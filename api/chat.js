import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { notifyAgent } from './notify.js';
import { sanitizeText, validateUUID } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10240) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/chat', 20, 60000);
  applyRateLimitHeaders(res, 20, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }
  
  const { id, text, type, sender = 'agent' } = req.body || {};
  if (!id || !text) return res.status(400).json({ error: 'Missing id or text in JSON body' });
  
  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  if (sender !== 'human' && sender !== 'agent') {
    return res.status(400).json({ error: 'Invalid sender' });
  }

  const sanitizedText = sanitizeText(text, 500);
  if (!sanitizedText) {
    return res.status(400).json({ error: 'Text is empty after sanitization' });
  }

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Verify game exists
  const { data: game, error } = await supabase.from('games').select('id, chat_history, webhook_url, webhook_failed, webhook_fail_count, move_history, fen, turn, pending_events, agent_connected').eq('id', id).single();
  if (error || !game) return res.status(404).json({ error: 'Game not found' });

  const newMessage = {
    sender: sender,
    text: sanitizedText,
    type: type || 'text', // Support special types like 'resign_request'
    timestamp: Date.now()
  };

  const newHistory = [...(game.chat_history || []), newMessage];

  const updates = { chat_history: newHistory };
  if (sender === 'agent') {
    updates.agent_connected = true;
    updates.agent_last_seen = new Date().toISOString();
  }

  if (sender === 'human') {
    const chess = new Chess(game.fen);
    const payload = {
      event: "human_sent_chat",
      game_id: id,
      human_message: sanitizedText,
      board: chess.ascii(),
      fen: game.fen,
      whose_turn: game.turn === 'w' ? 'human' : 'agent',
      move_number: Math.floor((game.move_history || []).length / 2) + 1,
      instruction: "Your user messaged you during your chess game. Reply in chat as yourself in 1-2 sentences. Use your 'skill.md' personality. Do not make a chess move unless it is your turn. CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move."
    };
    
    const enrichedPayload = await notifyAgent(game, payload, supabase);
    updates.pending_events = [...(updates.pending_events || game.pending_events || []), enrichedPayload];
  }

  // Update chat history and pending_events
  await supabase.from('games').update(updates).eq('id', id);

  res.status(200).json({ 
    success: true, 
    message: 'Chat message sent successfully.' 
  });
}
