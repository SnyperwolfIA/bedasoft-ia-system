export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAIChatCompletion } from '@/lib/ai-service';
import { initializeBedasoftStructure, uploadClientToSharePoint, uploadInvoiceToSharePoint } from '@/lib/microsoft-graph';
import { generateInvoicePDF } from '@/lib/pdf-generator';

const SYSTEM_PROMPT = `
Eres el Asistente Neural de Facturación de Bedasoft IA. Ayudas a gestionar clientes y facturas.

REGLAS ABSOLUTAS:
1. SIEMPRE termina tu respuesta con una etiqueta JSON en este formato EXACTO:
   [ACTION]{"intent":"NOMBRE_INTENT","data":{...}}[/ACTION]

2. Intents disponibles:
   - GREETING: Para saludos. data: {}
   - HELP: Para ayuda general. data: {}
   - CREATE_CLIENT: Para crear un cliente. data: {name, cif, address, postalCode, city, phone, email}
   - CREATE_INVOICE: Para crear una factura. data: {clientName, numPedido, lines:[{description, quantity, unitPrice}]}
   - LIST_CLIENTS: Para listar clientes. data: {}
   - LIST_INVOICES: Para listar facturas. data: {}
   - NONE: Para conversación sin acción. data: {}

3. Para CREATE_INVOICE: extrae el número de pedido (numPedido) si el usuario lo menciona (ej: "pedido 123", "orden ABC"). También extrae TODAS las líneas del mensaje.

4. Responde siempre en español de forma natural y profesional.
5. Si el usuario quiere crear una factura pero no ha dado líneas de conceptos, pídelas.
6. Si falta el número de pedido (numPedido), PÍDELO explícitamente antes de confirmar la creación, o indica que lo necesitas para proceder.
7. Si el usuario quiere crear una factura para un cliente que NO está en la lista de clientes conocidos, infórmale y pídele los datos del cliente.

CLIENTES CONOCIDOS DEL USUARIO:
{{CLIENT_LIST}}
`;

