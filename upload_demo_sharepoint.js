require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Configuración de Microsoft Graph
const msalConfig = {
  auth: {
    clientId: '1cbb0b14-cfd9-4e8d-a65e-f5e64c949bb0',
    authority: 'https://login.microsoftonline.com/80324945-885b-4f3e-99db-a1057b53db70',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  }
};

let pca = null;
function getPca() {
  if (!pca) {
    pca = new ConfidentialClientApplication(msalConfig);
  }
  return pca;
}

// Obtener Token de Graph
async function getGraphToken() {
  const tokenRequest = {
    scopes: ['https://graph.microsoft.com/.default'],
  };
  try {
    const response = await getPca().acquireTokenByClientCredential(tokenRequest);
    return response.accessToken;
  } catch (error) {
    console.error('Error al obtener token de Graph:', error);
    throw error;
  }
}

// Obtener Site ID de SharePoint
async function getSiteId(token) {
  const hostname = 'bedasoftes.sharepoint.com';
  const sitePath = '/sites/BedasoftIASystem';
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.id) {
      console.log(`[SharePoint] Site ID encontrado: ${data.id}`);
      return data.id;
    }
    console.error('[SharePoint] Error al obtener Site ID:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[SharePoint] Error de red buscando Site ID:', e);
  }
  return 'root';
}

