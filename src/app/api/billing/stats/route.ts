import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const userEmail = req.nextUrl.searchParams.get('userEmail');
    if (!userEmail) return NextResponse.json({ error: 'userEmail required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Obtener facturas del año actual
    const currentYear = new Date().getFullYear();
    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        issueDate: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`),
        }
      },
      select: {
        total: true,
        issueDate: true
      }
    });

    // Agrupar por mes (0-11)
    const monthlyTotals = new Array(12).fill(0);
    invoices.forEach(inv => {
      const month = new Date(inv.issueDate).getMonth();
      monthlyTotals[month] += inv.total;
    });

    return NextResponse.json({ 
      success: true, 
      monthlyTotals,
      year: currentYear
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
