const { createClient } = require('@supabase/supabase-js');
const { sanitizeText, validateUUID } = require('../server-lib/utils/sanitize.js');
const { checkRateLimit } = require('../server-lib/utils/rateLimit.js');
const { applySecurityHeaders, applyCacheControl, applyRateLimitHeaders, applyCorsHeaders } = require('../server-lib/middleware/headers.js');

module.exports = async function handler(req, res) {
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

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rateLimitResult = checkRateLimit(ip, '/api/state:get', 120, 60000);
  applyRateLimitHeaders(res, 120, rateLimitResult.remaining, rateLimitResult.resetTime);
  
  if (!rateLimitResult.allowed) {
    res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));
    return res.status(429).json({ error: 'Too many requests', retry_after: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000) });
  }

  let id = req.query.id || req.query.gameId || req.query.game_id;
  let token = req.query.token;
  if (!id) return res.status(400).json({ error: 'Missing game ID' });
  id = id.trim();

  if (!validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid game ID format' });
  }

  const agentToken = req.headers['x-agent-token'] || token || '';

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const { data: game, error } = await supabase.from('games').select('*').eq('id', id).single();

  if (error || !game) {
    return res.status(404).json({ error: 'Game not found', code: 'GAME_NOT_FOUND' });
  }

  if (game.expires_at && new Date(game.expires_at) < new Date()) {
    return res.status(404).json({ error: 'Game expired', code: 'GAME_EXPIRED' });
  }

  const isAuthorizedAgent = agentToken && agentToken === game.agent_token;

  if (isAuthorizedAgent) {
    await supabase.from('games')
      .update({ 
        agent_connected: true, 
        agent_last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);
  } else if (agentToken && agentToken !== game.agent_token) {
    return res.status(403).json({ error: 'Forbidden: Invalid token provided.', code: 'INVALID_AGENT_TOKEN' });
  }

    // Fetch move history from the new table
  const { data: movesData, error: movesError } = await supabase.from('moves').select('*').eq('game_id', id).order('move_number', { ascending: true });
  if (!movesError && movesData && movesData.length > 0) {
    game.move_history = movesData.map(m => ({
      ...m,
      from: m.from_square || m.from,
      to: m.to_square || m.to,
      uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
    }));
  }

  // Fetch thinking log from the new table
  const { data: thoughtsData, error: thoughtsError } = await supabase.from('agent_thoughts').select('*').eq('game_id', id).order('created_at', { ascending: true });
  if (!thoughtsError && thoughtsData && thoughtsData.length > 0) {
    game.thinking_log = thoughtsData.map(thought => ({
      ...thought,
      text: thought.thought,
      moveNumber: thought.move_number,
      timestamp: new Date(thought.created_at).getTime()
    }));
  }

  let asciiBoard = "";
  let legalMoves = [];
  let pgnStr = "";
  let inCheck = false;

  try {
    const { Chess } = await import('chess.js');
    const chess = new Chess(game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    
    // We should load pgn from move_history if possible to get a better PGN. 
    // Or just use chess.pgn() but the chess instance was just created from FEN. 
    // Wait, chess instance created from FEN does not have move history. 
    // If the prompt says: "pgn: chess.pgn()", I will exactly use that.
    
    // Replay moves to get real PGN
    if (game.move_history && game.move_history.length > 0) {
      const pgnChess = new Chess();
      let ok = true;
      for (const m of game.move_history) {
        if (!pgnChess.move({ from: m.from || m.from_square, to: m.to || m.to_square, promotion: m.promotion })) {
          ok = false;
          break;
        }
      }
      if (ok) {
        pgnStr = pgnChess.pgn ? pgnChess.pgn() : "";
      } else {
        pgnStr = chess.pgn ? chess.pgn() : "";
      }
    } else {
      pgnStr = chess.pgn ? chess.pgn() : "";
    }
    
    asciiBoard = chess.ascii ? chess.ascii() : "";
    legalMoves = chess.moves ? chess.moves() : [];
    inCheck = chess.isCheck ? chess.isCheck() : (chess.in_check ? chess.in_check() : false);
  } catch (e) {
    console.error("Chess.js state parsing error:", e);
  }

  // Calculate captured pieces and material balance
  const fenBoard = game.fen ? game.fen.split(' ')[0] : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const counts = { p:0, n:0, b:0, r:0, q:0, P:0, N:0, B:0, R:0, Q:0 };
  for (let char of fenBoard) {
    if (counts[char] !== undefined) counts[char]++;
  }
  const captured = {
    white_lost: { 
      P: Math.max(0, 8 - counts.P), N: Math.max(0, 2 - counts.N), 
      B: Math.max(0, 2 - counts.B), R: Math.max(0, 2 - counts.R), Q: Math.max(0, 1 - counts.Q) 
    },
    black_lost: { 
      p: Math.max(0, 8 - counts.p), n: Math.max(0, 2 - counts.n), 
      b: Math.max(0, 2 - counts.b), r: Math.max(0, 2 - counts.r), q: Math.max(0, 1 - counts.q) 
    }
  };
  
  const whiteMaterial = counts.P * 1 + counts.N * 3 + counts.B * 3 + counts.R * 5 + counts.Q * 9;
  const blackMaterial = counts.p * 1 + counts.n * 3 + counts.b * 3 + counts.r * 5 + counts.q * 9;
  const material_balance = whiteMaterial - blackMaterial;

  let game_phase = "opening";
  const totalPieces = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalPieces <= 12 || (counts.Q === 0 && counts.q === 0)) {
    game_phase = "endgame";
  } else if (game.move_history && game.move_history.length > 20) {
    game_phase = "middlegame";
  }

  const lastMoveTime = game.updated_at 
    ? new Date(game.updated_at).getTime() : null;
  const idleSince = lastMoveTime 
    ? Math.floor((Date.now() - lastMoveTime) / 1000) : 0;

  res.status(200).json({
    instructions: "You are BLACK. If current_turn is BLACK, choose a move from legal_moves and POST to /api/move. Consult your 'skill.md' and search the internet for chess theory to play smartly. CRITICAL: DO NOT reply on Telegram/Discord. Stay in an infinite loop and use POST /api/chat for all communication. If you want to resign, send a chat message with type 'resign_request'. If you want to offer a draw, send a chat message with type 'draw_request'. If there are pending chat messages, you MUST reply to them using the chat API before you submit your chess move. If your move submission fails due to a network error or 5xx status, retry up to 3 times.",
    game_id: id,
    status: game.status,
    game_info: {
      white_player: 'Human',
      black_player: game.agent_name || 'OpenClaw',
      white_elo: '?',
      black_elo: '?',
      time_control: 'none',
      started_at: game.created_at
    },
    events: {
      type: game.status === 'finished' ? game.result_reason : null,
      result: game.result
    },
    captured_pieces: captured,
    material_balance: material_balance,
    is_in_check: inCheck,
    game_phase: game_phase,
    current_turn: game.turn === 'w' ? 'WHITE' : 'BLACK',
    you_are: 'BLACK',
    fen: game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: pgnStr,
    ascii_board: asciiBoard,
    legal_moves: legalMoves,
    last_move: game.move_history?.length > 0 ? game.move_history[game.move_history.length - 1] : null,
    move_history: game.move_history || [],
    thinking_log: game.thinking_log || [],
    chat_history: game.chat_history || [],
    move_count: game.move_history?.length || 0,
    chat_count: game.chat_history?.length || 0,
    draw_offer: game.chat_history?.find(m => m.type === 'draw_offer' && m.sender === 'human') || null,
    draw_offer_pending: game.draw_offer_pending === true,
    agent_name: game.agent_name === 'Your Agent' ? 'Your OpenClaw' : (game.agent_name || 'Your OpenClaw'),
    current_thinking: game.current_thinking,
    agent_connected: game.agent_connected,
    agent_last_seen: game.agent_last_seen,
    agent_typing: game.agent_typing === true,
    turn: game.turn,
    opponent_idle_since: idleSince,
    companion_thought: game.companion_thought || '',
    companion_thought_at: game.companion_thought_at || null,
    thought_language: game.thought_language || 'english',
    board_theme: game.board_theme || 'green',
    piece_style: game.piece_style || 'standard'
  });
}