// Inicializar Estructura de carpetas en SharePoint
async function initializeStructure(token, siteId) {
  const folders = ['Facturas', 'Clientes'];
  for (const folderName of folders) {
    console.log(`[SharePoint] Asegurando carpeta: ${folderName}`);
    try {
      const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'name': folderName,
          'folder': {},
          '@microsoft.graph.conflictBehavior': 'replace' // Sobrescribir si ya existe
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[SharePoint] Carpeta '${folderName}' lista.`);
      } else {
        console.warn(`[SharePoint] Info carpeta '${folderName}':`, data.error?.message);
      }
    } catch (e) {
      console.error(`[SharePoint] Error de red al crear carpeta ${folderName}:`, e);
    }
  }
}

// Subir Cliente a SharePoint (JSON)
async function uploadClientToSharePoint(token, siteId, client) {
  const fileName = `Cliente-${client.name.replace(/\s+/g, '_')}.json`;
  console.log(`[SharePoint] Subiendo cliente: ${client.name} como ${fileName}...`);
  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/Clientes/${fileName}:/content`;
  
  const clientJson = {
    id: client.id,
    name: client.name,
    cif: client.cif,
    address: client.address,
    postalCode: client.postalCode,
    city: client.city,
    email: client.email,
    phone: client.phone,
    timestamp: new Date().toISOString()
  };

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(clientJson, null, 2)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[SharePoint] Error al subir cliente:', JSON.stringify(errorData, null, 2));
    throw new Error(`Error subiendo cliente ${client.name} a SharePoint`);
  }

  const data = await response.json();
  console.log(`[SharePoint] Cliente ${client.name} subido con éxito: ${data.webUrl}`);
  return data.webUrl;
}

// Generar PDF usando pdf-lib
async function generateInvoicePDF(invoice, client, lines) {
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

  // Logo
  try {
    const logoPath = path.join(__dirname, 'public', 'images', 'logo_official.png');
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
    console.error('Error cargando logo en el generador de PDF:', e);
  }

  // Cabecera
  page.drawText('BEDASOFT IA', { x: 50, y: height - 100, size: 24, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText('Plataforma de Inteligencia Artificial', { x: 50, y: height - 115, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  page.drawText('FACTURA', { x: width - 180, y: height - 60, size: 20, font: fontBold, color: rgb(0, 0, 0) });
  page.drawText(invoice.numFactura, { x: width - 180, y: height - 85, size: 14, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`Nº Pedido: ${invoice.numPedido || 'N/A'}`, { x: width - 180, y: height - 105, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(new Date(invoice.issueDate).toLocaleDateString('es-ES'), { x: width - 180, y: height - 120, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });

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
  page.drawText(client.name, { x: width / 2 + 50, y: height - 175, size: 14, font: fontBold });
  
  const clientDetails = [
    client.address || 'Sin dirección',
    `${client.postalCode || ''} ${client.city || ''}`,
    client.cif ? `CIF: ${client.cif}` : '',
    client.phone ? `Tel: ${client.phone}` : ''
  ].filter(Boolean).join('\n');
  page.drawText(clientDetails, { x: width / 2 + 50, y: height - 195, size: 10, font: fontRegular, lineHeight: 15, color: rgb(0.3, 0.3, 0.3) });

  // Tabla
  let y = height - 300;
  page.drawText('CONCEPTO', { x: 50, y, size: 9, font: fontBold });
  page.drawText('CANT.', { x: 350, y, size: 9, font: fontBold });
  page.drawText('PRECIO', { x: 430, y, size: 9, font: fontBold });
  page.drawText('TOTAL', { x: 510, y, size: 9, font: fontBold });
  page.drawLine({ start: { x: 50, y: y - 5 }, end: { x: width - 50, y: y - 5 }, thickness: 0.5 });
  
  y -= 25;
  lines.forEach((line) => {
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

// Subir Factura PDF a SharePoint
async function uploadInvoiceToSharePoint(token, siteId, pdfBytes, numFactura) {
  const fileName = `${numFactura}.pdf`;
  console.log(`[SharePoint] Subiendo factura: ${fileName}...`);
  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/Facturas/${fileName}:/content`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/pdf'
    },
    body: Buffer.from(pdfBytes)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[SharePoint] Error al subir factura:', JSON.stringify(errorData, null, 2));
    throw new Error(`Error subiendo factura ${numFactura} a SharePoint`);
  }

  const data = await response.json();
  console.log(`[SharePoint] Factura ${numFactura} subida con éxito: ${data.webUrl}`);
  return data.webUrl;
}

// Función principal
async function main() {
  console.log('=== PROTOCOLO DE DESPLIEGUE A SHAREPOINT ONLINE ===');
  
  const token = await getGraphToken();
  const siteId = await getSiteId(token);
  
  // 1. Asegurar la estructura de carpetas
  await initializeStructure(token, siteId);

  const targetEmails = ['amontesinos@bedasoft.es', 'angel.mchuan@outlook.com'];

  for (const email of targetEmails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.warn(`[Base de Datos] Usuario no encontrado: ${email}. Omitiendo...`);
      continue;
    }
    const userId = user.id;
    console.log(`\n>>> Sincronizando datos para usuario: ${email} (ID: ${userId})`);

    // Limpiar base de datos antes de poblar para evitar conflictos de ID / Unicidad
    const userInvoices = await prisma.invoice.findMany({ where: { userId } });
    for (const inv of userInvoices) {
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: inv.id } });
    }
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.client.deleteMany({ where: { userId } });
    console.log('[Base de Datos] Limpieza completada.');

    // Clientes de prueba
    const clientData = [
      {
        name: 'Nexus Cybernetics',
        cif: 'B12345678',
        address: 'Av. de la Inteligencia Artificial 42, Edificio B',
        postalCode: '28045',
        city: 'Madrid',
        email: 'billing@nexuscyber.com',
        phone: '+34 910 123 456'
      },
      {
        name: 'CyberCore Solutions',
        cif: 'B87654321',
        address: 'Calle del Algoritmo 15, Planta 4',
        postalCode: '08018',
        city: 'Barcelona',
        email: 'finance@cybercore.es',
        phone: '+34 931 987 654'
      },
      {
        name: 'Acme Global Technologies',
        cif: 'B99887766',
        address: 'Paseo de la Nube Virtual 99',
        postalCode: '46002',
        city: 'Valencia',
        email: 'contabilidad@acmetech.com',
        phone: '+34 963 456 789'
      },
      {
        name: 'Stark Industries España',
        cif: 'B55443322',
        address: 'Torre Stark Planta 10, Gran Vía',
        postalCode: '48009',
        city: 'Bilbao',
        email: 'finance@stark.es',
        phone: '+34 944 111 222'
      }
    ];

    const createdClients = [];
    for (const c of clientData) {
      // 1. Crear en BD local
      const client = await prisma.client.create({
        data: { ...c, userId }
      });
      
      // 2. Subir a SharePoint
      try {
        const sharepointUrl = await uploadClientToSharePoint(token, siteId, client);
        
        // 3. Actualizar con URL real
        const updatedClient = await prisma.client.update({
          where: { id: client.id },
          data: { sharepointUrl }
        });
        createdClients.push(updatedClient);
      } catch (err) {
        console.error(`Error subiendo cliente ${c.name}:`, err);
        createdClients.push(client);
      }
    }
    console.log(`[Base de Datos] Sincronizados ${createdClients.length} clientes.`);

    // Prefijo de factura único por usuario
    const invoicePrefix = email.includes('outlook') ? 'FAC-MC-' : 'FAC-2026-';

    const invoiceSpecs = [
      {
        numFactura: `${invoicePrefix}001`,
        numPedido: 'PED-9001',
        total: 4850.00,
        issueDate: new Date('2026-02-15T10:00:00Z'),
        status: 'pagada',
        clientName: 'Nexus Cybernetics',
        lines: [
          { description: 'Licencias Bedasoft Neural AI - Basic Pack', quantity: 5, unitPrice: 800 },
          { description: 'Consultoría e Integración con Teams', quantity: 1, unitPrice: 850 }
        ]
      },
      {
        numFactura: `${invoicePrefix}002`,
        numPedido: 'PED-9002',
        total: 2900.00,
        issueDate: new Date('2026-03-10T11:30:00Z'),
        status: 'emitida',
        clientName: 'CyberCore Solutions',
        lines: [
          { description: 'Desarrollo de Automatizaciones de Flujos', quantity: 20, unitPrice: 120 },
          { description: 'Mantenimiento del Sistema Cloud', quantity: 1, unitPrice: 500 }
        ]
      },
      {
        numFactura: `${invoicePrefix}003`,
        numPedido: 'PED-9003',
        total: 6700.00,
        issueDate: new Date('2026-04-05T09:15:00Z'),
        status: 'pagada',
        clientName: 'Acme Global Technologies',
        lines: [
          { description: 'Servicios de Migración de SharePoint local a Online', quantity: 1, unitPrice: 4500 },
          { description: 'Soporte y formación de operadores', quantity: 2, unitPrice: 1100 }
        ]
      },
      {
        numFactura: `${invoicePrefix}004`,
        numPedido: 'PED-9004',
        total: 8500.00,
        issueDate: new Date('2026-04-20T15:45:00Z'),
        status: 'emitida',
        clientName: 'Stark Industries España',
        lines: [
          { description: 'Bedasoft IA Copilot-ready Enterprise Pack', quantity: 1, unitPrice: 7500 },
          { description: 'Auditoría de ciberseguridad inicial', quantity: 1, unitPrice: 1000 }
        ]
      },
      {
        numFactura: `${invoicePrefix}005`,
        numPedido: 'PED-9005',
        total: 12000.00,
        issueDate: new Date('2026-05-12T08:00:00Z'),
        status: 'emitida',
        clientName: 'Nexus Cybernetics',
        lines: [
          { description: 'Reingeniería de Procesos Neurales y LLM dedicados', quantity: 1, unitPrice: 12000 }
        ]
      },
      {
        numFactura: `${invoicePrefix}006`,
        numPedido: 'PED-9006',
        total: 3400.00,
        issueDate: new Date('2026-05-18T14:20:00Z'),
        status: 'pagada',
        clientName: 'CyberCore Solutions',
        lines: [
          { description: 'Análisis Documental de RRHH módulo IA adicional', quantity: 1, unitPrice: 3400 }
        ]
      }
    ];

    for (const spec of invoiceSpecs) {
      const matchedClient = createdClients.find(c => c.name === spec.clientName);
      
      // 1. Crear Factura en BD local
      const invoice = await prisma.invoice.create({
        data: {
          userId,
          clientId: matchedClient ? matchedClient.id : null,
          numFactura: spec.numFactura,
          numPedido: spec.numPedido,
          total: spec.total,
          issueDate: spec.issueDate,
          createdAt: spec.issueDate,
          status: spec.status,
        }
      });

      // Crear las líneas de factura
      const createdLines = [];
      for (const line of spec.lines) {
        const dbLine = await prisma.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.quantity * line.unitPrice
          }
        });
        createdLines.push(dbLine);
      }

      // 2. Generar PDF
      try {
        const pdfBytes = await generateInvoicePDF(invoice, matchedClient || { name: 'Venta Directa' }, createdLines);
        
        // 3. Subir PDF a SharePoint
        const sharepointUrl = await uploadInvoiceToSharePoint(token, siteId, pdfBytes, spec.numFactura);

        // 4. Actualizar con URL de SharePoint real
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { sharepointUrl }
        });
      } catch (err) {
        console.error(`Error procesando PDF / SharePoint para factura ${spec.numFactura}:`, err);
      }
    }
    console.log(`[Base de Datos] Sincronizadas y subidas ${invoiceSpecs.length} facturas.`);
  }

  console.log('\n=== PROCESO DE SINCRONIZACIÓN DE LA DEMO COMPLETADO CON ÉXITO ===');
}

main()
  .catch(e => {
    console.error('Error fatal durante la sincronización:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
