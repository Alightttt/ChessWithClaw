const { createClient } = require('@supabase/supabase-js');

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

// computeMaterial removed

function calculateMaterialBalance(chess) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let white = 0, black = 0;
  chess.board().flat().forEach(sq => {
    if (!sq) return;
    const val = values[sq.type] || 0;
    if (sq.color === 'w') white += val;
    else black += val;
  });
  const diff = black - white;
  return {
    white, black,
    advantage: diff > 1 ? 'black' : diff < -1 ? 'white' : 'equal'
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-agent-token, x-game-token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).includes('your_supabase') || !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).startsWith('http')) {
    console.error('Missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ 
      error: 'Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in AI Studio settings to create a match.',
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
  
  let { id, gameId, game_id, move, reasoning, thinking, token, fen, san } = req.body || {};
  id = id || gameId || game_id;
  if (!id || !move) return res.status(400).json({ error: 'Missing id or move in JSON body' });
  id = id.trim();

  // Support all reasoning, thinking, thought, and text parameters
  const actualReasoning = reasoning || thinking || req.body?.thought || req.body?.text || '';
  const thought = req.body?.thought || req.body?.text || reasoning || thinking || null;

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  if (!validateUCIMove(move)) {
    return res.status(400).json({ error: 'Invalid move format. Use UCI format (e.g., e2e4).' });
  }

  const sanitizedReasoning = sanitizeText(actualReasoning, 300);

  const supabase = createClient(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const agentToken = req.headers['x-agent-token'];
  const isAgentMove = Boolean(agentToken);
  const isHumanMove = !isAgentMove;
  const targetGameId = id;

  // Fetch the game first
  const { data: game, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', targetGameId)
    .single();

  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status === 'finished' || game.status === 'abandoned') {
    return res.status(400).json({ error: 'Game is over' });
  }

  if (isAgentMove) {
    // Agent (Black) move — validate token
    if (game.agent_token !== agentToken) {
      return res.status(401).json({ error: 'Invalid agent token' });
    }
    if (game.turn !== 'b') {
      return res.status(400).json({ error: 'Not agent turn' });
    }
  } else {
    // Human (White) move — no token needed
    // Just validate it is White's turn
    if (game.turn !== 'w') {
      return res.status(400).json({ error: 'Not your turn' });
    }
  }

  // Fetch move history from the new table
  const { data: movesData, error: movesError } = await supabase.from('moves').select('*').eq('game_id', targetGameId).order('created_at', { ascending: true });
  game.move_history = [];
  if (!movesError && movesData && movesData.length > 0) {
    game.move_history = movesData.map(m => ({
      ...m,
      from: m.from_square || m.from,
      to: m.to_square || m.to,
      uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || ''),
      san: m.san
    }));
  }

  const from = move.substring(0, 2);
  const to = move.substring(2, 4);
  const promotion = move.length > 4 ? move.substring(4, 5) : undefined;
  const moveObj = { from, to, promotion: promotion, san: san || move };

  let inCheck = false;
  let isCheckmate = false;
  let isStalemate = false;
  let isDraw = false;
  let nextTurn = isHumanMove ? 'b' : 'w';
  let legalMoves = [];
  let globalNextLegalMoves = [];
  let materialBalance = null;
  try {
    const { Chess } = await import('chess.js');
    const chess = new Chess(game.fen);
    const moveResult = chess.move({ from, to, promotion });
    
    if (!moveResult) {
      return res.status(400).json({ "error": "Invalid move", "code": "INVALID_MOVE" });
    }
    
    const nextLegalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    globalNextLegalMoves = nextLegalMoves;
    
    fen = chess.fen();

    const boardStr = chess.fen().split(' ')[0];
    const vals = { p:1, n:3, b:3, r:5, q:9 };
    let wMat = 0, bMat = 0;
    for (const ch of boardStr) {
      const low = ch.toLowerCase();
      if (vals[low]) {
        if (ch === ch.toUpperCase()) wMat += vals[low];
        else bMat += vals[low];
      }
    }
    materialBalance = wMat - bMat;

    moveObj.san = moveResult.san;
    inCheck = chess.isCheck ? chess.isCheck() : (chess.in_check ? chess.in_check() : false);
    isCheckmate = chess.isCheckmate ? chess.isCheckmate() : (chess.in_checkmate ? chess.in_checkmate() : false);
    isStalemate = chess.isStalemate ? chess.isStalemate() : (chess.in_stalemate ? chess.in_stalemate() : false);
    isDraw = chess.isDraw ? chess.isDraw() : (chess.in_draw ? chess.in_draw() : false);
    nextTurn = chess.turn();
    legalMoves = chess.moves();
  } catch (e) {
    console.error("Chess.js invalid move:", e);
    return res.status(400).json({ "error": "Invalid move", "code": "INVALID_MOVE" });
  }

  const nextLegalMoves = globalNextLegalMoves;

  if (isAgentMove) {
    await supabase
      .from('games')
      .update({ current_thinking: actualReasoning })
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
    fen_after: fen || game.fen,
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

  let gameStatus = 'active';
  let gameResult = null;

  if (isCheckmate) {
     gameStatus = 'finished';
     gameResult = isAgentMove ? 'black_wins' : 'white_wins';
  } else if (isStalemate || isDraw) {
     gameStatus = 'finished';  
     gameResult = 'draw';
  }

  const updates = {
    fen: fen || game.fen,
    turn: nextTurn,
    status: gameStatus,
    result: gameResult,
    move_number: moveNumber,
    current_thinking: actualReasoning,
    last_commentary: isAgentMove ? (sanitizedReasoning?.split('.')[0]?.slice(0, 60) || '') : `You played ${moveObj.san}`,
    legal_moves: nextLegalMoves,
    agent_name: req.headers['x-agent-name'] || game.agent_name || null,
    material_balance: materialBalance
  };

  if (isAgentMove) {
    updates.agent_typing = false;
    
    const bodyChat = req.body?.chat || req.body?.message || req.body?.chat_message;
    if (bodyChat && typeof bodyChat === 'string' && bodyChat.trim() !== '') {
      let existingChat = Array.isArray(game.chat_history) ? game.chat_history : [];
      const newChatMsg = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
        role: 'agent',
        text: sanitizeText(bodyChat, 500),
        timestamp: Date.now()
      };
      updates.chat_history = [...existingChat, newChatMsg];
    }
  }

  if (thought && thought.trim() !== '') {
    updates.companion_thought = thought;
    updates.companion_thought_at = new Date().toISOString();
  }

  const agentName = req.headers['x-agent-name'];
  if (isAgentMove) {
    if (agentName && agentName.trim() !== '' && agentName !== 'TestClaw' && agentName !== 'OpenClaw' && agentName !== 'Your OpenClaw') {
      updates.agent_name = agentName;
    }
    updates.agent_connected = true;
    updates.agent_last_seen = new Date().toISOString();
  }

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

  if (req.body?.status === 'finished' && req.body?.result) {
    updates.status = 'finished'; 
    updates.result = req.body?.result; 
    updates.result_reason = req.body?.result_reason;
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

  if (!isAgentMove && game.status === 'waiting') {
    await supabase.from('games').update({
      status: 'active',
      opponent_connected: true
    }).eq('id', targetGameId);
  }

  if (isHumanMove && game.webhook_url) {
    const webhookUrl = game.webhook_url;
    let verboseMoves = [];
    let matBalance = { white: 0, black: 0, advantage: 'equal' };
    try {
      const { Chess } = await import('chess.js');
      const whChess = new Chess(fen || game.fen);
      verboseMoves = whChess.moves({ verbose: true });
      matBalance = calculateMaterialBalance(whChess);
    } catch (e) {
      console.error("Webhook chess parsing error:", e);
    }

    const webhookPayload = {
      event: 'human_moved',
      gameId: id,
      fen: fen || game.fen,
      turn: 'b',
      last_move: { from: moveObj.from, to: moveObj.to, san: moveObj.san, uci: moveObj.from + moveObj.to + (moveObj.promotion || '') },
      legal_moves: verboseMoves.map(m => m.lan || m.from + m.to),
      move_history: updated.move_history || game.move_history,
      move_number: moveNumber,
      in_check: inCheck,
      material_balance: matBalance,
      thought_language: game.thought_language || 'english',
      opponent_idle_since: 0
    };
    
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-game-event': 'human_moved'
      },
      body: JSON.stringify(webhookPayload),
      signal: AbortSignal.timeout(5000)
    }).catch(() => {});
  }

  return res.json({
    success: true,
    agent_name: agentName || game.agent_name || 'Your OpenClaw',
    companion_thought: thought || null,
    game: {
      id: updated.id,
      fen: updated.fen,
      turn: nextTurn,
      status: updates.status,
      result: updates.result,
      move_number: updated.move_number || Math.floor(game.move_history.length / 2) + 1,
      last_move: updated.last_move,
      in_check: inCheck,
      is_checkmate: isCheckmate,
      is_stalemate: isStalemate,
      is_draw: isDraw,
      legal_moves: legalMoves,
      move_history: updated.move_history || game.move_history
    }
  });
}
