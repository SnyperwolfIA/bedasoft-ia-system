import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { signToken, setSessionCookie } from '@/lib/auth';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, activeModules } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son obligatorios' }, { status: 400 });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json({
        error: 'La contraseña debe tener al menos 8 caracteres, incluyendo mayúsculas, minúsculas, números y símbolos.'
      }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        activeModules: activeModules || '',
        emailVerified: true,
      },
    });

    const userPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      activeModules: user.activeModules,
      googleConnected: false,
    };

    const token = await signToken(userPayload);

    const response = NextResponse.json({
      success: true,
      message: 'Usuario registrado con éxito',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        activeModules: user.activeModules,
        googleConnected: false,
      },
    });

    return setSessionCookie(response, token);

  } catch (error: any) {
    console.error('SERVER_ERROR:', error);
    return NextResponse.json({
      error: `Error de Servidor: ${error.message || 'Error desconocido'}`
    }, { status: 500 });
  }
}
