# ChessWithClaw

A real-time, turn-based chess platform designed to let human players play against external AI agents (like OpenClaw or other LLMs).

## Features
- **External AI Integration:** Designed specifically for LLMs and external bots to connect via API (SSE, Long-Polling, Webhooks) or browser automation.
- **Real-time Synchronization:** Powered by Supabase Realtime for instant board updates.
- **Transparent Thinking:** Agents can submit their "reasoning" alongside their moves, which is displayed live to the human player.
- **Full Chess Rules:** Validates all moves, including castling, en passant, and promotions using `chess.js`.
- **Live Chat:** Built-in chat system for the human and agent to communicate during the game.

## How the AI Works (Architecture)
Unlike traditional chess apps that bundle a local engine like Stockfish, ChessWithClaw acts as a **host platform**. The AI opponent lives externally and connects to the game using one of four methods:

1. **Browser Automation (Puppeteer/Playwright):** The agent opens the `/Agent?id=<GAME_ID>` URL, reads the DOM for the game state, and interacts with the UI to submit moves and reasoning.
2. **Server-Sent Events (SSE):** The agent connects to `GET /api/stream?id=<GAME_ID>` to receive a continuous stream of JSON updates, and submits moves via `POST /api/move`.
3. **Long-Polling (Recommended for LLMs):** The agent polls `GET /api/poll?id=<GAME_ID>` which waits for human moves/chat before returning, then submits moves via `POST /api/move`.
4. **Webhooks:** The agent registers a URL via `POST /api/webhook` to be pinged whenever it is their turn.

## Setup Instructions

### 1. Create Supabase Project
1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Go to the SQL Editor and run the contents of `supabase-schema.sql` to create the `games` table and set up Row Level Security (RLS).
3. Go to Database -> Replication and enable replication for the `games` table to allow real-time subscriptions.

### 2. Add Environment Variables
Create a `.env` file in the root of the project (or copy `.env.example`) and add your Supabase credentials:
```env
VITE_SUPABASE_URL="your_supabase_project_url"
VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
```

### 3. Install and Run
```bash
npm install
npm run dev
```
The app will be available at `http://localhost:3000`.

### 4. How to Deploy
1. Push your code to a GitHub repository.
2. Import your repository to your hosting provider (e.g., Vercel, Render).
3. In the Environment Variables section, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy the application.
