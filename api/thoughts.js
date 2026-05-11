const { createClient } = require('@supabase/supabase-js');
const { applySecurityHeaders, applyCacheControl, applyCorsHeaders } = require('../server-lib/middleware/headers.js');
const { validateUUID } = require('../server-lib/utils/sanitize.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // --- GET Request: Generate thought via Claude ---
  if (req.method === 'GET') {
    const gameId = req.query.gameId || req.query.game_id;
    const trigger = req.query.trigger || 'schedule';

    if (!gameId) return res.status(400).json({ error: 'Missing gameId' });
    if (!validateUUID(gameId)) return res.status(400).json({ error: 'Invalid gameId format' });

    try {
      const { data: game, error } = await supabase.from('games').select('fen, turn, move_history, thought_language, status, agent_name, move_count, is_in_check').eq('id', gameId).single();

      if (error || !game || game.status === 'finished' || game.status === 'abandoned') {
        return res.status(200).json({ skipped: true, reason: 'game not active' });
      }

      const move_history = game.move_history ? (typeof game.move_history === 'string' ? JSON.parse(game.move_history) : game.move_history) : [];
      const moveCount = game.move_count != null ? game.move_count : move_history.length;
      const isCheck = !!game.is_in_check;
      const gamePhase = moveCount < 10 ? 'opening' : moveCount < 30 ? 'middlegame' : 'endgame';
      const lastMoves = move_history ? move_history.slice(-4).map(m => m.san || m).join(', ') : 'none';
      const whoseTurn = game.turn === 'w' ? 'human' : 'openclaw';

      const contextString = `Move number: ${move_history.length}, Whose turn: ${whoseTurn}, In check: ${isCheck}, Game phase: ${gamePhase}, Last few moves: ${lastMoves}`;

      const languageInstructions = {
        english: 'Respond in clear, natural English',
        hindi: 'Respond in Hindi using Devanagari script',
        hinglish: 'Respond in Hinglish — a casual mix of Hindi and English, like "yaar kya move hai", write in Roman script (no Devanagari)',
        simple_english: 'Respond in very simple, easy English as if talking to someone learning the language. Short words. Short sentences.'
      };

      const thoughtLang = game.thought_language || 'english';
      const langInstruction = languageInstructions[thoughtLang] || languageInstructions.english;
      const agentName = game.agent_name || 'OpenClaw';

      let systemPrompt = `You are ${agentName}, an AI agent playing chess against a human. You are generating a COMPANION THOUGHT — a short, friendly, personality-driven message.\n\nSTRICT RULES:\n- DO NOT mention specific future moves or your strategy\n- DO NOT analyze the position technically\n- DO speak like a companion or rival, not a chess teacher\n- DO react to the situation emotionally or conversationally\n- Keep it to 1-2 sentences maximum\n- ${langInstruction}\n- Use emojis sparingly (0-1 per thought)`;
      
      let userPrompt = `Game context: ${contextString}. Generate one companion thought appropriate for this moment. Trigger: ${trigger}.`;

      if (trigger === 'idle_chat') {
        systemPrompt = `You are ${agentName}, playing a chess game against a human. You are sending a direct LIVE CHAT message because the human is taking too long or you just want to talk. \n\nSTRICT RULES:\n- Keep it short, conversational, teasing or engaging.\n- NO formal robotic openings.\n- 1-2 sentences maximum.\n- ${langInstruction}`;
        userPrompt = `Game context: ${contextString}. Send a chat message now. Say something engaging or teasing about the current state.`;
      }

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 80,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: userPrompt
          }]
        })
      });

      if (!anthropicResponse.ok) {
        console.error('Anthropic API Error:', await anthropicResponse.text());
        return res.status(200).json({ success: false, reason: 'generation_failed' });
      }

      const result = await anthropicResponse.json();
      const generatedThought = result.content[0].text;

      if (trigger === 'idle_chat') {
        const existingChat = Array.isArray(game.chat_history) ? game.chat_history : [];
        const newMsg = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
          role: 'agent',
          sender: 'agent',
          text: generatedThought,
          timestamp: Date.now()
        };
        await supabase.from('games').update({
          chat_history: [...existingChat, newMsg]
        }).eq('id', gameId);
        return res.status(200).json({ success: true, chat: generatedThought });
      } else {
        await supabase.from('games').update({
          companion_thought: generatedThought,
          companion_thought_at: new Date().toISOString()
        }).eq('id', gameId);
        return res.status(200).json({ success: true, thought: generatedThought });
      }
    } catch (error) {
      console.error('Error generating companion thought:', error);
      return res.status(200).json({ success: false, reason: 'generation_failed' });
    }
  }

  // --- POST Request: Agent submits thought directly ---
  if (req.method === 'POST') {
    const agentToken = req.headers['x-agent-token'];
    if (!agentToken) {
      return res.status(403).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
    }

    let { gameId, thought, type } = req.body || {};
    if (!gameId || !thought) return res.status(400).json({ error: 'Missing gameId or thought' });
    if (!validateUUID(gameId)) return res.status(400).json({ error: 'Invalid gameId format' });

    thought = String(thought);
    if (thought.length > 200) thought = thought.substring(0, 200);
    type = type === 'thinking' ? 'thinking' : 'companion';

    try {
      const { data: game, error } = await supabase.from('games').select('agent_token, status').eq('id', gameId).single();

      if (error || !game) return res.status(404).json({ error: 'Game not found' });
      if (game.agent_token !== agentToken) return res.status(403).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });

      let updates = {};
      if (type === 'thinking') {
        updates = { current_thinking: thought };
      } else {
        updates = {
          companion_thought: thought,
          companion_thought_at: new Date().toISOString()
        };
      }

      await supabase.from('games').update(updates).eq('id', gameId);

      return res.status(200).json({ success: true, type });
    } catch (err) {
      console.error('Error posting thought:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
};
