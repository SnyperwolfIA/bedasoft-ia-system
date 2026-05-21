import { 
  ActivityHandler, 
  MessageFactory, 
  TurnContext,
  TeamsInfo
} from 'botbuilder';
import prisma from './prisma';
import { getAIChatCompletion } from './ai-service';
import { sendEmail } from './email';

const SYSTEM_PROMPT = `
Eres el Asistente Neural de Mailing de Bedasoft IA operando desde MICROSOFT TEAMS. Ayudas a los empleados a redactar y enviar correos electrónicos de forma remota a otros contactos o compañeros de la organización.

REGLAS ABSOLUTAS:
1. SIEMPRE termina tu respuesta con una etiqueta JSON en este formato EXACTO:
   [ACTION]{"intent":"NOMBRE_INTENT","data":{...}}[/ACTION]

2. Intents disponibles:
   - SEND_EMAIL: { recipientNameOrEmail: string, subject: string, body: string }
   - NONE: {}

3. Para SEND_EMAIL:
   - Extrae el nombre, apellidos o dirección de correo electrónico del destinatario (recipientNameOrEmail).
   - Extrae el asunto (subject). Si falta, créale uno profesional y conciso acorde al mensaje.
   - Extrae el contenido o mensaje principal (body).
   - Si no tienes datos suficientes para redactar o enviar el email (por ejemplo, falta el destinatario o el mensaje principal), pídelo amablemente al usuario y utiliza el intent NONE hasta tener toda la información.

4. Responde en español profesional.
5. Indica siempre que el correo se envía a través de los servidores corporativos seguros de Bedasoft IA.
`;

// Verifica si el usuario existe en BD o lo auto-registra si es dominio corporativo
async function getOrCreateUser(userEmail: string) {
  const isAuthorizedDomain = (email: string) => {
    const lower = email.toLowerCase();
    return (
      lower.endsWith('@bedasoft.es') ||
      lower.endsWith('@bedasoft.ai') ||
      lower.endsWith('@bedasoft.onmicrosoft.com') ||
      lower.endsWith('@outlook.com') ||
      lower.endsWith('@outlook.es') ||
      lower.endsWith('@hotmail.com') ||
      lower.endsWith('@hotmail.es') ||
      lower.endsWith('@live.com') ||
      lower.endsWith('@live.es') ||
      lower.endsWith('@gmail.com')
    );
  };

  let user = await prisma.user.findUnique({ where: { email: userEmail } });
  
  if (!user && isAuthorizedDomain(userEmail)) {
    try {
      let company = await prisma.company.findFirst({ where: { name: 'Bedasoft' } });
      if (!company) {
        company = await prisma.company.create({
          data: { name: 'Bedasoft', licenseKey: 'LIC-BEDASOFT', status: 'active' }
        });
      }
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: userEmail.split('@')[0].toUpperCase(),
          password: 'SSO_BYPASS_PASSWORD',
          activeModules: 'facturacion,jira,rrhh,mailing', // Por defecto con mailing
          companyId: company.id,
          emailVerified: true
        }
      });
      console.log(`[MailingBot Auto-Register] Usuario creado: ${userEmail}`);
    } catch (dbErr: any) {
      console.error('[MailingBot Auto-Register] Error en DB:', dbErr);
    }
  }
  
  return user;
}

