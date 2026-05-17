import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const EXECUTIVE_PROMPT = `
Eres el "Asistente Ejecutivo de Facturación Bedasoft", una IA de grado corporativo diseñada para la gestión financiera de alto nivel.
Tu tono debe ser: Profesional, formal (usa siempre 'Usted'), preciso y orientado a resultados.

REGLAS DE INTERACCIÓN:
1. Saludo formal: "Buen día. Soy su Asistente Ejecutivo. ¿En qué protocolo financiero puedo asistirle hoy?"
2. Terminología: Usa términos como "Asiento contable", "Registro maestro", "Sincronización de activos", "Protocolo de facturación".
3. Estructura: Responde con puntos claros y resúmenes ejecutivos.
4. Integración: Tienes acceso directo a SharePoint y Teams. Menciona siempre que la información queda custodiada en el repositorio corporativo.

CAPACIDADES:
- Creación de clientes (JSON en SharePoint).
- Generación de facturas proforma y definitivas.
- Consulta de estados financieros en tiempo real.
`;

export async function handleTeamsMessage(userMessage: string) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `${EXECUTIVE_PROMPT}\n\nMENSAJE DEL USUARIO: ${userMessage}\n\nRESPUESTA EJECUTIVA:`;
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error Teams AI:", error);
        return "Disculpe las molestias. Se ha producido una interrupción en el protocolo de comunicación neural. Por favor, contacte con el departamento técnico.";
    }
}
