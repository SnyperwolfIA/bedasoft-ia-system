import { 
  ActivityHandler, 
  MessageFactory, 
  TurnContext,
  TeamsInfo
} from 'botbuilder';
import prisma from './prisma';
import { getAIChatCompletion } from './ai-service';
import { getGraphToken, getSiteId } from './microsoft-graph';

const SYSTEM_PROMPT = `
Eres el Asistente Neural de Recursos Humanos (RRHH) de Bedasoft IA operando desde MICROSOFT TEAMS. Tu misión es asistir a los empleados y gestores con consultas sobre normativa interna, convenios, nóminas y vacaciones.

CONVENIO COLECTIVO Y REGLAS DE VACACIONES DE BEDASOFT:
El sistema utiliza las reglas del Convenio Colectivo Estatal TIC.
- Días base de vacaciones: 22 días laborables (mínimo legal).
- Antigüedad ≥ 15 años: 25 días laborables.
- Antigüedad ≥ 20 años: 26 días laborables.

CONTEXTO DE DOCUMENTACIÓN DE SHAREPOINT:
A continuación se te proporcionan extractos de los documentos oficiales y listados cargados en tiempo real desde SharePoint Online. Utiliza esta información como ÚNICA fuente de verdad para temas legales o específicos de la empresa.

{{DOCUMENT_CONTEXT}}

REGLAS ABSOLUTAS:
1. Responde siempre en español de forma profesional, empática y clara.
2. Si la información no está en los documentos proporcionados, indica de manera elegante que no tienes acceso a ese dato específico en estos momentos y sugiere contactar con el departamento de RRHH.
3. No inventes cláusulas de convenios ni días de vacaciones si no están en el texto.
4. REGLAS DE PRIVACIDAD Y PROTECCIÓN DE DATOS (RGPD): 
   * Por estricta normativa de protección de datos, un empleado regular SOLO tiene permitido consultar su propia información de vacaciones. Tienes terminantemente prohibido revelar información, nombres o días de vacaciones de otros empleados a no ser que el consultante tenga permisos de "RECURSOS HUMANOS - Acceso Completo".
   * Si el usuario consultante tiene "Acceso Restringido (RGPD)", el contexto inyectado ya habrá sido filtrado a nivel de código y solo contendrá su propia información de vacaciones. Si dicho usuario te pregunta por las vacaciones de otro compañero (ej. "¿cuántos días tiene Ana?"), debes denegar la información de forma cordial, explicando que por el Reglamento General de Protección de Datos (RGPD) esa información es privada y confidencial.
   * Si el usuario tiene "Acceso Completo (Acceso RRHH)", puedes responder sobre las vacaciones de cualquier empleado de la lista.
5. Si el usuario pregunta por vacaciones de un trabajador autorizado, proporciona la información exacta (totales, disfrutados, pendientes, estado, periodos) formateada en una bonita TABLA Markdown.
6. Si te pregunta por sus propias vacaciones ("¿cuántos días me quedan?" o similar), indícale sus días exactos según la fila que le corresponda.
7. Usa formato Markdown para que la respuesta sea altamente legible (negritas, listas, tablas).
8. Menciona discretamente que los datos provienen de la nube corporativa segura de SharePoint.
9. Si el usuario solicita pedir, registrar o programar unas vacaciones (ej: "quiero pedir vacaciones del 5 de abril al 15 de abril"), confirma cordialmente las fechas y añade al final de tu respuesta la acción JSON en este formato EXACTO:
   [ACTION]{"intent":"REQUEST_VACATIONS","data":{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}}[/ACTION]
   Las fechas deben estar en formato YYYY-MM-DD. Extrae las fechas de la consulta del usuario o del año en curso (2026).
`;

// Resumen del Estatuto de los Trabajadores
function getEstatutoContent(): string {
  return `
ESTATUTO DE LOS TRABAJADORES (RDL 2/2015) - ARTÍCULOS CLAVE DE RRHH:

Art. 34 - JORNADA DE TRABAJO:
- Duración máxima: 40 horas semanales de trabajo efectivo en cómputo anual.
- Jornada diaria máxima: 9 horas ordinarias (8 horas para menores de 18 años).
- Entre jornadas: mínimo 12 horas de descanso.
- Descanso semanal: día y medio ininterrumpido.

Art. 37 - DESCANSO SEMANAL, FIESTAS Y PERMISOS:
- Permisos retribuidos:
  * Matrimonio: 15 días naturales.
  * Fallecimiento/Enfermedad grave familiar (1r grado): 2 días (4 si hay desplazamiento).
  * Traslado de domicilio: 1 día.
  * Nacimiento/Adopción: 16 semanas.

Art. 38 - VACACIONES ANUALES:
- Periodo mínimo: 30 días NATURALES (equivalente a 22 días LABORABLES).
- Las vacaciones NO son compensables económicamente, salvo extinción del contrato.
- Fecha de disfrute: acordada entre empresa y trabajador.
- Al menos 12 días deben ser consecutivos.

Art. 56 - DESPIDO IMPROCEDENTE:
- Indemnización: 33 días de salario por año de servicio (hasta 24 mensualidades).
`;
}

