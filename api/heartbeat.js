import { createClient } from '@supabase/supabase-js';
import { notifyAgent } from './notify.js';
import { validateUUID } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';

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

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10240) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/heartbeat', 60, 60000);
  applyRateLimitHeaders(res, 60, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }
  
  let { id, role, token } = req.body || {};
  if (!id || !role) return res.status(400).json({ error: 'Missing id or role in JSON body' });
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
  }

  const agentToken = req.headers['x-agent-token'] || token || '';
  const gameToken = req.headers['x-game-token'] || token || '';

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: game, error: fetchError } = await supabase.from('games').select('secret_token, agent_token').eq('id', id).single();
  if (fetchError || !game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (role === 'human') {
    if (!gameToken || gameToken !== game.secret_token) {
      return res.status(403).json({ error: 'Forbidden: Invalid or missing token.' });
    }
  } else if (role === 'agent') {
    if (!agentToken || agentToken !== game.agent_token) {
      return res.status(403).json({ error: 'Forbidden: Invalid or missing token.' });
    }
  }

  const updates = {};
  const now = new Date().toISOString();
  
  if (role === 'human') {
    updates.human_last_seen = now;
    updates.human_connected = true;
  } else if (role === 'agent') {
    updates.agent_last_seen = now;
    updates.agent_connected = true;
  }

  const { error: updateError } = await supabase.from('games').update(updates).eq('id', id);
  if (updateError) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing token.' });
  }

  // Check for human slow
  if (role === 'human') {
    const { data: gameData, error } = await supabase.from('games').select('id, turn, status, human_last_moved_at, last_impatience_at, pending_events, webhook_url, webhook_failed, webhook_fail_count, fen, player_color').eq('id', id).single();
    
    if (!error && gameData && gameData.status === 'active' && gameData.turn === (gameData.player_color || 'w') && gameData.human_last_moved_at) {
      const lastMoved = new Date(gameData.human_last_moved_at).getTime();
      const lastImpatience = gameData.last_impatience_at ? new Date(gameData.last_impatience_at).getTime() : 0;
      const currentTime = Date.now();
      
      const waitedSeconds = Math.floor((currentTime - lastMoved) / 1000);
      
      if (waitedSeconds > 90 && (currentTime - lastImpatience > 180000)) {
        const payload = {
          event: "human_slow",
          waited_seconds: waitedSeconds,
          fen: gameData.fen,
          instruction: "Your opponent is taking a long time. Send one short impatient or curious message in chat. Be yourself."
        };
        
        const enrichedPayload = await notifyAgent(gameData, payload, supabase);
        
        await supabase.from('games').update({
          last_impatience_at: now,
          pending_events: [...(gameData.pending_events || []), enrichedPayload]
        }).eq('id', id);
      }
    }
  }

  res.status(200).json({ connected: true });
}
