import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getListItems, createListItem } from '@/lib/microsoft-graph';

// GET /api/billing/clients?userEmail=xxx  → list all clients
export async function GET(req: NextRequest) {
  try {
    const userEmail = req.nextUrl.searchParams.get('userEmail');
    if (!userEmail) return NextResponse.json({ error: 'userEmail required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Intentamos cargar desde la lista de SharePoint 'Clientes'
    try {
      const listItems = await getListItems('Clientes');
      if (listItems && listItems.length > 0) {
        console.log(`[Clients API] Cargados ${listItems.length} clientes en tiempo real desde SharePoint List.`);
        const clients = listItems.map((item: any) => ({
          id: item.id,
          name: item.fields.Title, // 'Title' es el nombre
          cif: item.fields.CIF || '',
          address: item.fields.Dirección || '',
          email: item.fields.Email || '',
          phone: item.fields.Telefono || '',
          sharepointUrl: item.fields.SharePointUrl || '',
          invoices: [],
          createdAt: item.createdDateTime || new Date().toISOString()
        }));
        return NextResponse.json({ success: true, clients });
      }
    } catch (spError) {
      console.warn('[Clients API] Falló la carga desde SharePoint, usando base de datos local:', spError);
    }

    // Fallback: Base de datos local
    const clients = await prisma.client.findMany({
      where: { userId: user.id },
      include: { invoices: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, clients });
  } catch (error: any) {
    console.error('GET clients error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/billing/clients  → create a client
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userEmail, name, cif, address, email, phone } = body;

    if (!userEmail || !name) {
      return NextResponse.json({ error: 'userEmail y name son obligatorios' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // 1. Intentamos registrar en la Lista de SharePoint 'Clientes'
    let spUrl = '';
    try {
      const spItem = await createListItem('Clientes', {
        Title: name,
        CIF: cif || '',
        Dirección: address || '',
        Email: email || '',
        Telefono: phone || ''
      });
      if (spItem && spItem.webUrl) {
        spUrl = spItem.webUrl;
        console.log('[Clients API] Cliente creado exitosamente en la lista de SharePoint:', spUrl);
      }
    } catch (spError) {
      console.warn('[Clients API] No se pudo crear en la lista de SharePoint, guardando solo en local:', spError);
    }

    // 2. Registramos localmente (para persistencia o fallback)
    const existing = await prisma.client.findFirst({
      where: { userId: user.id, name: name },
    });
    
    if (existing) {
      // Si ya existe en BD local pero se creó en SP, actualizamos su URL
      if (spUrl) {
        const updated = await prisma.client.update({
          where: { id: existing.id },
          data: { sharepointUrl: spUrl }
        });
        return NextResponse.json({ success: true, client: updated });
      }
      return NextResponse.json({ error: `El cliente "${name}" ya existe en tu base de datos.` }, { status: 409 });
    }

    const client = await prisma.client.create({
      data: { userId: user.id, name, cif, address, email, phone, sharepointUrl: spUrl },
    });

    return NextResponse.json({ success: true, client });
  } catch (error: any) {
    console.error('POST clients error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/billing/clients  → delete a client by id
export async function DELETE(req: NextRequest) {
  try {
    const { clientId, userEmail } = await req.json();
    if (!clientId || !userEmail) return NextResponse.json({ error: 'clientId y userEmail requeridos' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const client = await prisma.client.findFirst({ where: { id: clientId, userId: user.id } });
    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    await prisma.client.delete({ where: { id: clientId } });

    return NextResponse.json({ success: true, message: `Cliente "${client.name}" eliminado.` });
  } catch (error: any) {
    console.error('DELETE clients error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
