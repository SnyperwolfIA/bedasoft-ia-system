import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAIChatCompletion } from '@/lib/ai-service';
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
    
    // 1. Verificar usuario o auto-registrar corporativo
    const isAuthorizedAdminDomain = (emailStr: string) => {
      const lower = emailStr.toLowerCase();
      return (
        lower === 'amontesinos@bedasoft.es' ||
        lower.endsWith('@bedasoft.es') ||
        lower.endsWith('@bedasoft.ai') ||
        lower.endsWith('@outlook.com') ||
        lower.endsWith('@outlook.es') ||
        lower.endsWith('@hotmail.com') ||
        lower.endsWith('@hotmail.es') ||
        lower.endsWith('@live.com') ||
        lower.endsWith('@live.es')
      );
    };

    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user && isAuthorizedAdminDomain(userEmail)) {
      try {
        let company = await prisma.company.findFirst({ where: { name: 'Bedasoft' } });
        if (!company) {
          company = await prisma.company.create({ 
            data: { 
              name: 'Bedasoft', 
              licenseKey: 'LIC-BEDASOFT',
              status: 'active'
            } 
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
        console.log(`[Auth Auto-Register] Creado usuario corporativo en RRHH: ${userEmail}`);
      } catch (dbErr: any) {
        console.error('[Auth Auto-Register] Error en base de datos al auto-registrar usuario en RRHH, usando mock:', dbErr);
        user = {
          id: 'cl-admin-bedasoft-demo',
          email: userEmail,
          name: userEmail.split('@')[0].toUpperCase(),
          password: 'SSO_BYPASS_PASSWORD',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          activeModules: 'facturacion,jira,rrhh',
          resetToken: null,
          resetTokenExpiry: null,
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiry: null,
          companyId: 'cl-company-demo',
          jiraUrl: null,
          jiraEmail: null,
          jiraToken: null,
          jiraRole: 'admin'
        } as any;
      }
    }

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

    // 3. Obtener respuesta del Copilot / AI Service
    const systemWithContext = SYSTEM_PROMPT.replace('{{DOCUMENT_CONTEXT}}', documentContext);
    const aiResponse = await getAIChatCompletion(systemWithContext, message, history || []);

    return NextResponse.json({ response: aiResponse });

  } catch (error: any) {
    console.error('RRHH Chat error:', error);
    return NextResponse.json({
      response: `Error en el enlace neural de RRHH: ${error.message}`,
      action: null
    }, { status: 500 });
  }
}
