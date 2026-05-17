import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function generateInvoicePDF(invoice: any) {
  // Crear el PDF con pdf-lib
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  
  // Fondo blanco
  page.drawRectangle({
    x: 0, y: 0, width: width, height: height,
    color: rgb(1, 1, 1)
  });

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Intentar cargar logo
  try {
    const logoPath = path.join(process.cwd(), 'public', 'images', 'logo_official.png');
    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath);
      const logoEmbed = await pdfDoc.embedPng(logoBytes);
      const dims = logoEmbed.scale(0.3);
      page.drawImage(logoEmbed, {
        x: 50, y: height - 80,
        width: dims.width, height: dims.height,
      });
    }
  } catch (e) {
    console.error('Error loading logo for PDF generator:', e);
  }

  // Cabecera
  page.drawText('BEDASOFT IA', { x: 50, y: height - 100, size: 24, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText('Plataforma de Inteligencia Artificial', { x: 50, y: height - 115, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  page.drawText('FACTURA', { x: width - 150, y: height - 60, size: 20, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText(invoice.numFactura, { x: width - 150, y: height - 85, size: 14, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`Nº Pedido: ${invoice.numPedido || 'N/A'}`, { x: width - 150, y: height - 105, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(new Date(invoice.createdAt || new Date()).toLocaleDateString(), { x: width - 150, y: height - 120, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });

  // Separador
  page.drawLine({
    start: { x: 50, y: height - 130 },
    end: { x: width - 50, y: height - 130 },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  // Emisor
  page.drawText('EMISOR', { x: 50, y: height - 160, size: 8, font: fontBold, color: rgb(0.6, 0.6, 0.6) });
  page.drawText('Bedasoft IA System', { x: 50, y: height - 175, size: 11, font: fontBold });
  page.drawText('Calle de la Inteligencia, 101\n28001 Madrid, España\nCIF: B99887766', { 
    x: 50, y: height - 195, size: 10, font: fontRegular, lineHeight: 15, color: rgb(0.3, 0.3, 0.3) 
  });

  // Cliente
  page.drawText('CLIENTE', { x: width / 2 + 50, y: height - 160, size: 8, font: fontBold, color: rgb(0.6, 0.6, 0.6) });
  const clientName = invoice.client?.name || 'Venta Directa';
  page.drawText(clientName, { x: width / 2 + 50, y: height - 175, size: 14, font: fontBold });
  
  if (invoice.client) {
    const clientDetails = [
      invoice.client.address,
      `${invoice.client.postalCode || ''} ${invoice.client.city || ''}`,
      invoice.client.cif ? `CIF: ${invoice.client.cif}` : '',
      invoice.client.phone ? `Tel: ${invoice.client.phone}` : ''
    ].filter(Boolean).join('\n');
    page.drawText(clientDetails, { x: width / 2 + 50, y: height - 195, size: 10, font: fontRegular, lineHeight: 15, color: rgb(0.3, 0.3, 0.3) });
  }

  // Tabla
  let y = height - 300;
  page.drawText('CONCEPTO', { x: 50, y, size: 9, font: fontBold });
  page.drawText('CANT.', { x: 350, y, size: 9, font: fontBold });
  page.drawText('PRECIO', { x: 430, y, size: 9, font: fontBold });
  page.drawText('TOTAL', { x: 510, y, size: 9, font: fontBold });
  page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: width - 50, y: y - 5 }, thickness: 0.5 });
  
  y -= 25;
  const lines = invoice.lines || [];
  lines.forEach((line: any) => {
    page.drawText(line.description.slice(0, 50), { x: 55, y, size: 10, font: fontRegular });
    page.drawText(String(line.quantity), { x: 350, y, size: 10, font: fontRegular });
    page.drawText(`${line.unitPrice.toFixed(2)}€`, { x: 430, y, size: 10, font: fontRegular });
    page.drawText(`${line.totalPrice.toFixed(2)}€`, { x: 510, y, size: 10, font: fontBold });
    y -= 20;
  });

  // Totales
  y -= 30;
  page.drawText('Base Imponible:', { x: 380, y, size: 10, font: fontRegular });
  page.drawText(`${(invoice.total / 1.21).toFixed(2)}€`, { x: 510, y, size: 10, font: fontRegular });
  y -= 20;
  page.drawText('IVA (21%):', { x: 380, y, size: 10, font: fontRegular });
  page.drawText(`${(invoice.total - (invoice.total / 1.21)).toFixed(2)}€`, { x: 510, y, size: 10, font: fontRegular });

  y -= 40;
  page.drawRectangle({ x: 370, y: y - 10, width: 200, height: 40, color: rgb(0, 0, 0) });
  page.drawText('TOTAL', { x: 380, y, size: 16, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(`${invoice.total.toFixed(2)}€`, { x: 510, y, size: 16, font: fontBold, color: rgb(1, 1, 1) });

  return await pdfDoc.save();
}
