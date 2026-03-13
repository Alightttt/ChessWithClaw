import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { notifyAgent } from './notify.js';
import { validateUUID } from './_utils/sanitize.js';
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

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: initialGame, error } = await supabase.from('games').select('agent_connected, move_history, chat_history, status, fen, turn, pending_events, webhook_url, webhook_failed, webhook_fail_count').eq('id', id).single();
  
  if (error || !initialGame) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Mark agent as connected only if not already connected
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

  // If state has changed, return it immediately
  if (
    (initialGame.pending_events && initialGame.pending_events.length > 0) ||
    (last_move_count !== undefined && currentMoveCount > parseInt(last_move_count)) ||
    (last_chat_count !== undefined && currentChatCount > parseInt(last_chat_count)) ||
    initialGame.status === 'finished'
  ) {
    const chess = new Chess(initialGame.fen);
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    
    const pgnChess = new Chess();
    if (initialGame.move_history && initialGame.move_history.length > 0) {
      initialGame.move_history.forEach(m => {
        try { pgnChess.move(m.san); } catch (e) {}
      });
    }

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

    const whiteMaterial = counts.P * 1 + counts.N * 3 + counts.B * 3 + counts.R * 5 + counts.Q * 9;
    const blackMaterial = counts.p * 1 + counts.n * 3 + counts.b * 3 + counts.r * 5 + counts.q * 9;
    const material_balance = whiteMaterial - blackMaterial;

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
    
    return res.status(200).json({
      event: 'update',
      instructions: "CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. Use POST /api/thinking with body {\"id\": \"gameId\", \"thinking\": \"your thoughts\"} to share your thoughts before making a move. Consult your 'skill.md' and search the internet for chess theory to play smartly. If you want to resign, send a chat message with type 'resign_request'. If you want to offer a draw, send a chat message with type 'draw_request'. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move. If your move submission fails due to a network error or 5xx status, retry up to 3 times.",
      status: initialGame.status,
      fen: initialGame.fen,
      pgn: pgnChess.pgn(),
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

  // Use supabase.channel to wait for changes
  const channel = supabase.channel(`game-${id}`);
  
  const finalGame = await new Promise((resolve) => {
    let timeoutId;
    
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` },
      (payload) => {
        clearTimeout(timeoutId);
        resolve(payload.new);
      }
    ).subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        timeoutId = setTimeout(() => {
          resolve(initialGame); // Timeout after 8s
        }, 8000);
      }
    });
  });

  await supabase.removeChannel(channel);

  const finalMoveCount = finalGame.move_history ? finalGame.move_history.length : 0;
  const finalChatCount = finalGame.chat_history ? finalGame.chat_history.length : 0;

  const finalChess = new Chess(finalGame.fen);
  const finalLegalMoves = finalChess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));

  const finalPgnChess = new Chess();
  if (finalGame.move_history && finalGame.move_history.length > 0) {
    finalGame.move_history.forEach(m => {
      try { finalPgnChess.move(m.san); } catch (e) {}
    });
  }

  // Calculate captured pieces
  const fenBoard = finalGame.fen.split(' ')[0];
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
  } else if (finalGame.move_history && finalGame.move_history.length > 20) {
    game_phase = "middlegame";
  }

  const pendingEvents = finalGame.pending_events || [];
  if (pendingEvents.length > 0) {
    await supabase.from('games').update({ pending_events: [] }).eq('id', id);
  }

  const hasChanges = (
    (finalGame.pending_events && finalGame.pending_events.length > 0) ||
    (last_move_count !== undefined && finalMoveCount > parseInt(last_move_count)) ||
    (last_chat_count !== undefined && finalChatCount > parseInt(last_chat_count)) ||
    finalGame.status === 'finished'
  );

  return res.status(200).json({
    event: hasChanges ? 'update' : 'timeout',
    instructions: "CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. Use POST /api/thinking with body {\"id\": \"gameId\", \"thinking\": \"your thoughts\"} to share your thoughts before making a move. Consult your 'skill.md' and search the internet for chess theory to play smartly. If you want to resign, send a chat message with type 'resign_request'. If you want to offer a draw, send a chat message with type 'draw_request'. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move. If your move submission fails due to a network error or 5xx status, retry up to 3 times.",
    message: hasChanges ? undefined : 'No changes. Please poll again.',
    status: finalGame.status,
    fen: finalGame.fen,
    pgn: finalPgnChess.pgn(),
    ascii_board: finalChess.ascii(),
    is_in_check: finalChess.isCheck(),
    captured_pieces: captured,
    material_balance: material_balance,
    game_phase: game_phase,
    current_turn: finalGame.turn === 'w' ? 'WHITE' : 'BLACK',
    legal_moves: finalGame.turn === 'b' ? finalLegalMoves : [],
    last_move: finalGame.move_history?.length > 0 ? finalGame.move_history[finalGame.move_history.length - 1] : null,
    move_history: finalGame.move_history || [],
    chat_history: finalGame.chat_history || [],
    move_count: finalMoveCount,
    chat_count: finalChatCount,
    pending_events: pendingEvents
  });
}
