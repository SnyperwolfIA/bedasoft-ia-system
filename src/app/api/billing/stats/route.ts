export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getFolderFiles, getListItems } from '@/lib/microsoft-graph';

export async function GET(req: NextRequest) {
  try {
    const userEmail = req.nextUrl.searchParams.get('userEmail');
    if (!userEmail) return NextResponse.json({ error: 'userEmail required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const currentYear = new Date().getFullYear();
    const monthlyTotals = new Array(12).fill(0);

    // 1. Intentamos cargar desde la carpeta de SharePoint 'Facturas' (Document Library)
    try {
      const folderFiles = await getFolderFiles('Facturas');
      
      if (folderFiles && Array.isArray(folderFiles)) {
        console.log(`[Stats API] Cargando estadísticas de ${folderFiles.length} archivos físicos de SharePoint.`);
        
        let listItems: any[] = [];
        try {
          listItems = await getListItems('Facturas');
        } catch (listErr) {
          console.warn('[Stats API] No se pudo obtener la lista de SharePoint:', listErr);
        }

        // Cargamos todas las facturas locales del usuario para cruce de datos y filtrado
        let localInvoices: any[] = [];
        try {
          localInvoices = await prisma.invoice.findMany({
            where: { userId: user.id }
          });
        } catch (dbErr) {
          console.warn('[Stats API] No se pudo cargar localInvoices:', dbErr);
        }

        folderFiles.forEach((file: any) => {
          const numFactura = file.name.replace(/\.[^/.]+$/, "");
          const cleanNumFactura = numFactura.toLowerCase().trim();
          
          // Buscar correspondencia en local para verificar pertenencia al usuario
          const localInv = localInvoices.find(li => {
            const liNum = li.numFactura.toLowerCase().trim();
            return cleanNumFactura.includes(liNum) || liNum.includes(cleanNumFactura);
          });

          // Si no pertenece a este usuario, no lo sumamos a sus estadísticas
          if (!localInv) return;

          // Cruce de datos flexible por subcadena con lista de SharePoint
          const matchedItem = listItems.find(item => {
            if (!item.fields?.Title) return false;
            const title = item.fields.Title.toLowerCase().trim();
            return cleanNumFactura.includes(title) || title.includes(cleanNumFactura);
          });

          const issueDateStr = localInv.issueDate || localInv.createdAt || file.createdDateTime || matchedItem?.fields?.FechaEmision || new Date().toISOString();
          const issueDate = new Date(issueDateStr);
          
          if (issueDate.getFullYear() === currentYear) {
            const month = issueDate.getMonth(); // 0-11
            const total = matchedItem?.fields?.Total ? Number(matchedItem.fields.Total) : localInv.total;
            monthlyTotals[month] += total;
          }
        });

        return NextResponse.json({ 
          success: true, 
          monthlyTotals,
          year: currentYear
        });
      }
    } catch (spError) {
      console.warn('[Stats API] Falló la carga desde SharePoint, usando local:', spError);
    }

    // Fallback: Base de datos local (solo si falla la conexión con SharePoint)
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
