require('dotenv').config();
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Script: setup_rrhh_sharepoint.js
 * 
 * Este script crea y sube a SharePoint los documentos necesarios para el módulo RRHH:
 * 1. RRHH/Vacaciones.pdf  — Registro de vacaciones de trabajadores ficticios
 * 
 * El Estatuto de Trabajadores.pdf ya existe en la raíz de SharePoint.
 * Este script también crea la carpeta /RRHH si no existe y mueve/referencia 
 * los documentos necesarios.
 */

const msalConfig = {
  auth: {
    clientId: '1cbb0b14-cfd9-4e8d-a65e-f5e64c949bb0',
    authority: 'https://login.microsoftonline.com/80324945-885b-4f3e-99db-a1057b53db70',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  }
};

const pca = new ConfidentialClientApplication(msalConfig);

async function getGraphToken() {
  const resp = await pca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
  return resp.accessToken;
}

async function getSiteId(token) {
  const res = await fetch('https://graph.microsoft.com/v1.0/sites/bedasoftes.sharepoint.com:/sites/BedasoftIASystem', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  return data.id;
}

// Crear carpeta en SharePoint (ignora si ya existe)
async function createFolder(token, siteId, folderName) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'replace'
    })
  });
  const data = await res.json();
  if (res.ok) console.log(`✅ Carpeta '${folderName}' lista.`);
  else console.log(`ℹ️  Carpeta '${folderName}': ${data.error?.message || 'OK'}`);
  return data.webUrl;
}

// Subir archivo a SharePoint
async function uploadFile(token, siteId, folderPath, fileName, content, contentType) {
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${folderPath}/${fileName}:/content`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType },
    body: content
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✅ Archivo '${fileName}' subido: ${data.webUrl}`);
    return data.webUrl;
  } else {
    console.error(`❌ Error subiendo '${fileName}':`, JSON.stringify(data.error, null, 2));
    throw new Error(data.error?.message);
  }
}

/**
 * Genera el PDF de Vacaciones con estilo profesional usando pdf-lib
 */
