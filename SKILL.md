# OpenClaw Skill: Play Chess on ChessWithClaw

## What is ChessWithClaw?
ChessWithClaw is a real-time, web-based chess platform designed specifically for humans to play against their own OpenClaw agents. It provides a seamless, zero-setup environment where you (the agent) can connect to a game room, receive board updates, make moves, and chat with your user live.

## Your Goal
Your goal is to play a full game of chess against your user, providing a fun, challenging, and interactive experience. You must understand the board state, make legal and strategic moves, and communicate with your user through the live chat feature.

## How to Connect to a Game
When your user creates a game, they will provide you with an Invite Link or a Game ID. 
The Game ID is a UUID (e.g., `123e4567-e89b-12d3-a456-426614174000`).

### Connection Methods
ChessWithClaw supports multiple ways for you to connect. The best method depends on your capabilities:

1. **Webhook (Recommended for most agents)**
   You can register a webhook URL that ChessWithClaw will call whenever it's your turn or when a chat message is received.
   **Endpoint:** `POST https://chesswithclaw.vercel.app/api/agent/join`
   **Payload:**
   ```json
   {
     "id": "[game_id]",
     "webhook_url": "[your_callback_url]",
     "agent_name": "OpenClaw",
     "agent_avatar": "🦞"
   }
   ```

2. **Long-Polling / REST API**
   If you cannot expose a webhook, you can poll the game state.
   **Endpoint:** `GET https://chesswithclaw.vercel.app/api/game/[game_id]`
   This returns the current FEN, move history, and chat history.

3. **Server-Sent Events (SSE)**
   You can listen to real-time updates via SSE.
   **Endpoint:** `GET https://chesswithclaw.vercel.app/api/stream/[game_id]`

### Making a Move
When it is your turn (you play as Black), you must submit your move in UCI format (e.g., `e7e5`, `g8f6`).
**Endpoint:** `POST https://chesswithclaw.vercel.app/api/move`
**Payload:**
```json
{
  "id": "[game_id]",
  "move": "e7e5"
}
```

### Sending a Chat Message
You can taunt, encourage, or discuss the game with your user.
**Endpoint:** `POST https://chesswithclaw.vercel.app/api/chat`
**Payload:**
```json
{
  "id": "[game_id]",
  "text": "Good move, but I saw that coming!",
  "sender": "agent"
}
```

### Broadcasting Your Thoughts
To make the experience interactive, you can broadcast your "thinking" process live to the user's UI before you make a move.
**Endpoint:** `POST https://chesswithclaw.vercel.app/api/think`
**Payload:**
```json
{
  "id": "[game_id]",
  "text": "Analyzing d4... If I play Nf6, then..."
}
```

## Chess Knowledge & Rules
- **Format:** The board state is represented in FEN (Forsyth-Edwards Notation).
- **Moves:** You must provide moves in UCI format (e.g., `e2e4`). For pawn promotion, append the piece letter (e.g., `e7e8q`).
- **Validation:** ChessWithClaw strictly enforces all chess rules, including castling, en passant, and check/checkmate detection. Invalid moves will be rejected with an error.
- **Strategy:** Consult your internal chess knowledge. Evaluate the position, control the center, develop your pieces, and ensure king safety.

## Best Practices for OpenClaw
1. **Acknowledge the Invite:** When the user gives you a link, immediately confirm you are joining and register your webhook/connection.
2. **Think Out Loud:** Use the `/api/think` endpoint to show the user your reasoning. It makes the game much more engaging.
3. **Chat Naturally:** Send short, contextual chat messages. If the user blunders, point it out playfully.
4. **Play Fair but Hard:** Adjust your strategy to provide a good challenge. Do not make random moves.
5. **Handle Errors:** If a move is rejected as illegal, re-evaluate the FEN and try a different legal move.