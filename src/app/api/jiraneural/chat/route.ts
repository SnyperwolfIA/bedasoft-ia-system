import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  getJiraProjects, getJiraIssues, createJiraIssue, 
  getIssue, addComment, getTransitions, doTransition, assignIssue, searchUsers 
} from '@/lib/jira';

const SYSTEM_PROMPT = (role: string) => `
Eres el Núcleo JiraNeural Sync de Bedasoft IA. Tu objetivo es ser el puente inteligente entre el operador y su instancia de Jira.

TU ROL ACTUAL: Estás actuando para un usuario con privilegios de: **${role === 'admin' ? 'ADMINISTRADOR' : 'USUARIO ESTÁNDAR'}**.

REGLAS DE OPERACIÓN:
1. SIEMPRE termina tu respuesta con una etiqueta JSON: [ACTION]{"intent":"NOMBRE_INTENT","data":{...}}[/ACTION]
2. Intents disponibles:
   - GREETING: Saludo inicial.
   - LIST_PROJECTS: Listar proyectos disponibles.
   - LIST_ISSUES: Listar tickets de un proyecto (requiere projectKey).
   - CREATE_ISSUE: Crear un ticket (requiere projectKey, summary, description, issueType, priorityId, assigneeId).
   - ISSUE_DETAILS: Obtener detalles completos de un ticket (requiere issueKey).
   - ADD_COMMENT: Añadir un comentario a un ticket (requiere issueKey, comment).
   - TRANSITION_ISSUE: Cambiar el estado de un ticket (requiere issueKey, targetStatus - ej: "En curso", "Hecho").
   - ASSIGN_ISSUE: Asignar un ticket a un usuario (requiere issueKey, assigneeName o email para buscar).
   - SEARCH_USER: Buscar usuarios en la instancia (requiere query).
   - NONE: Conversación general.

3. RESTRICCIONES DE ROL:
   - Si eres **USUARIO ESTÁNDAR**: Puedes gestionar tickets, comentar y cambiar estados, pero sé cauteloso con cambios masivos. Jira mismo rechazará acciones si no tienes permiso, informa al usuario si esto ocurre.
   - Si eres **ADMINISTRADOR**: Tienes autoridad total sobre la instancia. Puedes realizar configuraciones y gestiones críticas.

4. FLUJO INTERACTIVO DE CREACIÓN:
   - Para CREATE_ISSUE: No intentes crear el ticket hasta que tengas:
     1. **Proyecto** (Key).
     2. **Resumen** (Título).
     3. **Descripción** (Detalles).
     4. **Tipo** (Tarea, Historia, Bug, etc).
     5. **Prioridad** (Highest=1, High=2, Medium=3, Low=4, Lowest=5).
     6. **Asignado** (Opcional pero recomendado, busca el usuario si te dan un nombre).
   - Si el usuario dice "crea una tarea", ve pidiéndole los campos que falten uno por uno para que el ticket esté **completamente relleno**.

5. Formato: Usa Markdown elegante, negritas para IDs de tickets y enlaces si es posible.
`;