// Descarga el contenido de un archivo de SharePoint
async function downloadFileAsText(token: string, siteId: string, filePath: string): Promise<string | null> {
  try {
    const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${filePath}:/content`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store'
    });

    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error(`[RRHH Bot] Error descargando ${filePath}:`, err);
    return null;
  }
}

// Procesa y filtra el JSON de vacaciones basándose en el usuario que realiza la consulta (RGPD)
function processVacacionesJsonForUser(rawJson: string, userEmail: string): string {
  try {
    const data = JSON.parse(rawJson);
    if (!data || !data.trabajadores) {
      return 'No hay datos de vacaciones disponibles.';
    }

    const emailLower = userEmail.toLowerCase().trim();
    
    // Buscar al trabajador que realiza la consulta
    const currentUserRow = data.trabajadores.find((t: any) => 
      t.email && t.email.toLowerCase().trim() === emailLower
    );

    // Comprobar si pertenece al departamento de RRHH (tiene permisos de administrador/gestor)
    const isRRHH = currentUserRow && currentUserRow.departamento && currentUserRow.departamento.toUpperCase() === 'RRHH';

    const lineas = [
      `=== REGISTRO DE VACACIONES ${data.añoFiscal || 2026} ===`,
      `Base legal: ${data.baseLegal}`,
      `Mínimo legal: ${data.diasMinimoLegales} días laborables`,
      `Consultor actual: ${userEmail}`,
      currentUserRow 
        ? `Nombre oficial: ${currentUserRow.nombre} | Cargo: ${currentUserRow.cargo} | Dpto: ${currentUserRow.departamento}`
        : 'Nombre oficial: (No registrado en la plantilla activa)',
      `Nivel de Acceso: ${isRRHH ? 'RECURSOS HUMANOS - Acceso Completo' : 'EMPLEADO REGULAR - Acceso Restringido (RGPD)'}`,
      ''
    ];

    if (isRRHH) {
      // Si pertenece a RRHH, inyectar el listado completo
      lineas.push('DATOS COMPLETOS DE EMPLEADOS (Acceso RRHH):');
      data.trabajadores.forEach((t: any) => {
        lineas.push(
          `- Empleado: ${t.nombre} | Email: ${t.email || 'N/A'} | Cargo: ${t.cargo} | Dpto: ${t.departamento} | Antigüedad: ${t.añosAntiguedad} años | ` +
          `Total: ${t.diasLaborablesTotal} | Disfrutados: ${t.diasDisfrutados} | ` +
          `Pendientes: ${t.diasPendientes} | Estado: ${t.estado} | Periodos: ${t.periodosSolicitados?.join(', ') || 'Ninguno'}`
        );
      });
    } else {
      // Si es empleado regular, inyectar ÚNICAMENTE sus datos
      lineas.push('DATOS DE VACACIONES AUTORIZADOS (Acceso Personal Filtrado por RGPD):');
      if (currentUserRow) {
        lineas.push(
          `- Empleado: ${currentUserRow.nombre} | Email: ${currentUserRow.email} | Cargo: ${currentUserRow.cargo} | Dpto: ${currentUserRow.departamento} | Antigüedad: ${currentUserRow.añosAntiguedad} años | ` +
          `Total: ${currentUserRow.diasLaborablesTotal} | Disfrutados: ${currentUserRow.diasDisfrutados} | ` +
          `Pendientes: ${currentUserRow.diasPendientes} | Estado: ${currentUserRow.estado} | Periodos: ${currentUserRow.periodosSolicitados?.join(', ') || 'Ninguno'}`
        );
      } else {
        lineas.push('⚠️ ALERTA: No se encontró ningún registro para tu cuenta. Por motivos de privacidad, no tienes permitido ver otros empleados.');
      }
    }

    if (data.notasLegales) {
      lineas.push('', 'DIRECTRICES Y NOTAS LEGALES:');
      data.notasLegales.forEach((n: string) => lineas.push(`- ${n}`));
    }

    return lineas.join('\n');
  } catch (err: any) {
    console.error('[RRHH Bot] Error parseando JSON de vacaciones:', err);
    return 'Error al procesar el archivo estructurado de vacaciones.';
  }
}

// Extrae texto de un PDF de SharePoint (fallback al contenido del Estatuto)
async function downloadPdfText(token: string, siteId: string, filePath: string): Promise<string | null> {
  try {
    const metaUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${filePath}`;
    const metaRes = await fetch(metaUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store'
    });
    if (!metaRes.ok) return getEstatutoContent();
    return getEstatutoContent();
  } catch (err) {
    return getEstatutoContent();
  }
}

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
          activeModules: 'facturacion,jira,rrhh',
          companyId: company.id,
          emailVerified: true
        }
      });
      console.log(`[RRHHBot Auto-Register] Usuario creado: ${userEmail}`);
    } catch (dbErr: any) {
      console.error('[RRHHBot Auto-Register] Error en DB:', dbErr);
    }
  }
  
  return user;
}

