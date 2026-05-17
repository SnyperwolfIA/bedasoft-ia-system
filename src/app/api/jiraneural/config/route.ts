import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getJiraUserRole } from '@/lib/jira';

export async function POST(req: NextRequest) {
  try {
    const { userEmail, jiraUrl, jiraEmail, jiraToken } = await req.json();

    if (!userEmail || !jiraUrl || !jiraEmail || !jiraToken) {
      return NextResponse.json({ success: false, error: 'Faltan datos de configuración.' }, { status: 400 });
    }

    const sanitizedUrl = jiraUrl.replace(/\/$/, '');

    // Identificar rol antes de guardar
    const role = await getJiraUserRole(sanitizedUrl, jiraEmail, jiraToken);

    const updatedUser = await prisma.user.update({
      where: { email: userEmail },
      data: {
        jiraUrl: sanitizedUrl,
        jiraEmail,
        jiraToken,
        jiraRole: role
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Conexión establecida como: ${role === 'admin' ? 'Administrador' : 'Usuario estándar'}` 
    });

  } catch (error: any) {
    console.error('Error saving Jira config:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
