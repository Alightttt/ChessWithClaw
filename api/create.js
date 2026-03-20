import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';
import { checkRateLimit } from './_utils/rateLimit.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/create', 10, 60000);
  applyRateLimitHeaders(res, 10, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const secretToken = randomUUID();
    const agentToken = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: game, error } = await supabase
      .from('games')
      .insert([{
        status: 'waiting',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: 'w',
        move_history: [],
        thinking_log: [],
        current_thinking: '',
        human_connected: false,
        agent_connected: false,
        result: null,
        result_reason: null,
        webhook_url: null,
        chat_history: [],
        secret_token: secretToken,
        agent_token: agentToken,
        expires_at: expiresAt
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to create game in database' });
    }

    return res.status(200).json({
      id: game.id,
      fen: game.fen,
      turn: 'w',
      status: 'waiting',
      agent_token: agentToken,
      created_at: game.created_at
    });
  } catch (error) {
    console.error('Create game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
