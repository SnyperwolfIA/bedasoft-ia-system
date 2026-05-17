import { 
  ActivityHandler, 
  MessageFactory, 
  TurnContext,
  TeamsInfo
} from 'botbuilder';
import prisma from './prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getJiraProjects, getJiraIssues, createJiraIssue } from './jira';

const SYSTEM_PROMPT = `
Eres el Gestor Neural de Proyectos 'JiraNeural' de Bedasoft IA operando desde MICROSOFT TEAMS. Tienes acceso directo a la API de Jira para gestionar tickets, proyectos y tareas en tiempo real.

REGLAS ABSOLUTAS:
1. SIEMPRE termina tu respuesta con una etiqueta JSON en este formato EXACTO al final del mensaje:
   [ACTION]{"intent":"NOMBRE_INTENT","data":{...}}[/ACTION]

2. Intents disponibles:
   - LIST_PROJECTS: Para listar proyectos de Jira. data: {}
   - LIST_ISSUES: Para ver tickets de un proyecto. data: {projectKey}
   - CREATE_ISSUE: Para crear un ticket. data: {projectKey, summary, description, issueType}
   - NONE: Para conversación sin acción. data: {}

3. Responde siempre en español de forma profesional, rápida y con un tono altamente tecnológico e industrial.
4. Si el usuario quiere crear un ticket pero no especifica el proyecto o el título, pídeles con amabilidad esos detalles.
5. Utiliza Markdown para estructurar la lista de tickets o proyectos de forma sumamente legible (negritas, viñetas, enlaces).
`;

export class BedasoftJiraNeuralTeamsBot extends ActivityHandler {
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
          console.log(`[JiraNeuralBot] [TeamsInfo] Resolviendo email desde miembro de Teams: ${userEmail}`);
        } catch (e) {
          console.error(`[JiraNeuralBot] [TeamsInfo] Error al obtener miembro de Teams:`, e);
        }
      }

      // Si estamos probando en el Web Chat de Azure o en el Emulador, simulamos el primer usuario de la base de datos
      if (!userEmail && (context.activity.channelId === 'webchat' || context.activity.channelId === 'emulator')) {
        const firstUser = await prisma.user.findFirst();
        if (firstUser) {
          userEmail = firstUser.email;
          console.log(`[JiraNeuralBot] [WebChat/Emulator] Simulando contexto del usuario corporativo: ${userEmail}`);
        }
      }
      
      console.log(`[JiraNeuralBot] Mensaje de: ${userEmail}: ${text}`);

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

      // 2. Procesar con Gemini
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY?.replace(/"/g, '') || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        
        const chat = model.startChat({
          history: [
            { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
            { role: 'model', parts: [{ text: 'Entendido. Enlace neural con la API de Jira establecido. ¿Qué proyectos o tickets gestionamos hoy?' }] }
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

          // EJECUTAR ACCIONES DE JIRA
          if (actionData.intent === 'LIST_PROJECTS') {
            try {
              const projects = await getJiraProjects();
              if (projects.length === 0) {
                friendlyText += '\n\nNo he encontrado proyectos en tu instancia de Jira.';
              } else {
                friendlyText += '\n\n**🤖 Proyectos Jira activos:**\n' + projects.map((p: any) => 
                  `• **${p.name}** [${p.key}]`
                ).join('\n');
              }
            } catch (e: any) {
              friendlyText += `\n\n❌ Error de conexión al listar proyectos de Jira: ${e.message}`;
            }
          }

          if (actionData.intent === 'LIST_ISSUES') {
            const { projectKey } = actionData.data;
            if (!projectKey) {
              friendlyText += '\n\n⚠️ Por favor, indícame la clave del proyecto (ej: SCRUM).';
            } else {
              try {
                const data = await getJiraIssues(projectKey);
                const issues = data.issues || [];
                if (issues.length === 0) {
                  friendlyText += `\n\nNo hay tickets abiertos en el proyecto **${projectKey}**.`;
                } else {
                  friendlyText += `\n\n**📋 Últimos tickets en ${projectKey}:**\n` + issues.slice(0, 5).map((i: any) => 
                    `• **${i.key}**: ${i.fields.summary} _(${i.fields.status.name})_`
                  ).join('\n');
                }
              } catch (e: any) {
                friendlyText += `\n\n❌ Error al recuperar los tickets de ${projectKey}: ${e.message}`;
              }
            }
          }

          if (actionData.intent === 'CREATE_ISSUE') {
            const { projectKey, summary, description, issueType } = actionData.data;
            if (!projectKey || !summary) {
              friendlyText += '\n\n⚠️ Faltan parámetros requeridos (Proyecto y Título/Resumen) para completar el registro.';
            } else {
              try {
                const issue = await createJiraIssue(projectKey, summary, description || '', issueType);
                const browseUrl = `${process.env.JIRA_INSTANCE_URL || 'https://jira.atlassian.com'}/browse/${issue.key}`;
                friendlyText += `\n\n✅ **TICKET CREADO CON ÉXITO**: [${issue.key}](${browseUrl})\n📌 **Resumen**: ${summary}`;
              } catch (e: any) {
                friendlyText += `\n\n❌ No he podido registrar el ticket en Jira: ${e.message}`;
              }
            }
          }
        }

        await context.sendActivity(MessageFactory.text(friendlyText));

      } catch (err: any) {
        console.error("[JiraNeuralBotError]", err);
        await context.sendActivity(`Lo siento, he tenido un error procesando tu solicitud de Jira: ${err.message}`);
      }

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      const welcomeText = '¡Hola! Soy el Agente JiraNeural de Bedasoft IA. Estoy aquí para ayudarte a crear tickets, comprobar tareas y agilizar la gestión de tus proyectos de desarrollo directamente desde Teams. ¿Qué hacemos hoy?';
      for (let cnt = 0; cnt < (membersAdded?.length || 0); cnt++) {
        if (membersAdded![cnt].id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
        }
      }
      await next();
    });
  }
}
