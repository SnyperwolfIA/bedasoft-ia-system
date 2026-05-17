import { NextResponse } from 'next/server';
import { createOAuth2Client } from '@/lib/google';
import prisma from '@/lib/prisma';
import { google } from 'googleapis';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect('http://localhost:3002/dashboard?error=no_code');
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Obtener información del usuario para saber quién es
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.email) {
      throw new Error('No se pudo obtener el email de Google');
    }

    // Guardar tokens en el usuario correspondiente
    // IMPORTANTE: En producción usaríamos la sesión activa, 
    // para este MVP buscamos por el email devuelto por Google
    await prisma.user.update({
      where: { email: googleUser.email },
      data: {
        googleRefreshToken: tokens.refresh_token,
        googleAccessToken: tokens.access_token,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    return NextResponse.redirect('http://localhost:3002/dashboard?success=google_connected');
  } catch (error) {
    console.error('Google Callback Error:', error);
    return NextResponse.redirect('http://localhost:3002/dashboard?error=callback_failed');
  }
}
