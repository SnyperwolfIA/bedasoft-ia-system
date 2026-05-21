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

async function main() {
  const token = await getGraphToken();
  const siteId = await getSiteId(token);
  console.log('Site ID:', siteId);
  
  // List all lists in the site
  const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  
  if (!res.ok) {
    console.error('Error fetching lists:', data);
    return;
  }
  
  console.log('=== LISTS FOUND IN SITE ===');
  data.value.forEach(list => {
    console.log(`- List Name: ${list.name} | Title: ${list.displayName} | ID: ${list.id}`);
  });
}

main().catch(console.error);
