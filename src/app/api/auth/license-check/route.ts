import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    
    if (!email) return NextResponse.json({ success: false, error: 'Email requerido' });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true }
    });

    if (!user) return NextResponse.json({ success: false, error: 'Usuario no encontrado' });

    return NextResponse.json({ 
      success: true, 
      status: user.company?.status || 'active',
      companyName: user.company?.name
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
