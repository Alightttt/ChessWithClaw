import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { validateUUID } from './_utils/sanitize.js';

export const config = { runtime: 'edge' };

function computeMaterialBalance(chess) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let white = 0, black = 0;
  chess.board().forEach(row => row.forEach(sq => {
    if (!sq) return;
    const val = values[sq.type] || 0;
    if (sq.color === 'w') white += val;
    else black += val;
  }));
  const diff = white - black;
  return {
    white,
    black,
    advantage: diff > 0 ? 'white' : diff < 0 ? 'black' : 'equal',
    difference: Math.abs(diff)
  };
}

export default async function handler(req) {
  const origin = req.headers.get('origin') || '*';

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, last-event-id',
      },
    });
  }

  const url = new URL(req.url);
  let id = url.searchParams.get('id');
  const token = url.searchParams.get('token') || req.headers.get('x-agent-token') || '';
  const lastEventId = req.headers.get('last-event-id');
  const lastMoveCount = lastEventId ? parseInt(lastEventId) : 0;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing game ID' }), { status: 400 });
  }
  id = id.trim();

  if (!validateUUID(id)) {
    return new Response(JSON.stringify({ error: 'Invalid game ID format' }), { status: 400 });
  }

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
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
  const { data: gameCheck } = await supabase.from('games').select('agent_token, agent_connected').eq('id', id).single();
  if (!gameCheck || gameCheck.agent_token !== token) {
    return new Response(JSON.stringify({ error: 'Forbidden: Invalid or missing token' }), { status: 403 });
  }

  // Mark agent as connected in the database
  if (!gameCheck.agent_connected) {
    await supabase.from('games')
      .update({ agent_connected: true, agent_last_seen: new Date().toISOString() })
      .eq('id', id);
  } else {
    await supabase.from('games')
      .update({ agent_last_seen: new Date().toISOString() })
      .eq('id', id);
  }

  const { data: initialGame } = await supabase.from('games').select('*').eq('id', id).single();

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
        const legalMoves = chess.moves({ verbose: true });
        const legalMovesSan = legalMoves.map(m => m.san);
        const legalMovesUCI = legalMoves.map(m => m.from + m.to + (m.promotion || ''));
        
        const moveCount = gameData.move_history?.length || 0;
        
        // Only send if it's a new event compared to lastEventId
        if (moveCount >= lastMoveCount) {
          const payload = { 
            event: gameData.turn === 'b' ? 'your_turn' : 'update', 
            game_id: id,
            status: gameData.status,
            fen: chess.fen(), 
            turn: gameData.turn,
            move_number: Math.floor(moveCount / 2) + 1,
            last_move: moveCount > 0 ? gameData.move_history[moveCount - 1] : null,
            legal_moves: legalMovesSan,
            legal_moves_uci: legalMovesUCI,
            board_ascii: chess.ascii(),
            in_check: chess.inCheck(),
            is_checkmate: chess.isCheckmate(),
            is_stalemate: chess.isStalemate(),
            material_balance: computeMaterialBalance(chess),
            move_history: gameData.move_history || [],
            thinking_log: gameData.thinking_log || [],
            chat_history: gameData.chat_history || [],
            move_count: moveCount,
            chat_count: gameData.chat_history?.length || 0
          };

          controller.enqueue(encoder.encode(`id: ${moveCount}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        }
      };

      if (initialGame) {
        await sendUpdate(initialGame);
      }

      const channel = supabase.channel(`game-${id}-server`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, async (payload) => {
          await sendUpdate(payload.new);
        })
        .subscribe();

      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      req.signal.addEventListener('abort', async () => {
        clearInterval(heartbeatInterval);
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
