const { createClient } = require('@supabase/supabase-js');
const { validateUUID } = require('../server-lib/utils/sanitize.js');

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

module.exports = async (req, res) => {
  const origin = req.headers.origin || '*';

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, last-event-id, x-agent-token, x-game-token');
    return res.status(200).end();
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ 
      error: 'Server configuration error',
      code: 'MISSING_ENV_VARS'
    });
  }

  let id = req.query.id;
  const token = req.query.token || req.headers['x-agent-token'] || '';
  const lastEventId = req.headers['last-event-id'];
  const lastMoveCount = lastEventId ? parseInt(lastEventId) : 0;

  if (!id) {
    return res.status(400).json({ error: 'Missing game ID' });
  }
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Verify token before updating
  const { data: gameCheck } = await supabase.from('games').select('agent_token, agent_connected').eq('id', id).single();
  if (!gameCheck) {
    return res.status(404).json({ error: 'Game not found', code: 'GAME_NOT_FOUND' });
  }
  if (gameCheck.agent_token !== token) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing token', code: 'INVALID_AGENT_TOKEN' });
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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.flushHeaders();

  res.write('retry: 3000\n\n');
  res.write(`data: ${JSON.stringify({ status: 'connected', game_id: id, message: 'Listening for game updates...' })}\n\n`);

  const sendUpdate = async (gameData) => {
    // Fetch move history from the new table
    const { data: movesData, error: movesError } = await supabase.from('moves').select('*').eq('game_id', id).order('move_number', { ascending: true });
    if (!movesError && movesData && movesData.length > 0) {
      gameData.move_history = movesData.map(m => ({
        ...m,
        from: m.from_square || m.from,
        to: m.to_square || m.to,
        uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
      }));
    }

    // Fetch thinking log from the new table
    const { data: thoughtsData, error: thoughtsError } = await supabase.from('agent_thoughts').select('*').eq('game_id', id).order('created_at', { ascending: true });
    if (!thoughtsError && thoughtsData && thoughtsData.length > 0) {
      gameData.thinking_log = thoughtsData.map(thought => ({
        ...thought,
        text: thought.thought,
        moveNumber: thought.move_number,
        timestamp: new Date(thought.created_at).getTime()
      }));
    }

    const { Chess } = await import('chess.js');

    let chess;
    try {
      chess = new Chess(gameData.fen);
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: 'Corrupt game state', code: 'CORRUPT_FEN' })}\n\n`);
      return;
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

      res.write(`id: ${moveCount}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
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

  const heartbeatInterval = setInterval(async () => {
    try {
      res.write(': heartbeat\n\n');
      // Update agent_last_seen to prevent UI from thinking agent disconnected
      await supabase.from('games').update({ agent_last_seen: new Date().toISOString() }).eq('id', id);
    } catch (e) {
      clearInterval(heartbeatInterval);
    }
  }, 25000);

  req.on('close', async () => {
    clearInterval(heartbeatInterval);
    supabase.removeChannel(channel);
    await supabase.from('games').update({ agent_connected: false }).eq('id', id);
  });
}
