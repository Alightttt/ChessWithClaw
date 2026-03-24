import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';

function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function computeMaterial(chess) {
  const vals = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let w = 0, b = 0;
  chess.board().forEach(row => row.forEach(sq => {
    if (!sq) return;
    const v = vals[sq.type] || 0;
    if (sq.color === 'w') w += v; else b += v;
  }));
  const diff = w - b;
  return {
    white: w, black: b,
    advantage: diff > 0 ? 'white' : diff < 0 ? 'black' : 'equal',
    difference: Math.abs(diff)
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id: gameId, last_move_count, last_chat_count } = req.query;
  const lastMoveCount = parseInt(last_move_count) || 0;
  const lastChatCount = parseInt(last_chat_count) || 0;

  // Validate game ID
  if (!gameId || !isValidUUID(gameId)) {
    return res.status(400).json({ error: 'Invalid or missing game ID' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const agentToken = req.headers['x-agent-token'] || req.query.token || '';

  // Single database read — no loop
  const { data: game, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error || !game) {
    return res.status(404).json({ error: 'Game not found', game_id: gameId });
  }

  if (!agentToken || agentToken !== game.agent_token) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing token.' });
  }

  // Fetch move history from the new table
  const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', gameId).order('move_number', { ascending: true });
  game.move_history = (movesData || []).map(m => ({
    ...m,
    from: m.from_square || m.from,
    to: m.to_square || m.to,
    uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
  }));

  // Fetch chat history from the new table
  const { data: chatData } = await supabase.from('chat_messages').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
  game.chat_history = (chatData || []).map(msg => ({
    ...msg,
    text: msg.message,
    timestamp: new Date(msg.created_at).getTime()
  }));

  // Mark agent as connected if not already
  if (!game.agent_connected) {
    await supabase
      .from('games')
      .update({ agent_connected: true, updated_at: new Date().toISOString() })
      .eq('id', gameId);
  }

  // Game finished
  if (game.status === 'finished') {
    return res.json({
      event: 'game_ended',
      result: game.result,
      reason: game.result_reason,
      fen: game.fen,
      move_number: game.move_history ? game.move_history.length : 0,
      move_history: game.move_history || []
    });
  }

  const currentMoveCount = game.move_history ? game.move_history.length : 0;
  const currentChatCount = game.chat_history ? game.chat_history.length : 0;

  // Agent's turn and move count changed
  if (game.turn === 'b' && currentMoveCount > lastMoveCount) {
    let chess;
    try { chess = new Chess(game.fen); }
    catch(e) { return res.status(500).json({ error: 'Corrupt game state' }); }

    return res.json({
      event: 'your_turn',
      game_id: game.id,
      fen: game.fen,
      turn: 'b',
      move_number: currentMoveCount,
      last_move: game.move_history?.length > 0 ? game.move_history[game.move_history.length - 1] : null,
      legal_moves: chess.moves(),
      legal_moves_uci: chess.moves({ verbose:true }).map(m => m.from+m.to+(m.promotion||'')),
      move_history: game.move_history || [],
      board_ascii: chess.ascii(),
      in_check: chess.inCheck(),
      is_checkmate: chess.isCheckmate(),
      is_stalemate: chess.isStalemate(),
      material_balance: computeMaterial(chess),
      move_count: currentMoveCount,
      chat_count: currentChatCount
    });
  }

  // Human chatted
  if (currentChatCount > lastChatCount) {
    return res.json({
      event: 'human_chatted',
      messages: game.chat_history || [],
      move_count: currentMoveCount,
      chat_count: currentChatCount
    });
  }

  // Nothing changed — agent polls again after retry_after seconds
  return res.json({
    event: 'waiting',
    turn: game.turn,
    status: game.status,
    move_count: currentMoveCount,
    chat_count: currentChatCount,
    retry_after: 2
  });
}
