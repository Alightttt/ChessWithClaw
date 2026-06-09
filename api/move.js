const { createClient } = require('@supabase/supabase-js');

let ChessLib = null;
async function getChessLib() {
  if (ChessLib) return ChessLib;
  const imported = await import('chess.js');
  ChessLib = imported.Chess || (imported.default && imported.default.Chess) || imported.default;
  return ChessLib;
}

function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function validateUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id?.trim());
}

function validateUCIMove(move) {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move);
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

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let { id, gameId, game_id, move, thought, reasoning, thinking, text, token, fen, san } = req.body || {};
  id = (id || gameId || game_id)?.trim();
  const normalizedThought = thought || reasoning || thinking || text || '';
  const sanitizedThought = sanitizeText(normalizedThought, 1000);

  if (!id || !validateUUID(id)) return res.status(400).json({ error: 'Invalid game ID' });
  if (!move || !validateUCIMove(move)) return res.status(400).json({ error: 'Invalid move format' });

  const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const agentToken = req.headers['x-agent-token'];
  const isAgentMove = Boolean(agentToken);

  const { data: game, error } = await supabase.from('games').select('*').eq('id', id).single();
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status === 'finished') return res.status(400).json({ error: 'Game is over' });

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
    
    const moveNumber = Math.floor((game.move_number || 0) + 1);
    const newMove = {
      game_id: id,
      move_number: moveNumber, move_count: moveNumber,
      color: game.turn,
      from_square: from,
      to_square: to,
      san: moveResult.san,
      promotion: promotion || null,
      fen_after: chess.fen()
    };

    await supabase.from('moves').insert(newMove);

    // PATCH: Transition status from 'waiting' to 'active' on any move
    let nextStatus = game.status;
    if (chess.isGameOver()) {
      nextStatus = 'finished';
    } else if (game.status === 'waiting') {
      nextStatus = 'active';
    }

    const updates = {
      fen: chess.fen(),
      turn: chess.turn(),
      status: nextStatus,
      result: chess.isCheckmate() ? (game.turn === 'w' ? 'white' : 'black') : (chess.isDraw() ? 'draw' : null),
      move_number: moveNumber, move_count: moveNumber,
      current_thinking: sanitizedThought,
      last_commentary: isAgentMove ? (sanitizedThought.slice(0, 60)) : `You played ${moveResult.san}`,
      agent_typing: isAgentMove ? false : game.agent_typing
    };

    if (isAgentMove) {
      await supabase.from('agent_thoughts').insert({
        game_id: id,
        move_number: moveNumber, move_count: moveNumber,
        thought: normalizedThought || '(no reasoning provided)',
        is_final: true
      });
      
      const bodyChat = req.body?.chat || req.body?.message;
      if (bodyChat) {
        const newMsg = { id: Date.now().toString(), role: 'agent', text: sanitizeText(bodyChat, 500), timestamp: Date.now() };
        await supabase.rpc('append_chat_message', { p_game_id: id, p_message: newMsg });
      }
    }

    await supabase.from('games').update(updates).eq('id', id);

    return res.json({ success: true, game: { id, fen: chess.fen(), turn: chess.turn() } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal error" });
  }
}

function applySecurityHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); }
function applyCacheControl(res) { res.setHeader('Cache-Control', 'no-store'); }
function applyCorsHeaders(req, res) { res.setHeader('Access-Control-Allow-Origin', '*'); }
