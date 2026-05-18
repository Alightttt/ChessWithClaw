const { createClient } = require('@supabase/supabase-js');
const { validateUUID } = require('../server-lib/utils/sanitize.js');
const { applySecurityHeaders, applyCacheControl, applyCorsHeaders } = require('../server-lib/middleware/headers.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).includes('your_supabase') || !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).startsWith('http')) {
    return res.status(500).json({ error: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in AI Studio settings to create a match.' });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId, move } = req.query;
  const agentToken = req.headers['x-agent-token'];

  if (!gameId || !validateUUID(gameId)) {
    return res.status(400).json({ valid: false, reason: 'invalid_game_id' });
  }

  if (!move || typeof move !== 'string') {
    return res.status(400).json({ valid: false, reason: 'missing_move' });
  }

  const supabase = createClient(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: game, error } = await supabase.from('games').select('id, agent_token, fen, turn, status').eq('id', gameId).single();

  if (error || !game) {
    return res.status(404).json({ valid: false, reason: 'game_not_found' });
  }

  if (game.agent_token !== agentToken) {
    return res.status(403).json({ valid: false, reason: 'invalid_token' });
  }

  if (game.status !== 'active') {
    return res.status(400).json({ valid: false, reason: 'game_not_active' });
  }

  if (game.turn !== 'b') { // Assuming agent is always black based on previous code conventions
    return res.status(400).json({ valid: false, reason: 'not_your_turn' });
  }

  try {
    const { Chess } = await import('chess.js');
    const chess = new Chess(game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const legal = chess.moves({ verbose: true });
    
    // Check if the requested move is in legal moves
    const moveStr = move.trim();
    const matched_move = legal.find(m => m.lan === moveStr || (m.from + m.to) === moveStr.substring(0, 4) || (m.from + m.to + (m.promotion||'')) === moveStr);
    
    if (matched_move) {
      return res.status(200).json({ valid: true, move: moveStr, san: matched_move.san });
    } else {
      return res.status(200).json({ 
        valid: false, 
        reason: 'illegal_move', 
        legal_moves: legal.map(m => m.from + m.to + (m.promotion ? m.promotion : '')) 
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ valid: false, reason: 'internal_error' });
  }
};
