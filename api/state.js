import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { sanitizeText, validateUUID } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  
  if (req.method === 'PATCH') {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > 10240) {
      return res.status(413).json({ error: 'Payload too large' });
    }

    const rateLimitResult = checkRateLimit(ip, '/api/state:patch', 60, 60000);
    applyRateLimitHeaders(res, 60, rateLimitResult.remaining, rateLimitResult.resetTime);
    
    if (!rateLimitResult.allowed) {
      res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
      return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
    }

    const { id, current_thinking } = req.body || {};
    if (!id || current_thinking === undefined) return res.status(400).json({ error: 'Missing id or current_thinking' });
    
    if (!validateUUID(id)) {
      return res.status(400).json({ error: 'Invalid game ID format' });
    }

    const sanitizedThinking = sanitizeText(current_thinking, 2000);

    let supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
      return res.status(500).json({ error: 'Server configuration error' });
    }
    if (!supabaseUrl.startsWith('http')) supabaseUrl = `https://${supabaseUrl}`;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: game, error } = await supabase.from('games').select('id, status, agent_connected').eq('id', id).single();
    if (error || !game) return res.status(404).json({ error: 'Game not found' });
    if (game.status === 'finished') return res.status(400).json({ error: 'Game over' });

    const updates = { 
      current_thinking: sanitizedThinking,
      agent_last_seen: new Date().toISOString()
    };
    if (!game.agent_connected) {
      updates.agent_connected = true;
    }

    await supabase.from('games').update(updates).eq('id', id);
    return res.status(200).json({ success: true, message: 'Thinking updated' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateLimitResult = checkRateLimit(ip, '/api/state:get', 120, 60000);
  applyRateLimitHeaders(res, 120, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing game ID' });

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

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
  const { data: game, error } = await supabase.from('games').select('id, fen, turn, status, move_history, chat_history, thinking_log, current_thinking, result, result_reason, agent_connected, human_connected, webhook_url, agent_capabilities, pending_events, move_count, created_at, updated_at, agent_name, agent_avatar, agent_tagline').eq('id', id).single();

  if (error || !game) return res.status(404).json({ error: 'Game not found' });

  const updates = { agent_last_seen: new Date().toISOString() };
  if (!game.agent_connected) {
    updates.agent_connected = true;
    game.agent_connected = true;
  }
  await supabase.from('games').update(updates).eq('id', id);

  const chess = new Chess(game.fen);
  
  // Reconstruct PGN from move history using a fresh board
  const pgnChess = new Chess();
  if (game.move_history && game.move_history.length > 0) {
    game.move_history.forEach(m => {
      try { pgnChess.move(m.san); } catch (e) {}
    });
  }
  
  const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));

  // Calculate captured pieces and material balance
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
  
  const whiteMaterial = counts.P * 1 + counts.N * 3 + counts.B * 3 + counts.R * 5 + counts.Q * 9;
  const blackMaterial = counts.p * 1 + counts.n * 3 + counts.b * 3 + counts.r * 5 + counts.q * 9;
  const material_balance = whiteMaterial - blackMaterial;

  let game_phase = "opening";
  const totalPieces = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalPieces <= 12 || (counts.Q === 0 && counts.q === 0)) {
    game_phase = "endgame";
  } else if (game.move_history && game.move_history.length > 20) {
    game_phase = "middlegame";
  }

  res.status(200).json({
    instructions: "You are BLACK. If current_turn is BLACK, choose a move from legal_moves and POST to /api/move. Consult your 'skill.md' and search the internet for chess theory to play smartly. CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. If you want to resign, send a chat message with type 'resign_request'. If you want to offer a draw, send a chat message with type 'draw_request'. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move. If your move submission fails due to a network error or 5xx status, retry up to 3 times.",
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
    material_balance: material_balance,
    is_in_check: chess.isCheck(),
    game_phase: game_phase,
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
