import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { notifyAgent } from './notify.js';
import { sanitizeText, validateUUID, validateUCIMove } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';
import { detectGameEvent, getMaterialBalance, getEmotionalContext } from './_utils/gameLogic.js';

const moveRateLimits = new Map();

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
  
  let { id, move, reasoning } = req.body || {};
  if (!id || !move) return res.status(400).json({ error: 'Missing id or move in JSON body' });
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  if (!validateUCIMove(move)) {
    return res.status(400).json({ error: 'Invalid move format. Use UCI format (e.g., e2e4).' });
  }

  const sanitizedReasoning = sanitizeText(reasoning, 300);

  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined') {
    return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
  }

  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        'x-game-token': req.headers['x-game-token'] || '',
        'x-agent-token': req.headers['x-agent-token'] || ''
      }
    }
  });
  const { data: game, error } = await supabase.from('games').select('id, fen, turn, status, result, result_reason, agent_connected, human_connected, webhook_url, agent_capabilities, pending_events, move_count, created_at, updated_at, webhook_failed, webhook_fail_count, agent_name, agent_avatar, agent_tagline, secret_token, agent_token').eq('id', id).single();

  if (error || !game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'active' && game.status !== 'waiting') return res.status(400).json({ error: 'Game over' });

  // Fetch move history from the new table
  const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', id).order('move_number', { ascending: true });
  game.move_history = movesData || [];

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
    const gameToken = req.headers['x-game-token'];
    if (!gameToken || gameToken !== game.secret_token) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid or missing x-game-token for White (human) move.',
      });
    }
  } else if (isAgentMove) {
    const agentToken = req.headers['x-agent-token'];
    if (!agentToken || agentToken !== game.agent_token) {
      return res.status(403).json({ 
        error: 'Forbidden: Invalid or missing x-agent-token for Black (agent) move.',
      });
    }

    // FIX 1 — agent_connected NEVER SETS FOR API AGENTS
    if (!game.agent_connected) {
      await supabase
        .from('games')
        .update({ 
          agent_connected: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('agent_connected', false);
    }
  }

  // FIX 3 — PROTECT AGAINST FEN CORRUPTION
  let chess;
  try {
    chess = new Chess();
    if (game.move_history && game.move_history.length > 0) {
      game.move_history.forEach(m => {
        try { chess.move(m.san); } catch (e) {}
      });
    } else if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      chess.load(game.fen);
    }
  } catch (e) {
    return res.status(500).json({ error: 'Game state corrupted. Contact support.', code: 'CORRUPT_FEN' });
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
  const { error: moveInsertError } = await supabase.from('moves').insert(newMove);
  if (moveInsertError) {
    console.error("Error inserting move:", moveInsertError);
    // Fallback to old method if table doesn't exist
    if (moveInsertError.code === '42P01') {
      const newMoveHistory = [...(game.move_history || []), {
        number: moveNumber,
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
    game.move_history.push({ ...newMove, uci: newMove.from_square + newMove.to_square + (newMove.promotion || ''), timestamp: Date.now() });
  }

  const updates = {
    fen: chess.fen(),
    turn: isHumanMove ? 'b' : 'w',
    status: 'active'
  };

  if (isAgentMove) {
    const newThought = {
      game_id: id,
      move_number: moveNumber,
      thought: sanitizedReasoning || '(no reasoning provided)',
      is_final: true
    };
    const { error: thoughtError } = await supabase.from('agent_thoughts').insert(newThought);
    if (thoughtError && thoughtError.code === '42P01') {
      const newThinkingLog = [...(game.thinking_log || []), {
        moveNumber: moveNumber,
        text: sanitizedReasoning || '(no reasoning provided)',
        finalMove: moveObj.san,
        timestamp: Date.now()
      }];
      updates.thinking_log = newThinkingLog;
      updates.current_thinking = '';
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
    const chessBefore = new Chess();
    if (game.move_history && game.move_history.length > 0) {
      game.move_history.forEach(m => {
        try { chessBefore.move(m.san); } catch (e) {}
      });
    } else if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      chessBefore.load(game.fen);
    }
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

    // FIX 4 — WEBHOOK FIRE WITH COMPLETE PAYLOAD
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
      legal_moves: agentLegalMoves,
      legal_moves_uci: agentLegalMovesUCI,
      move_history: game.move_history,
      board_ascii: chess.ascii(),
      in_check: chess.isCheck(),
      is_checkmate: chess.isCheckmate(),
      is_stalemate: chess.isStalemate(),
      material_balance: computeMaterialBalance(chess),
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

    const webhookUrl = game.webhook_url || game.agent_webhook;
    if (webhookUrl && !game.webhook_failed) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enrichedPayload),
          signal: controller.signal
        });
      } catch (e) {
        console.error('Webhook delivery failed:', e.message);
        // Do NOT throw — webhook failure should not break the game
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // BEHAVIOR 2 — Position commentary trigger
    if (game.move_history.length % 8 === 0) { // Every 4 full moves (8 half-moves)
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
    const chessBefore = new Chess();
    if (game.move_history && game.move_history.length > 0) {
      game.move_history.forEach(m => {
        try { chessBefore.move(m.san); } catch (e) {}
      });
    } else if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      chessBefore.load(game.fen);
    }
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

  const { data: updatedGame, error: updateError } = await supabase
    .from('games')
    .update(updates)
    .eq('id', id)
    .eq('turn', game.turn)
    .select()
    .single();

  if (updateError || !updatedGame) {
    return res.status(409).json({ error: 'Move conflict. The game state has changed. Please fetch the latest state and try again.' });
  }
  
  // Reconstruct PGN for response
  const responseChess = new Chess();
  game.move_history.forEach(m => {
    try { responseChess.move(m.san); } catch (e) {}
  });

  // FIX 2 — RETURN FULL GAME STATE ON SUCCESS
  const nextLegalMovesObj = chess.moves({ verbose: true });
  const nextLegalMoves = nextLegalMovesObj.map(m => m.from + m.to + (m.promotion || ''));

  res.status(200).json({ 
    success: true, 
    game: {
      id: updatedGame.id,
      fen: updatedGame.fen,
      turn: updatedGame.turn,
      status: updatedGame.status,
      move_number: updatedGame.move_number || Math.floor(game.move_history.length / 2) + 1,
      last_move: updatedGame.last_move || (game.move_history.length > 0 ? game.move_history[game.move_history.length - 1] : null),
      in_check: chess.isCheck(),
      legal_moves: nextLegalMoves,
      move_history: game.move_history
    },
    // Keep existing fields for backward compatibility
    fen: chess.fen(), 
    ascii_board: chess.ascii(),
    pgn: responseChess.pgn(),
    status: updates.status,
    result: updates.result || null,
    result_reason: updates.result_reason || null,
    message: updates.status === 'finished' ? 'Game over.' : 'Move accepted. Waiting for White to play.' 
  });
}
