import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';

export default async function handler(req, res) {
  // CORS headers to allow agents to fetch from anywhere
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  if (origin && (origin.endsWith('.run.app') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Fallback for non-browser agents
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing game ID' });

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

  // If the agent checks the state via API, mark them as connected!
  if (!game.agent_connected) {
    await supabase.from('games').update({ agent_connected: true }).eq('id', id);
    game.agent_connected = true;
  }

  const chess = new Chess(game.fen);
  
  // Reconstruct PGN from move history using a fresh board
  const pgnChess = new Chess();
  if (game.move_history && game.move_history.length > 0) {
    game.move_history.forEach(m => {
      try { pgnChess.move(m.san); } catch (e) {}
    });
  }
  
  const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));

  // Calculate captured pieces
  const fenBoard = game.fen.split(' ')[0];
  const counts = { p:0, n:0, b:0, r:0, q:0, P:0, N:0, B:0, R:0, Q:0 };
  for (let char of fenBoard) {
    if (counts[char] !== undefined) counts[char]++;
  }
  const captured = {
    white_lost: { 
      P: Math.max(0, 8 - counts.P), N: Math.max(0, 2 - counts.N), 
      B: Math.max(0, 2 - counts.B), R: Math.max(0, 2 - counts.R), Q: Math.max(0, 1 - counts.Q) 
    },
    black_lost: { 
      p: Math.max(0, 8 - counts.p), n: Math.max(0, 2 - counts.n), 
      b: Math.max(0, 2 - counts.b), r: Math.max(0, 2 - counts.r), q: Math.max(0, 1 - counts.q) 
    }
  };

  res.status(200).json({
    instructions: "You are BLACK. If current_turn is BLACK, choose a move from legal_moves and POST to /api/move",
    game_id: id,
    status: game.status,
    game_info: {
      white_player: 'Human',
      black_player: 'Agent',
      white_elo: '?',
      black_elo: '?',
      time_control: 'none',
      started_at: game.created_at
    },
    events: {
      type: game.status === 'finished' ? game.result_reason : null,
      result: game.result
    },
    captured_pieces: captured,
    current_turn: game.turn === 'w' ? 'WHITE' : 'BLACK',
    you_are: 'BLACK',
    fen: game.fen,
    pgn: pgnChess.pgn(),
    ascii_board: chess.ascii(),
    legal_moves: game.turn === 'b' ? legalMoves : [],
    last_move: game.move_history?.length > 0 ? game.move_history[game.move_history.length - 1] : null,
    move_history: game.move_history || [],
    thinking_log: game.thinking_log || [],
    chat_history: game.chat_history || [],
    move_count: game.move_history?.length || 0,
    chat_count: game.chat_history?.length || 0
  });
}
