const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    include: { users: true }
  });
  console.log('--- COMPAÑÍAS Y SUS USUARIOS ---');
  if (companies.length === 0) {
    console.log('No hay compañías registradas.');
  } else {
    companies.forEach(c => {
      console.log(`\nCompañía: ${c.name} (CIF: ${c.cif}, Status: ${c.status}, ID: ${c.id}, LicenseKey: ${c.licenseKey})`);
      console.log(`Usuarios en esta compañía (${c.users.length}):`);
      c.users.forEach(u => {
        console.log(`  - ${u.name} (${u.email}) | Módulos activos: [${u.activeModules}]`);
      });
    });
  }

  const independentUsers = await prisma.user.findMany({
    where: { companyId: null }
  });
  if (independentUsers.length > 0) {
    console.log('\n--- USUARIOS SIN COMPAÑÍA ---');
    independentUsers.forEach(u => {
      console.log(`  - ${u.name} (${u.email}) | Módulos activos: [${u.activeModules}]`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
