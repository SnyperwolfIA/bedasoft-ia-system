const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const BEDASOFT_COMPANY_ID = 'cmp_bedasoft_id';

// Lista de los 17 empleados del sistema (Teams / SharePoint)
const EMPLEADOS = [
  { nombre: "Carlos Jiménez Ruiz",    email: "carlos.jimenez@bedasoft.es",  departamento: "RRHH",       cargo: "Director de RRHH",         role: "admin" },
  { nombre: "Ana Martínez López",     email: "ana.martinez@bedasoft.es",    departamento: "TI",         cargo: "Ing. de Software Senior",   role: "user" },
  { nombre: "Pedro Sánchez Morales",  email: "pedro.sanchez@bedasoft.es",   departamento: "Finanzas",   cargo: "Analista Financiero",      role: "user" },
  { nombre: "Laura García Fernández", email: "laura.garcia@bedasoft.es",    departamento: "Operaciones",cargo: "Jefa de Proyectos",         role: "user" },
  { nombre: "Miguel Torres Vega",     email: "miguel.torres@bedasoft.es",    departamento: "TI",         cargo: "DevOps Engineer",           role: "user" },
  { nombre: "Sofía Romero Castro",    email: "sofia.romero@bedasoft.es",    departamento: "Producto",   cargo: "Diseñadora UX/UI",          role: "user" },
  { nombre: "David Navarro Gil",      email: "david.navarro@bedasoft.es",   departamento: "Ventas",     cargo: "Comercial Senior",          role: "user" },
  { nombre: "Elena Díaz Herrera",     email: "elena.diaz@bedasoft.es",      departamento: "RRHH",       cargo: "Técnica de RRHH",           role: "admin" },
  { nombre: "Roberto Blanco Molina",  email: "roberto.blanco@bedasoft.es",  departamento: "TI",         cargo: "Arquitecto de Sistemas",    role: "user" },
  { nombre: "Cristina Ortiz Serrano", email: "cristina.ortiz@bedasoft.es",  departamento: "Marketing",  cargo: "Jefa de Marketing",         role: "user" },
  { nombre: "Juan Moreno Alonso",     email: "juan.moreno@bedasoft.es",     departamento: "TI",         cargo: "Técnico de Soporte",        role: "user" },
  { nombre: "Patricia León Fuentes",  email: "patricia.leon@bedasoft.es",   departamento: "Ventas",     cargo: "Directora Comercial",       role: "user" },
  { nombre: "Fernando Ruiz Cano",     email: "fernando.ruiz@bedasoft.es",   departamento: "Finanzas",   cargo: "Contable Senior",           role: "user" },
  { nombre: "Marta Iglesias Peña",    email: "marta.iglesias@bedasoft.es",  departamento: "Producto",   cargo: "Scrum Master",              role: "user" },
  { nombre: "Álvaro Méndez Prieto",   email: "alvaro.mendez@bedasoft.es",   departamento: "TI",         cargo: "Data Scientist",            role: "user" },
  { nombre: "Angel Montesinos",       email: "amontesinos@bedasoft.es",     departamento: "Producto",   cargo: "Scrum Master",              role: "user" },
  { nombre: "Angel MChuan",           email: "angel.mchuan@outlook.com",    departamento: "Producto",   cargo: "Scrum Master",              role: "user" },
  { nombre: "Administrador AI",       email: "admin@bedasoft.ai",           departamento: "TI",         cargo: "Administrator AI",          role: "admin" },
  { nombre: "Bedasoft Admin M365",    email: "admin@bedasoft.onmicrosoft.com", departamento: "TI",      cargo: "M365 Global Admin",         role: "admin" },
  { nombre: "Ángel Montesinos M365",   email: "amontesinos@bedasoft.onmicrosoft.com", departamento: "TI", cargo: "M365 Administrator",       role: "admin" },
  { nombre: "Operador Test AI",       email: "test_ai@bedasoft.ai",         departamento: "TI",         cargo: "Operador Test AI",          role: "user" },
  { nombre: "Angel MChuan (Gmail)",   email: "angel.mchuan@gmail.com",      departamento: "Producto",   cargo: "Scrum Master",              role: "user" },
  { nombre: "Nuria García",           email: "nuriagc_92@hotmail.es",       departamento: "RRHH",       cargo: "Técnica de RRHH",           role: "admin" }
];

