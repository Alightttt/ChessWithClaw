import { createClient } from '@supabase/supabase-js';
import { notifyAgent } from './notify.js';
import { validateUUID } from './_utils/sanitize.js';
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
  const rateLimitResult = checkRateLimit(ip, '/api/heartbeat', 60, 60000);
  applyRateLimitHeaders(res, 60, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }
  
  let { id, role } = req.body || {};
  if (!id || !role) return res.status(400).json({ error: 'Missing id or role in JSON body' });
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        'x-game-token': req.headers['x-game-token'] || '',
        'x-agent-token': req.headers['x-agent-token'] || ''
      }
    }
  });
  
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
    const { data: game, error } = await supabase.from('games').select('id, turn, status, human_last_moved_at, last_impatience_at, pending_events, webhook_url, webhook_failed, webhook_fail_count, fen').eq('id', id).single();
    
    if (!error && game && game.status === 'active' && game.turn === 'w' && game.human_last_moved_at) {
      const lastMoved = new Date(game.human_last_moved_at).getTime();
      const lastImpatience = game.last_impatience_at ? new Date(game.last_impatience_at).getTime() : 0;
      const currentTime = Date.now();
      
      const waitedSeconds = Math.floor((currentTime - lastMoved) / 1000);
      
      if (waitedSeconds > 90 && (currentTime - lastImpatience > 180000)) {
        const payload = {
          event: "human_slow",
          waited_seconds: waitedSeconds,
          fen: game.fen,
          instruction: "Your opponent is taking a long time. Send one short impatient or curious message in chat. Be yourself."
        };
        
        const enrichedPayload = await notifyAgent(game, payload, supabase);
        
        await supabase.from('games').update({
          last_impatience_at: now,
          pending_events: [...(game.pending_events || []), enrichedPayload]
        }).eq('id', id);
      }
    }
  }

  res.status(200).json({ connected: true });
}
