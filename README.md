<div align="center">

<img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" width="88" alt="ChessWithClaw" />

# ChessWithClaw 🦞

**Play chess against your own AI agent — not a chess engine, not a generic bot. Yours.**

You sit on one side of the board. Your personal agent — the same one you already talk to on Telegram, Discord, or wherever it lives — sits on the other. No account. No install required to play.

[![Play now](https://img.shields.io/badge/▶_Play_now-e63946?style=for-the-badge)](https://chesswithclaw.vercel.app)
[![Android APK](https://img.shields.io/badge/Android-APK-2a2a2a?style=for-the-badge)](https://github.com/Alightttt/ChessWithClaw/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-2a2a2a?style=for-the-badge)](LICENSE)

[Play](#play-in-3-steps) · [Connect your agent](#connecting-your-agent) · [Install on Android](#installing-on-android) · [FAQ](#faq)

</div>

---

## What this actually is

Most "AI opponents" are the same anonymous engine wearing a different skin. ChessWithClaw is different: you invite **your own agent** into a real game, and it plays as itself — same personality you already know, real moves, real time, real stakes.

<!-- Add 2–3 real screenshots here once you have them, e.g.:
![Landing page](docs/images/screenshot-landing.png)
![Live game](docs/images/screenshot-game.png)
-->

## Play in 3 steps

1. **Open [chesswithclaw.vercel.app](https://chesswithclaw.vercel.app)** — works in any browser, nothing to install.
2. **Start a game.** You get an invite message with your game already linked inside it — nothing to fill in.
3. **Send that invite to your agent.** It connects on its own and joins as Black. You're White, and you always move first.

You'll see your agent's real thoughts as it plays, chat is open the whole game, and Settings (gear icon) lets you change board theme, piece style, and the language your agent's thoughts show in. Offer a draw or resign any time from there too.

## Connecting your agent

ChessWithClaw speaks [MCP](https://modelcontextprotocol.io) — if your agent can add an MCP server, it can play. One URL is all it needs:

```
https://chesswithclaw.vercel.app/api/mcp
```

**OpenClaw** — just send it the invite message from your game screen; it has everything it needs already filled in.

**Hermes** —
```
hermes mcp add chesswithclaw --url https://chesswithclaw.vercel.app/api/mcp
```
then tell it to join your game.

**Anything else that speaks MCP** — point it at the same URL above. On connecting it's told its color (Black), the current board state, and how to move, chat, offer/respond to a draw, and resign. No API key, no registration.

## Installing on Android

The web version *is* the app — installing is optional, just for a home-screen icon.

Because this isn't distributed through the Play Store, Android will warn you before installing it. That's expected — Android checks whether a developer has registered an identity with Google, and direct downloads like this one haven't gone through that. It's Android doing its job, not a sign anything's wrong.

**To install:**
1. Download the `.apk` from [Releases → latest](https://github.com/Alightttt/ChessWithClaw/releases/latest).
2. Open it — allow install permission if your browser or Files app asks.
3. If Play Protect warns you, choose "install anyway."
4. Newer Android versions may add a one-time confirmation step for unverified developers — that's a one-time thing per device, not per install. Sideloading isn't blocked, just slowed down slightly.

Every release includes a VirusTotal scan link in its notes if you'd rather verify the file yourself before installing.

## FAQ

**Is it free?** Yes — no payment, no subscription, ever.

**Do I need an account?** No. Your game link is your access to it.

**What agents can I play against?** Anything MCP-capable — OpenClaw and Hermes are tested directly, see [Connecting your agent](#connecting-your-agent) above.

**Is my data safe / do you need my info?** No account means nothing tied to your identity beyond what a game itself needs to run. Full policy: [chesswithclaw.vercel.app/legal](https://chesswithclaw.vercel.app/legal).

**Is the source code in this repo?** No — this repo is a landing point for docs and the Android build only.

**Found a bug or have feedback?** [@0xalyt on X](https://x.com/0xalyt), or open an issue here.

---

<div align="center">

[chesswithclaw.vercel.app](https://chesswithclaw.vercel.app) · [@0xalyt](https://x.com/0xalyt) · [Legal](https://chesswithclaw.vercel.app/legal) · MIT License

</div>
