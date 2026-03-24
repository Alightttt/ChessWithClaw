import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { sanitizeText, validateUUID } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateLimitResult = checkRateLimit(ip, '/api/state:get', 120, 60000);
  applyRateLimitHeaders(res, 120, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }

  let { id, token } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing game ID' });
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
  }

  const agentToken = req.headers['x-agent-token'] || token || '';

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: game, error } = await supabase.from('games').select('id, fen, turn, status, result, result_reason, agent_connected, human_connected, webhook_url, agent_capabilities, pending_events, move_count, created_at, updated_at, agent_name, agent_avatar, agent_tagline, agent_token').eq('id', id).single();

  if (error || !game) return res.status(404).json({ error: 'Game not found' });

  if (!agentToken || agentToken !== game.agent_token) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing token.' });
  }

  // Fetch move history from the new table
  const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', id).order('move_number', { ascending: true });
  game.move_history = (movesData || []).map(m => ({
    ...m,
    from: m.from_square || m.from,
    to: m.to_square || m.to,
    uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
  }));

  // Fetch chat history from the new table
  const { data: chatData } = await supabase.from('chat_messages').select('*').eq('game_id', id).order('created_at', { ascending: true });
  game.chat_history = (chatData || []).map(msg => ({
    ...msg,
    text: msg.message,
    timestamp: new Date(msg.created_at).getTime()
  }));

  // Fetch thinking log from the new table
  const { data: thoughtsData } = await supabase.from('agent_thoughts').select('*').eq('game_id', id).order('created_at', { ascending: true });
  game.thinking_log = (thoughtsData || []).map(thought => ({
    ...thought,
    text: thought.thought,
    moveNumber: thought.move_number,
    timestamp: new Date(thought.created_at).getTime()
  }));

  if (agentToken && agentToken === game.agent_token) {
    const updates = { agent_last_seen: new Date().toISOString() };
    if (!game.agent_connected) {
      updates.agent_connected = true;
      game.agent_connected = true;
    }
    const { error: updateError } = await supabase.from('games').update(updates).eq('id', id);
    if (updateError) {
      console.error('Failed to update agent connection status:', updateError);
    }
  }

  const chess = new Chess();
  if (game.move_history && game.move_history.length > 0) {
    game.move_history.forEach(m => {
      try { chess.move(m.san); } catch (e) {}
    });
  } else if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    chess.load(game.fen);
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
    fen: chess.fen(),
    pgn: chess.pgn(),
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
