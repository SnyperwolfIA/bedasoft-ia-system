import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signToken, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    console.log(`[AUTH] Intento de login para: ${email}`);

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenciales incompletas' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    console.log(`[AUTH] Usuario encontrado: ${!!user}`);

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 401 });
    }

    /*
    if (!user.emailVerified) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tu cuenta aún no ha sido verificada. Revisa tu email para activarla.' 
      }, { status: 403 });
    }
    */

    console.log(`[AUTH] Comparando contraseñas...`);
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`[AUTH] ¿Contraseña válida?: ${isPasswordValid}`);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const userPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      activeModules: user.activeModules,
      googleConnected: !!user.googleRefreshToken,
    };

    const token = await signToken(userPayload);

    const response = NextResponse.json({
      success: true,
      message: 'Acceso concedido',
      token, // Also send token to client for localStorage
      user: {
        email: user.email,
        name: user.name,
        activeModules: user.activeModules,
        googleConnected: !!user.googleRefreshToken,
      },
    });

    // Set httpOnly cookie for server-side session validation
    return setSessionCookie(response, token);

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
