import { ConfidentialClientApplication } from '@azure/msal-node';

const msalConfig = {
    auth: {
        clientId: '1cbb0b14-cfd9-4e8d-a65e-f5e64c949bb0',
        authority: 'https://login.microsoftonline.com/80324945-885b-4f3e-99db-a1057b53db70',
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    }
};

const pca = new ConfidentialClientApplication(msalConfig);

export async function getGraphToken() {
    const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
    };

    try {
        const response = await pca.acquireTokenByClientCredential(tokenRequest);
        return response?.accessToken;
    } catch (error) {
        console.error('Error al obtener token de Graph:', error);
        throw error;
    }
}

export async function getSiteId() {
    const token = await getGraphToken();
    const hostname = "bedasoftes.sharepoint.com";
    const sitePath = "/sites/BedasoftIASystem";
    
    console.log(`Buscando sitio por ruta directa: ${hostname}:${sitePath}`);
    
    try {
        const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.id) {
            console.log(`Sitio encontrado: ${data.displayName} (${data.id})`);
            return data.id;
        }
        
        console.error("Error al obtener sitio por ruta:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error de red buscando sitio:", e);
    }

    return 'root';
}

// Función para inicializar la estructura en SharePoint
export async function initializeBedasoftStructure() {
    const token = await getGraphToken();
    const siteId = await getSiteId();
    console.log(`Usando Site ID para estructura: ${siteId}`);
    
    const folders = ["Facturas", "Clientes"];

    for (const folderName of folders) {
        const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "name": folderName,
                "folder": { },
                "@microsoft.graph.conflictBehavior": "fail"
            })
        });

        if (res.status === 201) {
            console.log(`Carpeta '${folderName}' creada correctamente en ${siteId}.`);
        }
    }
}

// Función para subir una factura a SharePoint
export async function uploadInvoiceToSharePoint(pdfBytes: Uint8Array, fileName: string) {
    const token = await getGraphToken();
    const siteId = await getSiteId();
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/Facturas/${fileName}:/content`;

    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/pdf'
        },
        body: Buffer.from(pdfBytes)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Error detallado de Graph (Factura):', JSON.stringify(errorData, null, 2));
        throw new Error('No se pudo subir la factura a SharePoint');
    }

    const data = await response.json();
    return data.webUrl;
}

// Función para subir datos de cliente a SharePoint (JSON)
export async function uploadClientToSharePoint(clientData: any) {
    const token = await getGraphToken();
    const siteId = await getSiteId();
    const fileName = `Cliente-${clientData.name.replace(/\s+/g, '_')}.json`;
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/Clientes/${fileName}:/content`;

    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(clientData, null, 2)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Error detallado de Graph:', JSON.stringify(errorData, null, 2));
        throw new Error('No se pudo subir el cliente a SharePoint');
    }

    const data = await response.json();
    return data.webUrl;
}

// === NUEVAS FUNCIONES PARA INTEGRACIÓN CON LISTAS DE SHAREPOINT ===

// Obtener elementos de una lista específica
export async function getListItems(listName: string) {
    const token = await getGraphToken();
    const siteId = await getSiteId();
    
    console.log(`[SharePoint Lists] Cargando datos de la lista: ${listName}`);
    
    try {
        const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listName}/items?expand=fields`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });
        
        if (!res.ok) {
            const errData = await res.json();
            console.error(`Error al obtener lista ${listName}:`, JSON.stringify(errData, null, 2));
            return [];
        }
        
        const data = await res.json();
        return data.value || [];
    } catch (e) {
        console.error(`Error de red cargando lista ${listName}:`, e);
        return [];
    }
}

// Crear un elemento en una lista específica
export async function createListItem(listName: string, fields: any) {
    const token = await getGraphToken();
    const siteId = await getSiteId();
    
    console.log(`[SharePoint Lists] Registrando nuevo elemento en la lista: ${listName}`);
    
    const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listName}/items`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
    });
    
    if (!res.ok) {
        const errData = await res.json();
        console.error(`Error al insertar elemento en la lista ${listName}:`, JSON.stringify(errData, null, 2));
        throw new Error(`Error en SharePoint List: ${errData.error?.message || 'Error desconocido'}`);
    }
    
    const data = await res.json();
    return data;
}

// Obtener archivos de una carpeta específica de la biblioteca de documentos
export async function getFolderFiles(folderName: string) {
    const token = await getGraphToken();
    const siteId = await getSiteId();
    
    console.log(`[SharePoint Drive] Cargando archivos de la carpeta: ${folderName}`);
    
    try {
        const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${folderName}:/children`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });
        
        if (!res.ok) {
            const errData = await res.json();
            console.error(`Error al obtener archivos de ${folderName}:`, JSON.stringify(errData, null, 2));
            return [];
        }
        
        const data = await res.json();
        return data.value || [];
    } catch (e) {
        console.error(`Error de red cargando archivos de ${folderName}:`, e);
        return [];
    }
}

