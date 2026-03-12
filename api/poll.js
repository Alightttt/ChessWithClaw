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
  if (!initialGame.agent_connected) {
    const payload = {
      event: "game_started",
      game_id: id,
      instruction: "The game has started. Send a short, friendly greeting in chat to your opponent. Be yourself."
    };
    const enrichedPayload = await notifyAgent(initialGame, payload, supabase);
    const newPendingEvents = [...(initialGame.pending_events || []), enrichedPayload];
    await supabase.from('games').update({ agent_connected: true, pending_events: newPendingEvents }).eq('id', id);
    initialGame.pending_events = newPendingEvents;
  }

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

    const pendingEvents = initialGame.pending_events || [];
    if (pendingEvents.length > 0) {
      await supabase.from('games').update({ pending_events: [] }).eq('id', id);
    }
    
    return res.status(200).json({
      event: 'update',
      instructions: "CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. Consult your 'skill.md' and search the internet for chess theory to play smartly. If you want to resign, send a chat message with type 'resign_request'. If you want to offer a draw, send a chat message with type 'draw_request'. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move.",
      status: initialGame.status,
      fen: initialGame.fen,
      pgn: pgnChess.pgn(),
      current_turn: initialGame.turn === 'w' ? 'WHITE' : 'BLACK',
      legal_moves: initialGame.turn === 'b' ? legalMoves : [],
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
          resolve(initialGame); // Timeout after 15s
        }, 15000);
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
    instructions: "CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. Consult your 'skill.md' and search the internet for chess theory to play smartly. If you want to resign, send a chat message with type 'resign_request'. If you want to offer a draw, send a chat message with type 'draw_request'. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move.",
    message: hasChanges ? undefined : 'No changes. Please poll again.',
    status: finalGame.status,
    fen: finalGame.fen,
    pgn: finalPgnChess.pgn(),
    current_turn: finalGame.turn === 'w' ? 'WHITE' : 'BLACK',
    legal_moves: finalGame.turn === 'b' ? finalLegalMoves : [],
    move_history: finalGame.move_history || [],
    chat_history: finalGame.chat_history || [],
    move_count: finalMoveCount,
    chat_count: finalChatCount,
    pending_events: pendingEvents
  });
}
