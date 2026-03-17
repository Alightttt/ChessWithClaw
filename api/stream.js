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
  let id = url.searchParams.get('id');
  const token = url.searchParams.get('token') || req.headers.get('x-agent-token') || '';

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing game ID' }), { status: 400 });
  }
  id = id.trim();

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

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        'x-agent-token': token
      }
    }
  });

  // Verify token before updating
  const { data: gameCheck } = await supabase.from('games').select('agent_token').eq('id', id).single();
  if (!gameCheck || gameCheck.agent_token !== token) {
    return new Response(JSON.stringify({ error: 'Forbidden: Invalid or missing token' }), { status: 403 });
  }

  // Mark agent as connected in the database
  const { data: initialGame } = await supabase.from('games').update({ 
    agent_connected: true,
    agent_last_seen: new Date().toISOString()
  }).eq('id', id).select().single();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('retry: 3000\n\n'));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'connected', game_id: id, message: 'Listening for game updates...' })}\n\n`));

      const sendUpdate = async (gameData) => {
        // Fetch move history from the new table
        const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', id).order('move_number', { ascending: true });
        gameData.move_history = movesData || [];

        // Fetch chat history from the new table
        const { data: chatData } = await supabase.from('chat_messages').select('*').eq('game_id', id).order('created_at', { ascending: true });
        gameData.chat_history = (chatData || []).map(msg => ({
          ...msg,
          text: msg.message,
          timestamp: new Date(msg.created_at).getTime()
        }));

        // Fetch thinking log from the new table
        const { data: thoughtsData } = await supabase.from('agent_thoughts').select('*').eq('game_id', id).order('created_at', { ascending: true });
        gameData.thinking_log = (thoughtsData || []).map(thought => ({
          ...thought,
          text: thought.thought,
          moveNumber: thought.move_number,
          timestamp: new Date(thought.created_at).getTime()
        }));

        const chess = new Chess();
        if (gameData.move_history && gameData.move_history.length > 0) {
          gameData.move_history.forEach(m => {
            try { chess.move(m.san); } catch (e) {}
          });
        } else if (gameData.fen && gameData.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
          chess.load(gameData.fen);
        }
        const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
        
        // Calculate captured pieces
        const fenBoard = gameData.fen.split(' ')[0];
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

        const whiteMaterial = counts.P * 1 + counts.N * 3 + counts.B * 3 + counts.R * 5 + counts.Q * 9;
        const blackMaterial = counts.p * 1 + counts.n * 3 + counts.b * 3 + counts.r * 5 + counts.q * 9;
        const material_balance = whiteMaterial - blackMaterial;

        let game_phase = "opening";
        const totalPieces = Object.values(counts).reduce((a, b) => a + b, 0);
        if (totalPieces <= 12 || (counts.Q === 0 && counts.q === 0)) {
          game_phase = "endgame";
        } else if (gameData.move_history && gameData.move_history.length > 20) {
          game_phase = "middlegame";
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          event: 'update', 
          status: gameData.status,
          game_info: {
            white_player: 'Human',
            black_player: 'Agent',
            white_elo: '?',
            black_elo: '?',
            time_control: 'none',
            started_at: gameData.created_at
          },
          events: {
            type: gameData.status === 'finished' ? gameData.result_reason : null,
            result: gameData.result
          },
          captured_pieces: captured,
          material_balance: material_balance,
          is_in_check: chess.isCheck(),
          game_phase: game_phase,
          fen: chess.fen(), 
          pgn: chess.pgn(),
          current_turn: gameData.turn === 'w' ? 'WHITE' : 'BLACK',
          ascii_board: chess.ascii(),
          legal_moves: gameData.turn === 'b' ? legalMoves : [],
          last_move: gameData.move_history?.length > 0 ? gameData.move_history[gameData.move_history.length - 1] : null,
          move_history: gameData.move_history || [],
          thinking_log: gameData.thinking_log || [],
          chat_history: gameData.chat_history || [],
          move_count: gameData.move_history?.length || 0,
          chat_count: gameData.chat_history?.length || 0
        })}\n\n`));
      };

      if (initialGame) {
        await sendUpdate(initialGame);
      }

      const channel = supabase.channel(`game-${id}-server`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, async (payload) => {
          await sendUpdate(payload.new);
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
