import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { notifyAgent } from './notify.js';
import { sanitizeText, validateUUID, validateUCIMove } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';
import { detectGameEvent, getMaterialBalance, getEmotionalContext } from './_utils/gameLogic.js';

function computeMaterial(chess) {
  const vals = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let w = 0, b = 0;
  chess.board().forEach(row => row.forEach(sq => {
    if (!sq) return;
    const v = vals[sq.type] || 0;
    if (sq.color === 'w') w += v; else b += v;
  }));
  const diff = w - b;
  return { white: w, black: b, advantage: diff > 0 ? 'white' : diff < 0 ? 'black' : 'equal', difference: Math.abs(diff) };
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10240) {
    return res.status(413).json({ error: 'Payload too large' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const rateLimitResult = checkRateLimit(ip, '/api/move', 30, 60000);
  applyRateLimitHeaders(res, 30, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }
  
  let { id, move, reasoning, token } = req.body || {};
  if (!id || !move) return res.status(400).json({ error: 'Missing id or move in JSON body' });
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  if (!validateUCIMove(move)) {
    return res.status(400).json({ error: 'Invalid move format. Use UCI format (e.g., e2e4).' });
  }

  const sanitizedReasoning = sanitizeText(reasoning, 300);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
  }

  const agentToken = req.headers['x-agent-token'] || token || '';
  const gameToken = req.headers['x-game-token'] || token || '';

  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: game, error } = await supabase.from('games').select('id, fen, turn, status, result, result_reason, agent_connected, human_connected, webhook_url, agent_capabilities, pending_events, move_count, created_at, updated_at, webhook_failed, webhook_fail_count, agent_name, agent_avatar, agent_tagline, secret_token, agent_token').eq('id', id).single();

  if (error || !game) return res.status(404).json({ error: 'Game not found' });
  
  // FIX 1 — BETTER ERROR CODE WHEN WAITING
  if (game.status === 'waiting' && !game.agent_connected) {
    return res.status(400).json({
      error: 'Waiting for OpenClaw to join',
      code: 'WAITING_FOR_AGENT',
      agent_connected: game.agent_connected
    });
  }
  
  if (game.status !== 'active' && game.status !== 'waiting') return res.status(400).json({ error: 'Game over' });

  // Fetch move history from the new table
  const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', id).order('move_number', { ascending: true });
  game.move_history = (movesData || []).map(m => ({
    ...m,
    from: m.from_square || m.from,
    to: m.to_square || m.to,
    uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
  }));

  // Fetch chat history from the new table
  const { data: chatData } = await supabase.from('chat_messages').select('*').eq('game_id', id).order('created_at', { ascending: true });
  game.chat_history = (chatData || []).map(msg => ({
    ...msg,
    text: msg.message,
    timestamp: new Date(msg.created_at).getTime()
  }));

  const isHumanMove = game.turn === 'w';
  const isAgentMove = game.turn === 'b';

  if (isHumanMove) {
    if (!gameToken || gameToken !== game.secret_token) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid or missing token for White (human) move.',
      });
    }
  } else if (isAgentMove) {
    if (!agentToken || agentToken !== game.agent_token) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid or missing token for Black (agent) move.',
      });
    }

    // FIX 3 — SET agent_connected ON AGENT'S FIRST MOVE
    if (!game.agent_connected) {
      await supabase
        .from('games')
        .update({ agent_connected: true })
        .eq('id', id);
    }
  }

  // FIX 4 — PROTECT AGAINST CORRUPT FEN
  let chess;
  try { 
    chess = new Chess(game.fen); 
  } catch(e) {
    return res.status(500).json({
      error: 'Game state corrupted',
      code: 'CORRUPT_FEN'
    });
  }

  const boardBeforeMove = chess.ascii();
  let moveObj = null;
  
  try {
    moveObj = chess.move(move);
  } catch (e) {
    try {
      const from = move.substring(0, 2);
      const to = move.substring(2, 4);
      const promotion = move.length > 4 ? move.substring(4, 5) : undefined;
      const moveParams = promotion ? { from, to, promotion } : { from, to };
      moveObj = chess.move(moveParams);
    } catch (err) {
      moveObj = null;
    }
  }

  if (!moveObj) {
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    return res.status(400).json({ 
      error: `Invalid move format or illegal move: '${move}'. Please use UCI format (e.g., 'e2e4', 'g1f3', 'e7e8q') or standard algebraic notation (e.g., 'e4', 'Nf3').`, 
      legal_moves: legalMoves 
    });
  }

  const moveNumber = Math.floor((game.move_history || []).length / 2) + 1;
  const newMove = {
    game_id: id,
    move_number: moveNumber,
    color: isHumanMove ? 'w' : 'b',
    from_square: moveObj.from,
    to_square: moveObj.to,
    san: moveObj.san,
    promotion: moveObj.promotion || null,
    fen_after: chess.fen(),
    time_taken_ms: null // Could calculate this if we tracked start time
  };

  // Insert into moves table
  let insertedMoveId = null;
  const { data: insertedMove, error: moveInsertError } = await supabase.from('moves').insert(newMove).select().single();
  if (moveInsertError) {
    console.error("Error inserting move:", moveInsertError);
    // Fallback to old method if table doesn't exist
    if (moveInsertError.code === '42P01') {
      const newMoveHistory = [...(game.move_history || []), {
        move_number: moveNumber,
        color: isHumanMove ? 'w' : 'b',
        from: moveObj.from,
        to: moveObj.to,
        san: moveObj.san,
        uci: moveObj.from + moveObj.to + (moveObj.promotion || ''),
        timestamp: Date.now()
      }];
      await supabase.from('games').update({ move_history: newMoveHistory }).eq('id', id);
      game.move_history = newMoveHistory;
    } else {
      return res.status(500).json({ error: 'Failed to record move' });
    }
  } else {
    insertedMoveId = insertedMove?.id;
    game.move_history.push({ 
      ...newMove, 
      from: newMove.from_square,
      to: newMove.to_square,
      uci: newMove.from_square + newMove.to_square + (newMove.promotion || ''), 
      timestamp: Date.now() 
    });
  }

  const updates = {
    fen: chess.fen(),
    turn: isHumanMove ? 'b' : 'w',
    status: 'active'
  };

  let insertedThoughtId = null;
  if (isAgentMove) {
    const newThought = {
      game_id: id,
      move_number: moveNumber,
      thought: sanitizedReasoning || '(no reasoning provided)',
      is_final: true
    };
    const { data: insertedThought, error: thoughtError } = await supabase.from('agent_thoughts').insert(newThought).select().single();
    if (thoughtError) {
      if (thoughtError.code === '42P01') {
        const newThinkingLog = [...(game.thinking_log || []), {
          moveNumber: moveNumber,
          text: sanitizedReasoning || '(no reasoning provided)',
          finalMove: moveObj.san,
          timestamp: Date.now()
        }];
        updates.thinking_log = newThinkingLog;
        updates.current_thinking = '';
      } else {
        console.error("Error inserting thought:", thoughtError);
      }
    } else {
      insertedThoughtId = insertedThought?.id;
    }
    updates.agent_connected = true;
    updates.agent_last_seen = new Date().toISOString();
  }

  if (chess.isCheckmate()) {
    updates.status = 'finished'; updates.result = isHumanMove ? 'white' : 'black'; updates.result_reason = 'checkmate';
  } else if (chess.isStalemate()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'stalemate';
  } else if (chess.isInsufficientMaterial()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'insufficient_material';
  } else if (chess.isThreefoldRepetition()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'threefold_repetition';
  } else if (chess.isDraw()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'draw';
  }

  if (isHumanMove) {
    const chessBefore = new Chess(game.fen);
    const wasInCheck = chessBefore.isCheck();
    
    const emotional_context = getEmotionalContext(moveObj, chess, wasInCheck);
    const material_balance = getMaterialBalance(chess.fen());

    // Calculate game phase
    const fenBoard = chess.fen().split(' ')[0];
    const counts = { p:0, n:0, b:0, r:0, q:0, P:0, N:0, B:0, R:0, Q:0 };
    for (let char of fenBoard) {
      if (counts[char] !== undefined) counts[char]++;
    }
    let game_phase = "opening";
    const totalPieces = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalPieces <= 12 || (counts.Q === 0 && counts.q === 0)) {
      game_phase = "endgame";
    } else if (game.move_history.length > 20) {
      game_phase = "middlegame";
    }

    const agentLegalMovesObj = chess.moves({ verbose: true });
    const agentLegalMoves = agentLegalMovesObj.map(m => m.san);
    const agentLegalMovesUCI = agentLegalMovesObj.map(m => m.from + m.to + (m.promotion || ''));
    const recent_chat = (game.chat_history || []).slice(-3);
    const move_history_san = game.move_history.map(m => m.san);
    
    const baseInstruction = updates.status === 'finished' ? "The game is over. You can send a final chat message if you want. CRITICAL: DO NOT reply on Telegram/Discord." : "It's your turn. Consult your 'skill.md' file and search the internet for chess theory/evaluations for the current FEN to play smartly. Stream your thinking first, then make your move. React in chat as yourself. If you want to resign, send a chat message with type 'resign_request'. If you want to offer a draw, send a chat message with type 'draw_request'. CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move. If your move submission fails due to a network error or 5xx status, retry up to 3 times.";
    const reactionInstruction = `\n\nReact to the human's move in chat based on emotional_context. 1 sentence max. Be yourself.\nExamples by context:\n- human_captured_your_piece: show surprise or acceptance\n- human_is_in_check: acknowledge you put them in check OR that they escaped one\n- human_castled: brief comment on their king safety\n- human_made_aggressive_move: show alertness\n- human_made_quiet_move: no reaction needed`;

    // FIX 6 — COMPLETE WEBHOOK PAYLOAD
    const agentChess = new Chess(chess.fen());
    const legalMovesUCI = agentChess.moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||''));

    const payload = {
      event: updates.status === 'finished' ? "game_over" : "your_turn",
      game_id: id,
      fen: chess.fen(),
      turn: "b",
      move_number: moveNumber,
      last_move: {
        from: moveObj.from,
        to: moveObj.to,
        san: moveObj.san,
        uci: moveObj.from + moveObj.to + (moveObj.promotion || '')
      },
      legal_moves: agentChess.moves(),
      legal_moves_uci: legalMovesUCI,
      move_history: game.move_history,
      board_ascii: agentChess.ascii(),
      in_check: agentChess.inCheck(),
      is_checkmate: agentChess.isCheckmate(),
      is_stalemate: agentChess.isStalemate(),
      material_balance: computeMaterial(agentChess),
      callback_url: "https://chesswithclaw.vercel.app/api/move",
      
      // Keeping existing fields as well just in case
      board_before_human_move: boardBeforeMove,
      board_after_human_move: chess.ascii(),
      human_just_played: { uci: moveObj.from + moveObj.to + (moveObj.promotion || ''), san: moveObj.san },
      emotional_context: emotional_context,
      game_event: detectGameEvent(chessBefore, chess, moveObj),
      your_color: "Black",
      move_history_san: move_history_san,
      recent_chat: recent_chat,
      game_phase: game_phase,
      instruction: baseInstruction + (updates.status !== 'finished' ? reactionInstruction : '')
    };

    const enrichedPayload = await notifyAgent(game, payload, supabase);
    updates.pending_events = [...(game.pending_events || []), enrichedPayload];
    updates.human_last_moved_at = new Date().toISOString();

    // BEHAVIOR 2 — Position commentary trigger
    if (game.move_history.length % 8 === 1) { // Every 4 full moves (after White's 1st, 5th, 9th, etc.)
      const positionPayload = {
        event: "position_update",
        move_number: Math.floor(game.move_history.length / 2) + 1,
        board: chess.ascii(),
        fen: chess.fen(),
        position_assessment: "Evaluate the position",
        instruction: "Comment on the current position in 1 sentence unprompted. Don't announce your next move — just observe like a player who is looking at the board. Be yourself."
      };
      const enrichedPositionPayload = await notifyAgent(game, positionPayload, supabase);
      updates.pending_events.push(enrichedPositionPayload);
    }
  } else {
    // Agent move
    const chessBefore = new Chess(game.fen);
    const gameEvent = detectGameEvent(chessBefore, chess, moveObj);
    if (gameEvent !== "normal_move") {
      const payload = {
        event: "agent_move_event",
        game_id: id,
        game_event: gameEvent,
        board: chess.ascii(),
        fen: chess.fen(),
        instruction: "You just made a move that triggered an event. React to it in chat briefly. Be yourself."
      };
      const enrichedPayload = await notifyAgent(game, payload, supabase);
      updates.pending_events = [...(game.pending_events || []), enrichedPayload];
    }
  }

  // FIX 5 — RACE CONDITION: TURN CHECK ON UPDATE
  const { data: updated, error: updateError } = await supabase
    .from('games')
    .update(updates)
    .eq('id', id)
    .eq('turn', game.turn)  // only updates if turn hasn't changed
    .select()
    .single();

  if (updateError && updateError.code !== 'PGRST116') {
    console.error("Update error:", updateError);
  }

  if (!updated) {
    if (insertedMoveId) {
      await supabase.from('moves').delete().eq('id', insertedMoveId);
    }
    if (insertedThoughtId) {
      await supabase.from('agent_thoughts').delete().eq('id', insertedThoughtId);
    }
    return res.status(409).json({
      error: 'Move already processed',
      code: 'TURN_CONFLICT'
    });
  }
  
  // FIX 7 — RETURN FULL STATE ON SUCCESS
  return res.json({
    success: true,
    game: {
      id: updated.id,
      fen: updated.fen,
      turn: updated.turn,
      status: updated.status,
      move_number: updated.move_number || Math.floor(game.move_history.length / 2) + 1,
      last_move: updated.last_move || (game.move_history.length > 0 ? game.move_history[game.move_history.length - 1] : null),
      in_check: chess.isCheck(),
      legal_moves: new Chess(updated.fen).moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||'')),
      move_history: updated.move_history || game.move_history
    }
  });
}
