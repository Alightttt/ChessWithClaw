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
  
  const { id, text, type, sender = 'agent' } = req.body || {};
  if (!id || !text) return res.status(400).json({ error: 'Missing id or text in JSON body' });

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
  const { data: game, error } = await supabase.from('games').select('id, chat_history, webhook_url, move_history').eq('id', id).single();
  if (error || !game) return res.status(404).json({ error: 'Game not found' });

  const sanitizeText = (str) => {
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };

  const newMessage = {
    sender: sender,
    text: sanitizeText(text),
    type: type || 'text', // Support special types like 'resign_request'
    timestamp: Date.now()
  };

  const newHistory = [...(game.chat_history || []), newMessage];

  const updates = { chat_history: newHistory };
  if (sender === 'agent') {
    updates.agent_connected = true;
  }

  // Update chat history
  await supabase.from('games').update(updates).eq('id', id);

  // Trigger webhook if human sent it and webhook exists
  if (sender === 'human' && game.webhook_url) {
    try {
      fetch(game.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'chat_message',
          game_id: id,
          message: newMessage,
          chat_history: newHistory,
          move_count: (game.move_history || []).length,
          chat_count: newHistory.length
        })
      }).catch(err => console.error('Webhook failed:', err));
    } catch (e) {}
  }

  res.status(200).json({ 
    success: true, 
    message: 'Chat message sent successfully.' 
  });
}
