import { createClient } from '@supabase/supabase-js';
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
  const rateLimitResult = checkRateLimit(ip, '/api/thinking', 60, 60000);
  applyRateLimitHeaders(res, 60, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }
  
  const { id, thinking } = req.body || {};
  if (!id || thinking === undefined) return res.status(400).json({ error: 'Missing id or thinking in JSON body' });

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  const sanitizedThinking = sanitizeText(thinking, 2000);

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

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

  res.status(200).json({ success: true, message: 'Thinking updated' });
}
