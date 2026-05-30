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

  // FIX 1 — move_count
  const move_history = Array.isArray(game.move_history) ? game.move_history : [];
  const move_count = move_history.length;

  // FIX 2 — chat_count and human_chatted
  const chat_history = Array.isArray(game.chat_history) ? game.chat_history : [];
  const human_messages = chat_history.filter(m => m.role === 'human');
  const chat_count = human_messages.length;
  const agentLastHumanChatCount = parseInt(req.query.last_human_chat_count || '0');
  const human_chatted = chat_count > agentLastHumanChatCount;

  // FIX 3 — legal_moves
  const legal_moves_uci = Array.isArray(game.legal_moves) ? game.legal_moves : [];
  const trueTurn = game.turn || 'w';

  // FIX 4 — events array
  const events = [];
  if (game.turn === 'b' && game.status === 'active') events.push('your_turn');
  if (human_chatted) events.push('human_chatted');

  let event = 'waiting';
  if (game.status === 'finished' || game.status === 'abandoned') {
    event = game.status === 'abandoned' ? 'abandoned' : 'game_ended';
  } else if (events.includes('your_turn')) {
    event = 'your_turn';
  } else if (events.includes('human_chatted')) {
    event = 'human_chatted';
  }

  // Build the complete standardized JSON structure
  const responseData = {
    event,
    fen: game.fen,
    turn: trueTurn,
    status: game.status,
    move_count: move_count,
    legal_moves: legal_moves_uci,
    legal_moves_uci: legal_moves_uci,
    in_check: Boolean(game.in_check),
    last_move: game.last_move || null,
    move_history: moveHistory,
    chat_count: chat_count,
    all_chat_count: chat_history.length,
    messages: chat_history, // Include in ALL poll responses so the agent is never deaf!
    chat_history: chat_history, // Alias in all responses
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
  if (event === 'game_ended' || event === 'abandoned') {
    responseData.status = game.result_reason === 'resignation' ? 'resigned' : game.result === 'draw' ? 'drawn' : game.result_reason === 'checkmate' ? 'checkmate' : game.status;
    responseData.result = game.result;
    responseData.reason = game.result_reason || '';
    responseData.move_number = game.move_number || 0;
  } else if (event === 'your_turn') {
    responseData.move_number = game.move_number || 0;
  } else if (event === 'human_chatted') {
    // Already included inline above
  } else {
    responseData.retry_after = 2;
  }

  return res.json(responseData);
};