async function main() {
  console.log('=== INICIANDO PROTOCOLO DE DEPURACIÓN Y SEMILLADO BEDASOFT ===\n');

  const defaultPasswordHash = await bcrypt.hash('Bedasoft2026!', 12);
  console.log(`🔑 Contraseña por defecto generada exitosamente ("Bedasoft2026!").`);

  // 1. Obtener la lista de emails de los 17 empleados para filtrados
  const emailsEmpleados = EMPLEADOS.map(e => e.email.toLowerCase());

  // 2. Depurar usuarios que no pertenezcan al equipo de Bedasoft
  const allUsers = await prisma.user.findMany();
  console.log(`\n🔍 Analizando ${allUsers.length} usuarios existentes en base de datos...`);
  
  let deletedCount = 0;
  for (const u of allUsers) {
    const userEmailLower = u.email.toLowerCase();
    if (!emailsEmpleados.includes(userEmailLower)) {
      console.log(`🗑️ Eliminando usuario ajeno (con cascade): ${u.name} (${u.email})`);
      await prisma.user.delete({ where: { id: u.id } });
      deletedCount++;
    } else {
      console.log(`🛡️ Conservando usuario corporativo: ${u.name} (${u.email})`);
      // Quitar temporalmente asociación de compañía para evitar violaciones de foreign key
      await prisma.user.update({
        where: { id: u.id },
        data: { companyId: null }
      });
    }
  }
  console.log(`✅ Depuración de usuarios completada: ${deletedCount} eliminados.`);

  // 3. Borrar el resto de empresas del panel de admin
  const allCompanies = await prisma.company.findMany();
  console.log(`\n🔍 Analizando ${allCompanies.length} empresas en base de datos...`);
  for (const c of allCompanies) {
    console.log(`🗑️ Eliminando empresa antigua: ${c.name} (ID: ${c.id})`);
    await prisma.company.delete({ where: { id: c.id } });
  }
  console.log(`✅ Eliminación de empresas antiguas completada.`);

  // 4. Crear la empresa Bedasoft con el ID estático y la licencia correspondiente
  console.log(`\n🏢 Creando la empresa Bedasoft en el Panel de Control...`);
  const bedasoftCompany = await prisma.company.create({
    data: {
      id: BEDASOFT_COMPANY_ID,
      name: 'Bedasoft',
      cif: 'B12345678',
      status: 'active',
      licenseKey: 'LIC-BEDASOFT'
    }
  });
  console.log(`✅ Empresa Bedasoft creada: ID="${bedasoftCompany.id}", Licencia="${bedasoftCompany.licenseKey}"`);

  // 5. Vincular y crear los 17 empleados bajo la empresa Bedasoft
  console.log(`\n👥 Vinculando y sembrando los 17 empleados corporativos...`);
  for (const emp of EMPLEADOS) {
    const existing = await prisma.user.findUnique({ where: { email: emp.email } });
    const allModulesString = 'facturacion,rrhh,jiraneural,mailing';

    if (existing) {
      console.log(`🔄 Actualizando y re-vinculando usuario existente: ${emp.nombre} (${emp.email})`);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: emp.nombre,
          password: defaultPasswordHash,
          companyId: BEDASOFT_COMPANY_ID,
          activeModules: allModulesString,
          jiraRole: emp.role,
          emailVerified: true
        }
      });
    } else {
      console.log(`🆕 Creando nuevo usuario empleado: ${emp.nombre} (${emp.email})`);
      await prisma.user.create({
        data: {
          name: emp.nombre,
          email: emp.email,
          password: defaultPasswordHash,
          companyId: BEDASOFT_COMPANY_ID,
          activeModules: allModulesString,
          jiraRole: emp.role,
          emailVerified: true
        }
      });
    }
  }

  // 6. Verificar y Mostrar Resultados
  console.log('\n======================================================');
  console.log('===       SINOPSIS DEL ESTADO FINAL DE LA DB       ===');
  console.log('======================================================');
  
  const finalCompanies = await prisma.company.findMany({
    include: { users: true }
  });
  
  finalCompanies.forEach(c => {
    console.log(`\n🏢 Compañía: ${c.name.toUpperCase()} (ID: ${c.id})`);
    console.log(`   CIF:        ${c.cif}`);
    console.log(`   Estado:     ${c.status.toUpperCase()}`);
    console.log(`   Licencia:   ${c.licenseKey}`);
    console.log(`   Empleados vinculados: ${c.users.length}`);
    c.users.forEach((u, i) => {
      console.log(`     ${String(i + 1).padStart(2, '0')}. [${u.jiraRole.toUpperCase()}] ${u.name.padEnd(25)} | Email: ${u.email.padEnd(30)} | Módulos: [${u.activeModules}]`);
    });
  });
  
  console.log('\n🎉 ¡PROTOCOLO COMPLETADO CON ÉXITO PARA LA PRUEBA DEFINITIVA! 🎉');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
