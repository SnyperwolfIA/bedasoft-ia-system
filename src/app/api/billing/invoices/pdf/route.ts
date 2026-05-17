import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { uploadInvoiceToSharePoint, initializeBedasoftStructure } from '@/lib/microsoft-graph';

export async function GET(req: NextRequest) {
  try {
    const invoiceId = req.nextUrl.searchParams.get('id');
    const userEmail = req.nextUrl.searchParams.get('userEmail');

    if (!invoiceId) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true, lines: true }
    });

    if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });

    let logoImage;
    try {
      const fs = require('fs');
      const path = require('path');
      const logoPath = path.join(process.cwd(), 'public', 'images', 'logo_official.png');
      const logoBytes = fs.readFileSync(logoPath);
      logoImage = logoBytes;
    } catch (e) {
      console.error('Error loading logo for PDF:', e);
    }

    const pdfBytes = await generateInvoicePDF(invoice);

    // NUEVO: Sincronización con SharePoint
    try {
      await initializeBedasoftStructure(); // Asegurar que la carpeta existe
      const fileName = `Factura-${invoice.numFactura}.pdf`;
      const sharepointUrl = await uploadInvoiceToSharePoint(pdfBytes, fileName);
      
      // Guardar la URL en la base de datos
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { sharepointUrl }
      });
      
      console.log(`Factura subida a SharePoint: ${sharepointUrl}`);
    } catch (spError) {
      console.error('Error al subir a SharePoint:', spError);
      // No bloqueamos la descarga del PDF si falla la subida, pero lo logueamos
    }

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Factura-${invoice.numFactura}.pdf"`,
      }
    });

  } catch (error: any) {
    console.error('PDF Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
