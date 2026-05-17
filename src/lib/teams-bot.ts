import { 
  ActivityHandler, 
  MessageFactory, 
  TurnContext,
  TeamsInfo
} from 'botbuilder';
import prisma from './prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeBedasoftStructure, uploadClientToSharePoint, uploadInvoiceToSharePoint, createListItem } from './microsoft-graph';
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
   - NONE: {}

3. Para CREATE_INVOICE: extrae el número de pedido (numPedido). Si falta, PÍDELO.

4. Responde en español profesional.
5. Indica siempre que los cambios se sincronizan en SHAREPOINT.
`;

export class BedasoftTeamsBot extends ActivityHandler {
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
          console.log(`[TeamsBot] [TeamsInfo] Resolviendo email desde miembro de Teams: ${userEmail}`);
        } catch (e) {
          console.error(`[TeamsBot] [TeamsInfo] Error al obtener miembro de Teams:`, e);
        }
      }

      // Si estamos probando en el Web Chat de Azure o en el Emulador, simulamos el primer usuario de la base de datos
      // para permitirte probar la IA y la facturación neural directamente sin estar aún dentro de Teams.
      if (!userEmail && (context.activity.channelId === 'webchat' || context.activity.channelId === 'emulator')) {
        const firstUser = await prisma.user.findFirst();
        if (firstUser) {
          userEmail = firstUser.email;
          console.log(`[TeamsBot] [WebChat/Emulator] Simulando contexto del usuario corporativo: ${userEmail}`);
        }
      }
      
      console.log(`[TeamsBot] Mensaje de: ${userEmail}: ${text}`);

      if (!userEmail) {
        await context.sendActivity("No he podido identificar tu cuenta corporativa. Asegúrate de estar usando tu cuenta de la organización.");
        return await next();
      }

      // 1. Verificar usuario en BD
      const user = await prisma.user.findUnique({ where: { email: userEmail } });
      if (!user) {
        await context.sendActivity("No tienes una cuenta activa en el sistema Bedasoft IA. Por favor, regístrate en el portal primero.");
        return await next();
      }

      // 2. Obtener contexto de clientes
      const clients = await prisma.client.findMany({ where: { userId: user.id } });
      const clientList = clients.map(c => `- ${c.name}`).join('\n');

      // 3. Procesar con Gemini
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY?.replace(/"/g, '') || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        
        const chat = model.startChat({
          history: [
            { role: 'user', parts: [{ text: SYSTEM_PROMPT.replace('{{CLIENT_LIST}}', clientList) }] },
            { role: 'model', parts: [{ text: 'Entendido. Estoy listo en Teams.' }] }
          ]
        });

        const result = await chat.sendMessage(text);
        const aiResponse = result.response.text();

        // Parsear Acción
        let friendlyText = aiResponse;
        const actionMatch = aiResponse.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
        
        if (actionMatch) {
          friendlyText = aiResponse.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/, '').trim();
          const actionData = JSON.parse(actionMatch[1].trim());

          // EJECUTAR ACCIONES (Misma lógica que el chat web)
          if (actionData.intent === 'CREATE_CLIENT') {
             const d = actionData.data;
             const newClient = await prisma.client.create({
               data: { userId: user.id, name: d.name, cif: d.cif, address: d.address, email: d.email, phone: d.phone }
             });
             
             await initializeBedasoftStructure();
             const fileSpUrl = await uploadClientToSharePoint(newClient);
             
             // 1. Registrar en la Lista de SharePoint 'Clientes'
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
               console.warn('[TeamsBot] No se pudo insertar en la Lista de Clientes de SharePoint:', spError);
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

               // Generar y Subir PDF a la carpeta de SharePoint Drive
               const pdfBytes = await generateInvoicePDF(inv);
               const fileSpUrl = await uploadInvoiceToSharePoint(pdfBytes, `Factura-${inv.numFactura}.pdf`);
               
               // 2. Registrar en la Lista de SharePoint 'Facturas'
               let listSpUrl = fileSpUrl;
               try {
                 const spItem = await createListItem('Facturas', {
                   Title: numFactura,
                   Total: total,
                   Moneda: 'EUR',
                   FechaEmision: new Date().toISOString(),
                   Estado: 'Emitida',
                   NumPedido: numPedido || 'Pedido Teams',
                   SharePointUrl: fileSpUrl // Guardamos el enlace directo al PDF en la lista
                 });
                 if (spItem && spItem.webUrl) {
                   listSpUrl = spItem.webUrl;
                 }
               } catch (spError) {
                 console.warn('[TeamsBot] No se pudo insertar en la Lista de Facturas de SharePoint:', spError);
               }

               await prisma.invoice.update({ where: { id: inv.id }, data: { sharepointUrl: fileSpUrl } });

               friendlyText += `\n\n🚀 Factura **${numFactura}** generada y registrada en SharePoint.\n📄 Enlace directo al PDF: ${fileSpUrl}`;
             }
          }
        }

        await context.sendActivity(MessageFactory.text(friendlyText));

      } catch (err: any) {
        console.error("[BotError]", err);
        await context.sendActivity(`Lo siento, he tenido un error procesando tu solicitud neural: ${err.message}`);
      }

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      const welcomeText = '¡Hola! Soy el Agente Neural de Bedasoft IA. Estoy aquí para ayudarte con tu facturación directamente desde Teams. ¿En qué puedo ayudarte hoy?';
      for (let cnt = 0; cnt < (membersAdded?.length || 0); cnt++) {
        if (membersAdded![cnt].id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
        }
      }
      await next();
    });
  }
}
