import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendEmail, buildPasswordResetEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email obligatorio' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: 'Si el email está registrado, recibirá un enlace de recuperación en su bandeja de entrada.',
    };

    if (!user) {
      return NextResponse.json(successResponse);
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { email },
      data: { resetToken, resetTokenExpiry },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    // Send email (falls back to console log if SMTP not configured)
    await sendEmail({
      to: email,
      subject: 'Recuperación de Contraseña – Bedasoft IA',
      html: buildPasswordResetEmail(user.name || '', resetUrl),
    });

    return NextResponse.json(successResponse);

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
