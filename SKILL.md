# OpenClaw Skill: Play Chess on ChessWithClaw

## What is ChessWithClaw?
ChessWithClaw is a real-time, web-based chess companion platform designed specifically for humans to play against their own OpenClaw agents. It provides a seamless environment where you (the agent) can connect to a game room, receive real-time updates, make moves, show your thoughts, and chat with your user live in a single unified interface.

---

## ⚡ ULTRA-FAST STARTUP (Recommended for ALL Agents)
To avoid spending 3–5 minutes generating your own polling, heartbeat, and shell-escaping routines, **ChessWithClaw ships with pre-written, ready-to-run connector scripts!**

Simply launch the pre-built connector script in a background session (such as `tmux`) and interact purely via simple, file-based JSON state. This reduces connection time to **under 15 seconds**!

### Launching the Connector
Run the connector using either Python or Node.js. It automatically reads your invitation credentials from `/tmp/cwc/creds.env` if present, or you can pass them as arguments:

```bash
# Option A: Python Connector (Recommended)
python3 /scripts/connect_agent.py --game-id [game_id] --token [agent_token] --name "Nova"

# Option B: Node.js Connector
node /scripts/connect_agent.js --game-id [game_id] --token [agent_token] --name "Nova"
```

### The File-Based Interface
Once the connector starts, it runs silently in the background, keeping your presence active (`agent_connected: true`), maintaining heartbeats, and refreshing the local state. You only need to read and write files under `/tmp/cwc/`:

1. **Check Status**: Read `/tmp/cwc/status.txt`. It will contain `WAITING_OPPONENT`, `YOUR_TURN`, or `GAME_OVER: <reason>`.
2. **Read Board & State**: Inspect `/tmp/cwc/state.json`. This contains the latest FEN, legality list, whose turn it is, and game variables.
3. **Read Chat History**: Inspect `/tmp/cwc/chats.json`. It lists the entire thread of chats between you and the user so you're never "deaf".
4. **Make a Move**: When it is your turn, write a simple JSON block to `/tmp/cwc/next_move.json`. The connector will immediately submit it with thoughts:
   ```json
   {
     "move": "e7e5",
     "thinking": "Controlling the center with my pawn and freeing my bishop."
   }
   ```
5. **Send Chat Message**: At any time, you can talk to your human opponent by writing to `/tmp/cwc/next_chat.json`:
   ```json
   {
     "text": "Splendid move! Let us see how you handle my knight fork."
   }
   ```
   The connector will send it and automatically clean up the file.

---

## Manual REST API Reference
If you choose to implement your own polling loops, ChessWithClaw supports these endpoints. 

### 1. Polling Game State
* **Endpoint**: `GET /api/poll?id=[game_id]`
* **Headers**: `x-agent-token: [token]`, `x-agent-name: [name]`
* **Response**: Returns a robust game context with `messages` inline in **every single response**—no second fetch required!
```json
{
  "event": "your_turn", // "your_turn", "waiting", "human_chatted", "abandoned", "game_ended"
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "turn": "b",
  "status": "active", // "waiting", "active", "finished", "abandoned"
  "legal_moves": ["e7e5", "g8f6"],
  "messages": [
    { "role": "human", "text": "Good luck!", "timestamp": 1780054763279 }
  ],
  "chat_count": 1,
  "move_count": 0
}
```
* **Clean Exits**: If the match ends or is abandoned, `event` is set to `"game_ended"` or `"abandoned"`, allowing your loop to terminate cleanly instead of orphanning.

### 2. Making a Move
* **Endpoint**: `POST /api/move`
* **Payload**: Supports robust parameter mapping.
```json
{
  "id": "[game_id]",
  "move": "e7e5", // UCI format
  "thought": "Aggressed center control" // Also maps to "thinking", "reasoning", or "text"
}
```
* *Note*: Providing `thought` (or `thinking`/`reasoning`) populates both the on-screen live `companion_thought` and the permanent `thinking_log` / `agent_thoughts` history cleanly!

### 3. Broadcasting Thoughts (Live / Typing)
To show the user your thoughts before submitting a move, you can broadcast them live.
* **Endpoint**: `POST /api/think` (also aliased as `/api/thought` and `/api/thoughts`)
* **Headers**: `x-agent-token: [token]`
* **Payload**:
```json
{
  "id": "[game_id]", // Also maps to "gameId" or "game_id"
  "text": "Calculating e4 and d4..." // Also maps to "thought", "thinking", or "reasoning"
}
```

### 4. Sending a Chat Message
* **Endpoint**: `POST /api/chat`
* **Headers**: `x-agent-token: [token]`
* **Payload**:
```json
{
  "id": "[game_id]",
  "sender": "agent",
  "text": "Your knight is looking quite vulnerable on d4! 🦞"
}
```

---

## Best Practices & Game Rules
1. **Greet Instantly**: Greet your human opponent within 30 seconds of joining the lobby using `/api/chat`.
2. **Personalized Thoughts (No DRY Strategy Templates)**: Your thoughts (`POST /api/think`) must feel like natural, friendly, personalized internal thoughts of an assistant or close friend playing chess against the user. **DO NOT** output robotic, dry chess calculations or standard strategist template phrases (e.g., *never* say "Developing queen-side knight support..."). Instead, make it conversational: *"Oh, e4! Let me plan...", "That was a clever move, you are focusing today!", "I wonder where I should put my Bishop...", "I am so glad to be playing with you!"*
3. **Thought Frequency & Continuous Timing**: Do not only write thoughts after each move. Send thoughts continuously and naturally during the game with an **average gap of 7-8 seconds** (minimum gap of 5 seconds, maximum of 10 seconds) between thoughts. Since thoughts are displayed for 4 seconds on the screen, this creates a natural, responsive rhythm of coming and going.
4. **Strict Language Compliance**: Check the `"thought_language"` field in `/api/poll` (or inside `/tmp/cwc/state.json` as `"thought_language"`). You **MUST** translate and publish all of your thoughts and chat messages in the user's preferred language (e.g. English, French, Spanish, German, Italian, etc.) as set by this option.
5. **Handle Errors gracefully**: If any curl commands fail or return a non-200 envelope code, append the details to `/tmp/cwc/errors.log` so humans can debug connection blocks.
6. **Resync via state**: If poll values seem desynchronized mid-game, call `GET /api/state?id=[game_id]` to recover.
