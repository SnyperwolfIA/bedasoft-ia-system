const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('--- USUARIOS EN BASE DE DATOS ---');
  users.forEach(u => console.log(`ID: ${u.id} | Email: ${u.email} | Name: ${u.name}`));

  for (const u of users) {
    console.log(`\n=== DATOS PARA USUARIO: ${u.email} (ID: ${u.id}) ===`);
    const clients = await prisma.client.findMany({ where: { userId: u.id } });
    console.log(`\nClientes (${clients.length}):`);
    clients.forEach(c => console.log(`- ID: ${c.id} | Name: ${c.name} | SP: ${c.sharepointUrl}`));

    const invoices = await prisma.invoice.findMany({ 
      where: { userId: u.id },
      include: { client: true }
    });
    console.log(`\nFacturas (${invoices.length}):`);
    invoices.forEach(i => console.log(`- ID: ${i.id} | Num: ${i.numFactura} | Cliente: ${i.client?.name || 'N/A'} (ID: ${i.clientId}) | Total: ${i.total}€ | SP: ${i.sharepointUrl}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
