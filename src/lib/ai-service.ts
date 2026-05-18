import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Unified AI Service that seamlessly supports Microsoft Copilot (Azure OpenAI), 
 * standard OpenAI, and falls back to Google Gemini if no Microsoft credentials are provided yet.
 */
export async function getAIChatCompletion(
  systemPrompt: string,
  userMessage: string,
  history: { role: 'user' | 'ai' | 'model' | 'assistant'; text?: string; content?: string }[] = []
): Promise<string> {
  // 1. Check for Microsoft Copilot / Azure OpenAI credentials
  const azureKey = process.env.AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

  // 2. Check for standard OpenAI credentials
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';

  // Format messages array for OpenAI / Azure OpenAI
  const messages: ChatMessage[] = [];
  
  // Add system prompt
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // Add history
  for (const h of history) {
    const role = h.role === 'model' || h.role === 'ai' || h.role === 'assistant' ? 'assistant' : 'user';
    const content = h.text || h.content || '';
    if (content) {
      messages.push({ role, content });
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  // A. Try Azure OpenAI (Microsoft Copilot Backend)
  if (azureKey && azureEndpoint) {
    console.log(`[AI-Service] Using Microsoft Azure OpenAI (Copilot Engine) - Deployment: ${azureDeployment}`);
    try {
      const cleanEndpoint = azureEndpoint.replace(/\/$/, '');
      const url = `${cleanEndpoint}/openai/deployments/${azureDeployment}/chat/completions?api-version=2024-02-15-preview`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureKey
        },
        body: JSON.stringify({
          messages,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content;
      if (aiText) return aiText;
    } catch (error: any) {
      console.error('[AI-Service] Azure OpenAI Error, falling back:', error.message);
    }
  }

  // B. Try Standard OpenAI (ChatGPT/GPT-4o)
  if (openaiKey) {
    console.log(`[AI-Service] Using Standard OpenAI API - Model: ${openaiModel}`);
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: openaiModel,
          messages,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content;
      if (aiText) return aiText;
    } catch (error: any) {
      console.error('[AI-Service] OpenAI Error, falling back:', error.message);
    }
  }

  // C. Fallback to Google Gemini (Active developer / demo key)
  console.log('[AI-Service] Falling back to Google Gemini (Demo Mode)');
  const geminiKey = process.env.GEMINI_API_KEY?.replace(/"/g, '') || '';
  if (!geminiKey) {
    throw new Error('No AI service credentials found (Azure OpenAI, OpenAI, or Gemini). Please configure environment variables.');
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  // Format history for Gemini chat
  const geminiHistory = [
    { role: 'user' as const, parts: [{ text: systemPrompt }] },
    { role: 'model' as const, parts: [{ text: 'Entendido. Estoy listo.' }] }
  ];

  for (const h of history) {
    const role = h.role === 'model' || h.role === 'ai' || h.role === 'assistant' ? ('model' as const) : ('user' as const);
    const content = h.text || h.content || '';
    if (content) {
      // Exclude action tags from conversational history to avoid pollution
      const cleanContent = content.split('[ACTION]')[0].trim();
      if (cleanContent) {
        geminiHistory.push({ role, parts: [{ text: cleanContent }] });
      }
    }
  }

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}
