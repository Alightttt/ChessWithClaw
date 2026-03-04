import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';

export default async function handler(req, res) {
  // Set headers for Server-Sent Events (SSE)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const origin = req.headers.origin;
  if (origin && (origin.endsWith('.run.app') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Fallback for non-browser agents
  }

  const { id } = req.query;
  if (!id) {
    res.write(`data: ${JSON.stringify({ error: 'Missing game ID' })}\n\n`);
    return res.end();
  }

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    res.write(`data: ${JSON.stringify({ error: 'Server configuration error' })}\n\n`);
    return res.end();
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Mark agent as connected in the database
  await supabase.from('games').update({ agent_connected: true }).eq('id', id);

  // Send initial connection success message
  res.write(`data: ${JSON.stringify({ status: 'connected', game_id: id, message: 'Listening for game updates...' })}\n\n`);

  // Subscribe to Supabase changes securely on the server side
  const channel = supabase.channel(`game-${id}-server`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, (payload) => {
      const chess = new Chess(payload.new.fen);
      const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
      
      const pgnChess = new Chess();
      if (payload.new.move_history && payload.new.move_history.length > 0) {
        payload.new.move_history.forEach(m => {
          try { pgnChess.move(m.san); } catch (e) {}
        });
      }
      
      // Calculate captured pieces
      const fenBoard = payload.new.fen.split(' ')[0];
      const counts = { p:0, n:0, b:0, r:0, q:0, P:0, N:0, B:0, R:0, Q:0 };
      for (let char of fenBoard) {
        if (counts[char] !== undefined) counts[char]++;
      }
      const captured = {
        white_lost: { 
          P: Math.max(0, 8 - counts.P), N: Math.max(0, 2 - counts.N), 
          B: Math.max(0, 2 - counts.B), R: Math.max(0, 2 - counts.R), Q: Math.max(0, 1 - counts.Q) 
        },
        black_lost: { 
          p: Math.max(0, 8 - counts.p), n: Math.max(0, 2 - counts.n), 
          b: Math.max(0, 2 - counts.b), r: Math.max(0, 2 - counts.r), q: Math.max(0, 1 - counts.q) 
        }
      };

      // Forward the update to the bot without exposing Supabase credentials
      res.write(`data: ${JSON.stringify({ 
        event: 'update', 
        status: payload.new.status,
        game_info: {
          white_player: 'Human',
          black_player: 'Agent',
          white_elo: '?',
          black_elo: '?',
          time_control: 'none',
          started_at: payload.new.created_at
        },
        events: {
          type: payload.new.status === 'finished' ? payload.new.result_reason : null,
          result: payload.new.result
        },
        captured_pieces: captured,
        fen: payload.new.fen, 
        pgn: pgnChess.pgn(),
        current_turn: payload.new.turn === 'w' ? 'WHITE' : 'BLACK',
        ascii_board: chess.ascii(),
        legal_moves: payload.new.turn === 'b' ? legalMoves : [],
        last_move: payload.new.move_history?.length > 0 ? payload.new.move_history[payload.new.move_history.length - 1] : null,
        move_history: payload.new.move_history || [],
        thinking_log: payload.new.thinking_log || [],
        chat_history: payload.new.chat_history || [],
        move_count: payload.new.move_history?.length || 0,
        chat_count: payload.new.chat_history?.length || 0
      })}\n\n`);
    })
    .subscribe();

  // Keep-alive ping to prevent the connection from dropping
  const interval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  // Cleanup when the bot disconnects
  req.on('close', async () => {
    clearInterval(interval);
    supabase.removeChannel(channel);
    await supabase.from('games').update({ agent_connected: false }).eq('id', id);
    res.end();
  });
}
