import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

const isEmailConfigured =
  process.env.SMTP_USER &&
  process.env.SMTP_USER !== 'your-gmail@gmail.com' &&
  process.env.SMTP_PASS &&
  process.env.SMTP_PASS !== 'your-app-password-here';

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  if (!isEmailConfigured) {
    // Development fallback: log to console
    console.log('\n========== [BEDASOFT EMAIL SIMULATION] ==========');
    console.log(`TO:      ${to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${html.replace(/<[^>]*>/g, '')}`);
    console.log('=================================================\n');
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });

    console.log(`[BEDASOFT EMAIL] Sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('[BEDASOFT EMAIL] Send error:', error);
    return false;
  }
}

export function buildPasswordResetEmail(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña – Bedasoft IA</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:'Arial',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:40px 20px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d0d1a,#0a0a15);border:1px solid rgba(0,242,254,0.15);border-radius:20px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,rgba(0,242,254,0.08),rgba(118,75,162,0.08));padding:40px;text-align:center;border-bottom:1px solid rgba(0,242,254,0.1);">
            <p style="color:rgba(0,242,254,0.6);font-size:10px;letter-spacing:6px;text-transform:uppercase;margin:0 0 12px;">BEDASOFT IA SYSTEM</p>
            <h1 style="color:#fff;font-size:28px;margin:0;font-weight:900;letter-spacing:2px;">RECOVERY PROTOCOL</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 24px;">
              Hola <strong style="color:#fff;">${name || 'Agente'}</strong>,
            </p>
            <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;margin:0 0 32px;">
              Hemos recibido una solicitud de recuperación de contraseña para tu cuenta en Bedasoft IA. Haz clic en el botón para establecer una nueva contraseña. Este enlace expira en <strong style="color:#00f2fe;">1 hora</strong>.
            </p>
            <div style="text-align:center;margin:36px 0;">
              <a href="${resetUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00f2fe,#764ba2);color:#050508;font-weight:900;font-size:13px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;border-radius:12px;box-shadow:0 10px 30px rgba(0,242,254,0.25);">
                RESTABLECER CONTRASEÑA
              </a>
            </div>
            <p style="color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;margin:24px 0 0;">
              Si no solicitaste este cambio, puedes ignorar este correo con total seguridad. Tu cuenta permanece protegida.
            </p>
            <div style="margin-top:24px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
              <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;word-break:break-all;">
                O copia este enlace en tu navegador:<br/>
                <span style="color:rgba(0,242,254,0.5);">${resetUrl}</span>
              </p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(255,255,255,0.2);font-size:10px;letter-spacing:4px;text-transform:uppercase;margin:0;">
              © 2026 BEDASOFT IA SYSTEMS S.L. — contact@bedasoft.ai
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
