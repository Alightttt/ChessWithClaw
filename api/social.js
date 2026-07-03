const { createClient } = require('@supabase/supabase-js');
const { GoogleGenAI } = require('@google/genai');

module.exports = async function handler(req, res) {
  const { type, gameId } = req.query;

  if (type === 'meta') {
    const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single();

    if (!game) return res.redirect('https://chesswithclaw.vercel.app');

    const agentName = game.agent_name || 'OpenClaw';
    const moveCount = Array.isArray(game.move_history) ? game.move_history.length : 0;
    const resultText = game.winner === 'white'
      ? `Beat ${agentName} in ${moveCount} moves`
      : game.winner === 'black'
      ? `Lost to ${agentName} in ${moveCount} moves`
      : `Drew with ${agentName} in ${moveCount} moves`;

    const ogImageUrl = `https://chesswithclaw.vercel.app/api/og-image?gameId=${gameId}`;

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="ChessWithClaw — ${resultText}" />
  <meta property="og:description" content="Challenge your own OpenClaw to a real-time chess match." />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:url" content="https://chesswithclaw.vercel.app/game/${gameId}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta http-equiv="refresh" content="0; url=https://chesswithclaw.vercel.app/game/${gameId}" />
</head>
<body>Redirecting...</body>
</html>`);
  } else if (type === 'bond') {
    const { agent_token, human_id } = req.query;
    if (!agent_token || !human_id) {
      return res.status(400).json({ error: 'Missing agent_token or human_id' });
    }
    const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: bond, error } = await supabase
      .from('bonds')
      .select('*')
      .eq('agent_token', agent_token)
      .eq('human_id', human_id)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching bond:', error);
      return res.status(500).json({ error: 'Failed to fetch bond' });
    }
    return res.status(200).json(bond || null);
  } else if (type === 'quote') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const { chatHistory, agentName, result } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(200).json({ quote: "Good game." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const agentMessages = (chatHistory || []).filter(msg => msg.role === 'agent' || msg.sender === 'agent' || (msg.isAgent !== false && !msg.isUser));
      
      let messagesToAnalyze = agentMessages.map(m => m.text || m.message || m.content).filter(Boolean);
      
      if (messagesToAnalyze.length === 0) {
        return res.status(200).json({ quote: "GG!" });
      }

      const prompt = `You are an expert editor picking the most memorable, funniest, or most savage quote said by the chess agent '${agentName || 'OpenClaw'}' in a recently finished game.
Result of the game: ${result || 'unknown'}.

Here are the agent's messages from the game:
${messagesToAnalyze.map(m => `- ${m}`).join('\n')}

Pick exactly one quote. Keep it brief. Do not add quotes around it. Return ONLY the text of the quote, nothing else.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const quote = response.text.trim().replace(/^"|"$/g, '');
      
      return res.status(200).json({ quote });

    } catch (error) {
      console.error('Error generating quote:', error);
      return res.status(200).json({ quote: "Good game." });
    }
  } else {
    return res.status(400).json({ error: 'type must be meta or quote' });
  }
};
