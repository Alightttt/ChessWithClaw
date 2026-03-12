import { createClient } from '@supabase/supabase-js';
import { notifyAgent } from './notify.js';
import { sanitizeText, validateUUID, validateWebhookURL } from './_utils/sanitize.js';
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
  const rateLimitResult = checkRateLimit(ip, '/api/webhook', 5, 60000);
  applyRateLimitHeaders(res, 5, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }
  
  const { id, webhook_url, agent_name, agent_avatar, agent_tagline } = req.body || {};
  if (!id || !webhook_url) return res.status(400).json({ error: 'Missing id or webhook_url in JSON body' });

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  if (!validateWebhookURL(webhook_url)) {
    return res.status(400).json({ error: 'Invalid webhook URL' });
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
  const { data: game, error } = await supabase.from('games').select('id, fen, turn, status, move_history, chat_history, pending_events').eq('id', id).single();
  if (error || !game) return res.status(404).json({ error: 'Game not found' });

  const payload = {
    event: 'agent_connected',
    game_id: id,
    status: game.status,
    fen: game.fen,
    current_turn: game.turn === 'w' ? 'WHITE' : 'BLACK',
    move_count: (game.move_history || []).length,
    chat_count: (game.chat_history || []).length,
    message: 'Webhook registered successfully. You are now connected.'
  };

  const updates = { 
    webhook_url: webhook_url,
    agent_connected: true,
    webhook_fail_count: 0,
    webhook_failed: false
  };

  if (agent_name) updates.agent_name = sanitizeText(agent_name, 50);
  if (agent_tagline) updates.agent_tagline = sanitizeText(agent_tagline, 100);
  if (agent_avatar) {
    const sanitizedAvatar = Array.from(agent_avatar)[0] || '🤖';
    updates.agent_avatar = sanitizedAvatar.slice(0, 2);
  }

  let newPendingEvents = [...(game.pending_events || [])];
  
  const gameWithNewWebhook = { ...game, webhook_url: webhook_url, webhook_failed: false, webhook_fail_count: 0 };
  
  const enrichedPayload = await notifyAgent(gameWithNewWebhook, payload, supabase);
  newPendingEvents.push(enrichedPayload);

  if (!game.agent_connected) {
    const gameStartedPayload = {
      event: "game_started",
      game_id: id,
      instruction: "The game has started. Send a short, friendly greeting in chat to your opponent. Be yourself."
    };
    const enrichedGameStartedPayload = await notifyAgent(gameWithNewWebhook, gameStartedPayload, supabase);
    newPendingEvents.push(enrichedGameStartedPayload);
  }

  updates.pending_events = newPendingEvents;

  // Update webhook URL and mark agent as connected
  await supabase.from('games').update(updates).eq('id', id);

  res.status(200).json({ 
    success: true, 
    message: 'Webhook registered successfully. We will POST to this URL when it is your turn.',
    game_state: payload
  });
}