export class BedasoftRRHHTeamsBot extends ActivityHandler {
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
          console.log(`[RRHHBot] [TeamsInfo] Resolviendo email desde miembro de Teams: ${userEmail}`);
        } catch (e) {
          console.error(`[RRHHBot] [TeamsInfo] Error al obtener miembro de Teams:`, e);
        }
      }

      // Si estamos probando en el Web Chat de Azure o en el Emulador, simulamos el primer usuario de la base de datos
      if (!userEmail && (context.activity.channelId === 'webchat' || context.activity.channelId === 'emulator')) {
        const firstUser = await prisma.user.findFirst();
        if (firstUser) {
          userEmail = firstUser.email;
          console.log(`[RRHHBot] [WebChat/Emulator] Simulando contexto del usuario corporativo: ${userEmail}`);
        }
      }
      
      console.log(`[RRHHBot] Mensaje de: ${userEmail}: ${text}`);

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

      // Verificar si el módulo RRHH está activo para el usuario
      const activeModules = user.activeModules || '';
      const modules = activeModules.split(',').map((m: string) => m.trim()).filter(Boolean);
      if (!modules.includes('rrhh')) {
        await context.sendActivity("Acceso Denegado: No tienes activo el módulo de Recursos Humanos (RRHH). Solicita su activación a tu administrador en el panel de control.");
        return await next();
      }

      // 2. Cargar contexto de SharePoint
      let documentContext = '';
      const contextParts: string[] = [];

      try {
        const token = await getGraphToken();
        const siteId = await getSiteId();
        if (!token || !siteId) {
          throw new Error('Microsoft Graph token or siteId is not configured.');
        }

        console.log(`[RRHHBot] Cargando documentos de SharePoint para: ${userEmail}`);

        // Cargar Estatuto
        const estatutoContent = await downloadPdfText(token, siteId, 'Estatuto Trabajadores.pdf');
        if (estatutoContent) {
          contextParts.push(`=== ESTATUTO DE LOS TRABAJADORES ===\n${estatutoContent}`);
        }

        // Cargar Vacaciones JSON y aplicar el filtro de privacidad RGPD
        const vacacionesContent = await downloadFileAsText(token, siteId, 'RRHH/Vacaciones_Datos.json');
        if (vacacionesContent) {
          const filteredVacaciones = processVacacionesJsonForUser(vacacionesContent, userEmail);
          contextParts.push(filteredVacaciones);
        }

        if (contextParts.length > 0) {
          documentContext = contextParts.join('\n\n---\n\n');
        } else {
          documentContext = `=== ESTATUTO DE LOS TRABAJADORES (VERSION EMBEBIDA) ===\n${getEstatutoContent()}`;
        }
      } catch (spError) {
        console.error('[RRHHBot] Error accediendo a SharePoint:', spError);
        documentContext = `=== ESTATUTO DE LOS TRABAJADORES (VERSION EMBEBIDA) ===\n${getEstatutoContent()}`;
      }

      // 3. Procesar con AI Service
      try {
        const systemWithContext = SYSTEM_PROMPT.replace('{{DOCUMENT_CONTEXT}}', documentContext);
        const aiResponse = await getAIChatCompletion(systemWithContext, text, []);

        let friendlyText = aiResponse;
        let actionData: any = { intent: 'NONE', data: {} };
        const actionMatch = aiResponse.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
        
        if (actionMatch) {
          friendlyText = aiResponse.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/, '').trim();
          try {
            actionData = JSON.parse(actionMatch[1].trim());
          } catch (jsonErr) {
            console.error('[RRHHBot] Error parseando ACTION JSON:', jsonErr);
          }

          if (actionData.intent === 'REQUEST_VACATIONS') {
            const { startDate, endDate } = actionData.data;
            const userModules = user.activeModules || '';
            const userModulesArr = userModules.split(',').map((m: string) => m.trim()).filter(Boolean);
            
            if (!userModulesArr.includes('mailing')) {
              friendlyText += `\n\n⚠️ **Aviso de Mailing:** Tu solicitud de vacaciones del **${startDate}** al **${endDate}** ha sido registrada internamente, pero no se ha podido enviar la notificación por email al responsable de Recursos Humanos porque no tienes activo el módulo de Mailing.`;
            } else {
              try {
                const crypto = require('crypto');
                const managerEmail = 'carlos.jimenez@bedasoft.es';
                
                // Firma criptográfica de seguridad
                const secret = process.env.MICROSOFT_CLIENT_SECRET || 'bedasoft_secret_key';
                const sig = crypto.createHash('sha256')
                  .update(`${userEmail}:${startDate}:${endDate}:${secret}`)
                  .digest('hex');
                
                const approveUrl = `https://bedasoft-ia-system.vercel.app/api/rrhh/approve-vacations?workerEmail=${encodeURIComponent(userEmail)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&sig=${sig}`;
                
                const subject = `Solicitud de Vacaciones: ${user.name || userEmail}`;
                const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitud de Vacaciones – Bedasoft IA</title>
</head>
<body style="margin:0;padding:0;background:#050508;font-family:'Arial',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:40px 20px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d0d1a,#0a0a15);border:1px solid rgba(0,242,254,0.15);border-radius:20px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,rgba(0,242,254,0.08),rgba(118,75,162,0.08));padding:40px;text-align:center;border-bottom:1px solid rgba(0,242,254,0.1);">
            <p style="color:rgba(0,242,254,0.6);font-size:10px;letter-spacing:6px;text-transform:uppercase;margin:0 0 12px;">BEDASOFT IA RRHH</p>
            <h1 style="color:#fff;font-size:26px;margin:0;font-weight:900;letter-spacing:2px;">SOLICITUD DE VACACIONES</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="color:rgba(255,255,255,0.8);font-size:15px;line-height:1.7;margin:0 0 24px;">
              Hola <strong style="color:#fff;">Carlos Jiménez Ruiz (Director de RRHH)</strong>,
            </p>
            <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;margin:0 0 32px;">
              El empleado <strong style="color:#fff;">${user.name || userEmail}</strong> (${userEmail}) ha solicitado un periodo de vacaciones a través del Asistente Neural de RRHH.
            </p>
            
            <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:20px;margin-bottom:32px;">
              <table width="100%">
                <tr>
                  <td style="color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;">Fecha Inicio:</td>
                  <td style="color:#fff;font-size:13px;font-weight:bold;text-align:right;">${startDate}</td>
                </tr>
                <tr>
                  <td style="color:rgba(255,255,255,0.4);font-size:12px;text-transform:uppercase;">Fecha Fin:</td>
                  <td style="color:#fff;font-size:13px;font-weight:bold;text-align:right;">${endDate}</td>
                </tr>
              </table>
            </div>

            <div style="text-align:center;margin:36px 0;">
              <a href="${approveUrl}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00f2fe,#764ba2);color:#050508;font-weight:900;font-size:12px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;border-radius:12px;box-shadow:0 10px 30px rgba(0,242,254,0.25);">
                APROBAR VACACIONES
              </a>
            </div>
            
            <p style="color:rgba(255,255,255,0.3);font-size:11px;line-height:1.6;margin:24px 0 0;text-align:center;">
              Al hacer clic en el botón de aprobación, el sistema validará la firma de seguridad, registrará la concesión y enviará una notificación automática de confirmación al empleado.
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
                
                const { sendEmail } = require('./email');
                const sent = await sendEmail({ to: managerEmail, subject, html: emailHtml });
                
                if (sent) {
                  friendlyText += `\n\n📧 **Notificación por email enviada:** Se ha remitido un correo interactivo de aprobación a **Carlos Jiménez (Director de RRHH)**. Cuando apruebe la solicitud, recibirás una confirmación por correo inmediatamente.`;
                } else {
                  friendlyText += `\n\n⚠️ Tu solicitud ha sido procesada pero hubo un problema al enviar la notificación por email al Director de RRHH.`;
                }
              } catch (mailErr) {
                console.error('[RRHHBot] Error enviando correo de vacaciones:', mailErr);
                friendlyText += `\n\n⚠️ Error al procesar el envío de correo de aprobación.`;
              }
            }
          }
        }

        await context.sendActivity(MessageFactory.text(friendlyText));

      } catch (err: any) {
        console.error("[RRHHBotError]", err);
        await context.sendActivity(`Lo siento, he tenido un error procesando tu consulta de RRHH: ${err.message}`);
      }

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      const welcomeText = '¡Hola! Soy el Agente Neural de Recursos Humanos (RRHH) de Bedasoft IA. Estoy aquí para resolver tus dudas de convenios, vacaciones y normativa interna directamente desde Teams. ¿En qué puedo ayudarte hoy?';
      for (let cnt = 0; cnt < (membersAdded?.length || 0); cnt++) {
        if (membersAdded![cnt].id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
        }
      }
      await next();
    });
  }
}
