import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { notifyAgent } from './notify.js';
import { validateUUID } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';

function computeMaterialBalance(chess) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let white = 0, black = 0;
  chess.board().forEach(row => row.forEach(sq => {
    if (!sq) return;
    const val = values[sq.type] || 0;
    if (sq.color === 'w') white += val;
    else black += val;
  }));
  const diff = white - black;
  return {
    white,
    black,
    advantage: diff > 0 ? 'white' : diff < 0 ? 'black' : 'equal',
    difference: Math.abs(diff)
  };
}

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/poll', 60, 60000);
  applyRateLimitHeaders(res, 60, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }

  let { id, last_move_count, last_chat_count } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing game ID' });
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        'x-agent-token': req.headers['x-agent-token'] || ''
      }
    }
  });

  const { data: initialGame, error } = await supabase.from('games').select('agent_connected, status, fen, turn, pending_events, webhook_url, webhook_failed, webhook_fail_count, agent_token').eq('id', id).single();
  
  if (error || !initialGame) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const agentToken = req.headers['x-agent-token'];
  if (!agentToken || agentToken !== initialGame.agent_token) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing x-agent-token.' });
  }

  // Fetch move history from the new table
  const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', id).order('move_number', { ascending: true });
  initialGame.move_history = movesData || [];

  // Fetch chat history from the new table
  const { data: chatData } = await supabase.from('chat_messages').select('*').eq('game_id', id).order('created_at', { ascending: true });
  initialGame.chat_history = (chatData || []).map(msg => ({
    ...msg,
    text: msg.message,
    timestamp: new Date(msg.created_at).getTime()
  }));

  // FIX 2 — SET agent_connected = true
  const initialUpdates = { agent_last_seen: new Date().toISOString() };
  if (!initialGame.agent_connected) {
    const payload = {
      event: "game_started",
      game_id: id,
      instruction: "The game has started. Send a short, friendly greeting in chat to your opponent. Be yourself."
    };
    const enrichedPayload = await notifyAgent(initialGame, payload, supabase);
    const newPendingEvents = [...(initialGame.pending_events || []), enrichedPayload];
    initialUpdates.agent_connected = true;
    initialUpdates.pending_events = newPendingEvents;
    initialGame.pending_events = newPendingEvents;
  }
  await supabase.from('games').update(initialUpdates).eq('id', id);

  const currentMoveCount = initialGame.move_history ? initialGame.move_history.length : 0;
  const currentChatCount = initialGame.chat_history ? initialGame.chat_history.length : 0;

  // FIX 1 — REWRITE AS SINGLE-SHOT POLL
  // If state has changed, return it immediately
  if (
    (initialGame.pending_events && initialGame.pending_events.length > 0) ||
    (last_move_count !== undefined && currentMoveCount > parseInt(last_move_count)) ||
    (last_chat_count !== undefined && currentChatCount > parseInt(last_chat_count)) ||
    initialGame.status === 'finished' ||
    initialGame.turn === 'b' // Also return immediately if it's the agent's turn
  ) {
    const chess = new Chess();
    if (initialGame.move_history && initialGame.move_history.length > 0) {
      initialGame.move_history.forEach(m => {
        try { chess.move(m.san); } catch (e) {}
      });
    } else if (initialGame.fen && initialGame.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      chess.load(initialGame.fen);
    }
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));

    // Calculate captured pieces
    const fenBoard = initialGame.fen.split(' ')[0];
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

    const material_balance = computeMaterialBalance(chess);

    let game_phase = "opening";
    const totalPieces = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalPieces <= 12 || (counts.Q === 0 && counts.q === 0)) {
      game_phase = "endgame";
    } else if (initialGame.move_history && initialGame.move_history.length > 20) {
      game_phase = "middlegame";
    }

    const pendingEvents = initialGame.pending_events || [];
    if (pendingEvents.length > 0) {
      await supabase.from('games').update({ pending_events: [] }).eq('id', id);
    }
    
    // FIX 3 — RETURN COMPLETE PAYLOAD
    return res.status(200).json({
      event: initialGame.turn === 'b' ? 'your_turn' : 'update',
      instructions: "CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. Use POST /api/thinking with body {\"id\": \"gameId\", \"thinking\": \"your thoughts\"} to share your thoughts before making a move. Consult your 'skill.md' and search the internet for chess theory to play smartly. If you want to resign, send a chat message with type 'resign_request'. If you want to offer a draw, send a chat message with type 'draw_request'. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move. If your move submission fails due to a network error or 5xx status, retry up to 3 times.",
      status: initialGame.status,
      fen: chess.fen(),
      pgn: chess.pgn(),
      ascii_board: chess.ascii(),
      is_in_check: chess.isCheck(),
      captured_pieces: captured,
      material_balance: material_balance,
      game_phase: game_phase,
      current_turn: initialGame.turn === 'w' ? 'WHITE' : 'BLACK',
      legal_moves: initialGame.turn === 'b' ? legalMoves : [],
      last_move: initialGame.move_history?.length > 0 ? initialGame.move_history[initialGame.move_history.length - 1] : null,
      move_history: initialGame.move_history || [],
      chat_history: initialGame.chat_history || [],
      move_count: currentMoveCount,
      chat_count: currentChatCount,
      pending_events: pendingEvents
    });
  }

  // If there are no updates, return this exact JSON
  return res.status(200).json({
    event: 'waiting',
    message: 'No new events. Please poll again.',
    retry_after: 2
  });
}
