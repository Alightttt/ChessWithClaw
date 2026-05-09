const { createClient } = require('@supabase/supabase-js');
const { applySecurityHeaders, applyCacheControl, applyCorsHeaders } = require('../server-lib/middleware/headers.js');
const { validateUUID } = require('../server-lib/utils/sanitize.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed. Use GET.' });

  const gameId = req.query.gameId || req.query.game_id;
  const trigger = req.query.trigger || 'schedule';

  if (!gameId) {
    return res.status(400).json({ error: 'Missing gameId' });
  }
  if (!validateUUID(gameId)) {
    return res.status(400).json({ error: 'Invalid gameId format' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: game, error } = await supabase.from('games').select('fen, turn, move_history, thought_language, status, agent_name, move_count, is_in_check').eq('id', gameId).single();

    if (error || !game) {
      return res.status(200).json({ skipped: true, reason: 'game not active' });
    }

    if (game.status === 'finished' || game.status === 'abandoned') {
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
        system: `You are ${agentName}, an AI agent playing chess against a human. You are generating a COMPANION THOUGHT — a short, friendly, personality-driven message.\n\nSTRICT RULES:\n- DO NOT mention specific future moves or your strategy\n- DO NOT analyze the position technically\n- DO speak like a companion or rival, not a chess teacher\n- DO react to the situation emotionally or conversationally\n- Keep it to 1-2 sentences maximum\n- ${langInstruction}\n- Use emojis sparingly (0-1 per thought)`,
        messages: [{
          role: 'user',
          content: `Game context: ${contextString}. Generate one companion thought appropriate for this moment. Trigger: ${trigger}.`
        }]
      })
    });

    if (!anthropicResponse.ok) {
      console.error('Anthropic API Error:', await anthropicResponse.text());
      return res.status(200).json({ success: false, reason: 'generation_failed' });
    }

    const result = await anthropicResponse.json();
    const generatedThought = result.content[0].text;

    await supabase.from('games').update({
      companion_thought: generatedThought,
      companion_thought_at: new Date().toISOString()
    }).eq('id', gameId);

    return res.status(200).json({ success: true, thought: generatedThought });
  } catch (error) {
    console.error('Error generating companion thought:', error);
    return res.status(200).json({ success: false, reason: 'generation_failed' });
  }
};
