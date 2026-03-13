import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, applyRateLimitHeaders } from '../lib/rateLimit.js';

export default async function handler(req, res) {
  // Apply rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/ping', 120, 60000); // 120 requests per minute
  
  applyRateLimitHeaders(res, 120, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing game ID' });
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
  
  const { data: game, error } = await supabase.from('games').select('id, status, agent_connected').eq('id', id).single();
  if (error || !game) return res.status(404).json({ error: 'Game not found' });
  if (game.status === 'finished' || game.status === 'abandoned') return res.status(400).json({ error: 'Game over' });

  const updates = { agent_last_ping: new Date().toISOString() };
  if (!game.agent_connected) {
    updates.agent_connected = true;
  }

  await supabase.from('games').update(updates).eq('id', id);
  return res.status(200).json({ success: true, message: 'Ping received' });
}
