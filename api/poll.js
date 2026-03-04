import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  if (origin && (origin.endsWith('.run.app') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Fallback for non-browser agents
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let { id, last_move_count, last_chat_count } = req.query;
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

  // Initialize counts if not provided
  if (last_move_count === undefined || last_chat_count === undefined) {
    const { data: initialGame } = await supabase.from('games').select('move_history, chat_history').eq('id', id).single();
    if (initialGame) {
      if (last_move_count === undefined) last_move_count = initialGame.move_history ? initialGame.move_history.length : 0;
      if (last_chat_count === undefined) last_chat_count = initialGame.chat_history ? initialGame.chat_history.length : 0;
    }
  }

  // Long polling logic using Supabase Realtime
  return new Promise((resolve) => {
    let isResolved = false;
    let timeoutId;

    const channel = supabase.channel(`game-${id}-poll`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, (payload) => {
        if (isResolved) return;
        
        const game = payload.new;
        const currentMoveCount = game.move_history ? game.move_history.length : 0;
        const currentChatCount = game.chat_history ? game.chat_history.length : 0;

        if (
          (last_move_count !== undefined && currentMoveCount > parseInt(last_move_count)) ||
          (last_chat_count !== undefined && currentChatCount > parseInt(last_chat_count)) ||
          game.status === 'finished'
        ) {
          isResolved = true;
          clearTimeout(timeoutId);
          supabase.removeChannel(channel);

          const chess = new Chess(game.fen);
          const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
          
          const pgnChess = new Chess();
          if (game.move_history && game.move_history.length > 0) {
            game.move_history.forEach(m => {
              try { pgnChess.move(m.san); } catch (e) {}
            });
          }
          
          resolve(res.status(200).json({
            event: 'update',
            status: game.status,
            fen: game.fen,
            pgn: pgnChess.pgn(),
            current_turn: game.turn === 'w' ? 'WHITE' : 'BLACK',
            legal_moves: game.turn === 'b' ? legalMoves : [],
            move_history: game.move_history || [],
            chat_history: game.chat_history || [],
            move_count: currentMoveCount,
            chat_count: currentChatCount
          }));
        }
      })
      .subscribe();

    // Timeout fallback
    timeoutId = setTimeout(async () => {
      if (isResolved) return;
      isResolved = true;
      supabase.removeChannel(channel);

      const { data: finalGame } = await supabase.from('games').select('id, fen, turn, status, move_history, chat_history').eq('id', id).single();
      if (!finalGame) {
        return resolve(res.status(404).json({ error: 'Game not found' }));
      }

      const finalChess = new Chess(finalGame.fen);
      const finalLegalMoves = finalChess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));

      const finalPgnChess = new Chess();
      if (finalGame.move_history && finalGame.move_history.length > 0) {
        finalGame.move_history.forEach(m => {
          try { finalPgnChess.move(m.san); } catch (e) {}
        });
      }

      resolve(res.status(200).json({ 
        event: 'timeout', 
        message: 'No changes. Please poll again.',
        status: finalGame.status,
        fen: finalGame.fen,
        pgn: finalPgnChess.pgn(),
        current_turn: finalGame.turn === 'w' ? 'WHITE' : 'BLACK',
        legal_moves: finalGame.turn === 'b' ? finalLegalMoves : [],
        move_history: finalGame.move_history || [],
        chat_history: finalGame.chat_history || [],
        move_count: finalGame.move_history?.length || 0,
        chat_count: finalGame.chat_history?.length || 0
      }));
    }, 8000);
  });
}
