import { createClient } from '@supabase/supabase-js';
import { sanitizeText, validateUUID } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10240) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/thinking', 60, 60000);
  applyRateLimitHeaders(res, 60, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }
  
  let { id, thinking, token } = req.body || {};
  if (!id || thinking === undefined) return res.status(400).json({ error: 'Missing id or thinking in JSON body' });
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  const sanitizedThinking = sanitizeText(thinking, 2000);

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const agentToken = req.headers['x-agent-token'] || token || '';

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: game, error } = await supabase.from('games').select('id, status, agent_connected, agent_token').eq('id', id).single();
  if (error || !game) return res.status(404).json({ error: 'Game not found' });
  
  if (!agentToken || agentToken !== game.agent_token) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing x-agent-token.' });
  }

  if (game.status === 'finished') return res.status(400).json({ error: 'Game over' });

  const updates = { 
    current_thinking: sanitizedThinking,
    agent_last_seen: new Date().toISOString()
  };
  if (!game.agent_connected) {
    updates.agent_connected = true;
  }

  await supabase.from('games').update(updates).eq('id', id);

  res.status(200).json({ success: true, message: 'Thinking updated' });
}
