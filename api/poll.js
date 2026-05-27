const { createClient } = require('@supabase/supabase-js');

function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id||''))
}

// computeMaterial removed

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type,x-agent-token')
  if(req.method==='OPTIONS')return res.status(200).end()
  if(req.method!=='GET')return res.status(405).json({
    error:'Method not allowed'})

  if(!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)||!process.env.SUPABASE_SERVICE_ROLE_KEY){
    return res.status(500).json({error:'Server config error'})
  }

  const supabase = createClient(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const gameId = req.query.id || req.query.gameId || req.query.game_id;
  const last_move_count = req.query.last_move_count;
  const last_chat_count = req.query.last_chat_count;
  const lastMoveCount=parseInt(last_move_count)||0
  const lastChatCount=parseInt(last_chat_count)||0

  if(!gameId||!isValidUUID(gameId)){
    return res.status(400).json({
      error:'Invalid game ID',code:'INVALID_GAME_ID',
      provided:gameId})
  }

  const{data:game,error}=await supabase
    .from('games').select('*').eq('id',gameId).single()

  if (game && Boolean(req.headers['x-agent-token'])) {
     const agentName = req.query.agent_name || req.headers['x-agent-name'] || null;
     let needsUpdate = false;
     const updateData = { agent_last_seen: new Date().toISOString() };
     
     if (!game.agent_connected) {
        updateData.agent_connected = true;
        needsUpdate = true;
     }
     if (agentName && agentName !== 'TestClaw' && agentName.length > 0 && game.agent_name !== agentName) {
        updateData.agent_name = agentName;
        needsUpdate = true;
     }
     if (needsUpdate || Math.random() < 0.1) {
        // Await the update FIRST before doing the heavy move computation
        await supabase.from('games').update(updateData).eq('id', gameId);
     }
  }

  if(error||!game){
    return res.status(404).json({
      error:'Game not found',code:'GAME_NOT_FOUND',
      detail:error?.message})
  }

  // Calculate dynamic human chat_count
  const humanMessages = (game.chat_history || [])
    .filter(m => m.role === 'human');
  const humanChatCount = humanMessages.length;
  game.chat_count = humanChatCount;

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object') {
      body.agent_last_seen = game.agent_last_seen || null;
      body.agent_connected = game.agent_connected || false;
      body.chat_count = humanChatCount;
      body.board_theme = game.board_theme || 'green';
      body.piece_style = game.piece_style || 'standard';
      body.thought_language = game.thought_language || 'english';
      body.agent_typing = Boolean(game.agent_typing);
      body.draw_offer_pending = Boolean(game.draw_offer_pending);
      body.companion_thought = game.companion_thought || '';
    }
    return originalJson(body);
  };

  // Fetch move history
  const { data: movesData, error: movesError } = await supabase.from('moves').select('*').eq('game_id', gameId).order('move_number', { ascending: true });
  if (!movesError && movesData && movesData.length > 0) {
    game.move_history = movesData.map(m => ({
      ...m,
      from: m.from_square || m.from,
      to: m.to_square || m.to,
      uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
    }));
  }

  // Check expiry
  if(game.expires_at&&new Date(game.expires_at)<new Date()){
    return res.status(404).json({
      error:'Game expired',code:'GAME_EXPIRED',
      detail:'Create a new game and send a fresh invite.'})
  }

  const agentName = req.query.agent_name || req.headers['x-agent-name'] || null;
  const isAgent = Boolean(req.headers['x-agent-token']);
  
  if (isAgent) {
     let needsUpdate = false;
     const updateData = {
        agent_last_seen: new Date().toISOString()
     };
     
     if (!game.agent_connected) {
        updateData.agent_connected = true;
        needsUpdate = true;
     }
     if (agentName && agentName !== 'TestClaw' && agentName.length > 0 && game.agent_name !== agentName) {
        updateData.agent_name = agentName;
        needsUpdate = true;
     }

     if (needsUpdate || Math.random() < 0.1) { // periodically update last seen
        // Fire and forget so we don't block the poll
        supabase.from('games').update({ ...updateData }).eq('id', gameId).then(()=>{});
     }
  }

  const lastMoveTimestamp = game.move_history && game.move_history.length > 0 
    ? game.move_history[game.move_history.length - 1].created_at 
    : game.created_at;

  const opponentConnected = game.player_last_seen 
    ? (new Date() - new Date(game.player_last_seen)) < 15000 
    : false;

  let computedLegalMoves = [];
  let inCheck = false;
  let isCheckmate = false;
  let isStalemate = false;
  let boardAscii = '';
  try {
    const { Chess } = await import('chess.js');
    const chess = new Chess(game.fen);
    inCheck = chess.isCheck ? chess.isCheck() : (chess.in_check ? chess.in_check() : false);
    isCheckmate = chess.isCheckmate ? chess.isCheckmate() : (chess.in_checkmate ? chess.in_checkmate() : false);
    isStalemate = chess.isStalemate ? chess.isStalemate() : (chess.in_stalemate ? chess.in_stalemate() : false);
    boardAscii = chess.ascii ? chess.ascii() : '';
    const verboseMoves = chess.moves({ verbose: true });
    computedLegalMoves = verboseMoves.map(m => m.from + m.to + (m.promotion || ''));
  } catch (e) {
    console.error("Chess.js error in poll:", e);
  }

  let event = 'waiting';

  if (game.status === 'finished' || game.status === 'abandoned') {
    event = 'game_ended';
  } else if (game.turn === 'b' && game.status === 'active') {
    // It's Black's turn (agent's turn) — always return your_turn
    // Do NOT check move_count. Do NOT check opponent_connected.
    // If turn is b and status is active, agent must move.
    event = 'your_turn';
  } else if (game.turn === 'w' && game.status === 'active') {
    event = 'waiting';
  } else if (game.status === 'waiting') {
    event = 'waiting';
  }

  // Check for new human chat — only if human sent a message
  // Count messages from human role only
  if (humanChatCount > (parseInt(lastChatCount) || 0)) {
    event = 'human_chatted'; // Only fire if HUMAN sent new message
  }

  const baseResponse = {
    event: event,
    chat_count: humanChatCount, // only human messages
    agent_chat_count: (game.chat_history || []).filter(m => m.role === 'agent').length,
    board_theme: game.board_theme || 'green',
    piece_style: game.piece_style || 'standard',
    move_count: game.move_count || 0,
    status: game.status,
    turn: game.turn,
    fen: game.fen,
    last_move_timestamp: lastMoveTimestamp,
    opponent_connected: opponentConnected,
  };

  if (event === 'game_ended') {
    return res.json({
      ...baseResponse,
      status: game.result_reason === 'resignation' ? 'resigned' : game.result === 'draw' ? 'drawn' : game.result_reason === 'checkmate' ? 'checkmate' : game.status,
      result: game.result,
      reason: game.result_reason,
      move_number: game.move_number,
      move_history: game.move_history
    });
  }

  if (event === 'your_turn') {
    return res.json({
      ...baseResponse,
      game_id: game.id,
      turn: 'b',
      move_number: game.move_number,
      last_move: game.last_move,
      legal_moves: computedLegalMoves,
      legal_moves_uci: computedLegalMoves,
      board_ascii: boardAscii || game.board_ascii || '',
      in_check: inCheck || game.in_check || false,
      is_checkmate: isCheckmate,
      is_stalemate: isStalemate,
      move_history: game.move_history
    });
  }

  if (event === 'human_chatted') {
    return res.json({
      ...baseResponse,
      messages: game.chat_history,
    });
  }

  return res.json({
    ...baseResponse,
    retry_after: 2
  });
}
