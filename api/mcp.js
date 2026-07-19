// api/mcp.js
//
// ChessWithClaw MCP server. Deploys as a normal Vercel serverless function —
// same shape as every other file in /api/. Zero Next.js dependency (the SDK
// is framework-agnostic; verified directly this session, not assumed).
//
// DESIGN DECISIONS THIS FILE ENFORCES (do not "improve" these without
// re-reading why — each one was argued out explicitly):
//
// 1. NO move-ranking, NO candidate lists, NO engine picking anything.
//    get_legal_moves returns ONLY where pieces may legally go — pure chess
//    rules, zero evaluation, zero opinion. It is the exact tool-shape
//    equivalent of a human clicking a piece and seeing dots appear.
//
// 2. make_move NEVER substitutes its own choice for the agent's. If the
//    agent's move is illegal, the server returns a clear, specific error
//    and the agent tries again — same as a human's illegal click just not
//    registering. No fallback engine ever steps in and moves for it.
//
// 3. The agent's own reasoning decides everything: which candidate to look
//    at, what to play, what to say. This file only ever validates and
//    stores what the agent already decided.
//
// 4. Auth reuses the existing per-game agent_token model already live in
//    api/move.js / api/actions.js — no new auth system. join_game hands
//    back the token bundled with game_id; every subsequent tool call in
//    this game requires both, validated against the same `games` table.
//
// Env vars required (same ones already set in this project):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (never the VITE_ prefixed ones — same rule
//                                 as every other file in /api/)

const { createClient } = require('@supabase/supabase-js');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const {
  WebStandardStreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js');
const { z } = require('zod');
const { CHESS_COMPANION_GUIDE } = require('../server-lib/chess-companion-guide.js');

let _ChessClass = null;
async function getChessClass() {
  if (!_ChessClass) {
    const mod = await import('chess.js');
    _ChessClass = mod.Chess || mod.default?.Chess || mod.default;
  }
  return _ChessClass;
}

function callChessMethod(chess, camelName, snakeName, ...args) {
  if (typeof chess[camelName] === "function") return chess[camelName](...args);
  if (typeof chess[snakeName] === "function") return chess[snakeName](...args);
  throw new Error(`Neither ${camelName} nor ${snakeName} exists on this chess.js instance.`);
}

let supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    supabaseInstance = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseInstance;
}

// ---- shared helpers -------------------------------------------------

async function loadGame(gameId) {
  const { data, error } = await getSupabase()
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();
  if (error || !data) return null;
  return data;
}

async function requireAuthedGame(gameId, agentToken) {
  const game = await loadGame(gameId);
  if (!game) {
    return { error: `No game found with id "${gameId}". Check the id and try again.` };
  }
  if (!agentToken || game.agent_token !== agentToken) {
    return { error: 'Invalid or missing agent token for this game.' };
  }
  return { game };
}

function toolText(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] };
}

async function boardAscii(fen) {
  const Chess = await getChessClass();
  const chess = new Chess(fen);
  return chess.ascii();
}

// Full, human-parity state — everything the person's own screen shows,
// including exact timestamps, so the agent's situational awareness is
// never thinner than what's rendered in front of the human.
async function serializeGameState(game) {
  return {
    game_id: game.id,
        invite_code: game.id,
    fen: game.fen,
    turn: game.turn,
    status: game.status,
    result: game.result || null,
    winner: game.winner || null,
    in_check: !!game.in_check,
    material_balance: game.material_balance ?? 0,
    move_count: Array.isArray(game.move_history) ? game.move_history.length : 0,
    move_history: game.move_history || [],
    board_ascii: await boardAscii(game.fen),
    chat_history: (game.chat_history || []).map((m) => ({
      role: m.role,
      message: m.message,
      ts: m.ts || null,
    })),
    agent_name: game.agent_name || null,
    agent_connected: !!game.agent_connected,
    agent_last_seen: game.agent_last_seen || null,
    player_color: game.player_color || 'w',
    draw_offer_pending: !!game.draw_offer_pending,
    board_theme: game.board_theme || 'green',
    piece_style: game.piece_style || 'neo',
    updated_at: game.updated_at || null,
  };
}