export async function POST(req: NextRequest) {
  try {
    const { message, userEmail, history } = await req.json();
    
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user || !user.jiraUrl || !user.jiraEmail || !user.jiraToken) {
      return NextResponse.json({ response: '⚠️ Configuración de Jira no detectada. Por favor, completa el enlace técnico.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY?.replace(/"/g, '') || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const chatHistory = [
      { role: 'user' as const, parts: [{ text: SYSTEM_PROMPT(user.jiraRole || 'user') }] },
      ...(history || []).slice(-15).map((m: any) => ({
        role: (m.role === 'ai' ? 'model' : 'user') as 'user' | 'model',
        parts: [{ text: m.text.split('[ACTION]')[0] }]
      }))
    ];

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();

    let friendlyText = aiResponse;
    let actionData: any = { intent: 'NONE', data: {} };
    const actionMatch = aiResponse.match(/\[ACTION\]([\s\S]*?)\[\/ACTION\]/);
    
    if (actionMatch) {
      friendlyText = aiResponse.replace(/\[ACTION\][\s\S]*?\[\/ACTION\]/, '').trim();
      try {
        actionData = JSON.parse(actionMatch[1].trim());
      } catch {}
    }

    let actionTriggered: string | null = null;

    // --- MÓDULOS DE ACCIÓN ---

    if (actionData.intent === 'LIST_PROJECTS') {
      try {
        const projects = await getJiraProjects(user.jiraUrl, user.jiraEmail, user.jiraToken);
        friendlyText += '\n\n**Proyectos en tu instancia:**\n' + projects.map((p: any) => `• ${p.name} (**${p.key}**)`).join('\n');
        actionTriggered = 'PROJECTS_LISTED';
      } catch (e: any) { friendlyText += `\n\n❌ Error Jira: ${e.message}`; }
    }

    if (actionData.intent === 'LIST_ISSUES') {
      const { projectKey } = actionData.data;
      if (projectKey) {
        try {
          const data = await getJiraIssues(user.jiraUrl, user.jiraEmail, user.jiraToken, projectKey);
          const issues = data.issues || [];
          friendlyText += `\n\n**Tickets en ${projectKey}:**\n` + issues.slice(0, 10).map((i: any) => `• **${i.key}**: ${i.fields.summary} (${i.fields.status.name})`).join('\n');
          actionTriggered = 'ISSUES_LISTED';
        } catch (e: any) { friendlyText += `\n\n❌ Error Jira: ${e.message}`; }
      }
    }

    if (actionData.intent === 'ISSUE_DETAILS') {
      const { issueKey } = actionData.data;
      if (issueKey) {
        try {
          const issue = await getIssue(user.jiraUrl, user.jiraEmail, user.jiraToken, issueKey);
          friendlyText += `\n\n**DETALLES DE ${issueKey}:**\n• **Resumen**: ${issue.fields.summary}\n• **Estado**: ${issue.fields.status.name}\n• **Asignado**: ${issue.fields.assignee?.displayName || 'Sin asignar'}\n• **Prioridad**: ${issue.fields.priority?.name || 'Media'}\n• **Descripción**: ${issue.fields.description?.content?.[0]?.content?.[0]?.text || 'Sin descripción'}`;
          actionTriggered = 'ISSUE_DETAILS_RETRIEVED';
        } catch (e: any) { friendlyText += `\n\n❌ Error Jira: ${e.message}`; }
      }
    }

    if (actionData.intent === 'ADD_COMMENT') {
      const { issueKey, comment } = actionData.data;
      if (issueKey && comment) {
        try {
          await addComment(user.jiraUrl, user.jiraEmail, user.jiraToken, issueKey, comment);
          friendlyText += `\n\n✅ Comentario añadido con éxito a **${issueKey}**.`;
          actionTriggered = 'COMMENT_ADDED';
        } catch (e: any) { friendlyText += `\n\n❌ Error Jira: ${e.message}`; }
      }
    }

    if (actionData.intent === 'TRANSITION_ISSUE') {
      const { issueKey, targetStatus } = actionData.data;
      if (issueKey && targetStatus) {
        try {
          const transData = await getTransitions(user.jiraUrl, user.jiraEmail, user.jiraToken, issueKey);
          const transition = transData.transitions.find((t: any) => 
            t.name.toLowerCase().includes(targetStatus.toLowerCase()) || 
            t.to.name.toLowerCase().includes(targetStatus.toLowerCase())
          );
          if (transition) {
            await doTransition(user.jiraUrl, user.jiraEmail, user.jiraToken, issueKey, transition.id);
            friendlyText += `\n\n✅ Estado de **${issueKey}** cambiado a **${transition.name}**.`;
            actionTriggered = 'ISSUE_TRANSITIONED';
          } else {
            friendlyText += `\n\n⚠️ No encontré una transición válida para "${targetStatus}". Disponibles: ${transData.transitions.map((t: any) => t.name).join(', ')}`;
          }
        } catch (e: any) { friendlyText += `\n\n❌ Error Jira: ${e.message}`; }
      }
    }

    if (actionData.intent === 'ASSIGN_ISSUE') {
      const { issueKey, assigneeName } = actionData.data;
      if (issueKey && assigneeName) {
        try {
          const users = await searchUsers(user.jiraUrl, user.jiraEmail, user.jiraToken, assigneeName);
          if (users.length > 0) {
            const targetUser = users[0];
            await assignIssue(user.jiraUrl, user.jiraEmail, user.jiraToken, issueKey, targetUser.accountId);
            friendlyText += `\n\n✅ **${issueKey}** asignado a **${targetUser.displayName}**.`;
            actionTriggered = 'ISSUE_ASSIGNED';
          } else {
            friendlyText += `\n\n⚠️ No se encontró ningún usuario que coincida con "${assigneeName}".`;
          }
        } catch (e: any) { friendlyText += `\n\n❌ Error Jira: ${e.message}`; }
      }
    }

    if (actionData.intent === 'CREATE_ISSUE') {
      const { projectKey, summary, description, issueType, priorityId, assigneeId } = actionData.data;
      if (projectKey && summary) {
        try {
          const issue = await createJiraIssue(
            user.jiraUrl, user.jiraEmail, user.jiraToken, 
            projectKey, summary, description || '', 
            issueType || 'Tarea', priorityId, assigneeId
          );
          friendlyText += `\n\n✅ **TICKET CREADO**: [${issue.key}](${user.jiraUrl}/browse/${issue.key})`;
          actionTriggered = 'ISSUE_CREATED';
        } catch (e: any) { friendlyText += `\n\n❌ Error Jira: ${e.message}`; }
      }
    }

    return NextResponse.json({ response: friendlyText, action: actionTriggered });

  } catch (error: any) {
    return NextResponse.json({ response: `Error: ${error.message}` });
  }
}
