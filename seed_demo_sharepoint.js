const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- INICIANDO PROTOCOLO DE SEEDING: FACTURACIÓN SHAREPOINT ---');

  // Cuentas de usuario clave para la demo
  const targetEmails = ['amontesinos@bedasoft.es', 'angel.mchuan@outlook.com'];

  for (const email of targetEmails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.warn(`Usuario no encontrado: ${email}. Omitiendo...`);
      continue;
    }
    const userId = user.id;
    console.log(`Poblando datos de SharePoint para usuario: ${email} (ID: ${userId})`);

    // 1. Eliminar facturas e invoice lines existentes del usuario para hacer reset limpio
    const userInvoices = await prisma.invoice.findMany({ where: { userId } });
    for (const inv of userInvoices) {
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: inv.id } });
    }
    await prisma.invoice.deleteMany({ where: { userId } });
    await prisma.client.deleteMany({ where: { userId } });

    console.log(`Limpieza completada de datos antiguos de facturación para ${email}.`);

    // 2. Crear clientes realistas
    const clientData = [
      {
        name: 'Nexus Cybernetics',
        cif: 'B12345678',
        address: 'Av. de la Inteligencia Artificial 42, Edificio B',
        postalCode: '28045',
        city: 'Madrid',
        email: 'billing@nexuscyber.com',
        phone: '+34 910 123 456',
        sharepointUrl: 'https://bedasoftes.sharepoint.com/sites/BedasoftIASystem/Documentos%20compartidos/Clientes/Nexus_Cybernetics'
      },
      {
        name: 'CyberCore Solutions',
        cif: 'B87654321',
        address: 'Calle del Algoritmo 15, Planta 4',
        postalCode: '08018',
        city: 'Barcelona',
        email: 'finance@cybercore.es',
        phone: '+34 931 987 654',
        sharepointUrl: 'https://bedasoftes.sharepoint.com/sites/BedasoftIASystem/Documentos%20compartidos/Clientes/CyberCore_Solutions'
      },
      {
        name: 'Acme Global Technologies',
        cif: 'B99887766',
        address: 'Paseo de la Nube Virtual 99',
        postalCode: '46002',
        city: 'Valencia',
        email: 'contabilidad@acmetech.com',
        phone: '+34 963 456 789',
        sharepointUrl: 'https://bedasoftes.sharepoint.com/sites/BedasoftIASystem/Documentos%20compartidos/Clientes/Acme_Global'
      },
      {
        name: 'Stark Industries España',
        cif: 'B55443322',
        address: 'Torre Stark Planta 10, Gran Vía',
        postalCode: '48009',
        city: 'Bilbao',
        email: 'finance@stark.es',
        phone: '+34 944 111 222',
        sharepointUrl: 'https://bedasoftes.sharepoint.com/sites/BedasoftIASystem/Documentos%20compartidos/Clientes/Stark_Industries'
      }
    ];

    const createdClients = [];
    for (const c of clientData) {
      const client = await prisma.client.create({
        data: {
          ...c,
          userId
        }
      });
      createdClients.push(client);
    }
    console.log(`Creados ${createdClients.length} clientes premium.`);

    // Prefijo único de factura según el email del usuario para respetar el Unique Constraint de la base de datos
    const invoicePrefix = email.includes('outlook') ? 'FAC-MC-' : 'FAC-2026-';

    // 3. Crear facturas con fechas y montos realistas para una gráfica impecable
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
      
      const spUrl = `https://bedasoftes.sharepoint.com/sites/BedasoftIASystem/Documentos%20compartidos/Facturas/${spec.numFactura}.pdf`;

      const invoice = await prisma.invoice.create({
        data: {
          userId,
          clientId: matchedClient ? matchedClient.id : null,
          numFactura: spec.numFactura,
          numPedido: spec.numPedido,
          total: spec.total,
          issueDate: spec.issueDate,
          createdAt: spec.issueDate, // Forzar createdAt para que coincida con la gráfica
          status: spec.status,
          sharepointUrl: spUrl
        }
      });

      // Crear las líneas de factura correspondientes
      for (const line of spec.lines) {
        await prisma.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: line.quantity * line.unitPrice
          }
        });
      }
    }
    console.log(`Sincronizadas e insertadas ${invoiceSpecs.length} facturas de SharePoint.`);
  }

  console.log('--- SEEDING COMPLETADO CON ÉXITO ---');
}

main()
  .catch((e) => {
    console.error('Error durante el seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
