const { createClient } = require('@supabase/supabase-js');
const { Chess } = require('chess.js');

function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+=/gi, '')
}

function validateUUID(id) {
  if (typeof id !== 'string') return false;
  const trimmedId = id.trim();
  const uuidRegex = 
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(trimmedId)
}

function validateUCIMove(move) {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)
}

const rateLimits = new Map();

function checkRateLimit(ip, endpoint, limit, windowMs = 60000) {
  const now = Date.now();
  const key = `${ip}:${endpoint}`;
  
  if (!rateLimits.has(key)) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
  }
  
  const record = rateLimits.get(key);
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return { allowed: true, remaining: limit - 1, resetTime: record.resetTime };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }
  
  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetTime: record.resetTime };
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function applyCacheControl(res) {
  res.setHeader('Cache-Control', 'no-store');
}

function applyRateLimitHeaders(res, limit, remaining, resetTime) {
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.floor(resetTime / 1000));
}

function applyCorsHeaders(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-game-token, x-agent-token');
}

function computeMaterial(chess) {
  const vals = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let w = 0, b = 0;
  chess.board().forEach(row => row && row.forEach(sq => {
    if (!sq) return;
    const v = vals[sq.type] || 0;
    if (sq.color === 'w') w += v; else b += v;
  }));
  const diff = w - b;
  return { white: w, black: b, advantage: diff > 0 ? 'white' : diff < 0 ? 'black' : 'equal', difference: Math.abs(diff) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ 
      error: 'Server configuration error',
      code: 'MISSING_ENV_VARS'
    });
  }

  applySecurityHeaders(res);
  applyCacheControl(res);
  applyCorsHeaders(req, res);

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
  
  let { id, move, reasoning, thinking, token } = req.body || {};
  if (!id || !move) return res.status(400).json({ error: 'Missing id or move in JSON body' });
  id = id.trim();

  // Support both reasoning and thinking fields
  const actualReasoning = reasoning || thinking || '';

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  if (!validateUCIMove(move)) {
    return res.status(400).json({ error: 'Invalid move format. Use UCI format (e.g., e2e4).' });
  }

  const sanitizedReasoning = sanitizeText(actualReasoning, 300);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data: game, error } = await supabase.from('games').select('*').eq('id', id).single();

  if (error || !game) {
    return res.status(404).json({ error: 'Game not found', code: 'GAME_NOT_FOUND' });
  }
  
  // Fetch move history from the new table
  const { data: movesData, error: movesError } = await supabase.from('moves').select('*').eq('game_id', id).order('created_at', { ascending: true });
  if (!movesError && movesData && movesData.length > 0) {
    game.move_history = movesData.map(m => ({
      ...m,
      from: m.from_square || m.from,
      to: m.to_square || m.to,
      uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || ''),
      san: m.san
    }));
  }

  const playerColor = game.player_color || 'w';
  const isHumanMove = game.turn === playerColor;
  const isAgentMove = game.turn !== playerColor;

  if (isAgentMove) {
    const agentToken = req.headers['x-agent-token'] || token || '';
    if (!agentToken || agentToken !== game.agent_token) {
      return res.status(401).json({ 
        error: 'Invalid agent token',
        code: 'INVALID_AGENT_TOKEN'
      });
    }

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

  if (game.status === 'finished') {
    return res.status(400).json({
      error: 'Game is finished',
      code: 'GAME_FINISHED'
    });
  }

  if (game.status !== 'active' && game.status !== 'waiting') {
    return res.status(400).json({ error: 'Game over' });
  }

  let chess
  try { chess = new Chess(game.fen) }
  catch(e) {
    return res.status(500).json({ error: 'Invalid FEN' })
  }

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

  if (isAgentMove) {
    await supabase
      .from('games')
      .update({ current_thinking: req.body?.reasoning || req.body?.thinking || '' })
      .eq('id', id);
  }

  const moveNumber = Math.floor((game.move_history || []).length / 2) + 1;
  const newMove = {
    game_id: id,
    move_number: moveNumber,
    color: game.turn,
    from_square: moveObj.from,
    to_square: moveObj.to,
    san: moveObj.san,
    promotion: moveObj.promotion || null,
    fen_after: chess.fen(),
    time_taken_ms: null
  };

  let insertedMoveId = null;
  const { data: insertedMove, error: moveInsertError } = await supabase.from('moves').insert(newMove).select().single();
  if (moveInsertError) {
    console.error("Error inserting move:", moveInsertError);
    if (moveInsertError.code === '42P01') {
      const newMoveHistory = [...(game.move_history || []), {
        move_number: moveNumber,
        color: game.turn,
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
    status: 'active',
    move_number: moveNumber,
    current_thinking: req.body?.reasoning || req.body?.thinking || '',
    last_commentary: isAgentMove ? (sanitizedReasoning?.split('.')[0]?.slice(0, 60) || '') : `You played ${moveObj.san}`
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
      console.error("Error inserting thought:", thoughtError);
    } else {
      insertedThoughtId = insertedThought?.id;
    }
  }

  if (chess.isCheckmate()) {
    const humanResult = playerColor === 'w' ? 'white' : 'black';
    const agentResult = playerColor === 'w' ? 'black' : 'white';
    updates.status = 'finished'; updates.result = isHumanMove ? humanResult : agentResult; updates.result_reason = 'checkmate';
  } else if (chess.isStalemate()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'stalemate';
  } else if (chess.isInsufficientMaterial()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'insufficient_material';
  } else if (chess.isThreefoldRepetition()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'threefold_repetition';
  } else if (chess.isDraw()) {
    updates.status = 'finished'; updates.result = 'draw'; updates.result_reason = 'draw';
  }

  const { data: updated, error: updateError } = await supabase
    .from('games')
    .update(updates)
    .eq('id', id)
    .eq('turn', game.turn)
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

  if (isHumanMove && game.webhook_url) {
    let agentChess
    try { agentChess = new Chess(chess.fen()) }
    catch(e) {
      return res.status(500).json({ error: 'Invalid FEN' })
    }
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
      callback_url: `https://${req.headers.host}/api/move`
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      await fetch(game.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
    } catch (e) {
      console.error(`Webhook error for game ${id}:`, e.message);
    }
  }

  let updatedChess
  try { updatedChess = new Chess(updated.fen) }
  catch(e) {
    return res.status(500).json({ error: 'Invalid FEN' })
  }

  return res.json({
    success: true,
    game: {
      id: updated.id,
      fen: updated.fen,
      turn: updated.turn,
      status: updated.status,
      move_number: updated.move_number || Math.floor(game.move_history.length / 2) + 1,
      last_move: updated.last_move,
      in_check: chess.inCheck(),
      legal_moves: updatedChess.moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||'')),
      move_history: updated.move_history || game.move_history
    }
  });
}
