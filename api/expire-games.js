import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders, applyCacheControl } from './_middleware/headers.js';

export default async function handler(req, res) {
  applySecurityHeaders(res);
  applyCacheControl(res);

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Expire waiting games
  await supabase
    .from('games')
    .update({ status: 'abandoned' })
    .eq('status', 'waiting')
    .lt('created_at', twoHoursAgo);

  // Expire active games
  // Note: We don't have an updated_at column in the schema, so we'll use created_at for now,
  // or we can add updated_at. Let's add updated_at to the schema.
  await supabase
    .from('games')
    .update({ status: 'abandoned' })
    .eq('status', 'active')
    .lt('updated_at', twentyFourHoursAgo);

  // Remove Supabase Realtime channels for abandoned/finished games older than 1 hour
  const { data: oldGames } = await supabase
    .from('games')
    .select('id')
    .in('status', ['abandoned', 'finished'])
    .lt('updated_at', oneHourAgo);

  if (oldGames && oldGames.length > 0) {
    for (const game of oldGames) {
      const channel1 = supabase.channel(`game-${game.id}`);
      const channel2 = supabase.channel(`agent-${game.id}`);
      await supabase.removeChannel(channel1);
      await supabase.removeChannel(channel2);
    }
  }

  res.status(200).json({ success: true });
}
