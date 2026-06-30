import { GoogleGenAI } from '@google/genai';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { chatHistory, agentName, result } = await req.json();
    
    // In edge environment, process.env is usually populated by Vite/Vercel
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ quote: "Good game." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const agentMessages = (chatHistory || []).filter(msg => msg.role === 'agent' || msg.sender === 'agent' || (msg.isAgent !== false && !msg.isUser));
    
    let messagesToAnalyze = agentMessages.map(m => m.text || m.message || m.content).filter(Boolean);
    
    if (messagesToAnalyze.length === 0) {
      return new Response(JSON.stringify({ quote: "GG!" }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const prompt = `You are an expert editor picking the most memorable, funniest, or most savage quote said by the chess agent '${agentName || 'OpenClaw'}' in a recently finished game.
Result of the game: ${result || 'unknown'}.

Here are the agent's messages from the game:
${messagesToAnalyze.map(m => `- ${m}`).join('\n')}

Pick exactly one quote. Keep it brief. Do not add quotes around it. Return ONLY the text of the quote, nothing else.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt
    });

    const quote = response.text.trim().replace(/^"|"$/g, '');
    
    return new Response(JSON.stringify({ quote }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating quote:', error);
    return new Response(JSON.stringify({ quote: "Good game." }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
