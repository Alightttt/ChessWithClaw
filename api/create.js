import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';
import { checkRateLimit } from './_utils/rateLimit.js';

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

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/create', 10, 60000);
  applyRateLimitHeaders(res, 10, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const agentToken = randomUUID();
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 24*60*60*1000).toISOString();

    const { data: game, error } = await supabase
      .from('games')
      .insert({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: 'w',
        status: 'waiting',
        move_history: [],
        chat_history: [],
        move_count: 0,
        chat_count: 0,
        move_number: 0,
        in_check: false,
        agent_connected: false,
        agent_token: agentToken,
        created_at: now,
        updated_at: now,
        expires_at: expires
      })
      .select()
      .single();

    if (error || !game) {
      console.error('Game creation failed:', error);
      return res.status(500).json({ 
        error: 'Failed to create game',
        detail: error?.message,
        code: 'CREATE_FAILED'
      });
    }

    return res.status(200).json({
      id: game.id,
      fen: game.fen,
      turn: game.turn,
      status: game.status,
      agent_token: agentToken,
      created_at: game.created_at
    });
  } catch (error) {
    console.error('Create game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
