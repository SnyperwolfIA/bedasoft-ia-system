import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import JSZip from 'jszip';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, connectors, flowDefinition } = body;

    if (!title || !flowDefinition) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros obligatorios (title o flowDefinition)' }, { status: 400 });
    }

    console.log(`[Power Automate Export] Generando paquete ZIP para: "${title}"`);

    // 1. Crear el GUID único para el flujo en formato estándar de Power Automate (con guiones y en minúsculas)
    const flowGuid = crypto.randomUUID().toLowerCase();

    // 2. Construir manifest.json
    const manifestConnections: any = {};
    const apimapConnections: any = {};

    (connectors || ['shared_office365', 'shared_sharepointonline']).forEach((conn: string) => {
      manifestConnections[conn] = {
        "connectionReferenceLogicalName": conn,
        "type": "Microsoft.PowerApps/apis",
        "id": `/providers/Microsoft.PowerApps/apis/${conn}`,
        "iconUri": `https://connectoricons-prod.azureedge.net/${conn}/icon.png`
      };

      apimapConnections[conn] = {
        "connectionReferenceLogicalName": conn,
        "id": `/providers/Microsoft.PowerApps/apis/${conn}`
      };
    });

    const manifest = {
      "schema": "1.0",
      "details": {
        "displayName": title,
        "description": description || `Automatización generada por Bedasoft IA: ${title}`,
        "createdTime": new Date().toISOString()
      },
      "resources": {
        [flowGuid]: {
          "type": "Microsoft.Flow/flows",
          "suggestedCreationType": "New",
          "creationType": "Existing, New, Update",
          "details": {
            "displayName": title
          },
          "configurableConnectionResources": manifestConnections
        }
      }
    };

    // 3. Construir apimap.json
    const apimap = {
      "suggestedBindingInfo": {
        "connections": apimapConnections
      }
    };

    // 4. Crear e instanciar el archivo ZIP usando jszip
    const zip = new JSZip();

    // Archivo de manifiesto raíz
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    // Carpeta del flujo con definición y mapeo de apis
    const flowFolder = zip.folder(`Microsoft.Flow/flows/${flowGuid}`);
    if (flowFolder) {
      flowFolder.file("definition.json", JSON.stringify(flowDefinition, null, 2));
      flowFolder.file("apimap.json", JSON.stringify(apimap, null, 2));
    }

    // 5. Generar archivo binario ZIP con compresión DEFLATE estándar (nivel 9)
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9
      }
    });

    // 6. Retornar el archivo como descarga
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_powerautomate.zip`;

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString()
      }
    });

  } catch (error: any) {
    console.error('[Power Automate Export ERROR]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
