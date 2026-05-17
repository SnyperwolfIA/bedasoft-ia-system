import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, setSessionCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token no proporcionado' }, { status: 400 });
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: payload
    });

    // IMPORTANTE: Establecer la cookie de sesión para que el middleware la reconozca
    return setSessionCookie(response, token);

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
