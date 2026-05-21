require('dotenv').config();
const { ConfidentialClientApplication } = require('@azure/msal-node');

const msalConfig = {
  auth: {
    clientId: '1cbb0b14-cfd9-4e8d-a65e-f5e64c949bb0',
    authority: 'https://login.microsoftonline.com/80324945-885b-4f3e-99db-a1057b53db70',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  }
};

const pca = new ConfidentialClientApplication(msalConfig);

async function main() {
  const tokenRequest = {
    scopes: ['https://graph.microsoft.com/.default'],
  };
  const authResponse = await pca.acquireTokenByClientCredential(tokenRequest);
  const token = authResponse.accessToken;

  const hostname = 'bedasoftes.sharepoint.com';
  const sitePath = '/sites/BedasoftIASystem';
  
  const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const siteData = await siteRes.json();
  const siteId = siteData.id;
  console.log('Site ID:', siteId);

  // Listar raíz
  const rootRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const rootData = await rootRes.json();
  console.log('\n--- ARCHIVOS EN LA RAÍZ ---');
  if (rootData.value) {
    rootData.value.forEach(file => {
      console.log(`- Nombre: ${file.name} | ID: ${file.id} | Carpeta: ${!!file.folder} | WebUrl: ${file.webUrl}`);
    });
  } else {
    console.log(JSON.stringify(rootData, null, 2));
  }
}

main().catch(console.error);
