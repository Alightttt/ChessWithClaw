import { createClient } from '@supabase/supabase-js';
import { Chess } from 'chess.js';
import { notifyAgent } from './notify.js';
import { sanitizeText, validateUUID, validateUCIMove } from './_utils/sanitize.js';
import { checkRateLimit } from './_utils/rateLimit.js';
import { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } from './_middleware/headers.js';

const moveRateLimits = new Map();

function detectGameEvent(chessBefore, chessAfter, moveObj) {
  if (chessAfter.isCheckmate()) return "checkmate";
  if (chessAfter.isStalemate()) return "stalemate";
  if (chessAfter.isCheck()) {
    if (moveObj.color === 'w') return "agent_in_check";
    return "check_delivered";
  }
  if (moveObj.captured) return "piece_captured";
  if (moveObj.san.includes('O-O')) return "castled";
  if (moveObj.promotion) return "promotion";
  return "normal_move";
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
  
  const { id, move, reasoning } = req.body || {};
  if (!id || !move) return res.status(400).json({ error: 'Missing id or move in JSON body' });

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

  // Ensure the URL starts with https://
  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: game, error } = await supabase.from('games').select('id, fen, turn, status, move_history, chat_history, thinking_log, current_thinking, result, result_reason, agent_connected, human_connected, webhook_url, agent_capabilities, pending_events, move_count, created_at, updated_at, webhook_failed, webhook_fail_count, agent_name, agent_avatar, agent_tagline, secret_token').eq('id', id).single();

  if (error || !game) return res.status(404).json({ error: 'Game not found' });
  if (game.status !== 'active' && game.status !== 'waiting') return res.status(400).json({ error: 'Game over' });

  const isHumanMove = game.turn === 'w';
  const isAgentMove = game.turn === 'b';

  if (isHumanMove) {
    const gameToken = req.headers['x-game-token'];
    if (!gameToken || gameToken !== game.secret_token) {
      return res.status(403).json({ error: 'Not authorized' });
    }
  }

  const chess = new Chess(game.fen);
  const boardBeforeMove = chess.ascii();
  let moveObj = null;
  
  try {
    moveObj = chess.move(move);
  } catch (e) {
    try {
      const from = move.substring(0, 2);
      const to = move.substring(2, 4);
      const promotion = move.length > 4 ? move.substring(4, 5) : 'q';
      moveObj = chess.move({ from, to, promotion });
    } catch (err) {
      moveObj = null;
    }
  }

  if (!moveObj) {
    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    return res.status(400).json({ error: `Invalid move: ${move}`, legal_moves: legalMoves });
  }

  const newMoveHistory = [...(game.move_history || []), {
    number: Math.floor((game.move_history || []).length / 2) + 1,
    color: isHumanMove ? 'w' : 'b',
    from: moveObj.from,
    to: moveObj.to,
    san: moveObj.san,
    uci: moveObj.from + moveObj.to + (moveObj.promotion || ''),
    timestamp: Date.now()
  }];

  const updates = {
    fen: chess.fen(),
    turn: isHumanMove ? 'b' : 'w',
    move_history: newMoveHistory,
    status: 'active'
  };

  if (isAgentMove) {
    const newThinkingLog = [...(game.thinking_log || []), {
      moveNumber: Math.floor((game.move_history || []).length / 2) + 1,
      text: sanitizedReasoning || '(no reasoning provided)',
      finalMove: moveObj.san,
      timestamp: Date.now()
    }];
    updates.thinking_log = newThinkingLog;
    updates.current_thinking = '';
    updates.agent_connected = true;
  }

  if (chess.isCheckmate()) {
    updates.status = 'finished'; updates.result = isHumanMove ? 'white' : 'black'; updates.result_reason = 'checkmate';
  } else if (chess.isStalemate()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'stalemate';
  } else if (chess.isDraw()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'draw';
  }

  if (isHumanMove) {
    const chessBefore = new Chess(game.fen);
    const wasInCheck = chessBefore.isCheck();
    
    let emotional_context = "normal_move";
    if (moveObj.captured) {
      emotional_context = "human_captured_your_piece";
    } else if (chess.isCheck() || wasInCheck) {
      emotional_context = "human_is_in_check";
    } else if (moveObj.san.includes('O-O')) {
      emotional_context = "human_castled";
    } else if (moveObj.san.includes('+') || moveObj.san.includes('#') || (moveObj.piece !== 'p' && parseInt(moveObj.to[1]) >= 5)) {
      emotional_context = "human_made_aggressive_move";
    } else {
      emotional_context = "human_made_quiet_move";
    }

    const fenBoard = chess.fen().split(' ')[0];
    const counts = { p:0, n:0, b:0, r:0, q:0, P:0, N:0, B:0, R:0, Q:0 };
    for (let char of fenBoard) {
      if (counts[char] !== undefined) counts[char]++;
    }
    const material_balance = {
      white: { P: counts.P, N: counts.N, B: counts.B, R: counts.R, Q: counts.Q },
      black: { p: counts.p, n: counts.n, b: counts.b, r: counts.r, q: counts.q }
    };

    const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    const recent_chat = (game.chat_history || []).slice(-3);
    const move_history_san = newMoveHistory.map(m => m.san);
    
    const baseInstruction = updates.status === 'finished' ? "The game is over. You can send a final chat message if you want. CRITICAL: DO NOT reply on Telegram/Discord." : "It's your turn. Consult your 'skill.md' file and search the internet for chess theory/evaluations for the current FEN to play smartly. Stream your thinking first, then make your move. React in chat as yourself. If you want to resign, send a chat message with type 'resign_request'. If you want to offer a draw, send a chat message with type 'draw_request'. CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move.";
    const reactionInstruction = `\n\nReact to the human's move in chat based on emotional_context. 1 sentence max. Be yourself.\nExamples by context:\n- human_captured_your_piece: show surprise or acceptance\n- human_is_in_check: acknowledge you put them in check OR that they escaped one\n- human_castled: brief comment on their king safety\n- human_made_aggressive_move: show alertness\n- human_made_quiet_move: no reaction needed`;

    const payload = {
      event: updates.status === 'finished' ? "game_over" : "your_turn",
      game_id: id,
      move_number: Math.floor(newMoveHistory.length / 2) + 1,
      board_before_human_move: boardBeforeMove,
      board_after_human_move: chess.ascii(),
      human_just_played: { uci: moveObj.from + moveObj.to + (moveObj.promotion || ''), san: moveObj.san },
      emotional_context: emotional_context,
      game_event: detectGameEvent(chessBefore, chess, moveObj),
      your_color: "Black",
      fen: chess.fen(),
      legal_moves: legalMoves,
      move_history_san: move_history_san,
      is_in_check: chess.isCheck(),
      recent_chat: recent_chat,
      material_balance: material_balance,
      instruction: baseInstruction + (updates.status !== 'finished' ? reactionInstruction : '')
    };

    const enrichedPayload = await notifyAgent(game, payload, supabase);
    updates.pending_events = [...(game.pending_events || []), enrichedPayload];
    updates.human_last_moved_at = new Date().toISOString();

    // BEHAVIOR 2 — Position commentary trigger
    if (newMoveHistory.length % 8 === 0) { // Every 4 full moves (8 half-moves)
      const positionPayload = {
        event: "position_update",
        move_number: Math.floor(newMoveHistory.length / 2) + 1,
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

  await supabase.from('games').update(updates).eq('id', id);
  
  // Reconstruct PGN for response
  const responseChess = new Chess();
  newMoveHistory.forEach(m => {
    try { responseChess.move(m.san); } catch (e) {}
  });

  res.status(200).json({ 
    success: true, 
    fen: chess.fen(), 
    ascii_board: chess.ascii(),
    pgn: responseChess.pgn(),
    status: updates.status,
    result: updates.result || null,
    result_reason: updates.result_reason || null,
    message: updates.status === 'finished' ? 'Game over.' : 'Move accepted. Waiting for White to play.' 
  });
}
