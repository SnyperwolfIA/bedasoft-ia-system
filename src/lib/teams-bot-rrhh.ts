import { 
  ActivityHandler, 
  MessageFactory, 
  TurnContext,
  TeamsInfo
} from 'botbuilder';
import prisma from './prisma';
import { getAIChatCompletion } from './ai-service';
import { getDriveService, searchAndDownloadFile } from './google';

const SYSTEM_PROMPT = `
Eres el Asistente Neural de Recursos Humanos (RRHH) de Bedasoft IA operando desde MICROSOFT TEAMS. Tu misión es asistir a los empleados y gestores con consultas sobre normativa interna, convenios, nóminas y vacaciones.

CONTEXTO DE DOCUMENTACIÓN:
A continuación se te proporcionan extractos de los documentos encontrados en la nube del usuario (Google Drive/SharePoint). Utiliza esta información como ÚNICA fuente de verdad para temas legales o específicos de la empresa.

{{DOCUMENT_CONTEXT}}

REGLAS:
1. Responde siempre en español de forma profesional, empática y clara.
2. Si la información no está en los documentos proporcionados, indica de manera elegante que no tienes acceso a ese dato específico en estos momentos y sugiere contactar con el departamento de RRHH.
3. No inventes cláusulas de convenios ni días de vacaciones si no están en el texto.
4. Usa formato Markdown para que la respuesta sea legible (negritas, listas, etc.).
5. Menciona de forma discreta que la documentación analizada proviene de la nube corporativa segura de la organización.
`;

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

      // 1. Verificar usuario en BD
      const user = await prisma.user.findUnique({ where: { email: userEmail } });
      if (!user) {
        await context.sendActivity("No tienes una cuenta activa en el sistema Bedasoft IA. Por favor, regístrate en el portal primero.");
        return await next();
      }

      let documentContext = "No se han encontrado documentos de RRHH específicos (Convenio o Vacaciones) en la nube.";

      // 2. Cargar contexto de Drive si posee tokens
      if (user.googleAccessToken) {
        try {
          const drive = getDriveService(user.googleAccessToken, user.googleRefreshToken || undefined);
          const convenioFile = await searchAndDownloadFile(drive, 'convenio');
          const vacacionesFile = await searchAndDownloadFile(drive, 'vacaciones');
          
          let contextParts = [];
          if (convenioFile) contextParts.push(`DOCUMENTO: ${convenioFile.name}\nCONTENIDO:\n${convenioFile.content}`);
          if (vacacionesFile) contextParts.push(`DOCUMENTO: ${vacacionesFile.name}\nCONTENIDO:\n${vacacionesFile.content}`);
          
          if (contextParts.length > 0) {
            documentContext = contextParts.join('\n\n---\n\n');
          }
        } catch (driveError) {
          console.error('[RRHHBot] Error accediendo a Drive:', driveError);
          documentContext = "Error al intentar conectar con Google Drive para leer la documentación.";
        }
      }

      // 3. Procesar con Copilot / AI Service
      try {
        const systemWithContext = SYSTEM_PROMPT.replace('{{DOCUMENT_CONTEXT}}', documentContext);
        const aiResponse = await getAIChatCompletion(systemWithContext, text, []);

        await context.sendActivity(MessageFactory.text(aiResponse));

      } catch (err: any) {
        console.error("[RRHHBotError]", err);
        await context.sendActivity(`Lo siento, he tenido un error procesando tu consulta de RRHH: ${err.message}`);
      }

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      const welcomeText = '¡Hola! Soy el Agente de Recursos Humanos (RRHH) de Bedasoft IA. Estoy aquí para resolver tus dudas de convenios, vacaciones y normativa interna directamente desde Teams. ¿En qué puedo ayudarte hoy?';
      for (let cnt = 0; cnt < (membersAdded?.length || 0); cnt++) {
        if (membersAdded![cnt].id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
        }
      }
      await next();
    });
  }
}
