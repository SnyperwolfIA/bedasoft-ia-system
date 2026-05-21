import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Llama a Gemini con reintentos exponenciales y múltiples modelos de fallback.
 * Orden de preferencia de modelos Gemini:
 *   1. gemini-2.0-flash        (más rápido, menor coste)
 *   2. gemini-1.5-flash        (estable, muy disponible)
 *   3. gemini-1.5-flash-8b     (versión ligera, máxima disponibilidad)
 */
async function callGeminiWithRetry(
  geminiKey: string,
  systemPrompt: string,
  userMessage: string,
  history: { role: 'user' | 'ai' | 'model' | 'assistant'; text?: string; content?: string }[]
): Promise<string> {

  const MODELS = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];

  const MAX_RETRIES = 2; // intentos por modelo

  const genAI = new GoogleGenerativeAI(geminiKey);

  // Construir historial base de Gemini (el prompt de sistema lo inyectamos como turno inicial)
  const buildHistory = () => {
    const geminiHistory = [
      { role: 'user' as const, parts: [{ text: systemPrompt }] },
      { role: 'model' as const, parts: [{ text: 'Entendido. Estoy listo para ayudarte.' }] }
    ];
    for (const h of history) {
      const role = (h.role === 'model' || h.role === 'ai' || h.role === 'assistant')
        ? ('model' as const)
        : ('user' as const);
      const content = h.text || h.content || '';
      if (content) {
        const clean = content.split('[ACTION]')[0].trim();
        if (clean) geminiHistory.push({ role, parts: [{ text: clean }] });
      }
    }
    return geminiHistory;
  };

  for (const modelName of MODELS) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const waitMs = Math.pow(2, attempt) * 1000; // 2s, 4s
          console.log(`[AI-Service] Reintentando con ${modelName} en ${waitMs}ms (intento ${attempt + 1})...`);
          await sleep(waitMs);
        } else {
          console.log(`[AI-Service] Probando modelo Gemini: ${modelName}`);
        }

        const model = genAI.getGenerativeModel({ model: modelName });
        const chat = model.startChat({ history: buildHistory() });
        const result = await chat.sendMessage(userMessage);
        const text = result.response.text();

        if (text) {
          console.log(`[AI-Service] Respuesta obtenida con ${modelName} (intento ${attempt + 1})`);
          return text;
        }
      } catch (err: any) {
        const msg = err?.message || '';
        const isServiceError = msg.includes('503') || msg.includes('Service Unavailable') ||
                               msg.includes('overloaded') || msg.includes('high demand') ||
                               msg.includes('429') || msg.includes('quota');

        if (isServiceError && attempt < MAX_RETRIES) {
          // Reintentamos con el mismo modelo
          console.warn(`[AI-Service] ${modelName} sobrecargado (${attempt + 1}/${MAX_RETRIES + 1}):`, msg.slice(0, 120));
          continue;
        }

        // Si agotamos reintentos o el error no es de disponibilidad, pasamos al siguiente modelo
        console.warn(`[AI-Service] Modelo ${modelName} fallido. Probando siguiente...`, msg.slice(0, 120));
        break;
      }
    }
  }

  throw new Error('Todos los modelos de IA están temporalmente no disponibles. Por favor, inténtalo de nuevo en unos instantes.');
}

/**
 * Unified AI Service que soporta:
 *   A. Microsoft Azure OpenAI (Copilot)
 *   B. Standard OpenAI (ChatGPT/GPT-4o)
 *   C. Google Gemini (con reintentos y múltiples modelos de fallback)
 */
export async function getAIChatCompletion(
  systemPrompt: string,
  userMessage: string,
  history: { role: 'user' | 'ai' | 'model' | 'assistant'; text?: string; content?: string }[] = []
): Promise<string> {

  // Construir array de mensajes estándar OpenAI
  const messages: ChatMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  for (const h of history) {
    const role = (h.role === 'model' || h.role === 'ai' || h.role === 'assistant') ? 'assistant' : 'user';
    const content = h.text || h.content || '';
    if (content) messages.push({ role, content });
  }
  messages.push({ role: 'user', content: userMessage });

  // ── A. Azure OpenAI ──────────────────────────────────────────────
  const azureKey = process.env.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

  if (azureKey && azureEndpoint) {
    console.log(`[AI-Service] Using Azure OpenAI - Deployment: ${azureDeployment}`);
    try {
      const url = `${azureEndpoint.replace(/\/$/, '')}/openai/deployments/${azureDeployment}/chat/completions?api-version=2024-02-15-preview`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': azureKey },
        body: JSON.stringify({ messages, temperature: 0.2 })
      });
      if (!response.ok) throw new Error(`Azure status ${response.status}: ${await response.text()}`);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    } catch (err: any) {
      console.error('[AI-Service] Azure OpenAI failed, trying next:', err.message);
    }
  }

  // ── B. Standard OpenAI ───────────────────────────────────────────
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';

  if (openaiKey) {
    console.log(`[AI-Service] Using OpenAI - Model: ${openaiModel}`);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: openaiModel, messages, temperature: 0.2 })
      });
      if (!response.ok) throw new Error(`OpenAI status ${response.status}: ${await response.text()}`);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    } catch (err: any) {
      console.error('[AI-Service] OpenAI failed, trying Gemini:', err.message);
    }
  }

  // ── C. Google Gemini (con reintentos + múltiples modelos) ─────────
  const geminiKey = process.env.GEMINI_API_KEY?.replace(/"/g, '') || '';
  if (!geminiKey) {
    throw new Error('No AI credentials configured (Azure OpenAI, OpenAI, or GEMINI_API_KEY). Check environment variables.');
  }

  return callGeminiWithRetry(geminiKey, systemPrompt, userMessage, history);
}