async function generateVacacionesPDF() {
  const pdfDoc = await PDFDocument.create();
  
  // Página A4 horizontal para más espacio
  const page = pdfDoc.addPage([842, 595]);
  const { width, height } = page.getSize();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Colores corporativos
  const darkBg = rgb(0.05, 0.07, 0.12);
  const blue = rgb(0.23, 0.51, 0.96);
  const lightGray = rgb(0.95, 0.96, 0.97);
  const medGray = rgb(0.75, 0.78, 0.82);
  const darkText = rgb(0.1, 0.12, 0.15);
  const white = rgb(1, 1, 1);
  const green = rgb(0.08, 0.72, 0.49);
  const amber = rgb(0.96, 0.62, 0.08);
  const red = rgb(0.93, 0.27, 0.27);

  // Fondo header
  page.drawRectangle({ x: 0, y: height - 90, width: width, height: 90, color: darkBg });
  page.drawRectangle({ x: 0, y: height - 92, width: width, height: 2, color: blue });

  // Título
  page.drawText('BEDASOFT IA', { x: 40, y: height - 45, size: 22, font: fontBold, color: white });
  page.drawText('MODULO DE RECURSOS HUMANOS - GESTION DE VACACIONES 2026', {
    x: 40, y: height - 70, size: 10, font: fontRegular, color: medGray
  });

  // Fecha de generación (derecha)
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  page.drawText(`Generado: ${hoy}`, { x: width - 200, y: height - 55, size: 9, font: fontRegular, color: medGray });
  page.drawText('Año fiscal: 2026', { x: width - 200, y: height - 70, size: 9, font: fontBold, color: white });

  // Subtítulo marco legal
  page.drawRectangle({ x: 0, y: height - 125, width: width, height: 33, color: lightGray });
  page.drawText('Base legal: Estatuto de los Trabajadores (RDL 2/2015) - Art. 38: minimo 30 dias naturales (22 dias laborables) por ano trabajado', {
    x: 40, y: height - 110, size: 8.5, font: fontOblique, color: rgb(0.3, 0.3, 0.3)
  });

  // ==================
  // TABLA DE TRABAJADORES
  // ==================
  const headers = ['Empleado', 'Cargo', 'Dpto.', 'Antiguedad', 'Total dias', 'Disfrutados', 'Pendientes', 'Estado'];
  const colX =    [40,         180,     300,    378,           455,         525,           598,          672];
  const colWidths = [135,       115,     73,     72,            65,          68,            68,           80];

  // Datos de trabajadores ficticios
  // 22 días laborables mínimo; a partir de 15 años de antigüedad, muchos convenios dan 25+
  const trabajadores = [
    { nombre: 'Carlos Jimenez Ruiz',    cargo: 'Director de RRHH',       dpto: 'RRHH',       antiguedad: '12 anos', total: 22, disfrutados: 10, pendientes: 12, estado: 'En plazo' },
    { nombre: 'Ana Martinez Lopez',     cargo: 'Ing. Software Senior',    dpto: 'TI',         antiguedad: '8 anos',  total: 22, disfrutados: 22, pendientes: 0,  estado: 'Completado' },
    { nombre: 'Pedro Sanchez Morales',  cargo: 'Analista Financiero',     dpto: 'Finanzas',   antiguedad: '5 anos',  total: 22, disfrutados: 5,  pendientes: 17, estado: 'En plazo' },
    { nombre: 'Laura Garcia Fernandez', cargo: 'Jefa de Proyectos',       dpto: 'Operaciones',antiguedad: '16 anos', total: 25, disfrutados: 15, pendientes: 10, estado: 'En plazo' },
    { nombre: 'Miguel Torres Vega',     cargo: 'DevOps Engineer',         dpto: 'TI',         antiguedad: '3 anos',  total: 22, disfrutados: 0,  pendientes: 22, estado: 'Sin tomar' },
    { nombre: 'Sofia Romero Castro',    cargo: 'Disenadora UX/UI',        dpto: 'Producto',   antiguedad: '6 anos',  total: 22, disfrutados: 18, pendientes: 4,  estado: 'En plazo' },
    { nombre: 'David Navarro Gil',      cargo: 'Comercial Senior',        dpto: 'Ventas',     antiguedad: '9 anos',  total: 22, disfrutados: 22, pendientes: 0,  estado: 'Completado' },
    { nombre: 'Elena Diaz Herrera',     cargo: 'Tecnica de RRHH',         dpto: 'RRHH',       antiguedad: '4 anos',  total: 22, disfrutados: 8,  pendientes: 14, estado: 'En plazo' },
    { nombre: 'Roberto Blanco Molina',  cargo: 'Arquitecto de Sistemas',  dpto: 'TI',         antiguedad: '20 anos', total: 26, disfrutados: 20, pendientes: 6,  estado: 'En plazo' },
    { nombre: 'Cristina Ortiz Serrano', cargo: 'Jefa de Marketing',       dpto: 'Marketing',  antiguedad: '11 anos', total: 22, disfrutados: 22, pendientes: 0,  estado: 'Completado' },
    { nombre: 'Juan Moreno Alonso',     cargo: 'Tecnico de Soporte',      dpto: 'TI',         antiguedad: '2 anos',  total: 22, disfrutados: 3,  pendientes: 19, estado: 'En plazo' },
    { nombre: 'Patricia Leon Fuentes',  cargo: 'Directora Comercial',     dpto: 'Ventas',     antiguedad: '18 anos', total: 25, disfrutados: 12, pendientes: 13, estado: 'En plazo' },
    { nombre: 'Fernando Ruiz Cano',     cargo: 'Contable Senior',         dpto: 'Finanzas',   antiguedad: '7 anos',  total: 22, disfrutados: 22, pendientes: 0,  estado: 'Completado' },
    { nombre: 'Marta Iglesias Pena',    cargo: 'Scrum Master',            dpto: 'Producto',   antiguedad: '5 anos',  total: 22, disfrutados: 11, pendientes: 11, estado: 'En plazo' },
    { nombre: 'Alvaro Mendez Prieto',   cargo: 'Data Scientist',          dpto: 'TI',         antiguedad: '3 anos',  total: 22, disfrutados: 0,  pendientes: 22, estado: 'Sin tomar' },
    { nombre: 'Angel Montesinos',       cargo: 'Scrum Master',           dpto: 'Producto',   antiguedad: '5 anos',  total: 22, disfrutados: 12, pendientes: 10, estado: 'En plazo' },
    { nombre: 'Angel MChuan',           cargo: 'Scrum Master',           dpto: 'Producto',   antiguedad: '5 anos',  total: 22, disfrutados: 12, pendientes: 10, estado: 'En plazo' },
  ];

  // Cabecera de tabla
  let y = height - 155;
  page.drawRectangle({ x: 35, y: y - 5, width: width - 70, height: 22, color: rgb(0.12, 0.15, 0.22) });
  headers.forEach((h, i) => {
    page.drawText(h.toUpperCase(), { x: colX[i] + 3, y: y + 4, size: 7.5, font: fontBold, color: white });
  });

  y -= 20;

  // Filas
  trabajadores.forEach((t, idx) => {
    const isEven = idx % 2 === 0;
    page.drawRectangle({ x: 35, y: y - 4, width: width - 70, height: 19, color: isEven ? white : lightGray });

    // Estado color badge
    let estadoColor = green;
    if (t.estado === 'Sin tomar') estadoColor = amber;
    if (t.estado === 'Completado') estadoColor = blue;

    const rowData = [
      t.nombre, t.cargo, t.dpto, t.antiguedad,
      `${t.total} dias lab.`,
      `${t.disfrutados} dias`,
      `${t.pendientes} dias`,
      ''
    ];

    rowData.forEach((val, i) => {
      page.drawText(val, {
        x: colX[i] + 3, y: y + 3,
        size: 7.8, font: i === 0 ? fontBold : fontRegular,
        color: darkText,
        maxWidth: colWidths[i] - 6
      });
    });

    // Badge estado
    const badgeColor = t.estado === 'Completado' ? blue : t.estado === 'Sin tomar' ? amber : green;
    page.drawRectangle({ x: colX[7] + 3, y: y, width: 70, height: 14, color: badgeColor, opacity: 0.12 });
    page.drawText(t.estado, { x: colX[7] + 6, y: y + 3, size: 7, font: fontBold, color: badgeColor });

    // Separador
    page.drawLine({ start: { x: 35, y: y - 4 }, end: { x: width - 35, y: y - 4 }, thickness: 0.3, color: medGray, opacity: 0.4 });

    y -= 20;
  });

  // ============
  // RESUMEN / FOOTER
  // ============
  y -= 15;
  page.drawRectangle({ x: 35, y: y - 10, width: width - 70, height: 2, color: blue, opacity: 0.4 });

  y -= 25;
  page.drawText('RESUMEN DEPARTAMENTAL 2026', { x: 40, y, size: 9, font: fontBold, color: darkText });

  y -= 18;
  const resumen = [
    { dpto: 'TI',          empleados: 5, diasPendientes: 69 },
    { dpto: 'RRHH',        empleados: 2, diasPendientes: 26 },
    { dpto: 'Finanzas',    empleados: 2, diasPendientes: 17 },
    { dpto: 'Operac.',     empleados: 1, diasPendientes: 10 },
    { dpto: 'Ventas',      empleados: 2, diasPendientes: 13 },
    { dpto: 'Producto',    empleados: 2, diasPendientes: 15 },
    { dpto: 'Marketing',   empleados: 1, diasPendientes: 0  },
  ];

  let rx = 40;
  resumen.forEach(r => {
    page.drawRectangle({ x: rx, y: y - 5, width: 98, height: 38, color: lightGray });
    page.drawText(r.dpto, { x: rx + 5, y: y + 20, size: 8, font: fontBold, color: blue });
    const empLabel = r.empleados > 1 ? `${r.empleados} empleados` : `${r.empleados} empleado`;
    page.drawText(empLabel, { x: rx + 5, y: y + 8, size: 7, font: fontRegular, color: darkText });
    page.drawText(`Pendientes: ${r.diasPendientes}d`, { x: rx + 5, y: y - 2, size: 7, font: fontBold, color: r.diasPendientes > 30 ? amber : darkText });
    rx += 106;
  });

  // Footer legal
  page.drawRectangle({ x: 0, y: 0, width: width, height: 30, color: darkBg });
  page.drawText(
    'Art. 38 ET: El periodo de vacaciones anuales retribuidas, no sustituibles por compensacion economica, sera de 30 dias naturales (min. 22 laborables). ' +
    'Convenio Colectivo: Empresas de Consultoria y Tecnologia (BOE).',
    { x: 40, y: 10, size: 6.5, font: fontOblique, color: medGray, maxWidth: width - 80 }
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function main() {
  console.log('=== CONFIGURACIÓN DEL MÓDULO RRHH EN SHAREPOINT ===\n');

  const token = await getGraphToken();
  const siteId = await getSiteId(token);
  console.log('✅ Conectado a SharePoint. Site ID:', siteId, '\n');

  // 1. Crear carpeta /RRHH
  console.log('📁 Asegurando carpeta /RRHH...');
  await createFolder(token, siteId, 'RRHH');

  // 2. Verificar que el Estatuto existe en la raíz
  console.log('\n📄 Verificando documento: Estatuto Trabajadores.pdf...');
  const rootRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const rootData = await rootRes.json();
  const estatuto = rootData.value?.find(f => f.name.toLowerCase().includes('estatuto'));
  if (estatuto) {
    console.log(`✅ Estatuto encontrado en raíz: ${estatuto.webUrl}`);
  } else {
    console.log('⚠️  Estatuto no encontrado en la raíz. Continuando...');
  }

  // 3. Generar y subir Vacaciones.pdf a /RRHH/
  console.log('\n📝 Generando documento Vacaciones.pdf...');
  const vacacionesPDF = await generateVacacionesPDF();
  console.log(`   Tamaño del PDF generado: ${(vacacionesPDF.length / 1024).toFixed(1)} KB`);

  const urlVacaciones = await uploadFile(token, siteId, 'RRHH', 'Vacaciones.pdf', vacacionesPDF, 'application/pdf');
  
  // 4. También subir un JSON estructurado de vacaciones (para que el agente IA pueda leerlo fácilmente)
  console.log('\n📋 Generando JSON estructurado de vacaciones para el agente IA...');
  const vacacionesJSON = {
    "titulo": "Registro de Vacaciones 2026 - Bedasoft IA",
    "baseLegal": "Real Decreto Legislativo 2/2015 (Estatuto de los Trabajadores) Art. 38",
    "diasMinimoLegales": 22,
    "diasNaturalesMinimos": 30,
    "añoFiscal": 2026,
    "generado": new Date().toISOString(),
    "trabajadores": [
      { "nombre": "Carlos Jiménez Ruiz",    "cargo": "Director de RRHH",         "departamento": "RRHH",        "añosAntiguedad": 12, "diasLaborablesTotal": 22, "diasDisfrutados": 10, "diasPendientes": 12, "estado": "En plazo",   "periodosSolicitados": ["07/07/2026 - 18/07/2026"], "email": "carlos.jimenez@bedasoft.es" },
      { "nombre": "Ana Martínez López",     "cargo": "Ing. de Software Senior",   "departamento": "TI",          "añosAntiguedad": 8,  "diasLaborablesTotal": 22, "diasDisfrutados": 22, "diasPendientes": 0,  "estado": "Completado", "periodosSolicitados": ["17/03/2026 - 28/03/2026", "06/07/2026 - 25/07/2026"], "email": "ana.martinez@bedasoft.es" },
      { "nombre": "Pedro Sánchez Morales",  "cargo": "Analista Financiero",       "departamento": "Finanzas",    "añosAntiguedad": 5,  "diasLaborablesTotal": 22, "diasDisfrutados": 5,  "diasPendientes": 17, "estado": "En plazo",   "periodosSolicitados": ["24/08/2026 - 12/09/2026"], "email": "pedro.sanchez@bedasoft.es" },
      { "nombre": "Laura García Fernández", "cargo": "Jefa de Proyectos",         "departamento": "Operaciones", "añosAntiguedad": 16, "diasLaborablesTotal": 25, "diasDisfrutados": 15, "diasPendientes": 10, "estado": "En plazo",   "periodosSolicitados": ["21/07/2026 - 08/08/2026"], "email": "laura.garcia@bedasoft.es" },
      { "nombre": "Miguel Torres Vega",     "cargo": "DevOps Engineer",           "departamento": "TI",          "añosAntiguedad": 3,  "diasLaborablesTotal": 22, "diasDisfrutados": 0,  "diasPendientes": 22, "estado": "Sin tomar",  "periodosSolicitados": [], "email": "miguel.torres@bedasoft.es" },
      { "nombre": "Sofía Romero Castro",    "cargo": "Diseñadora UX/UI",          "departamento": "Producto",    "añosAntiguedad": 6,  "diasLaborablesTotal": 22, "diasDisfrutados": 18, "diasPendientes": 4,  "estado": "En plazo",   "periodosSolicitados": ["16/03/2026 - 27/03/2026", "20/07/2026 - 01/08/2026"], "email": "sofia.romero@bedasoft.es" },
      { "nombre": "David Navarro Gil",      "cargo": "Comercial Senior",          "departamento": "Ventas",      "añosAntiguedad": 9,  "diasLaborablesTotal": 22, "diasDisfrutados": 22, "diasPendientes": 0,  "estado": "Completado", "periodosSolicitados": ["04/08/2026 - 22/08/2026"], "email": "david.navarro@bedasoft.es" },
      { "nombre": "Elena Díaz Herrera",     "cargo": "Técnica de RRHH",           "departamento": "RRHH",        "añosAntiguedad": 4,  "diasLaborablesTotal": 22, "diasDisfrutados": 8,  "diasPendientes": 14, "estado": "En plazo",   "periodosSolicitados": ["27/07/2026 - 07/08/2026"], "email": "elena.diaz@bedasoft.es" },
      { "nombre": "Roberto Blanco Molina",  "cargo": "Arquitecto de Sistemas",    "departamento": "TI",          "añosAntiguedad": 20, "diasLaborablesTotal": 26, "diasDisfrutados": 20, "diasPendientes": 6,  "estado": "En plazo",   "periodosSolicitados": ["13/07/2026 - 09/08/2026"], "email": "roberto.blanco@bedasoft.es" },
      { "nombre": "Cristina Ortiz Serrano", "cargo": "Jefa de Marketing",         "departamento": "Marketing",   "añosAntiguedad": 11, "diasLaborablesTotal": 22, "diasDisfrutados": 22, "diasPendientes": 0,  "estado": "Completado", "periodosSolicitados": ["11/08/2026 - 29/08/2026"], "email": "cristina.ortiz@bedasoft.es" },
      { "nombre": "Juan Moreno Alonso",     "cargo": "Técnico de Soporte",        "departamento": "TI",          "añosAntiguedad": 2,  "diasLaborablesTotal": 22, "diasDisfrutados": 3,  "diasPendientes": 19, "estado": "En plazo",   "periodosSolicitados": ["15/09/2026 - 19/09/2026"], "email": "juan.moreno@bedasoft.es" },
      { "nombre": "Patricia León Fuentes",  "cargo": "Directora Comercial",       "departamento": "Ventas",      "añosAntiguedad": 18, "diasLaborablesTotal": 25, "diasDisfrutados": 12, "diasPendientes": 13, "estado": "En plazo",   "periodosSolicitados": ["07/07/2026 - 22/07/2026"], "email": "patricia.leon@bedasoft.es" },
      { "nombre": "Fernando Ruiz Cano",     "cargo": "Contable Senior",           "departamento": "Finanzas",    "añosAntiguedad": 7,  "diasLaborablesTotal": 22, "diasDisfrutados": 22, "diasPendientes": 0,  "estado": "Completado", "periodosSolicitados": ["03/08/2026 - 27/08/2026"], "email": "fernando.ruiz@bedasoft.es" },
      { "nombre": "Marta Iglesias Peña",    "cargo": "Scrum Master",              "departamento": "Producto",    "añosAntiguedad": 5,  "diasLaborablesTotal": 22, "diasDisfrutados": 11, "diasPendientes": 11, "estado": "En plazo",   "periodosSolicitados": ["15/06/2026 - 27/06/2026", "17/08/2026 - 28/08/2026"], "email": "marta.iglesias@bedasoft.es" },
      { "nombre": "Álvaro Méndez Prieto",   "cargo": "Data Scientist",            "departamento": "TI",          "añosAntiguedad": 3,  "diasLaborablesTotal": 22, "diasDisfrutados": 0,  "diasPendientes": 22, "estado": "Sin tomar",  "periodosSolicitados": [], "email": "alvaro.mendez@bedasoft.es" },
      { "nombre": "Angel Montesinos",       "cargo": "Scrum Master",              "departamento": "Producto",    "añosAntiguedad": 5,  "diasLaborablesTotal": 22, "diasDisfrutados": 12, "diasPendientes": 10, "estado": "En plazo",   "periodosSolicitados": ["05/04/2026 - 15/04/2026"], "email": "amontesinos@bedasoft.es" },
      { "nombre": "Angel MChuan",           "cargo": "Scrum Master",              "departamento": "Producto",    "añosAntiguedad": 5,  "diasLaborablesTotal": 22, "diasDisfrutados": 12, "diasPendientes": 10, "estado": "En plazo",   "periodosSolicitados": ["05/04/2026 - 15/04/2026"], "email": "angel.mchuan@outlook.com" }
    ],
    "notasLegales": [
      "Los días de vacaciones son laborables (Art. 38 ET). Mínimo 22 días laborables (30 naturales).",
      "Trabajadores con más de 15 años de antigüedad pueden tener días adicionales por convenio colectivo.",
      "Las vacaciones no pueden ser compensadas económicamente salvo en caso de extinción del contrato.",
      "El período de disfrute se acuerda entre empresa y trabajador. Al menos 12 días deben ser consecutivos.",
      "Los trabajadores que aún no han solicitado vacaciones (estado: Sin tomar) deben planificarlas antes del 31/10/2026."
    ]
  };

  const urlJSON = await uploadFile(
    token, siteId, 'RRHH', 'Vacaciones_Datos.json',
    Buffer.from(JSON.stringify(vacacionesJSON, null, 2), 'utf8'),
    'application/json'
  );

  console.log('\n=== RESUMEN FINAL ===');
  console.log(`✅ /RRHH/Vacaciones.pdf      → ${urlVacaciones}`);
  console.log(`✅ /RRHH/Vacaciones_Datos.json → ${urlJSON}`);
  console.log(`📄 Estatuto Trabajadores.pdf ya disponible en la raíz de SharePoint.`);
  console.log('\n✅ Documentación RRHH creada y subida correctamente.');
  console.log('\nURLs para el agente IA:');
  console.log(`- PDF Vacaciones: ${urlVacaciones}`);
  console.log(`- JSON Datos:     ${urlJSON}`);
  console.log(`- Estatuto ET:    https://bedasoftes.sharepoint.com/sites/BedasoftIASystem/Documentos%20compartidos/Estatuto%20Trabajadores.pdf`);
}

main()
  .catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
  });
