import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getJiraProjects, getJiraIssues, createJiraIssue } from '@/lib/jira';

const SYSTEM_PROMPT = `
Eres el Gestor Neural de Proyectos de Bedasoft IA. Tienes acceso directo a la API de Jira para gestionar tickets, proyectos y tareas.

REGLAS ABSOLUTAS:
1. SIEMPRE termina tu respuesta con una etiqueta JSON en este formato EXACTO:
   [ACTION]{"intent":"NOMBRE_INTENT","data":{...}}[/ACTION]

2. Intents disponibles:
   - GREETING: Para saludos. data: {}
   - LIST_PROJECTS: Para listar proyectos de Jira. data: {}
   - LIST_ISSUES: Para ver tickets de un proyecto. data: {projectKey}
   - CREATE_ISSUE: Para crear un ticket. data: {projectKey, summary, description, issueType}
   - NONE: Para conversación sin acción. data: {}

3. Responde siempre en español de forma profesional y técnica.
4. Si el usuario quiere crear un ticket pero no especifica el proyecto, pregúntale en qué proyecto desea crearlo.
5. Usa Markdown para que la información de los tickets sea clara (negritas, listas).
`;

export async function POST(req: NextRequest) {
  try {
    const { message, userEmail, history } = await req.json();
    
    // 1. Verificar usuario
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ response: 'Sesión no válida.', action: null });

    // 2. Llamar a Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY?.replace(/"/g, '') || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const chatHistory = [
      { role: 'user' as const, parts: [{ text: SYSTEM_PROMPT }] },
      { role: 'model' as const, parts: [{ text: 'Entendido. Enlace con Jira establecido. ¿Qué proyecto o ticket gestionamos hoy? [ACTION]{"intent":"GREETING","data":{}}[/ACTION]' }] },
      ...(history || []).slice(-8).map((m: any) => ({
        role: (m.role === 'ai' ? 'model' : 'user') as 'user' | 'model',
        parts: [{ text: m.text.split('[ACTION]')[0] }]
      }))
    ];

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();

    // 3. Parsear la respuesta y ejecutar acciones
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

    let actionTriggered: string | null = null;

    // Lógica de acciones JIRA
    if (actionData.intent === 'LIST_PROJECTS') {
      try {
        const projects = await getJiraProjects();
        if (projects.length === 0) {
          friendlyText += '\n\nNo he encontrado proyectos en tu instancia de Jira.';
        } else {
          friendlyText += '\n\n**Proyectos disponibles:**\n' + projects.map((p: any) => 
            `• **${p.name}** [${p.key}]`
          ).join('\n');
        }
        actionTriggered = 'PROJECTS_LISTED';
      } catch (e: any) {
        friendlyText += `\n\n❌ Error al conectar con Jira: ${e.message}`;
      }
    }

    if (actionData.intent === 'LIST_ISSUES') {
      const { projectKey } = actionData.data;
      if (!projectKey) {
        friendlyText += '\n\n⚠️ Por favor, indica la clave del proyecto (ej: SCRUM).';
      } else {
        try {
          const data = await getJiraIssues(projectKey);
          const issues = data.issues || [];
          if (issues.length === 0) {
            friendlyText += `\n\nNo hay tickets abiertos en el proyecto **${projectKey}**.`;
          } else {
            friendlyText += `\n\n**Últimos tickets en ${projectKey}:**\n` + issues.slice(0, 5).map((i: any) => 
              `• **${i.key}**: ${i.fields.summary} (${i.fields.status.name})`
            ).join('\n');
          }
          actionTriggered = 'ISSUES_LISTED';
        } catch (e: any) {
          friendlyText += `\n\n❌ Error al listar tickets: ${e.message}`;
        }
      }
    }

    if (actionData.intent === 'CREATE_ISSUE') {
      const { projectKey, summary, description, issueType } = actionData.data;
      if (!projectKey || !summary) {
        friendlyText += '\n\n⚠️ Faltan datos críticos para crear el ticket (Proyecto o Resumen).';
      } else {
        try {
          const issue = await createJiraIssue(projectKey, summary, description || '', issueType);
          friendlyText += `\n\n✅ **TICKET CREADO**: [${issue.key}](${process.env.JIRA_INSTANCE_URL}/browse/${issue.key}). El equipo ha sido notificado.`;
          actionTriggered = 'ISSUE_CREATED';
        } catch (e: any) {
          friendlyText += `\n\n❌ Error al crear ticket en Jira: ${e.message}`;
        }
      }
    }

    return NextResponse.json({ response: friendlyText, action: actionTriggered });

  } catch (error: any) {
    console.error('Jira Chat error:', error);
    return NextResponse.json({
      response: `Error en el núcleo de gestión de proyectos: ${error.message}`,
      action: null
    });
  }
}
