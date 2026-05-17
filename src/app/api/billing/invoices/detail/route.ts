import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/billing/invoices/detail?id=xxx
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { client: true, lines: true }
    });

    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    return NextResponse.json({ success: true, invoice });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
