import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getDriveService, searchAndDownloadFile } from '@/lib/google';

const SYSTEM_PROMPT = `
Eres el Asistente Neural de RRHH de Bedasoft IA. Tu misión es ayudar a los empleados y gestores con consultas sobre normativa interna, convenios y vacaciones.

CONTEXTO DE DOCUMENTACIÓN:
A continuación se te proporciona extractos de los documentos encontrados en la nube del usuario (Google Drive/SharePoint). Utiliza esta información como ÚNICA fuente de verdad para temas legales o específicos de la empresa.

{{DOCUMENT_CONTEXT}}

REGLAS:
1. Responde siempre en español de forma profesional, empática y clara.
2. Si la información no está en los documentos proporcionados, indica que no tienes acceso a ese dato específico y sugiere contactar con el departamento de RRHH.
3. No inventes cláusulas de convenios ni días de vacaciones si no están en el texto.
4. Si el usuario pregunta por "el convenio", refiérete al documento que has analizado.
5. Usa formato Markdown para que la respuesta sea legible (negritas, listas, etc.).
`;

export async function POST(req: NextRequest) {
  try {
    const { message, userEmail, history } = await req.json();
    
    // 1. Verificar usuario y tokens de Google
    const user = await prisma.user.findUnique({ 
      where: { email: userEmail } 
    });
    
    if (!user) return NextResponse.json({ response: 'Sesión no válida.', action: null });

    let documentContext = "No se han encontrado documentos de RRHH específicos (Convenio o Vacaciones) en la nube.";

    // 2. Intentar obtener contexto de Google Drive si tiene tokens
    if (user.googleAccessToken) {
      try {
        const drive = getDriveService(user.googleAccessToken, user.googleRefreshToken || undefined);
        
        // Buscar archivos clave
        const convenioFile = await searchAndDownloadFile(drive, 'convenio');
        const vacacionesFile = await searchAndDownloadFile(drive, 'vacaciones');
        
        let contextParts = [];
        if (convenioFile) contextParts.push(`DOCUMENTO: ${convenioFile.name}\nCONTENIDO:\n${convenioFile.content}`);
        if (vacacionesFile) contextParts.push(`DOCUMENTO: ${vacacionesFile.name}\nCONTENIDO:\n${vacacionesFile.content}`);
        
        if (contextParts.length > 0) {
          documentContext = contextParts.join('\n\n---\n\n');
        }
      } catch (driveError) {
        console.error('Error accediendo a Drive:', driveError);
        documentContext = "Error al intentar conectar con Google Drive para leer la documentación.";
      }
    }

    // 3. Llamar a Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY?.replace(/"/g, '') || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const systemWithContext = SYSTEM_PROMPT.replace('{{DOCUMENT_CONTEXT}}', documentContext);

    const chatHistory = [
      { role: 'user' as const, parts: [{ text: systemWithContext }] },
      { role: 'model' as const, parts: [{ text: 'Entendido. He procesado la documentación de RRHH disponible. Estoy listo para asistir al personal.' }] },
      ...(history || []).slice(-10).map((m: any) => ({
        role: (m.role === 'ai' ? 'model' : 'user') as 'user' | 'model',
        parts: [{ text: m.text }]
      }))
    ];

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();

    return NextResponse.json({ response: aiResponse });

  } catch (error: any) {
    console.error('RRHH Chat error:', error);
    return NextResponse.json({
      response: `Error en el enlace neural de RRHH: ${error.message}`,
      action: null
    }, { status: 500 });
  }
}