export class BedasoftMailingTeamsBot extends ActivityHandler {
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
          console.log(`[MailingBot] [TeamsInfo] Resolviendo email desde miembro de Teams: ${userEmail}`);
        } catch (e) {
          console.error(`[MailingBot] [TeamsInfo] Error al obtener miembro de Teams:`, e);
        }
      }

      // Si estamos probando en el Web Chat de Azure o en el Emulador, simulamos el primer usuario de la base de datos
      if (!userEmail && (context.activity.channelId === 'webchat' || context.activity.channelId === 'emulator')) {
        const firstUser = await prisma.user.findFirst();
        if (firstUser) {
          userEmail = firstUser.email;
          console.log(`[MailingBot] [WebChat/Emulator] Simulando contexto del usuario corporativo: ${userEmail}`);
        }
      }
      
      console.log(`[MailingBot] Mensaje de: ${userEmail}: ${text}`);

      if (!userEmail) {
        await context.sendActivity("No he podido identificar tu cuenta corporativa. Asegúrate de estar usando tu cuenta de la organización.");
        return await next();
      }

      // 1. Obtener o auto-registrar usuario
      const user = await getOrCreateUser(userEmail);
      if (!user) {
        await context.sendActivity("No tienes una cuenta activa en el sistema Bedasoft IA. Por favor, regístrate en el portal primero.");
        return await next();
      }

      // Verificar si el módulo Mailing está activo para el usuario
      const activeModules = user.activeModules || '';
      const modules = activeModules.split(',').map((m: string) => m.trim()).filter(Boolean);
      if (!modules.includes('mailing')) {
        await context.sendActivity("Acceso Denegado: No tienes activo el módulo de Mailing. Solicita su activación a tu administrador en el panel de control.");
        return await next();
      }

      // 2. Procesar con AI Service
      try {
        const aiResponse = await getAIChatCompletion(SYSTEM_PROMPT, text, []);

        let friendlyText = aiResponse;
        let actionData: any = { intent: 'NONE', data: {} };
        const actionMatch = aiResponse.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
        
        if (actionMatch) {
          friendlyText = aiResponse.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/, '').trim();
          try {
            actionData = JSON.parse(actionMatch[1].trim());
          } catch (jsonErr) {
            console.error('[MailingBot] Error parseando ACTION JSON:', jsonErr);
          }

          if (actionData.intent === 'SEND_EMAIL') {
            const { recipientNameOrEmail, subject, body } = actionData.data;
            
            // Resolver destinatario
            let recipientEmail: string | null = null;
            let resolvedName: string | null = null;
            
            if (recipientNameOrEmail.includes('@')) {
              recipientEmail = recipientNameOrEmail.trim();
              resolvedName = recipientEmail!.split('@')[0];
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
                    resolvedName = worker.nombre;
                  }
                }
              } catch (spErr) {
                console.warn('[MailingBot] Falló búsqueda en SharePoint:', spErr);
              }
            }

            if (!recipientEmail) {
              friendlyText += `\n\n⚠️ No he podido resolver la dirección de correo electrónico para **"${recipientNameOrEmail}"** en el sistema de SharePoint. Por favor, indícame la dirección de correo directa (ejemplo: usuario@dominio.com) para poder realizar el envío.`;
            } else {
              // Proceder con el envío de correo usando diseño premium
              const cleanBody = body.replace(/\n/g, '<br/>');
              const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:'Arial',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d0d1a,#0a0a15);border:1px solid rgba(0,242,254,0.15);border-radius:20px;overflow:hidden;box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,rgba(0,242,254,0.08),rgba(118,75,162,0.08));padding:40px;text-align:center;border-bottom:1px solid rgba(0,242,254,0.1);">
            <p style="color:rgba(0,242,254,0.6);font-size:10px;letter-spacing:6px;text-transform:uppercase;margin:0 0 12px;">BEDASOFT IA MAILING</p>
            <h1 style="color:#fff;font-size:24px;margin:0;font-weight:900;letter-spacing:2px;text-transform:uppercase;">COMUNICADO CORPORATIVO</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.7;margin:0 0 24px;">
              Hola <strong style="color:#fff;">${resolvedName || 'Compañero'}</strong>,
            </p>
            <p style="color:rgba(255,255,255,0.7);font-size:14.5px;line-height:1.8;margin:0 0 32px;">
              Has recibido un mensaje corporativo importante enviado por <strong style="color:#00f2fe;">${user.name || userEmail}</strong> a través de nuestro Asistente de Mailing Integrado:
            </p>
            
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:24px;margin-bottom:32px;color:#fff;font-size:14px;line-height:1.7;">
              <h3 style="color:#00f2fe;margin-top:0;margin-bottom:16px;font-size:15px;border-bottom:1px solid rgba(0,242,254,0.1);padding-bottom:8px;">Asunto: ${subject}</h3>
              <p style="margin:0;color:rgba(255,255,255,0.95);">${cleanBody}</p>
            </div>
            
            <p style="color:rgba(255,255,255,0.35);font-size:11px;line-height:1.6;margin:24px 0 0;text-align:center;font-style:italic;">
              Este mensaje ha sido transmitido de manera automatizada y segura utilizando los servicios inteligentes de Bedasoft IA Systems.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:rgba(255,255,255,0.2);font-size:9px;letter-spacing:4px;text-transform:uppercase;margin:0;">
              © 2026 BEDASOFT IA SYSTEMS S.L. — mailing@bedasoft.ai
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
              `;

              const sent = await sendEmail({
                to: recipientEmail!,
                subject: `Mensaje de ${user.name || userEmail}: ${subject}`,
                html: emailHtml
              });

              if (sent) {
                friendlyText += `\n\n✅ **Correo enviado con éxito:** Se ha remitido el email a **${resolvedName || recipientEmail}** (${recipientEmail}) con el asunto "*${subject}*".`;
              } else {
                friendlyText += `\n\n⚠️ Hubo un problema al intentar enviar el email a **${recipientEmail}**. Por favor, inténtalo de nuevo en unos minutos.`;
              }
            }
          }
        }

        await context.sendActivity(MessageFactory.text(friendlyText));

      } catch (err: any) {
        console.error("[MailingBotError]", err);
        await context.sendActivity(`Lo siento, he tenido un error procesando tu consulta de mailing: ${err.message}`);
      }

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      const welcomeText = '¡Hola! Soy el Agente Neural de Mailing de Bedasoft IA. Estoy aquí para ayudarte a enviar correos electrónicos corporativos a tus compañeros y clientes directamente desde Teams. ¿A quién te gustaría escribir hoy?';
      for (let cnt = 0; cnt < (membersAdded?.length || 0); cnt++) {
        if (membersAdded![cnt].id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
        }
      }
      await next();
    });
  }
}
