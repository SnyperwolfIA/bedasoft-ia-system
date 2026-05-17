import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signToken, setSessionCookie } from '@/lib/auth';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token y contraseña son obligatorios' }, { status: 400 });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json({
        error: 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas, números y símbolos.',
      }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { resetToken: token },
    });

    if (!user || !user.resetTokenExpiry) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 });
    }

    if (new Date() > user.resetTokenExpiry) {
      return NextResponse.json({ error: 'El enlace de recuperación ha expirado. Solicite uno nuevo.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Auto-login after password reset
    const userPayload = {
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      activeModules: updatedUser.activeModules,
      googleConnected: !!updatedUser.googleRefreshToken,
    };

    const jwtToken = await signToken(userPayload);
    const response = NextResponse.json({
      success: true,
      message: 'Contraseña actualizada con éxito.',
      token: jwtToken,
      user: {
        email: updatedUser.email,
        name: updatedUser.name,
        activeModules: updatedUser.activeModules,
        googleConnected: !!updatedUser.googleRefreshToken,
      },
    });

    return setSessionCookie(response, jwtToken);

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