export async function POST(req: NextRequest) {
  try {
    const { message, userEmail, history } = await req.json();
    
    // 1. Verificar usuario
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ response: 'Sesión no válida.', action: null });

    // 2. Obtener clientes del usuario para contexto
    const clients = await prisma.client.findMany({ where: { userId: user.id } });
    const clientList = clients.length > 0
      ? clients.map(c => `- ${c.name}${c.cif ? ` (CIF: ${c.cif})` : ''}`).join('\n')
      : 'Ninguno registrado aún.';

    // 3. Obtener respuesta del Copilot / AI Service
    const systemWithContext = SYSTEM_PROMPT.replace('{{CLIENT_LIST}}', clientList);
    const aiResponse = await getAIChatCompletion(systemWithContext, message, history || []);

    // 4. Parsear la respuesta
    let friendlyText = aiResponse;
    let actionData: any = { intent: 'NONE', data: {} };

    const actionMatch = aiResponse.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
    if (actionMatch) {
      friendlyText = aiResponse.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/, '').trim();
      try {
        actionData = JSON.parse(actionMatch[1].trim());
      } catch (e) {
        console.error('Error parseando ACTION JSON:', e);
      }
    }

    // 5. Ejecutar acciones en DB
    let actionTriggered: string | null = null;

    if (actionData.intent === 'CREATE_CLIENT') {
      const d = actionData.data;
      try {
        const existing = await prisma.client.findFirst({
          where: { userId: user.id, name: d.name }
        });
        if (existing) {
          friendlyText += '\n\n⚠️ **SISTEMA**: Este cliente ya está registrado.';
        } else {
          const newClient = await prisma.client.create({
            data: {
              userId: user.id,
              name: d.name || 'Nuevo Cliente',
              cif: d.cif || null,
              address: d.address || null,
              postalCode: d.postalCode || null,
              city: d.city || null,
              email: d.email || null,
              phone: d.phone || null,
            }
          });
          friendlyText += `\n\n✅ **SISTEMA**: Cliente **${newClient.name}** registrado con éxito.`;
          actionTriggered = 'CLIENT_CREATED';

          // Sincronizar con SharePoint
          try {
            await initializeBedasoftStructure();
            const sharepointUrl = await uploadClientToSharePoint(newClient);
            await prisma.client.update({
              where: { id: newClient.id },
              data: { sharepointUrl }
            });
            friendlyText += `\n📂 **NODO**: Datos maestros sincronizados en SharePoint (Carpeta Clientes).`;
          } catch (spErr) {
            console.error('Error SharePoint Cliente:', spErr);
          }
        }
      } catch (e: any) {
        friendlyText += `\n\n❌ Error al crear cliente: ${e.message}`;
      }
    }

    if (actionData.intent === 'CREATE_INVOICE') {
      const { clientName, numPedido, lines } = actionData.data;

      let client = null;
      if (clientName) {
        client = await prisma.client.findFirst({
          where: {
            userId: user.id,
            name: { contains: clientName }
          }
        });
      }

      if (!client && clientName) {
        friendlyText += `\n\n⚠️ **SISTEMA**: No encuentro al cliente **${clientName}** en tu base de datos. Regístralo primero con sus datos (CIF, dirección, etc.).`;
      } else if (!lines || lines.length === 0) {
        friendlyText += '\n\n⚠️ **SISTEMA**: No he podido extraer los conceptos de la factura. Por favor, especifica descripción, cantidad y precio.';
      } else {
        try {
          const total = lines.reduce((acc: number, l: any) => acc + ((l.quantity || 1) * (l.unitPrice || 0)), 0);
          
          // Calcular número correlativo
          const count = await prisma.invoice.count({ where: { userId: user.id } });
          const numFactura = `FAC-${String(count + 1).padStart(3, '0')}`;

          const inv = await prisma.invoice.create({
            data: {
              userId: user.id,
              clientId: client?.id || null,
              numFactura: numFactura,
              numPedido: numPedido || null,
              total,
              lines: {
                create: lines.map((l: any) => ({
                  description: l.description,
                  quantity: l.quantity || 1,
                  unitPrice: l.unitPrice || 0,
                  totalPrice: (l.quantity || 1) * (l.unitPrice || 0)
                }))
              }
            }
          });
          friendlyText += `\n\n🚀 **SISTEMA**: Factura **${inv.numFactura}** generada. Total: **${total.toFixed(2)}€**.`;
          actionTriggered = 'INVOICE_CREATED';

          // Sincronización Inmediata con SharePoint (PDF)
          try {
            await initializeBedasoftStructure();
            // Recargar factura con líneas para el PDF
            const fullInvoice = await prisma.invoice.findUnique({
              where: { id: inv.id },
              include: { client: true, lines: true }
            });
            
            if (fullInvoice) {
              const pdfBytes = await generateInvoicePDF(fullInvoice);
              const sharepointUrl = await uploadInvoiceToSharePoint(pdfBytes, `Factura-${fullInvoice.numFactura}.pdf`);
              
              await prisma.invoice.update({
                where: { id: inv.id },
                data: { sharepointUrl }
              });
              friendlyText += `\n📂 **NODO**: Documento PDF generado y sincronizado en SharePoint.`;
            }
          } catch (spErr) {
            console.error('Error SharePoint Factura:', spErr);
            friendlyText += `\n⚠️ **SISTEMA**: Factura creada pero hubo un error al subir a SharePoint.`;
          }
        } catch (e: any) {
          friendlyText += `\n\n❌ Error al crear factura: ${e.message}`;
        }
      }
    }

    if (actionData.intent === 'LIST_CLIENTS') {
      const cs = await prisma.client.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } });
      if (cs.length === 0) {
        friendlyText += '\n\nNo tienes clientes registrados todavía.';
      } else {
        friendlyText += '\n\n**Tus clientes:**\n' + cs.map(c =>
          `• **${c.name}**${c.cif ? ` — CIF: ${c.cif}` : ''}${c.city ? ` — ${c.city}` : ''}`
        ).join('\n');
      }
      actionTriggered = 'LIST_REFRESH';
    }

    if (actionData.intent === 'LIST_INVOICES') {
      const ins = await prisma.invoice.findMany({
        where: { userId: user.id },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      if (ins.length === 0) {
        friendlyText += '\n\nNo hay facturas registradas todavía.';
      } else {
        friendlyText += '\n\n**Últimas facturas:**\n' + ins.map(i =>
          `• **${i.numFactura}** — ${i.client?.name || 'Venta directa'}: ${i.total.toFixed(2)}€`
        ).join('\n');
      }
      actionTriggered = 'LIST_REFRESH';
    }

    return NextResponse.json({ response: friendlyText, action: actionTriggered });

  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({
      response: `Error procesando tu solicitud. Detalles técnicos: ${error.message}`,
      action: null
    });
  }
}
