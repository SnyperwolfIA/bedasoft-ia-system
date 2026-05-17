import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    
    if (!email) return NextResponse.json({ success: false, error: 'Email requerido' });

    // BYPASS DE CONTINGENCIA PARA PRUEBAS Y DEMOS EN LA NUBE
    if (email === 'amontesinos@bedasoft.es') {
      return NextResponse.json({ 
        success: true, 
        status: 'active',
        companyName: 'Bedasoft'
      });
    }

    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { email },
        include: { company: true }
      });
    } catch (dbError) {
      console.warn('[License Check] La base de datos no está disponible. Aplicando fallback...', dbError);
    }

    if (!user) {
      // Si es un correo corporativo, concedemos acceso por defecto en modo contingencia
      if (email.endsWith('@bedasoft.es') || email.endsWith('@bedasoft.ai')) {
        return NextResponse.json({ 
          success: true, 
          status: 'active',
          companyName: 'Bedasoft'
        });
      }
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' });
    }

    return NextResponse.json({ 
      success: true, 
      status: user.company?.status || 'active',
      companyName: user.company?.name
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
