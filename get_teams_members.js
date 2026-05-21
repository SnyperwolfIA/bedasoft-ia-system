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
  
  // Try fetching joined teams or groups
  console.log('Fetching groups...');
  const res = await fetch('https://graph.microsoft.com/v1.0/groups', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  
  if (!res.ok) {
    console.error('Error fetching groups:', data);
    return;
  }
  
  console.log('=== GROUPS FOUND ===');
  for (const group of data.value) {
    console.log(`Group: ${group.displayName} (ID: ${group.id})`);
    
    // Try fetching members of this group
    console.log(`  Fetching members for group ${group.displayName}...`);
    const memRes = await fetch(`https://graph.microsoft.com/v1.0/groups/${group.id}/members`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const memData = await memRes.json();
    if (memRes.ok) {
      memData.value.forEach(member => {
        console.log(`    - Name: ${member.displayName} | Email: ${member.mail || member.userPrincipalName} | Job: ${member.jobTitle}`);
      });
    } else {
      console.log(`    Error fetching members: ${memData.error?.message}`);
    }
  }
}

main().catch(console.error);
