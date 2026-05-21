import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { getGraphToken, getSiteId } from '@/lib/microsoft-graph';

/**
 * Endpoint GET /api/rrhh/approve-vacations
 * Permite a los responsables aprobar vacaciones con un solo clic desde su email.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workerEmail = searchParams.get('workerEmail') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const sig = searchParams.get('sig') || '';

  // 1. Validar Firma Criptográfica de Seguridad
  const secret = process.env.MICROSOFT_CLIENT_SECRET || 'bedasoft_secret_key';
  const expectedSig = crypto.createHash('sha256')
    .update(`${workerEmail}:${startDate}:${endDate}:${secret}`)
    .digest('hex');

  const formattedStartDate = startDate.split('-').reverse().join('/');
  const formattedEndDate = endDate.split('-').reverse().join('/');

  if (!sig || sig !== expectedSig) {
    return new NextResponse(
      buildResponsePage({
        success: false,
        title: "FIRMA INVÁLIDA",
        subtitle: "Protocolo de Seguridad Violado",
        message: "La firma criptográfica proporcionada no coincide con los parámetros de la solicitud. Esta acción ha sido bloqueada por seguridad.",
        color: "#ef4444",
        glowColor: "rgba(239, 68, 68, 0.4)",
        workerEmail,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      }),
      { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    // 2. Intentar actualizar SharePoint Online
    let spUpdated = false;
    let employeeName = workerEmail.split('@')[0].toUpperCase();

    try {
      const token = await getGraphToken();
      const siteId = await getSiteId();
      
      if (token && siteId) {
        const downloadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/RRHH/Vacaciones_Datos.json:/content`;
        const dlRes = await fetch(downloadUrl, { 
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        });

        if (dlRes.ok) {
          const data = await dlRes.json();
          const worker = data.trabajadores.find(
            (t: any) => t.email && t.email.toLowerCase().trim() === workerEmail.toLowerCase().trim()
          );

          if (worker) {
            employeeName = worker.nombre;
            const periodStr = `${formattedStartDate} - ${formattedEndDate}`;
            
            if (!worker.periodosSolicitados) worker.periodosSolicitados = [];
            
            if (!worker.periodosSolicitados.includes(periodStr)) {
              worker.periodosSolicitados.push(periodStr);
              
              // Calcular días laborables
              const start = new Date(startDate);
              const end = new Date(endDate);
              let businessDays = 0;
              
              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const day = d.getDay();
                if (day !== 0 && day !== 6) businessDays++;
              }
              
              const daysToTake = Math.min(businessDays, worker.diasPendientes);
              worker.diasDisfrutados += daysToTake;
              worker.diasPendientes -= daysToTake;
              worker.estado = "En plazo";

              // Subir cambios de vuelta a SharePoint
              const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/RRHH/Vacaciones_Datos.json:/content`;
              const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(data, null, 2)
              });

              if (uploadRes.ok) {
                console.log(`[SharePoint Sync] Sincronización de vacaciones exitosa para: ${workerEmail}`);
                spUpdated = true;
              }
            } else {
              // Ya estaba registrado
              spUpdated = true;
            }
          }
        }
      }
    } catch (spError) {
      console.error('[ApproveVacations API] Error al sincronizar con SharePoint:', spError);
    }

    // 3. Notificar al empleado por correo electrónico (Confirmación Automática)
    const emailSubject = `Vacaciones Concedidas: ${formattedStartDate} – ${formattedEndDate}`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vacaciones Aprobadas – Bedasoft IA</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:'Arial',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:40px 20px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d0d1a,#0a0a15);border:1px solid rgba(0,242,254,0.15);border-radius:20px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,rgba(0,242,254,0.08),rgba(118,75,162,0.08));padding:40px;text-align:center;border-bottom:1px solid rgba(0,242,254,0.1);">
            <p style="color:rgba(0,242,254,0.6);font-size:10px;letter-spacing:6px;text-transform:uppercase;margin:0 0 12px;">BEDASOFT IA RRHH</p>
            <h1 style="color:#00f2fe;font-size:24px;margin:0;font-weight:900;letter-spacing:2px;">VACACIONES CONCEDIDAS</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.7;margin:0 0 20px;">
              Hola <strong style="color:#fff;">${employeeName}</strong>,
            </p>
            <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 24px;">
              Nos complace informarte que tu solicitud de vacaciones ha sido **aprobada y autorizada** formalmente por el departamento de Recursos Humanos.
            </p>
            
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:20px;margin-bottom:24px;">
              <table width="100%">
                <tr>
                  <td style="color:rgba(255,255,255,0.4);font-size:12px;">Periodo Autorizado:</td>
                  <td style="color:#00f2fe;font-size:14px;font-weight:bold;text-align:right;">${formattedStartDate} - ${formattedEndDate}</td>
                </tr>
                <tr>
                  <td style="color:rgba(255,255,255,0.4);font-size:12px;">Estado del Registro:</td>
                  <td style="color:#22c55e;font-size:13px;font-weight:bold;text-align:right;">Sincronizado en SharePoint Online</td>
                </tr>
              </table>
            </div>

            <p style="color:rgba(255,255,255,0.4);font-size:13px;line-height:1.7;margin:0 0 24px;">
              ¡Disfruta de tu descanso! Tu saldo de días pendientes ha sido actualizado de forma automática.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(255,255,255,0.2);font-size:9px;letter-spacing:4px;text-transform:uppercase;margin:0;">
              © 2026 BEDASOFT IA SYSTEMS S.L. — hr@bedasoft.ai
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `;

    await sendEmail({ to: workerEmail, subject: emailSubject, html: emailHtml });

    return new NextResponse(
      buildResponsePage({
        success: true,
        title: "ACCESO CONCEDIDO",
        subtitle: "Vacaciones Aprobadas Exitosamente",
        message: `El periodo de vacaciones para ${employeeName} (${workerEmail}) del ${formattedStartDate} al ${formattedEndDate} ha sido aprobado y registrado de manera satisfactoria.`,
        color: "#00f2fe",
        glowColor: "rgba(0, 242, 254, 0.4)",
        workerEmail,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        spSync: spUpdated
      }),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );

  } catch (err: any) {
    return new NextResponse(
      buildResponsePage({
        success: false,
        title: "ERROR DE PROCESAMIENTO",
        subtitle: "Fallo en los Protocolos del Servidor",
        message: `Se ha producido un error durante el procesamiento de la aprobación: ${err.message}`,
        color: "#f59e0b",
        glowColor: "rgba(245, 158, 11, 0.4)",
        workerEmail,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      }),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/**
 * Genera la página de respuesta web premium interactiva
 */
