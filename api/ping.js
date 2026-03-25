import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applyRateLimitHeaders } from './_middleware/headers.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ 
      error: 'Server configuration error',
      code: 'MISSING_ENV_VARS'
    });
  }

  // Apply rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/ping', 120, 60000); // 120 requests per minute
  
  applyRateLimitHeaders(res, 120, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let { id, token } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing game ID' });
  }
  id = id.trim();

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
    return res.status(403).json({ error: 'Forbidden: Invalid or missing token.' });
  }

  if (game.status === 'finished' || game.status === 'abandoned') return res.status(400).json({ error: 'Game over' });

  const updates = { agent_last_seen: new Date().toISOString() };
  if (!game.agent_connected) {
    updates.agent_connected = true;
  }

  await supabase.from('games').update(updates).eq('id', id);
  return res.status(200).json({ success: true, message: 'Ping received' });
}
