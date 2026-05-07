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

  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY){
    return res.status(500).json({error:'Server config error'})
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
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

  if(error||!game){
    return res.status(404).json({
      error:'Game not found',code:'GAME_NOT_FOUND',
      detail:error?.message})
  }

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

  // Set connected and update last seen
  const updateData = {
    agent_connected: true,
    agent_last_seen: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (agentName && !game.agent_name) {
    updateData.agent_name = agentName || game.agent_name || 'OpenClaw';
  }

  await supabase.from('games')
    .update(updateData)
    .eq('id', gameId);

  if(game.status==='finished'||game.status==='abandoned'){
    return res.json({
      event:'game_ended',
      status: game.result_reason === 'resignation' ? 'resigned' : game.result === 'draw' ? 'drawn' : game.result_reason === 'checkmate' ? 'checkmate' : game.status,
      result:game.result,
      reason:game.result_reason,fen:game.fen,
      move_number:game.move_number,
      move_history:game.move_history})
  }

  const lastMoveTimestamp = game.move_history && game.move_history.length > 0 
    ? game.move_history[game.move_history.length - 1].created_at 
    : game.created_at;

  const opponentConnected = game.player_last_seen 
    ? (new Date() - new Date(game.player_last_seen)) < 15000 
    : false;

  if(game.turn==='b'&&game.move_count>lastMoveCount){
    return res.json({
      event:'your_turn',game_id:game.id,fen:game.fen,
      turn:'b',move_number:game.move_number,
      last_move:game.last_move,
      last_move_timestamp: lastMoveTimestamp,
      opponent_connected: opponentConnected,
      legal_moves: [],
      legal_moves_uci: [],
      move_history:game.move_history,
      board_ascii:"",
      in_check: false,
      is_checkmate: false,
      is_stalemate: false,
      material_balance: {},
      move_count:game.move_count,
      chat_count:game.chat_count})
  }

  if(game.chat_count>lastChatCount){
    return res.json({
      event:'human_chatted',messages:game.chat_history,
      last_move_timestamp: lastMoveTimestamp,
      opponent_connected: opponentConnected,
      move_count:game.move_count,chat_count:game.chat_count})
  }

  return res.json({
    event:'waiting',turn:game.turn,status:game.status,
    last_move_timestamp: lastMoveTimestamp,
    opponent_connected: opponentConnected,
    move_count:game.move_count,chat_count:game.chat_count,
    retry_after:2})
}
