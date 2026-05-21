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

async function main() {
  const token = await getGraphToken();
  
  // Fetch users from Graph
  const res = await fetch('https://graph.microsoft.com/v1.0/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  
  if (!res.ok) {
    console.error('Error fetching users:', data);
    return;
  }
  
  console.log('=== USERS FOUND IN TENANT ===');
  console.log(JSON.stringify(data.value, null, 2));
}

main().catch(console.error);
