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

  const { data: initialGame, error } = await supabase.from('games').select('agent_connected, move_history, chat_history, status, fen, turn').eq('id', id).single();
  
  if (error || !initialGame) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Mark agent as connected only if not already connected
  if (!initialGame.agent_connected) {
    await supabase.from('games').update({ agent_connected: true }).eq('id', id);
  }

  const currentMoveCount = initialGame.move_history ? initialGame.move_history.length : 0;
  const currentChatCount = initialGame.chat_history ? initialGame.chat_history.length : 0;

  // If state has changed, return it immediately
  if (
    (last_move_count !== undefined && currentMoveCount > parseInt(last_move_count)) ||
    (last_chat_count !== undefined && currentChatCount > parseInt(last_chat_count)) ||
    initialGame.status === 'finished'
  ) {
    const chess = new Chess(initialGame.fen);
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    
    const pgnChess = new Chess();
    if (initialGame.move_history && initialGame.move_history.length > 0) {
      initialGame.move_history.forEach(m => {
        try { pgnChess.move(m.san); } catch (e) {}
      });
    }
    
    return res.status(200).json({
      event: 'update',
      status: initialGame.status,
      fen: initialGame.fen,
      pgn: pgnChess.pgn(),
      current_turn: initialGame.turn === 'w' ? 'WHITE' : 'BLACK',
      legal_moves: initialGame.turn === 'b' ? legalMoves : [],
      move_history: initialGame.move_history || [],
      chat_history: initialGame.chat_history || [],
      move_count: currentMoveCount,
      chat_count: currentChatCount
    });
  }

  // If no change, wait 3 seconds and check ONE more time to simulate short long-polling
  // This avoids the while loop that destroys Supabase quota
  await new Promise(resolve => setTimeout(resolve, 3000));

  const { data: finalGame } = await supabase.from('games').select('id, fen, turn, status, move_history, chat_history').eq('id', id).single();
  if (!finalGame) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const finalMoveCount = finalGame.move_history ? finalGame.move_history.length : 0;
  const finalChatCount = finalGame.chat_history ? finalGame.chat_history.length : 0;

  if (
    (last_move_count !== undefined && finalMoveCount > parseInt(last_move_count)) ||
    (last_chat_count !== undefined && finalChatCount > parseInt(last_chat_count)) ||
    finalGame.status === 'finished'
  ) {
    const finalChess = new Chess(finalGame.fen);
    const finalLegalMoves = finalChess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));

    const finalPgnChess = new Chess();
    if (finalGame.move_history && finalGame.move_history.length > 0) {
      finalGame.move_history.forEach(m => {
        try { finalPgnChess.move(m.san); } catch (e) {}
      });
    }

    return res.status(200).json({
      event: 'update',
      status: finalGame.status,
      fen: finalGame.fen,
      pgn: finalPgnChess.pgn(),
      current_turn: finalGame.turn === 'w' ? 'WHITE' : 'BLACK',
      legal_moves: finalGame.turn === 'b' ? finalLegalMoves : [],
      move_history: finalGame.move_history || [],
      chat_history: finalGame.chat_history || [],
      move_count: finalMoveCount,
      chat_count: finalChatCount
    });
  }

  // Still no change, return timeout
  const finalPgnChess = new Chess();
  if (finalGame.move_history && finalGame.move_history.length > 0) {
    finalGame.move_history.forEach(m => {
      try { finalPgnChess.move(m.san); } catch (e) {}
    });
  }

  return res.status(200).json({ 
    event: 'timeout', 
    message: 'No changes. Please poll again.',
    status: finalGame.status,
    fen: finalGame.fen,
    pgn: finalPgnChess.pgn(),
    current_turn: finalGame.turn === 'w' ? 'WHITE' : 'BLACK',
    legal_moves: finalGame.turn === 'b' ? [] : [],
    move_history: finalGame.move_history || [],
    chat_history: finalGame.chat_history || [],
    move_count: finalMoveCount,
    chat_count: finalChatCount
  });
}
