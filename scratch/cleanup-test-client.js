const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.client.deleteMany({
    where: { name: { contains: 'Nexus' } }
  });
  console.log(`Eliminados ${res.count} clientes.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
