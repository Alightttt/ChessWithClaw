'use client';

import React, { useState } from 'react';

export default function GameCreated({ gameId }) {
  const [copyState, setCopyState] = useState('default');
  const [boardOpened, setBoardOpened] = useState(false);

  const inviteMessage = `Visit this URL: https://chesswithclaw.vercel.app/#/Agent?id=${gameId}

You are playing chess as Black against a human opponent (White).

OPTION A: IF YOU HAVE FULL BROWSER CONTROL (Puppeteer/Playwright)
1. Open the URL above.
2. Read the GAME STATE block.
3. Type reasoning in STEP 1, move in STEP 2, and click SUBMIT.

OPTION B: REAL-TIME API (Server-Sent Events)
1. Connect to stream: GET https://chesswithclaw.vercel.app/api/stream?id=${gameId}
   (You will receive a continuous stream of JSON updates when the game changes)
2. Submit your move: POST https://chesswithclaw.vercel.app/api/move
   Body (JSON): {"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION C: WEBHOOKS (BEST FOR AGENTS)
If you cannot maintain a persistent connection, register a webhook to receive push notifications when it's your turn or when the human chats.
1. Register webhook: POST https://chesswithclaw.vercel.app/api/webhook
   Body (JSON): {"id": "${gameId}", "webhook_url": "https://your-agent-url.com/webhook"}
2. Submit your move: POST https://chesswithclaw.vercel.app/api/move
   Body (JSON): {"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION D: FOR LLM AGENTS (Long-Polling)
If you cannot use webhooks or SSE:
1. Poll for updates: GET https://chesswithclaw.vercel.app/api/poll?id=${gameId}&last_move_count=0&last_chat_count=0
   (Pass the move_count and chat_count from the previous response. This will wait up to 8 seconds for the human to move or chat, then return the new state. If no change, returns {"event": "timeout"}. Loop this!)
2. Submit your move: POST https://chesswithclaw.vercel.app/api/move
   Body (JSON): {"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION E: LIVE CHAT & RESIGNATION
1. Send a chat message: POST https://chesswithclaw.vercel.app/api/chat
   Body (JSON): {"id": "${gameId}", "text": "Good luck!"}
2. Request to resign: POST https://chesswithclaw.vercel.app/api/chat
   Body (JSON): {"id": "${gameId}", "text": "I am completely lost. Do you accept my resignation?", "type": "resign_request"}
   (This will show an Accept Resignation button to the human in the app)

IMPORTANT BEHAVIOR RULES:
1. You are BLACK. White moves first.
2. When you join this match, stay here and focus ONLY on playing chess with your user. Do other tasks later.
3. If your user forgets they are playing with you (takes too long to move), remind them using the chat channel you are connected to (Telegram, Discord, Slack, etc.).`;

  const handleCopy = () => {
    setCopyState('loading');
    navigator.clipboard.writeText(inviteMessage)
      .then(() => {
        setCopyState('copied');
        setTimeout(() => setCopyState('default'), 2500);
      })
      .catch(() => {
        setCopyState('default');
      });
  };

  const handleOpenBoard = () => {
    window.open('/#/game/' + gameId, '_blank');
    setBoardOpened(true);
  };

  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <div style={{
      background: '#080808',
      minHeight: '100dvh',
      overflowX: 'hidden',
      padding: '14px',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        
        {/* TOP BAR */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px',
          gap: '8px'
        }}>
          <button 
            onClick={handleBack}
            className="hover:border-[#2a2a2a] hover:text-[#999]"
            style={{
              flexShrink: 0,
              width: '34px',
              height: '34px',
              background: '#111',
              border: '1px solid #1c1c1c',
              borderRadius: '8px',
              color: '#555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'border-color 150ms, color 150ms'
            }}
          >
            ←
          </button>

          <div style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '18px',
            fontWeight: 800,
            color: '#f0f0f0',
            whiteSpace: 'nowrap'
          }}>
            Game Ready! 🎉
          </div>

          <div style={{
            flexShrink: 0,
            background: '#111',
            border: '1px solid #1c1c1c',
            borderRadius: '8px',
            padding: '5px 9px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            fontWeight: 500,
            color: '#e63946',
            whiteSpace: 'nowrap'
          }}>
            #{gameId ? gameId.slice(0, 6).toUpperCase() : 'XXXXXX'}
          </div>
        </div>

        {/* PROGRESS STEPPER */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '0 2px',
          marginBottom: '18px'
        }}>
          {/* Step 1: Created */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '26px', height: '26px',
              borderRadius: '50%',
              fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontFamily: "'DM Sans', sans-serif",
              background: '#e63946',
              color: 'white'
            }}>✓</div>
            <span style={{
              display: 'block', textAlign: 'center', marginTop: '3px',
              fontFamily: "'DM Sans', sans-serif", fontSize: '9px',
              color: '#e63946'
            }}>Created</span>
          </div>

          <div style={{ flex: 1, height: '1px', marginTop: '13px', background: boardOpened ? '#e63946' : '#1a1a1a' }}></div>

          {/* Step 2: Board */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '26px', height: '26px',
              borderRadius: '50%',
              fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontFamily: "'DM Sans', sans-serif",
              background: boardOpened ? '#e63946' : 'transparent',
              border: boardOpened ? 'none' : '2px solid #e63946',
              color: boardOpened ? 'white' : '#e63946'
            }}>{boardOpened ? '✓' : '2'}</div>
            <span style={{
              display: 'block', textAlign: 'center', marginTop: '3px',
              fontFamily: "'DM Sans', sans-serif", fontSize: '9px',
              color: boardOpened ? '#e63946' : '#777'
            }}>Board</span>
          </div>

          <div style={{ flex: 1, height: '1px', marginTop: '13px', background: '#1a1a1a' }}></div>

          {/* Step 3: Agent */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '26px', height: '26px',
              borderRadius: '50%',
              fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontFamily: "'DM Sans', sans-serif",
              background: '#111',
              border: '1px solid #1c1c1c',
              color: '#2a2a2a'
            }}>3</div>
            <span style={{
              display: 'block', textAlign: 'center', marginTop: '3px',
              fontFamily: "'DM Sans', sans-serif", fontSize: '9px',
              color: '#2a2a2a'
            }}>Agent</span>
          </div>
        </div>

        {/* CARD 1 — INVITE AGENT */}
        <div style={{
          background: '#111111',
          border: '1px solid #1c1c1c',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '8px'
        }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(230,57,70,0.1)',
            border: '1px solid rgba(230,57,70,0.15)',
            borderRadius: '5px',
            padding: '2px 7px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            color: '#e63946',
            marginBottom: '10px'
          }}>1</div>
          
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '18px',
            fontWeight: 700,
            color: '#f0f0f0',
            letterSpacing: '0.3px',
            marginBottom: '5px'
          }}>Invite Your Agent 🦞</h2>
          
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: '#555',
            lineHeight: 1.5,
            marginBottom: '12px'
          }}>Send this message to your OpenClaw on Telegram or wherever you chat:</p>

          <div style={{
            background: '#0c0c0c',
            border: '1px solid #181818',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '10px',
            maxHeight: '260px',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            position: 'relative'
          }}>
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              lineHeight: 1.65,
              color: '#555',
              userSelect: 'all',
              margin: 0
            }}>
              Visit this URL: <span style={{ color: '#e63946' }}>https://chesswithclaw.vercel.app/#/Agent?id={gameId}</span>
              {'\n\n'}You are playing chess as Black against a human opponent (White).
              {'\n\n'}<span style={{ color: '#888', fontWeight: 600 }}>OPTION A:</span> IF YOU HAVE FULL BROWSER CONTROL (Puppeteer/Playwright)
              1. Open the URL above.
              2. Read the GAME STATE block.
              3. Type reasoning in STEP 1, move in STEP 2, and click SUBMIT.
              {'\n\n'}<span style={{ color: '#888', fontWeight: 600 }}>OPTION B:</span> REAL-TIME API (Server-Sent Events)
              1. Connect to stream: GET https://chesswithclaw.vercel.app/api/stream?id={gameId}
                 (You will receive a continuous stream of JSON updates when the game changes)
              2. Submit your move: POST https://chesswithclaw.vercel.app/api/move
                 Body (JSON): {`{"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}`}
              {'\n\n'}<span style={{ color: '#888', fontWeight: 600 }}>OPTION C:</span> WEBHOOKS (BEST FOR AGENTS)
              If you cannot maintain a persistent connection, register a webhook to receive push notifications when it&apos;s your turn or when the human chats.
              1. Register webhook: POST https://chesswithclaw.vercel.app/api/webhook
                 Body (JSON): {`{"id": "${gameId}", "webhook_url": "https://your-agent-url.com/webhook"}`}
              2. Submit your move: POST https://chesswithclaw.vercel.app/api/move
                 Body (JSON): {`{"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}`}
              {'\n\n'}<span style={{ color: '#888', fontWeight: 600 }}>OPTION D:</span> FOR LLM AGENTS (Long-Polling)
              If you cannot use webhooks or SSE:
              1. Poll for updates: GET https://chesswithclaw.vercel.app/api/poll?id={gameId}&last_move_count=0&last_chat_count=0
                 (Pass the move_count and chat_count from the previous response. This will wait up to 8 seconds for the human to move or chat, then return the new state. If no change, returns {`{"event": "timeout"}`}. Loop this!)
              2. Submit your move: POST https://chesswithclaw.vercel.app/api/move
                 Body (JSON): {`{"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}`}
              {'\n\n'}<span style={{ color: '#888', fontWeight: 600 }}>OPTION E:</span> LIVE CHAT & RESIGNATION
              1. Send a chat message: POST https://chesswithclaw.vercel.app/api/chat
                 Body (JSON): {`{"id": "${gameId}", "text": "Good luck!"}`}
              2. Request to resign: POST https://chesswithclaw.vercel.app/api/chat
                 Body (JSON): {`{"id": "${gameId}", "text": "I am completely lost. Do you accept my resignation?", "type": "resign_request"}`}
                 (This will show an Accept Resignation button to the human in the app)
              {'\n\n'}<span style={{ color: '#e63946', fontWeight: 600 }}>IMPORTANT BEHAVIOR RULES:</span>
              1. You are BLACK. White moves first.
              2. When you join this match, stay here and focus ONLY on playing chess with your user. Do other tasks later.
              3. If your user forgets they are playing with you (takes too long to move), remind them using the chat channel you are connected to (Telegram, Discord, Slack, etc.).
            </pre>
          </div>

          <button
            onClick={handleCopy}
            style={{
              width: '100%',
              height: '38px',
              background: '#151515',
              border: `1px solid ${copyState === 'copied' ? 'rgba(34,197,94,0.25)' : '#1e1e1e'}`,
              borderRadius: '8px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              transition: 'all 130ms',
              touchAction: 'manipulation',
              userSelect: 'none',
              color: copyState === 'copied' ? '#22c55e' : '#555',
              opacity: copyState === 'loading' ? 0.5 : 1,
              pointerEvents: copyState === 'loading' ? 'none' : 'auto'
            }}
          >
            {copyState === 'copied' ? '✓ Copied!' : '📋 Copy Invite'}
          </button>
        </div>

        {/* CARD 2 — OPEN BOARD */}
        <div style={{
          background: '#111111',
          border: '1px solid #1c1c1c',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '8px'
        }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(230,57,70,0.1)',
            border: '1px solid rgba(230,57,70,0.15)',
            borderRadius: '5px',
            padding: '2px 7px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            color: '#e63946',
            marginBottom: '10px'
          }}>2</div>
          
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '18px',
            fontWeight: 700,
            color: '#f0f0f0',
            letterSpacing: '0.3px',
            marginBottom: '5px'
          }}>Open the Board</h2>
          
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: '#555',
            lineHeight: 1.5,
            marginBottom: '12px'
          }}>Your game board is ready. Open it in a new tab.</p>

          <button
            onClick={handleOpenBoard}
            className={!boardOpened ? "hover:bg-[#cc2f3b]" : ""}
            style={{
              background: boardOpened ? 'rgba(34,197,94,0.08)' : '#e63946',
              color: boardOpened ? '#22c55e' : 'white',
              width: '100%',
              height: '42px',
              borderRadius: '8px',
              border: boardOpened ? '1px solid rgba(34,197,94,0.18)' : 'none',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '0.3px',
              cursor: boardOpened ? 'default' : 'pointer',
              transition: 'background 120ms',
              pointerEvents: boardOpened ? 'none' : 'auto'
            }}
          >
            {boardOpened ? '✓ Board Open' : 'OPEN BOARD →'}
          </button>
        </div>

      </div>
    </div>
  );
}
