import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  if (origin && (origin.endsWith('.run.app') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Fallback for non-browser agents
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  
  const { id, webhook_url } = req.body || {};
  if (!id || !webhook_url) return res.status(400).json({ error: 'Missing id or webhook_url in JSON body' });

  try {
    const parsedUrl = new URL(webhook_url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return res.status(400).json({ error: 'Invalid webhook URL protocol' });
    }
    
    // Basic SSRF protection - block localhost and common internal IPs
    const hostname = parsedUrl.hostname;
    if (
      hostname === 'localhost' || 
      hostname === '127.0.0.1' || 
      hostname === '0.0.0.0' || 
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return res.status(400).json({ error: 'Invalid webhook URL: Internal or reserved IPs are not allowed' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid webhook URL format' });
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
  const { data: game, error } = await supabase.from('games').select('id').eq('id', id).single();
  if (error || !game) return res.status(404).json({ error: 'Game not found' });

  // Update webhook URL and mark agent as connected
  await supabase.from('games').update({ 
    webhook_url: webhook_url,
    agent_connected: true 
  }).eq('id', id);

  // Fire a test ping to verify it works
  try {
    fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        event: 'ping', 
        game_id: id, 
        message: 'Webhook registered successfully' 
      })
    }).catch(() => {});
  } catch (e) {}

  res.status(200).json({ 
    success: true, 
    message: 'Webhook registered successfully. We will POST to this URL when it is your turn.' 
  });
}
