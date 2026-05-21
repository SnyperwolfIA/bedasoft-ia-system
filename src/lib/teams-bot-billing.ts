import { 
  ActivityHandler, 
  MessageFactory, 
  TurnContext,
  TeamsInfo
} from 'botbuilder';
import prisma from './prisma';
import { getAIChatCompletion } from './ai-service';
import { initializeBedasoftStructure, uploadClientToSharePoint, uploadInvoiceToSharePoint, createListItem, getListItems } from './microsoft-graph';
import { generateInvoicePDF } from './pdf-generator';

const SYSTEM_PROMPT = `
Eres el Asistente Neural de Facturación de Bedasoft IA operando desde MICROSOFT TEAMS. Ayudas a gestionar clientes y facturas de forma remota.

REGLAS ABSOLUTAS:
1. SIEMPRE termina tu respuesta con una etiqueta JSON en este formato EXACTO:
   [ACTION]{"intent":"NOMBRE_INTENT","data":{...}}[/ACTION]

2. Intents disponibles:
   - CREATE_CLIENT: {name, cif, address, postalCode, city, phone, email}
   - CREATE_INVOICE: {clientName, numPedido, lines:[{description, quantity, unitPrice}]}
   - LIST_CLIENTS: {}
   - LIST_INVOICES: {}
   - SEND_INVOICE_EMAIL: {invoiceNumber, recipientNameOrEmail}
   - SCHEDULE_INVOICE_EMAIL: {invoiceNumber, recipientNameOrEmail, scheduleTime}
   - NONE: {}

3. Para CREATE_INVOICE: extrae el número de pedido (numPedido). Si falta, PÍDELO.

4. Para SEND_INVOICE_EMAIL: extrae el número de factura (invoiceNumber, ej: "FAC-T-001") y el destinatario (recipientNameOrEmail, ya sea un email directo o un nombre).
5. Para SCHEDULE_INVOICE_EMAIL: extrae el número de factura, el destinatario y la hora programada en formato HH:MM (scheduleTime, ej: "10:00").

6. Responde en español profesional.
7. Indica siempre que los cambios se sincronizan en SHAREPOINT.
`;

