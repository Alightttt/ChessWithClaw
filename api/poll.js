import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Chess } = require('chess.js');
import { createClient } from '@supabase/supabase-js'

function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id||''))
}

function computeMaterial(chess) {
  const vals={p:1,n:3,b:3,r:5,q:9}
  let w=0,b=0
  chess.board().forEach(row=>row&&row.forEach(sq=>{
    if(!sq)return
    const v=vals[sq.type]||0
    if(sq.color==='w')w+=v;else b+=v
  }))
  const diff=w-b
  return{white:w,black:b,
    advantage:diff>0?'white':diff<0?'black':'equal',
    difference:Math.abs(diff)}
}

export default async function handler(req, res) {
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

  const{id:gameId,last_move_count,last_chat_count}=req.query
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

  // Fetch chat history
  const { data: chatData, error: chatError } = await supabase.from('chat_messages').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
  if (!chatError && chatData && chatData.length > 0) {
    game.chat_history = chatData.map(msg => ({
      ...msg,
      text: msg.message,
      timestamp: new Date(msg.created_at).getTime()
    }));
  }

  // Check expiry
  if(game.expires_at&&new Date(game.expires_at)<new Date()){
    return res.status(404).json({
      error:'Game expired',code:'GAME_EXPIRED',
      detail:'Create a new game and send a fresh invite.'})
  }

  // Set connected (service role bypasses RLS — always works)
  if(!game.agent_connected){
    await supabase.from('games')
      .update({agent_connected:true,
        updated_at:new Date().toISOString()})
      .eq('id',gameId).eq('agent_connected',false)
  }

  if(game.status==='finished'){
    return res.json({
      event:'game_ended',result:game.result,
      reason:game.result_reason,fen:game.fen,
      move_number:game.move_number,
      move_history:game.move_history})
  }

  if(game.turn==='b'&&game.move_count>lastMoveCount){
    let chess
    try{chess=new Chess(game.fen)}
    catch(e){return res.status(500).json({
      error:'Corrupt game state',code:'CORRUPT_FEN'})}
    return res.json({
      event:'your_turn',game_id:game.id,fen:game.fen,
      turn:'b',move_number:game.move_number,
      last_move:game.last_move,
      legal_moves:chess.moves(),
      legal_moves_uci:chess.moves({verbose:true})
        .map(m=>m.from+m.to+(m.promotion||'')),
      move_history:game.move_history,
      board_ascii:chess.ascii(),
      in_check:chess.inCheck(),
      is_checkmate:chess.isCheckmate(),
      is_stalemate:chess.isStalemate(),
      material_balance:computeMaterial(chess),
      move_count:game.move_count,
      chat_count:game.chat_count})
  }

  if(game.chat_count>lastChatCount){
    return res.json({
      event:'human_chatted',messages:game.chat_history,
      move_count:game.move_count,chat_count:game.chat_count})
  }

  return res.json({
    event:'waiting',turn:game.turn,status:game.status,
    move_count:game.move_count,chat_count:game.chat_count,
    retry_after:2})
}
