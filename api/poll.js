const { createClient } = require('@supabase/supabase-js');

function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id||''))
}

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

  const { data: game, error } = await supabase
    .from('games').select('*').eq('id', gameId).single()

  if(error||!game){
    return res.status(404).json({
      error:'Game not found',code:'GAME_NOT_FOUND',
      detail:error?.message})
  }

  const agentName = req.query.agent_name || req.headers['x-agent-name'] || null;
  const isAgent = Boolean(req.headers['x-agent-token']);
  
  if (isAgent) {
     let needsUpdate = false;
     const lastSeenDate = game.agent_last_seen ? new Date(game.agent_last_seen) : null;
     const thirtySecsAgo = new Date(Date.now() - 30000);
     
     if (!game.agent_connected) {
        needsUpdate = true;
     }
     if (agentName && agentName !== 'TestClaw' && agentName.length > 0 && game.agent_name !== agentName) {
        needsUpdate = true;
     }
     const needsFreshSeen = !lastSeenDate || lastSeenDate < thirtySecsAgo;

     if (needsUpdate || needsFreshSeen) {
        const updateData = {
           agent_last_seen: new Date().toISOString()
        };
        if (!game.agent_connected) {
           updateData.agent_connected = true;
        }
        if (agentName && agentName !== 'TestClaw' && agentName.length > 0 && game.agent_name !== agentName) {
           updateData.agent_name = agentName;
         }
         try {
            await supabase.from('games').update(updateData).eq('id', gameId);
            // update local object so values match what's in DB
            if (updateData.agent_connected) game.agent_connected = true;
            if (updateData.agent_name) game.agent_name = agentName;
            game.agent_last_seen = updateData.agent_last_seen;
         } catch (updateErr) {
            console.error("Non-blocking error updating agent presence in poll:", updateErr);
         }
      }
  }

  // Fetch move history
  const { data: movesData, error: movesError } = await supabase.from('moves').select('*').eq('game_id', gameId).order('move_number', { ascending: true });
  let moveHistory = [];
  if (!movesError && movesData && movesData.length > 0) {
    moveHistory = movesData.map(m => ({
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

  // Compute FEN-accurate turn and legal moves on server-side
  let legalMovesUCI = [];
  let trueTurn = game.turn;
  try {
    const { Chess } = await import('chess.js');
    const chess = new Chess(game.fen);
    trueTurn = chess.turn();
    legalMovesUCI = chess.moves({ verbose: true })
      .map(m => m.from + m.to + (m.promotion || ''));
  } catch (e) {
    console.error("Chess.js error in poll:", e);
  }

  // Fix chat_count
  const chatHistory = game.chat_history || [];
  const humanChatCount = chatHistory.filter(m => m.role === 'human').length;
  const allChatCount = chatHistory.length;

  // Fix event logic — your_turn must fire when turn==='b' AND status==='active':
  let event = 'waiting';
  
  if (game.status === 'finished' || game.status === 'abandoned') {
    event = 'game_ended';
  } else if (trueTurn === 'b' && game.status === 'active') {
    event = 'your_turn'; // Always, no other conditions
  } else {
    // Check for new human chat — only fire if the last message is indeed from the human (prevent spam loop)
    const lastMessage = chatHistory[chatHistory.length - 1];
    const isLastFromHuman = lastMessage && lastMessage.role === 'human';
    const lastSeenChat = parseInt(req.query.last_chat_count) || 0;
    if (humanChatCount > lastSeenChat && isLastFromHuman) {
      event = 'human_chatted';
    }
  }

  // Build the complete standardized JSON structure
  const responseData = {
    event,
    fen: game.fen,
    turn: trueTurn,
    status: game.status,
    move_count: moveHistory.length, // READ DYNAMICALLY from database moves history size - never wrong
    legal_moves: legalMovesUCI,
    legal_moves_uci: legalMovesUCI,
    in_check: Boolean(game.in_check),
    last_move: game.last_move || null,
    move_history: moveHistory,
    chat_count: humanChatCount,
    all_chat_count: allChatCount,
    companion_thought: game.companion_thought || '',
    thought_language: game.thought_language || 'english',
    agent_connected: Boolean(game.agent_connected),
    agent_last_seen: game.agent_last_seen || null,
    board_theme: game.board_theme || 'green',
    piece_style: game.piece_style || 'neo', // FALLBACK to neo as requested by user
    material_balance: game.material_balance || null,
    draw_offer_pending: Boolean(game.draw_offer_pending),
    agent_typing: Boolean(game.agent_typing),
    id: game.id,
    game_id: game.id,
  };

  // Add event-specific extras
  if (event === 'game_ended') {
    responseData.status = game.result_reason === 'resignation' ? 'resigned' : game.result === 'draw' ? 'drawn' : game.result_reason === 'checkmate' ? 'checkmate' : game.status;
    responseData.result = game.result;
    responseData.reason = game.result_reason || '';
    responseData.move_number = game.move_number || 0;
  } else if (event === 'your_turn') {
    responseData.move_number = game.move_number || 0;
  } else if (event === 'human_chatted') {
    responseData.messages = chatHistory;
  } else {
    responseData.retry_after = 2;
  }

  return res.json(responseData);
};
