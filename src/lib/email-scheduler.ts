import prisma from './prisma';
import { sendEmail } from './email';
import { generateInvoicePDF } from './pdf-generator';

/**
 * Calcula la próxima ejecución basada en la hora proporcionada (ej: "10:00")
 * o por defecto suma 24 horas si no se detecta formato.
 */
export function calculateNextRun(cronExpr: string): Date {
  const now = new Date();
  const next = new Date();
  
  const match = cronExpr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    next.setHours(hours, minutes, 0, 0);
    
    // Si la hora ya pasó hoy, programar para mañana
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else {
    // Por defecto, sumamos 24 horas
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Construye la plantilla HTML premium para el envío de facturas
 */
function buildInvoiceEmailTemplate(invoice: any, user: any): string {
  const formattedTotal = Number(invoice.total || 0).toFixed(2);
  const clientName = invoice.client?.name || 'Cliente Bedasoft';
  const issueDate = new Date(invoice.issueDate).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura Electrónica ${invoice.numFactura} – Bedasoft IA</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:'Arial',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d0d1a,#0a0a15);border:1px solid rgba(0,242,254,0.15);border-radius:24px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,rgba(0,242,254,0.08),rgba(118,75,162,0.08));padding:40px;text-align:center;border-bottom:1px solid rgba(0,242,254,0.1);">
            <p style="color:rgba(0,242,254,0.6);font-size:10px;letter-spacing:6px;text-transform:uppercase;margin:0 0 12px;">BEDASOFT IA FACTURACIÓN</p>
            <h1 style="color:#fff;font-size:26px;margin:0;font-weight:900;letter-spacing:2px;">FACTURA ELECTRÓNICA</h1>
            <p style="color:#00f2fe;font-size:14px;font-family:monospace;letter-spacing:1px;margin:10px 0 0;">REF: ${invoice.numFactura}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.7;margin:0 0 24px;">
              Estimado cliente,
            </p>
            <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 24px;">
              Le adjuntamos la factura emitida por **Bedasoft IA** correspondiente a sus servicios activos. Los detalles resumidos se presentan a continuación:
            </p>
            
            <!-- Resumen Card -->
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:24px;margin-bottom:32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cliente:</td>
                  <td style="padding:6px 0;color:#fff;font-size:13px;font-weight:bold;text-align:right;">${clientName}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Fecha Emisión:</td>
                  <td style="padding:6px 0;color:#fff;font-size:13px;text-align:right;">${issueDate}</td>
                </tr>
                ${invoice.numPedido ? `
                <tr>
                  <td style="padding:6px 0;color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Nº Pedido:</td>
                  <td style="padding:6px 0;color:#fff;font-size:13px;text-align:right;">${invoice.numPedido}</td>
                </tr>
                ` : ''}
                <tr>
                  <td colspan="2" style="border-top:1px solid rgba(255,255,255,0.06);margin-top:12px;padding-top:12px;"></td>
                </tr>
                <tr>
                  <td style="color:#00f2fe;font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Importe Total:</td>
                  <td style="color:#00f2fe;font-size:18px;font-weight:900;text-align:right;">${formattedTotal} EUR</td>
                </tr>
              </table>
            </div>

            <!-- Botón de acción -->
            ${invoice.sharepointUrl ? `
            <div style="text-align:center;margin:32px 0;">
              <a href="${invoice.sharepointUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00f2fe,#764ba2);color:#050508;font-weight:900;font-size:12px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;border-radius:12px;box-shadow:0 10px 30px rgba(0,242,254,0.25);">
                VER PDF EN SHAREPOINT
              </a>
            </div>
            ` : ''}

            <p style="color:rgba(255,255,255,0.3);font-size:11px;line-height:1.6;margin:32px 0 0;text-align:center;">
              *Nota: Este correo se ha enviado de forma automatizada según la programación establecida en el sistema por el operador ${user.name || user.email}. Dispone de la factura oficial en formato PDF adjunta a este correo.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(255,255,255,0.2);font-size:9px;letter-spacing:4px;text-transform:uppercase;margin:0;">
              © 2026 BEDASOFT IA SYSTEMS S.L. — cloud-billing@bedasoft.ai
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;
}

/**
 * Procesa la cola de facturas programadas para su envío por email
 */
export async function processScheduledEmails(): Promise<number> {
  console.log('[Scheduler] Iniciando verificación de correos programados...');
  const now = new Date();
  
  try {
    // Buscar correos programados activos que deban ejecutarse ya
    const pendingEmails = await prisma.scheduledEmail.findMany({
      where: {
        active: true,
        nextRun: {
          lte: now
        }
      },
      include: {
        user: true
      }
    });

    if (pendingEmails.length === 0) {
      console.log('[Scheduler] No hay envíos programados pendientes.');
      return 0;
    }

    console.log(`[Scheduler] Encontrados ${pendingEmails.length} envíos programados para procesar.`);
    let processedCount = 0;

    for (const job of pendingEmails) {
      try {
        console.log(`[Scheduler] Procesando envío: Factura ${job.invoiceNum} para ${job.recipient}`);
        
        // Buscar factura en BD con sus líneas y cliente
        const invoice = await prisma.invoice.findFirst({
          where: {
            userId: job.userId,
            numFactura: job.invoiceNum
          },
          include: {
            client: true,
            lines: true
          }
        });

        if (!invoice) {
          console.error(`[Scheduler] Factura ${job.invoiceNum} no encontrada para el usuario ${job.userId}. Desactivando tarea.`);
          await prisma.scheduledEmail.update({
            where: { id: job.id },
            data: { active: false }
          });
          continue;
        }

        // Generar el PDF dinámicamente
        const pdfBytes = await generateInvoicePDF(invoice);
        
        // Construir la plantilla de correo
        const htmlContent = buildInvoiceEmailTemplate(invoice, job.user);
        
        // Enviar el correo con el PDF adjunto
        const sent = await sendEmail({
          to: job.recipient,
          subject: `Factura Electrónica ${invoice.numFactura} – Bedasoft IA`,
          html: htmlContent,
          attachments: [
            {
              filename: `Factura-${invoice.numFactura}.pdf`,
              content: Buffer.from(pdfBytes),
              contentType: 'application/pdf'
            }
          ]
        });

        if (sent) {
          console.log(`[Scheduler] Correo enviado con éxito a ${job.recipient}`);
          processedCount++;
          
          // Calcular la siguiente ejecución
          const nextRunTime = calculateNextRun(job.cronExpr);
          
          // Actualizar el estado de la programación en BD
          await prisma.scheduledEmail.update({
            where: { id: job.id },
            data: {
              nextRun: nextRunTime
            }
          });
          console.log(`[Scheduler] Tarea reprogramada para: ${nextRunTime.toISOString()}`);
        } else {
          console.error(`[Scheduler] Error al enviar correo para la tarea ${job.id}. Se reintentará en el próximo ciclo.`);
        }

      } catch (jobErr) {
        console.error(`[Scheduler] Error crítico procesando tarea ${job.id}:`, jobErr);
      }
    }

    return processedCount;

  } catch (err) {
    console.error('[Scheduler] Error general procesando correos programados:', err);
    return 0;
  }
}
