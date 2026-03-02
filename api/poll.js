import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { id, last_move_count, last_chat_count } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing game ID' });

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Mark agent as connected
  await supabase.from('games').update({ agent_connected: true }).eq('id', id);

  // Long polling logic: wait up to 8 seconds for a change
  const startTime = Date.now();
  const timeout = 8000; // 8 seconds to stay under Vercel's 10s limit

  while (Date.now() - startTime < timeout) {
    const { data: game, error } = await supabase.from('games').select('*').eq('id', id).single();
    if (error || !game) return res.status(404).json({ error: 'Game not found' });

    const currentMoveCount = game.move_history ? game.move_history.length : 0;
    const currentChatCount = game.chat_history ? game.chat_history.length : 0;

    // If there's a change, return the new state immediately
    if (
      (last_move_count !== undefined && currentMoveCount > parseInt(last_move_count)) ||
      (last_chat_count !== undefined && currentChatCount > parseInt(last_chat_count)) ||
      game.status === 'finished'
    ) {
      const chess = new Chess(game.fen);
      const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
      
      return res.status(200).json({
        event: 'update',
        status: game.status,
        fen: game.fen,
        current_turn: game.turn === 'w' ? 'WHITE' : 'BLACK',
        legal_moves: game.turn === 'b' ? legalMoves : [],
        move_history: game.move_history || [],
        chat_history: game.chat_history || [],
        move_count: currentMoveCount,
        chat_count: currentChatCount
      });
    }

    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Timeout reached, return current counts so the client can poll again
  const { data: finalGame } = await supabase.from('games').select('move_history, chat_history').eq('id', id).single();
  return res.status(200).json({ 
    event: 'timeout', 
    message: 'No changes. Please poll again.',
    move_count: finalGame?.move_history?.length || 0,
    chat_count: finalGame?.chat_history?.length || 0
  });
}
