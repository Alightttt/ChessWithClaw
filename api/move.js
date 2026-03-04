import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  if (origin && (origin.endsWith('.run.app') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Fallback for non-browser agents
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  
  const { id, move, reasoning } = req.body || {};
  if (!id || !move) return res.status(400).json({ error: 'Missing id or move in JSON body' });

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
  }

  // Ensure the URL starts with https://
  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: game, error } = await supabase.from('games').select('id, fen, turn, status, move_history, thinking_log, chat_history, result, result_reason, created_at, agent_connected').eq('id', id).single();

  if (error || !game) return res.status(404).json({ error: 'Game not found' });
  if (game.turn !== 'b' || (game.status !== 'active' && game.status !== 'waiting')) return res.status(400).json({ error: 'Not your turn or game over' });

  const chess = new Chess(game.fen);
  let moveObj = null;
  
  try {
    moveObj = chess.move(move);
  } catch (e) {
    try {
      const from = move.substring(0, 2);
      const to = move.substring(2, 4);
      const promotion = move.length > 4 ? move.substring(4, 5) : 'q';
      moveObj = chess.move({ from, to, promotion });
    } catch (err) {
      moveObj = null;
    }
  }

  if (!moveObj) {
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    return res.status(400).json({ error: `Invalid move: ${move}`, legal_moves: legalMoves });
  }

  const newThinkingLog = [...(game.thinking_log || []), {
    moveNumber: Math.floor((game.move_history || []).length / 2) + 1,
    text: reasoning || '(no reasoning provided)',
    finalMove: moveObj.san,
    timestamp: Date.now()
  }];

  const newMoveHistory = [...(game.move_history || []), {
    number: Math.floor((game.move_history || []).length / 2) + 1,
    color: 'b',
    from: moveObj.from,
    to: moveObj.to,
    san: moveObj.san,
    uci: moveObj.from + moveObj.to + (moveObj.promotion || ''),
    timestamp: Date.now()
  }];

  const updates = {
    fen: chess.fen(),
    turn: 'w',
    move_history: newMoveHistory,
    thinking_log: newThinkingLog,
    current_thinking: '',
    agent_connected: true,
    status: 'active'
  };

  if (chess.isCheckmate()) {
    updates.status = 'finished'; updates.result = 'black'; updates.result_reason = 'checkmate';
  } else if (chess.isStalemate()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'stalemate';
  } else if (chess.isDraw()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'draw';
  }

  await supabase.from('games').update(updates).eq('id', id);
  
  // Reconstruct PGN for response
  const responseChess = new Chess();
  newMoveHistory.forEach(m => {
    try { responseChess.move(m.san); } catch (e) {}
  });

  res.status(200).json({ 
    success: true, 
    fen: chess.fen(), 
    ascii_board: chess.ascii(),
    pgn: responseChess.pgn(),
    status: updates.status,
    result: updates.result || null,
    result_reason: updates.result_reason || null,
    message: updates.status === 'finished' ? 'Game over.' : 'Move accepted. Waiting for White to play.' 
  });
}
