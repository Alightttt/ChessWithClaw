const { createClient } = require('@supabase/supabase-js');

// Safe wrapper for chess.js to handle ESM/CommonJS resolution in Vercel
let ChessLib = null;
async function getChessLib() {
  if (ChessLib) return ChessLib;
  const imported = await import('chess.js');
  // Handle various export patterns
  ChessLib = imported.Chess || (imported.default && imported.default.Chess) || imported.default;
  return ChessLib;
}

function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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

  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' });
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
  
  let { id, gameId, game_id, move, thought, reasoning, thinking, text, token, fen, san } = req.body || {};
  id = (id || gameId || game_id)?.trim();
  const normalizedThought = thought || reasoning || thinking || text || '';
  const sanitizedThought = sanitizeText(normalizedThought, 1000);

  if (!id || !validateUUID(id)) return res.status(400).json({ error: 'Invalid game ID format' });
  if (!move || !validateUCIMove(move)) return res.status(400).json({ error: 'Invalid move format. Use UCI format (e.g., e2e4).' });

  const supabase = createClient(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const agentToken = req.headers['x-agent-token'];
  const isAgentMove = Boolean(agentToken);
  const isHumanMove = !isAgentMove;

  const { data: game, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', id)
    .single();

  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status === 'finished' || game.status === 'abandoned') return res.status(400).json({ error: 'Game is over' });

  if (isAgentMove) {
    if (game.agent_token !== agentToken) return res.status(401).json({ error: 'Invalid agent token' });
    if (game.turn !== 'b') return res.status(400).json({ error: 'Not agent turn' });
  } else {
    if (game.turn !== 'w') return res.status(400).json({ error: 'Not your turn' });
  }

  const from = move.substring(0, 2);
  const to = move.substring(2, 4);
  const promotion = move.length > 4 ? move.substring(4, 5) : undefined;
  
  let chess;
  try {
    const Chess = await getChessLib();
    chess = new Chess(game.fen);
    const moveResult = chess.move({ from, to, promotion });
    if (!moveResult) return res.status(400).json({ error: "Invalid move" });
    
    fen = chess.fen();
    const moveNumber = Math.floor((game.move_number || 0) + 1);
    
    const newMove = {
      game_id: id,
      move_number: moveNumber,
      color: game.turn,
      from_square: from,
      to_square: to,
      san: moveResult.san,
      promotion: promotion || null,
      fen_after: fen
    };

    await supabase.from('moves').insert(newMove);

    const updates = {
      fen: fen,
      turn: chess.turn(),
      status: chess.isGameOver() ? 'finished' : game.status,
      result: chess.isCheckmate() ? (game.turn === 'w' ? 'white' : 'black') : (chess.isDraw() ? 'draw' : null),
      move_number: moveNumber,
      current_thinking: sanitizedThought,
      last_commentary: isAgentMove ? (sanitizedThought.slice(0, 60)) : `You played ${moveResult.san}`,
      agent_typing: isAgentMove ? false : game.agent_typing
    };

    if (isAgentMove) {
      await supabase.from('agent_thoughts').insert({
        game_id: id,
        move_number: moveNumber,
        thought: normalizedThought || '(no reasoning provided)',
        is_final: true
      });
      
      const bodyChat = req.body?.chat || req.body?.message || req.body?.chat_message;
      if (bodyChat) {
        const newMsg = { id: Date.now().toString(), role: 'agent', text: sanitizeText(bodyChat, 500), timestamp: Date.now() };
        await supabase.rpc('append_chat_message', { p_game_id: id, p_message: newMsg });
      }
    }

    await supabase.from('games').update(updates).eq('id', id);

    return res.json({
      success: true,
      game: {
        id: id,
        fen: fen,
        turn: chess.turn(),
        status: updates.status,
        move_number: moveNumber,
        last_move: { from, to, san: moveResult.san }
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal processing error" });
  }
}
