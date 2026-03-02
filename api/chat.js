import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  
  const { id, text, type } = req.body || {};
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
  const { data: game, error } = await supabase.from('games').select('id, chat_history').eq('id', id).single();
  if (error || !game) return res.status(404).json({ error: 'Game not found' });

  const newMessage = {
    sender: 'agent',
    text: text,
    type: type || 'text', // Support special types like 'resign_request'
    timestamp: Date.now()
  };

  const newHistory = [...(game.chat_history || []), newMessage];

  // Update chat history and mark agent as connected
  await supabase.from('games').update({ 
    chat_history: newHistory,
    agent_connected: true 
  }).eq('id', id);

  res.status(200).json({ 
    success: true, 
    message: 'Chat message sent successfully.' 
  });
}
