import { NextRequest, NextResponse } from 'next/server';
import { getAIChatCompletion } from '@/lib/ai-service';

const SYSTEM_PROMPT = `
Eres un Ingeniero Experto de Soluciones Cloud especializado en Microsoft 365, Power Automate y Azure Logic Apps.
Tu misión es traducir directrices en lenguaje natural que introduce el usuario en definiciones estructuradas de flujos de trabajo válidas para Microsoft Power Automate.

Debes responder ÚNICAMENTE con un objeto JSON válido. Queda terminantemente PROHIBIDO incluir texto explicativo fuera del JSON, bloques de código markdown (\`\`\`json ... \`\`\`), o cualquier carácter adicional. Solo devuelve la cadena JSON pura estructurada con la siguiente forma:

{
  "title": "Título corto y descriptivo de la automatización en español",
  "description": "Una descripción clara y concisa de lo que realiza la automatización en español",
  "trigger": {
    "name": "Nombre descriptivo del disparador (ej. 'Cuando se recibe un correo')",
    "connector": "shared_office365 | shared_sharepointonline | shared_teams | shared_excelonline | shared_todo",
    "description": "Explicación breve en español de cuándo se activa el flujo"
  },
  "actions": [
    {
      "id": "Nombre_tecnico_de_la_accion",
      "name": "Nombre visual amigable de la acción (ej. 'Crear archivo en SharePoint')",
      "connector": "shared_sharepointonline",
      "description": "Breve explicación en español de lo que hace este paso"
    }
  ],
  "connectors": ["shared_office365", "shared_sharepointonline"],
  "flowDefinition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
      "$connections": {
        "defaultValue": {},
        "type": "Object"
      }
    },
    "triggers": {
      "Cuando_se_recibe_un_nuevo_correo": {
        "type": "ApiConnection",
        "inputs": {
          "host": {
            "connection": {
              "name": "@parameters('$connections')['shared_office365']['connectionId']"
            }
          },
          "method": "get",
          "path": "/v2/Mail/OnNewMail",
          "queries": {
            "folderPath": "Inbox"
          }
        }
      }
    },
    "actions": {
      "Crear_archivo": {
        "runAfter": {},
        "type": "ApiConnection",
        "inputs": {
          "host": {
            "connection": {
              "name": "@parameters('$connections')['shared_sharepointonline']['connectionId']"
            }
          },
          "method": "post",
          "path": "/datasets/@{encodeURIComponent(encodeURIComponent('https://bedasoftes.sharepoint.com/sites/BedasoftIASystem'))}/files",
          "queries": {
            "folderPath": "/Documentos compartidos"
          },
          "body": {
            "name": "factura_generada.pdf",
            "content": "contenido_base64"
          }
        }
      }
    }
  },
  "apimap": {
    "shared_office365": {
      "connectionId": "/providers/Microsoft.PowerApps/apis/shared_office365",
      "id": "/providers/Microsoft.PowerApps/apis/shared_office365"
    },
    "shared_sharepointonline": {
      "connectionId": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline",
      "id": "/providers/Microsoft.PowerApps/apis/shared_sharepointonline"
    }
  }
}

REGLAS DE DISEÑO DE DEFINICIONES DE POWER AUTOMATE:
1. Traduce la directriz de lenguaje natural a las correspondientes secciones de triggers y actions en Logic Apps JSON.
2. Identifica los conectores correctos:
   * Outlook/Office 365: "shared_office365"
   * SharePoint: "shared_sharepointonline"
   * Teams: "shared_teams"
   * Excel Online: "shared_excelonline"
   * Microsoft To-Do: "shared_todo"
3. Las referencias de conexión en los triggers/actions dentro de "flowDefinition" DEBEN usar siempre el formato de parámetro:
   "@parameters('$connections')['<connector_name>']['connectionId']"
4. Asegúrate de que el JSON que generes en "flowDefinition" sea sintácticamente correcto, tenga llaves balanceadas y cumpla estrictamente con el formato JSON. No uses expresiones JavaScript complejas, solo cadenas, números y arreglos válidos en JSON.
5. El tono de los textos amigables debe ser formal pero dinámico y ágil, en español de España (evitando arcaísmos o traducciones robóticas).
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'La directriz o prompt es obligatorio' }, { status: 400 });
    }

    console.log(`[Power Automate API] Procesando directriz: "${prompt}"`);

    const aiResponse = await getAIChatCompletion(SYSTEM_PROMPT, prompt, []);

    // Limpiar posibles bloques markdown del output
    let cleanResponse = aiResponse.trim();
    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    }

    try {
      const flowData = JSON.parse(cleanResponse);
      return NextResponse.json({ success: true, flow: flowData });
    } catch (parseError: any) {
      console.error('[Power Automate API] Error parseando respuesta JSON de la IA:', parseError, '\nRespuesta original:', aiResponse);
      return NextResponse.json({ 
        success: false, 
        error: 'El motor de IA no generó un JSON válido para Power Automate. Inténtelo de nuevo especificando de forma más clara las acciones.',
        rawResponse: aiResponse
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Power Automate API ERROR]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
