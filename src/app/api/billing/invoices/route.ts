import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getListItems, createListItem } from '@/lib/microsoft-graph';

// GET /api/billing/invoices?userEmail=xxx&page=1&limit=5
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userEmail = searchParams.get('userEmail');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  if (!userEmail) return NextResponse.json({ success: false, error: 'Email requerido' });

  try {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ success: false, error: 'Usuario no encontrado' });

    // 1. Intentamos cargar desde la lista de SharePoint 'Facturas'
    try {
      const listItems = await getListItems('Facturas');
      if (listItems && listItems.length > 0) {
        console.log(`[Invoices API] Cargadas ${listItems.length} facturas en tiempo real desde SharePoint List.`);
        
        const mappedInvoices = listItems.map((item: any) => ({
          id: item.id,
          numFactura: item.fields.Title, // 'Title' es el número de factura
          total: Number(item.fields.Total || 0),
          currency: item.fields.Moneda || 'EUR',
          issueDate: item.fields.FechaEmision || item.createdDateTime || new Date().toISOString(),
          status: item.fields.Estado?.toLowerCase() || 'emitida',
          numPedido: item.fields.NumPedido || '',
          sharepointUrl: item.fields.SharePointUrl || '',
          client: item.fields.ClienteLookupId || item.fields.Cliente ? { name: item.fields.Cliente || 'Cliente Asociado' } : null,
          lines: [] // Las líneas detalladas se leen desde el PDF físico
        }));

        // Ordenamos por fecha de emisión descendente
        const sortedInvoices = mappedInvoices.sort((a: any, b: any) => 
          new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
        );

        // Paginación manual para SharePoint
        const total = sortedInvoices.length;
        const paginatedInvoices = sortedInvoices.slice((page - 1) * limit, page * limit);

        return NextResponse.json({ 
          success: true, 
          invoices: paginatedInvoices,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        });
      }
    } catch (spError) {
      console.warn('[Invoices API] Falló la carga desde SharePoint, usando local:', spError);
    }

    // Fallback: Base de datos local
    const total = await prisma.invoice.count({ where: { userId: user.id } });
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      include: { client: true, lines: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    return NextResponse.json({ 
      success: true, 
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}

// POST /api/billing/invoices — Create invoice directly (for API use)
export async function POST(req: NextRequest) {
  try {
    const { userEmail, clientName, lines } = await req.json();
    if (!userEmail) return NextResponse.json({ success: false, error: 'Email requerido' });

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ success: false, error: 'Usuario no encontrado' });

    let client = null;
    if (clientName) {
      client = await prisma.client.findFirst({
        where: { userId: user.id, name: { contains: clientName } }
      });
    }

    const total = (lines || []).reduce((acc: number, l: any) => acc + ((l.quantity || 1) * (l.unitPrice || 0)), 0);
    const numFactura = `FAC-${Date.now().toString().slice(-6)}`;

    // 1. Intentamos registrar en la Lista de SharePoint 'Facturas'
    let spUrl = '';
    try {
      const spItem = await createListItem('Facturas', {
        Title: numFactura,
        Total: total,
        Moneda: 'EUR',
        FechaEmision: new Date().toISOString(),
        Estado: 'Emitida',
        NumPedido: lines?.[0]?.description || 'Factura Bedasoft IA'
      });
      if (spItem && spItem.webUrl) {
        spUrl = spItem.webUrl;
        console.log('[Invoices API] Factura creada exitosamente en la lista de SharePoint:', spUrl);
      }
    } catch (spError) {
      console.warn('[Invoices API] No se pudo crear en la lista de SharePoint, guardando local:', spError);
    }
    
    const inv = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: client?.id || null,
        numFactura,
        total,
        sharepointUrl: spUrl,
        lines: {
          create: (lines || []).map((l: any) => ({
            description: l.description,
            quantity: l.quantity || 1,
            unitPrice: l.unitPrice || 0,
            totalPrice: (l.quantity || 1) * (l.unitPrice || 0)
          }))
        }
      },
      include: { client: true, lines: true }
    });

    return NextResponse.json({ success: true, invoice: inv });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