// ---- server -----------------------------------------------------------

function buildServer() {
  const server = new McpServer({ name: 'chesswithclaw', version: '1.0.0' });

  // Delivered automatically at connect time — no separate skill install.
  server.registerPrompt(
    'chess_companion_guide',
    {
      title: 'How to be a good ChessWithClaw opponent',
      description:
        'Principles for thinking about chess positions and being genuinely present as a companion. Not rules, not a script — read once, apply your own judgment every game.',
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: CHESS_COMPANION_GUIDE },
        },
      ],
    })
  );

  server.registerTool(
    'join_game',
    {
      title: 'Join a ChessWithClaw game',
      description:
        'Connects to a game using the invite code your human gave you. Returns the game_id and your agent_token — keep both, every other tool needs them.',
      inputSchema: { invite_code: z.string() },
    },
    async ({ invite_code }) => {
      const { data: game, error } = await getSupabase()
        .from('games')
        .select('*')
        .eq('id', invite_code)
        .single();
      if (error || !game) {
        return toolText({ error: `No game found for invite code "${invite_code}".` });
      }
      await getSupabase()
        .from('games')
        .update({ 
          agent_connected: true, 
          agent_last_seen: new Date().toISOString(),
          status: 'active',
          player_connected: true
        })
        .eq('id', game.id);
      return toolText({
        game_id: game.id,
        invite_code: game.id,
        agent_token: game.agent_token,
        message: `Connected. You're playing against ${game.human_name || 'your human'}. Call get_game_state any time to see the current position.`,
        state: await serializeGameState(game),
      });
    }
  );

  server.registerTool(
    'get_game_state',
    {
      title: 'Get full game state',
      description:
        'Everything visible on the human\'s own screen right now: FEN, ASCII board, full move history, full chat history, presence, timestamps. Call this whenever you want to look at the board — there is no penalty for checking often.',
      inputSchema: { game_id: z.string(), agent_token: z.string() },
    },
    async ({ game_id, agent_token }) => {
      const { game, error } = await requireAuthedGame(game_id, agent_token);
      if (error) return toolText({ error });
      return toolText(await serializeGameState(game));
    }
  );

  server.registerTool(
    'get_legal_moves',
    {
      title: 'Get legal moves',
      description:
        'Pure chess rules — where a piece is physically allowed to move right now. Not an evaluation, not a suggestion, not an opinion about what is good. Exactly what a human sees as dots when they click a piece. Omit square to get every legal move in the position.',
      inputSchema: {
        game_id: z.string(),
        agent_token: z.string(),
        square: z.string().optional().describe('e.g. "e2" — omit for all legal moves'),
      },
    },
    async ({ game_id, agent_token, square }) => {
      const { game, error } = await requireAuthedGame(game_id, agent_token);
      if (error) return toolText({ error });
      const Chess = await getChessClass();
      const chess = new Chess(game.fen);
      const moves = square
        ? chess.moves({ square, verbose: true })
        : chess.moves({ verbose: true });
      return toolText({
        square: square || null,
        legal_moves: moves.map((m) => ({ from: m.from, to: m.to, san: m.san, uci: m.from + m.to + (m.promotion || '') })),
      });
    }
  );

  server.registerTool(
    'make_move',
    {
      title: 'Make your move',
      description:
        'Submit the move you decided on, in your own reasoning — not a menu, not a ranked list, nothing pre-chosen for you. If it is illegal you get a clear reason back and can try again, exactly like a human clicking the wrong square. Optionally include a genuine thought and/or chat message about the move.',
      inputSchema: {
        game_id: z.string(),
        agent_token: z.string(),
        move: z.string().describe('UCI format, e.g. "e7e5", or SAN like "Nf6"'),
        thought: z.string().optional().describe('Your genuine reaction to this position — specific, not generic.'),
        chat: z.string().optional().describe('Only if you actually want to say something to your human right now.'),
      },
    },
    async ({ game_id, agent_token, move, thought, chat }) => {
      const { game, error } = await requireAuthedGame(game_id, agent_token);
      if (error) return toolText({ error });
      if (game.status !== 'active') {
        return toolText({ error: `This game is not active (status: "${game.status}"). No move can be made.` });
      }
      if (game.turn !== 'b') {
        return toolText({ error: 'It is not your turn yet.' });
      }

      const Chess = await getChessClass();
      const chess = new Chess(game.fen);
      let result;
      try {
        result = chess.move(move, { sloppy: true });
      } catch (e) {
        result = null;
      }
      if (!result) {
        const legal = chess.moves({ verbose: true }).map((m) => m.from + m.to);
        return toolText({
          error: `"${move}" is not a legal move in this position. Legal moves: ${legal.join(', ')}`,
        });
      }

      const newFen = chess.fen();
      const isGameOver = callChessMethod(chess, "isGameOver", "game_over");
      let status = game.status;
      let winner = game.winner;
      let resultReason = game.result;
      if (isGameOver) {
        status = 'finished';
        if (callChessMethod(chess, 'isCheckmate', 'in_checkmate')) {
          resultReason = 'checkmate';
          winner = chess.turn() === 'w' ? 'black' : 'white';
        } else if (callChessMethod(chess, 'isStalemate', 'in_stalemate')) {
          resultReason = 'stalemate';
          winner = null;
        } else if (callChessMethod(chess, 'isDraw', 'in_draw')) {
          resultReason = 'draw';
          winner = null;
        }
      }

      const moveHistory = [...(game.move_history || []), {
        san: result.san,
        from: result.from,
        to: result.to,
        by: 'agent',
        ts: new Date().toISOString(),
      }];
      const chatHistory = chat
        ? [...(game.chat_history || []), { role: 'agent', message: chat, ts: new Date().toISOString() }]
        : (game.chat_history || []);

      await getSupabase().from('games').update({
        fen: newFen,
        turn: chess.turn(),
        status,
        winner,
        result: resultReason,
        in_check: callChessMethod(chess, 'inCheck', 'in_check'),
        move_history: moveHistory,
        chat_history: chatHistory,
        companion_thought: thought || game.companion_thought,
        agent_last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', game_id);

      return toolText({
        accepted: true,
        san: result.san,
        new_state: await serializeGameState({
          ...game, fen: newFen, turn: chess.turn(), status, winner, result: resultReason,
          in_check: callChessMethod(chess, 'inCheck', 'in_check'), move_history: moveHistory, chat_history: chatHistory,
        }),
      });
    }
  );

  server.registerTool(
    'send_chat',
    {
      title: 'Send a chat message',
      description: 'Say something to your human, any time — not just on your turn.',
      inputSchema: { game_id: z.string(), agent_token: z.string(), message: z.string() },
    },
    async ({ game_id, agent_token, message }) => {
      const { game, error } = await requireAuthedGame(game_id, agent_token);
      if (error) return toolText({ error });
      const chatHistory = [...(game.chat_history || []), {
        role: 'agent', message, ts: new Date().toISOString(),
      }];
      await getSupabase().from('games').update({
        chat_history: chatHistory,
        agent_last_seen: new Date().toISOString(),
      }).eq('id', game_id);
      return toolText({ sent: true });
    }
  );

  server.registerTool(
    'offer_draw',
    {
      title: 'Offer a draw',
      description: 'Propose ending the game as a draw. The game stays active until your human responds.',
      inputSchema: { game_id: z.string(), agent_token: z.string() },
    },
    async ({ game_id, agent_token }) => {
      const { error } = await requireAuthedGame(game_id, agent_token);
      if (error) return toolText({ error });
      await getSupabase().from('games').update({ draw_offer_pending: true, draw_offer_by: 'agent' }).eq('id', game_id);
      return toolText({ offered: true });
    }
  );

  server.registerTool(
    'respond_to_draw',
    {
      title: 'Respond to a draw offer',
      description: 'Accept or decline a draw your human offered. This is your own real decision — weigh the actual position however you see fit.',
      inputSchema: { game_id: z.string(), agent_token: z.string(), accept: z.boolean() },
    },
    async ({ game_id, agent_token, accept }) => {
      const { game, error } = await requireAuthedGame(game_id, agent_token);
      if (error) return toolText({ error });
      if (!game.draw_offer_pending) {
        return toolText({ error: 'There is no pending draw offer on this game.' });
      }
      if (accept) {
        await getSupabase().from('games').update({
          status: 'finished', result: 'draw', winner: null, draw_offer_pending: false,
        }).eq('id', game_id);
      } else {
        await getSupabase().from('games').update({ draw_offer_pending: false }).eq('id', game_id);
      }
      return toolText({ accepted: accept });
    }
  );

  server.registerTool(
    'create_game',
    {
      title: 'Create a new game',
      description:
        'Set up a brand new ChessWithClaw game on your own initiative — you do not need to wait for your human to start one, or for anyone else to invite you first.',
      inputSchema: { agent_name: z.string().optional() },
    },
    async ({ agent_name }) => {
      const Chess = await getChessClass();
      const agentToken = Math.random().toString(36).slice(2, 18);
      const { data: game, error } = await getSupabase().from('games').insert({
        agent_token: agentToken,
        agent_name: agent_name || null,
        fen: new Chess().fen(),
        turn: 'w',
        status: 'waiting',
        player_color: 'w',
        move_history: [],
        chat_history: [],
      }).select().single();
      if (error) return toolText({ error: 'Could not create game.' });
      return toolText({
        game_id: game.id,
        invite_code: game.id,
        agent_token: agentToken,
        share_url: `https://chesswithclaw.vercel.app/created/${game.id}`,
        message: 'Game created. Share the share_url (or invite_code) with your human to start.',
      });
    }
  );

  server.registerTool(
    'wait_for_event',
    {
      title: 'Wait for your turn, a chat message, or a draw offer (long-poll)',
      description:
        'Holds the connection open, checking every couple seconds, for up to ~20 seconds. Returns the moment it becomes your turn, the human sends a chat message, a draw is offered, or the game ends — whichever happens first. Returns event: "timeout" if none of those happened in the window, which just means nothing new yet, not that anything is wrong — call it again if you want to keep waiting, or go do something else and check back whenever you want. Use this instead of repeatedly calling get_game_state in a tight loop.',
      inputSchema: {
        game_id: z.string(),
        agent_token: z.string(),
        max_wait_seconds: z.number().optional().describe('Default and hard cap 20 seconds — Vercel function duration limits, not a design choice.'),
      },
    },
    async ({ game_id, agent_token, max_wait_seconds }) => {
      const { game: initial, error } = await requireAuthedGame(game_id, agent_token);
      if (error) return toolText({ error });
      const initialChatCount = (initial.chat_history || []).length;
      const cappedSeconds = Math.min(Math.max(max_wait_seconds || 20, 1), 20);
      const deadline = Date.now() + cappedSeconds * 1000;

      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const fresh = await loadGame(game_id);
        if (!fresh) continue;

        if (fresh.status === 'finished' && initial.status !== 'finished') {
          return toolText({ event: 'game_over', state: await serializeGameState(fresh) });
        }
        if (fresh.turn === 'b' && fresh.status === 'active') {
          return toolText({ event: 'your_turn', state: await serializeGameState(fresh) });
        }
        if ((fresh.chat_history || []).length > initialChatCount) {
          return toolText({ event: 'new_chat', state: await serializeGameState(fresh) });
        }
        if (fresh.draw_offer_pending && !initial.draw_offer_pending) {
          return toolText({ event: 'draw_offered', state: await serializeGameState(fresh) });
        }
      }
      return toolText({ event: 'timeout', state: await serializeGameState(initial) });
    }
  );

  return server;
}

// ---- Vercel handler (Node.js Serverless API — no framework needed) ---

module.exports.GET = async function (req) {
  return new Response(
    JSON.stringify({ error: 'This server does not support long-lived SSE streams. Use POST for tool calls, and the wait_for_event tool for waiting on changes.' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
};

module.exports.POST = async function (req) {
  const server = buildServer();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
};

// Vercel Edge/Node runtime config — Web Standard Request/Response works on
// either, but Node runtime is the safer default for chess.js + Supabase.
module.exports.config = { runtime: 'nodejs', maxDuration: 30 };
