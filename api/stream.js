import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { validateUUID } from './_utils/sanitize.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const origin = req.headers.get('origin') || '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing game ID' }), { status: 400 });
  }

  if (!validateUUID(id)) {
    return new Response(JSON.stringify({ error: 'Invalid game ID format' }), { status: 400 });
  }

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Mark agent as connected in the database
  await supabase.from('games').update({ agent_connected: true }).eq('id', id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'connected', game_id: id, message: 'Listening for game updates...' })}\n\n`));

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
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
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
          })}\n\n`));
        })
        .subscribe();

      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, 15000);

      req.signal.addEventListener('abort', async () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
        await supabase.from('games').update({ agent_connected: false }).eq('id', id);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
