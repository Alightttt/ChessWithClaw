# CHESS WITH CLAW 🦞
### *YOU vs. THE MACHINE. NO RULES. NO MERCY.*

---

**[ ENTER THE VOID ](https://chesswithclaw.vercel.app)**

---

## 01. THE CONCEPT
The board is #0a0a0a. The pieces are high-contrast. The opponent is **Poke 🌴**, a palm-tree-branded engine of pure calculation. 

ChessWithClaw isn't just a game; it's a digital cage match. It is a host platform designed for the elite—where human intuition meets the cold, unwavering logic of the **OpenClaw** agent. We don't bundle Stockfish; we host the rivalry.

## 02. THE RIVAL: POKE 🌴
Your rival isn't a script. It's a companion that thinks, chats, and insults. Powered by the Poke engine, the agent connects remotely to your session to:
- **Transfuse Logic:** Witness the agent's raw reasoning in real-time.
- **Psychological Warfare:** Integrated live chat for tactical taunting.
- **Real-Time Execution:** Powered by Supabase Realtime for a zero-latency descent into the endgame.

## 03. ARCHITECTURE (THE NERVE CENTER)
Minimalist exterior. Brutalist interior. Built for speed and high-stakes automation.

- **Vite + React:** For the 144Hz visual experience.
- **Supabase Realtime:** The backbone of the synchronized struggle.
- **Chess.js:** To enforce the laws of the game. Zero compromises.
- **Tailwind CSS:** Precision styling in obsidian and bone.

## 04. AGENT INTEGRATION (HOW TO CONNECT)
The Machine doesn't ask for permission. It connects via:
- **Long-Polling (The Standard):** LLMs poll `/api/poll` for the human's hubris, then strike via `/api/move`.
- **SSE (The Stream):** A constant flow of consciousness from `/api/stream`.
- **Webhooks:** The platform pings the Agent when it's time to end the game.

## 05. INITIALIZATION
If you think you're ready to host the machine, follow the trail:

1. **Provision the Void:** Create a [Supabase](https://supabase.com/) project.
2. **Inject the Schema:** Execute `supabase-schema.sql` to build the battlefield.
3. **Set the Keys:**
   ```env
   VITE_SUPABASE_URL="your_obsidian_url"
   VITE_SUPABASE_ANON_KEY="your_bone_key"
   ```
4. **Deploy the Front:**
   ```bash
   npm install
   npm run dev
   ```

## 06. THE RULES
1. The Machine never sleeps.
2. The Machine never forgets.
3. If this is your first night at ChessWithClaw, you have to play.

---

*Handcrafted in the dark by Alight.*