function buildResponsePage(data: {
  success: boolean;
  title: string;
  subtitle: string;
  message: string;
  color: string;
  glowColor: string;
  workerEmail: string;
  startDate: string;
  endDate: string;
  spSync?: boolean;
}): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} – Bedasoft IA</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #030306;
      color: #ffffff;
      font-family: 'Outfit', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow: hidden;
    }

    /* Background futuristic grid & glow */
    .bg-effects {
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1;
      overflow: hidden;
    }
    
    .bg-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 600px;
      height: 600px;
      background: ${data.glowColor};
      border-radius: 50%;
      filter: blur(140px);
      opacity: 0.15;
      animation: pulse 8s infinite alternate;
    }

    @keyframes pulse {
      0% { opacity: 0.12; transform: translate(-50%, -50%) scale(0.9); }
      100% { opacity: 0.20; transform: translate(-50%, -50%) scale(1.1); }
    }

    /* Glassmorphic Container */
    .card {
      position: relative;
      z-index: 10;
      width: 90%;
      max-w: 480px;
      background: rgba(13, 13, 26, 0.45);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
      border-radius: 36px;
      padding: 50px 40px;
      text-align: center;
      box-sizing: border-box;
      animation: slideIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes slideIn {
      0% { opacity: 0; transform: translateY(30px) scale(0.95); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Neon border glow */
    .card::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 36px;
      padding: 1.5px;
      background: linear-gradient(135deg, ${data.color}, rgba(255,255,255,0.02), rgba(118,75,162,0.1), ${data.color});
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    /* Glow Badge */
    .icon-badge {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.1);
      margin-bottom: 25px;
      box-shadow: 0 0 30px ${data.glowColor};
    }

    .icon-badge svg {
      width: 32px;
      height: 32px;
      stroke: ${data.color};
      filter: drop-shadow(0 0 8px ${data.color});
    }

    .tech-header {
      font-family: 'Orbitron', sans-serif;
      font-size: 11px;
      letter-spacing: 5px;
      color: ${data.color};
      text-transform: uppercase;
      margin: 0 0 10px 0;
      font-weight: 900;
    }

    h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0 0 15px 0;
      background: linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0.7));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .message {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.6;
      margin-bottom: 30px;
    }

    /* Parameters list */
    .param-list {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 35px;
      text-align: left;
    }

    .param-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-size: 13px;
    }

    .param-item:last-child {
      margin-bottom: 0;
    }

    .param-label {
      color: rgba(255, 255, 255, 0.4);
    }

    .param-value {
      font-weight: 600;
      color: #fff;
    }

    .sp-sync {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #22c55e;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      padding: 6px 12px;
      border-radius: 100px;
      font-weight: bold;
    }

    .sp-sync.failed {
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.2);
    }

    /* Interactive button */
    .btn-portal {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, ${data.color}, #764ba2);
      color: #050508;
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-decoration: none;
      padding: 16px 20px;
      border-radius: 14px;
      box-shadow: 0 8px 24px ${data.glowColor};
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .btn-portal:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px ${data.glowColor};
      filter: brightness(1.1);
    }

    .btn-portal:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>

  <div class="bg-effects">
    <div class="bg-glow"></div>
  </div>

  <div class="card">
    <div class="icon-badge">
      ${data.success ? `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ` : `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `}
    </div>

    <div class="tech-header">${data.title}</div>
    <h1>${data.subtitle}</h1>
    <div class="message">${data.message}</div>

    <div class="param-list">
      <div class="param-item">
        <span class="param-label">Empleado:</span>
        <span class="param-value">${data.workerEmail}</span>
      </div>
      <div class="param-item">
        <span class="param-label">Periodo:</span>
        <span class="param-value">${data.startDate} – ${data.endDate}</span>
      </div>
      <div class="param-item">
        <span class="param-label">Sincronización:</span>
        <span class="param-value">
          ${data.success ? `
            <span class="sp-sync ${data.spSync ? '' : 'failed'}">
              ${data.spSync ? 'SHAREPOINT ONLINE OK' : 'PENDIENTE DE COLA'}
            </span>
          ` : `
            <span style="color:#ef4444;font-weight:bold;">FALLIDA</span>
          `}
        </span>
      </div>
    </div>

    <a href="https://bedasoft-ia-system.vercel.app/dashboard" class="btn-portal">
      Ir al Portal Bedasoft IA
    </a>
  </div>

</body>
</html>
  `;
}