export class BedasoftBillingTeamsBot extends ActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const text = context.activity.text;
      let userEmail = context.activity.from.properties?.email || (context.activity.from as any).email;
      
      // Si el email es undefined y estamos en Teams, intentamos resolver el miembro
      if (!userEmail && context.activity.channelId === 'msteams') {
        try {
          const member = await TeamsInfo.getMember(context, context.activity.from.id);
          userEmail = member.userPrincipalName || member.email;
          console.log(`[BillingBot] [TeamsInfo] Resolviendo email desde miembro de Teams: ${userEmail}`);
        } catch (e) {
          console.error(`[BillingBot] [TeamsInfo] Error al obtener miembro de Teams:`, e);
        }
      }

      // Si estamos probando en el Web Chat de Azure o en el Emulador, simulamos el primer usuario de la base de datos
      if (!userEmail && (context.activity.channelId === 'webchat' || context.activity.channelId === 'emulator')) {
        const firstUser = await prisma.user.findFirst();
        if (firstUser) {
          userEmail = firstUser.email;
          console.log(`[BillingBot] [WebChat/Emulator] Simulando contexto del usuario corporativo: ${userEmail}`);
        }
      }
      
      console.log(`[BillingBot] Mensaje de: ${userEmail}: ${text}`);

      if (!userEmail) {
        await context.sendActivity("No he podido identificar tu cuenta corporativa. Asegúrate de estar usando tu cuenta de la organización.");
        return await next();
      }

      // 1. Verificar usuario en BD e invocar el planificador de envíos de correo programados
      try {
        const { processScheduledEmails } = require('./email-scheduler');
        await processScheduledEmails();
      } catch (schErr) {
        console.error('[BillingBot] Error al procesar correos programados:', schErr);
      }

      const user = await prisma.user.findUnique({ where: { email: userEmail } });
      if (!user) {
        await context.sendActivity("No tienes una cuenta activa en el sistema Bedasoft IA. Por favor, regístrate en el portal primero.");
        return await next();
      }

      // Verificar si el módulo Facturación está activo para el usuario
      const activeModules = user.activeModules || '';
      const modules = activeModules.split(',').map((m: string) => m.trim()).filter(Boolean);
      if (!modules.includes('facturacion')) {
        await context.sendActivity("Acceso Denegado: No tienes activo el módulo de Facturación. Solicita su activación a tu administrador en el panel de control.");
        return await next();
      }

      // 2. Obtener contexto de clientes
      const clients = await prisma.client.findMany({ where: { userId: user.id } });
      const clientList = clients.map(c => `- ${c.name}`).join('\n');

      // 3. Procesar con Copilot / AI Service
      try {
        const systemWithContext = SYSTEM_PROMPT.replace('{{CLIENT_LIST}}', clientList);
        const aiResponse = await getAIChatCompletion(systemWithContext, text, []);

        // Parsear Acción
        let friendlyText = aiResponse;
        let actionData: any = { intent: 'NONE', data: {} };
        const actionMatch = aiResponse.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
        
        if (actionMatch) {
          friendlyText = aiResponse.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/, '').trim();
          try {
            actionData = JSON.parse(actionMatch[1].trim());
          } catch (jsonErr) {
            console.error('[BillingBot] Error parseando ACTION JSON:', jsonErr);
          }

          // EJECUTAR ACCIONES
          if (actionData.intent === 'CREATE_CLIENT') {
             const d = actionData.data;
             const newClient = await prisma.client.create({
               data: { userId: user.id, name: d.name, cif: d.cif, address: d.address, email: d.email, phone: d.phone }
             });
             
             await initializeBedasoftStructure();
             const fileSpUrl = await uploadClientToSharePoint(newClient);
             
             let listSpUrl = fileSpUrl;
             try {
               const spItem = await createListItem('Clientes', {
                 Title: d.name,
                 CIF: d.cif || '',
                 Dirección: d.address || '',
                 Email: d.email || '',
                 Telefono: d.phone || '',
                 SharePointUrl: fileSpUrl
               });
               if (spItem && spItem.webUrl) {
                 listSpUrl = spItem.webUrl;
               }
             } catch (spError) {
               console.warn('[BillingBot] No se pudo insertar en la Lista de Clientes de SharePoint:', spError);
             }

             await prisma.client.update({ where: { id: newClient.id }, data: { sharepointUrl: listSpUrl } });
             friendlyText += `\n\n✅ Cliente registrado y sincronizado en la Lista y Drive de SharePoint: ${listSpUrl}`;
          }

          if (actionData.intent === 'CREATE_INVOICE') {
             const { clientName, numPedido, lines } = actionData.data;
             const client = await prisma.client.findFirst({ where: { userId: user.id, name: { contains: clientName } } });
             
             if (client && lines?.length > 0) {
               const total = lines.reduce((acc: number, l: any) => acc + (l.quantity * l.unitPrice), 0);
               const count = await prisma.invoice.count({ where: { userId: user.id } });
               const numFactura = `FAC-T-${String(count + 1).padStart(3, '0')}`;

               const inv = await prisma.invoice.create({
                 data: {
                   userId: user.id,
                   clientId: client.id,
                   numFactura,
                   numPedido,
                   total,
                   lines: { create: lines.map((l: any) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, totalPrice: l.quantity * l.unitPrice })) }
                 },
                 include: { client: true, lines: true }
               });

               const pdfBytes = await generateInvoicePDF(inv);
               const fileSpUrl = await uploadInvoiceToSharePoint(pdfBytes, `Factura-${inv.numFactura}.pdf`);
               
               let listSpUrl = fileSpUrl;
               try {
                 const spItem = await createListItem('Facturas', {
                   Title: numFactura,
                   Total: total,
                   Moneda: 'EUR',
                   FechaEmision: new Date().toISOString(),
                   Estado: 'Emitida',
                   NumPedido: numPedido || 'Pedido Teams',
                   SharePointUrl: fileSpUrl,
                   Cliente: client.name
                 });
                 if (spItem && spItem.webUrl) {
                   listSpUrl = spItem.webUrl;
                 }
               } catch (spError) {
                 console.warn('[BillingBot] No se pudo insertar en la Lista de Facturas de SharePoint:', spError);
               }

               await prisma.invoice.update({ where: { id: inv.id }, data: { sharepointUrl: fileSpUrl } });

               friendlyText += `\n\n🚀 Factura **${numFactura}** generada y registrada en SharePoint.\n📄 Enlace directo al PDF: ${fileSpUrl}`;
             } else {
               friendlyText += `\n\n⚠️ No se ha podido crear la factura porque el cliente **${clientName}** no existe en el sistema. Regístralo primero con 'crear cliente'.`;
             }
          }

          if (actionData.intent === 'SEND_INVOICE_EMAIL' || actionData.intent === 'SCHEDULE_INVOICE_EMAIL') {
             const { invoiceNumber, recipientNameOrEmail, scheduleTime } = actionData.data;
             const isSend = actionData.intent === 'SEND_INVOICE_EMAIL';
             
             // 1. Verificar módulo de mailing
             const userModules = user.activeModules || '';
             const userModulesArr = userModules.split(',').map((m: string) => m.trim()).filter(Boolean);
             
             if (!userModulesArr.includes('mailing')) {
                friendlyText += `\n\n⚠️ **Acceso Denegado:** No tienes activo el módulo de Mailing. Solicita su activación a tu administrador en el panel de control.`;
             } else {
                // 2. Buscar factura
                const invoice = await prisma.invoice.findFirst({
                  where: {
                    userId: user.id,
                    numFactura: {
                      contains: invoiceNumber
                    }
                  },
                  include: { client: true, lines: true }
                });

                if (!invoice) {
                   friendlyText += `\n\n⚠️ No he podido encontrar ninguna factura coincidente con **${invoiceNumber}** en tus registros.`;
                } else {
                   // 3. Resolver destinatario
                   let recipientEmail: string | null = null;
                   
                   if (recipientNameOrEmail.includes('@')) {
                      recipientEmail = recipientNameOrEmail.trim();
                   } else {
                      // Buscar en clientes del usuario
                      const matchingClient = await prisma.client.findFirst({
                        where: {
                          userId: user.id,
                          name: {
                            contains: recipientNameOrEmail
                          }
                        }
                      });
                      if (matchingClient && matchingClient.email) {
                         recipientEmail = matchingClient.email;
                      } else {
                         // Buscar en plantilla de empleados de SharePoint
                         try {
                            const { getGraphToken, getSiteId } = require('./microsoft-graph');
                            const token = await getGraphToken();
                            const siteId = await getSiteId();
                            const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/RRHH/Vacaciones_Datos.json:/content`;
                            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                            if (res.ok) {
                              const data = await res.json();
                              const worker = data.trabajadores.find((t: any) =>
                                t.nombre.toLowerCase().includes(recipientNameOrEmail.toLowerCase())
                              );
                              if (worker && worker.email) {
                                recipientEmail = worker.email;
                              }
                            }
                         } catch (spErr) {
                            console.warn('[BillingBot] Falló búsqueda en SharePoint:', spErr);
                         }
                      }
                   }

                   if (!recipientEmail) {
                      friendlyText += `\n\n⚠️ No he podido resolver la dirección de correo electrónico para **"${recipientNameOrEmail}"**. Por favor, indícame su email directamente.`;
                   } else {
                      if (isSend) {
                         // Realizar el envío inmediato
                         try {
                            const pdfBytes = await generateInvoicePDF(invoice);
                            const { sendEmail } = require('./email');
                            
                            const formattedTotal = Number(invoice.total || 0).toFixed(2);
                            const clientName = invoice.client?.name || 'Cliente';
                            const issueDate = new Date(invoice.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                            
                            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Factura Electrónica ${invoice.numFactura}</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:sans-serif;color:#fff;">
  <div style="background:#050508;padding:40px 20px;text-align:center;">
    <div style="max-width:540px;margin:0 auto;background:linear-gradient(135deg,#0d0d1a,#0a0a15);border:1px solid rgba(0,242,254,0.15);border-radius:20px;padding:40px;text-align:left;">
      <h2 style="color:#00f2fe;margin-top:0;font-size:22px;letter-spacing:1px;">FACTURA ELECTRÓNICA</h2>
      <p style="color:rgba(255,255,255,0.6);font-size:14px;">Estimado cliente, le adjuntamos la factura correspondiente a sus servicios activos.</p>
      
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:20px;margin:25px 0;">
        <table width="100%" style="font-size:13px;line-height:2;">
          <tr><td style="color:rgba(255,255,255,0.4);">Cliente:</td><td style="text-align:right;font-weight:bold;color:#fff;">${clientName}</td></tr>
          <tr><td style="color:rgba(255,255,255,0.4);">Factura:</td><td style="text-align:right;color:#fff;">${invoice.numFactura}</td></tr>
          <tr><td style="color:rgba(255,255,255,0.4);">Fecha:</td><td style="text-align:right;color:#fff;">${issueDate}</td></tr>
          <tr><td style="color:#00f2fe;font-weight:bold;">Total:</td><td style="text-align:right;color:#00f2fe;font-weight:bold;font-size:16px;">${formattedTotal} EUR</td></tr>
        </table>
      </div>
      
      ${invoice.sharepointUrl ? `
      <div style="text-align:center;margin:30px 0;">
        <a href="${invoice.sharepointUrl}" style="display:inline-block;padding:14px 30px;background:linear-gradient(135deg,#00f2fe,#764ba2);color:#050508;font-weight:bold;text-decoration:none;border-radius:10px;text-transform:uppercase;font-size:11px;letter-spacing:1px;">Descargar Factura</a>
      </div>
      ` : ''}
      
      <p style="color:rgba(255,255,255,0.3);font-size:10px;margin-top:30px;text-align:center;">Bedasoft IA Cloud Billing System. La factura oficial se encuentra adjunta a este correo en formato PDF.</p>
    </div>
  </div>
</body>
</html>
                            `;

                            const sent = await sendEmail({
                              to: recipientEmail,
                              subject: `Factura Electrónica ${invoice.numFactura} – Bedasoft IA`,
                              html: emailHtml,
                              attachments: [
                                {
                                  filename: `Factura-${invoice.numFactura}.pdf`,
                                  content: Buffer.from(pdfBytes),
                                  contentType: 'application/pdf'
                                }
                              ]
                            });

                            if (sent) {
                               friendlyText += `\n\n📧 **Factura enviada:** Se ha enviado la factura **${invoice.numFactura}** al correo **${recipientEmail}** con el archivo PDF adjunto.`;
                            } else {
                               friendlyText += `\n\n⚠️ No se pudo enviar el correo electrónico con la factura.`;
                            }

                         } catch (sendErr: any) {
                            console.error('[BillingBot] Error enviando factura:', sendErr);
                            friendlyText += `\n\n⚠️ Error al procesar el envío inmediato de la factura.`;
                         }
                      } else {
                         // Realizar la programación del envío
                         try {
                            const { calculateNextRun } = require('./email-scheduler');
                            const nextRun = calculateNextRun(scheduleTime);
                            
                            await prisma.scheduledEmail.create({
                              data: {
                                userId: user.id,
                                invoiceNum: invoice.numFactura,
                                recipient: recipientEmail,
                                cronExpr: scheduleTime,
                                nextRun
                              }
                            });

                            friendlyText += `\n\n📅 **Planificación Registrada:** Se ha programado el envío automático de la factura **${invoice.numFactura}** a **${recipientEmail}** para todos los días a las **${scheduleTime}**.\n*Próxima ejecución:* ${nextRun.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} del ${nextRun.toLocaleDateString('es-ES')}`;

                         } catch (schedErr: any) {
                            console.error('[BillingBot] Error al registrar programación:', schedErr);
                            friendlyText += `\n\n⚠️ Error al programar la factura en la base de datos.`;
                         }
                      }
                   }
                }
             }
          }

          if (actionData.intent === 'LIST_CLIENTS') {
             try {
                const listItems = await getListItems('Clientes');
                if (listItems && listItems.length > 0) {
                   friendlyText += '\n\n**📋 Clientes registrados en SharePoint:**\n' + listItems.map((item: any) =>
                     `• **${item.fields.Title}**${item.fields.CIF ? ` — CIF: ${item.fields.CIF}` : ''}${item.fields.Email ? ` — ${item.fields.Email}` : ''}`
                   ).join('\n');
                } else {
                   friendlyText += '\n\nNo tienes clientes registrados en la lista de SharePoint todavía.';
                }
             } catch (spErr) {
                console.warn('[BillingBot] Falló la carga de clientes desde SharePoint, usando local:', spErr);
                const cs = await prisma.client.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } });
                if (cs.length === 0) {
                  friendlyText += '\n\nNo tienes clientes registrados todavía.';
                } else {
                  friendlyText += '\n\n**Tus clientes en el sistema (local):**\n' + cs.map(c =>
                    `• **${c.name}**${c.cif ? ` — CIF: ${c.cif}` : ''}${c.email ? ` — ${c.email}` : ''}`
                  ).join('\n');
                }
             }
          }

          if (actionData.intent === 'LIST_INVOICES') {
             try {
                const listItems = await getListItems('Facturas');
                if (listItems && listItems.length > 0) {
                   friendlyText += '\n\n**📋 Facturas registradas en SharePoint:**\n' + listItems.map((item: any) =>
                     `• **${item.fields.Title}**${item.fields.Cliente ? ` — ${item.fields.Cliente}` : ''}: **${Number(item.fields.Total || 0).toFixed(2)}€** _(${item.fields.Estado || 'Emitida'})_${item.fields.SharePointUrl ? ` — [Ver PDF](${item.fields.SharePointUrl})` : ''}`
                   ).join('\n');
                } else {
                   friendlyText += '\n\nNo hay facturas registradas en la lista de SharePoint todavía.';
                }
             } catch (spErr) {
                console.warn('[BillingBot] Falló la carga de facturas desde SharePoint, usando local:', spErr);
                const ins = await prisma.invoice.findMany({
                  where: { userId: user.id },
                  include: { client: true },
                  orderBy: { createdAt: 'desc' },
                  take: 10
                });
                if (ins.length === 0) {
                  friendlyText += '\n\nNo hay facturas registradas en el sistema todavía.';
                } else {
                  friendlyText += '\n\n**📋 Listado de facturas (local):**\n' + ins.map(i =>
                    `• **${i.numFactura}** — ${i.client?.name || 'Venta directa'}: **${i.total.toFixed(2)}€** _(${i.status})_${i.sharepointUrl ? ` — [Ver PDF in SharePoint](${i.sharepointUrl})` : ''}`
                  ).join('\n');
                }
             }
          }
        }

        await context.sendActivity(MessageFactory.text(friendlyText));

      } catch (err: any) {
        console.error("[BillingBotError]", err);
        await context.sendActivity(`Lo siento, he tenido un error procesando tu solicitud neural: ${err.message}`);
      }

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      const welcomeText = '¡Hola! Soy el Agente de Facturación Bedasoft IA. Estoy aquí para ayudarte a registrar clientes y emitir facturas en SharePoint directamente desde Teams. ¿En qué puedo ayudarte hoy?';
      for (let cnt = 0; cnt < (membersAdded?.length || 0); cnt++) {
        if (membersAdded![cnt].id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
        }
      }
      await next();
    });
  }
}
