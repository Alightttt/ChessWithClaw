'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRipple } from '../hooks/useRipple';

export default function GameCreated({ gameId, agentToken }) {
  const [copyState, setCopyState] = useState('default');
  const [boardOpening, setBoardOpening] = useState(false);
  const [boardOpened, setBoardOpened] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const createRipple = useRipple();

  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      const { data } = await supabase
        .from('games')
        .select('agent_connected')
        .eq('id', gameId)
        .single();
      
      if (data?.agent_connected) {
        setAgentConnected(true);
      }
    };
    fetchGame();

    const subscription = supabase
      .channel(`game-${gameId}-created`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, (payload) => {
        if (payload.new.agent_connected) {
          setAgentConnected(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [gameId]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const agentUrl = `${origin}/Agent?id=${gameId}`;
  
  const inviteMessage = `Visit this URL: ${agentUrl}

You are playing chess as Black against a human opponent (White).

OPTION A: IF YOU HAVE FULL BROWSER CONTROL (Puppeteer/Playwright)
1. Open the URL above.
2. Read the GAME STATE block.
3. Type reasoning in STEP 1, move in STEP 2, and click SUBMIT.

OPTION B: REAL-TIME API (Server-Sent Events)
1. Connect to stream: GET ${origin}/api/stream?id=${gameId}
   (You will receive a continuous stream of JSON updates when the game changes)
2. Submit your move: POST ${origin}/api/move
   Body (JSON): {"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION C: WEBHOOKS (BEST FOR AGENTS)
If you cannot maintain a persistent connection, register a webhook to receive push notifications when it's your turn or when the human chats.
1. Register webhook: POST ${origin}/api/webhook
   Body (JSON): {"id": "${gameId}", "webhook_url": "https://your-agent-url.com/webhook"}
2. Submit your move: POST ${origin}/api/move
   Body (JSON): {"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION D: FOR LLM AGENTS (Long-Polling)
If you cannot use webhooks or SSE:
1. Poll for updates: GET ${origin}/api/poll?id=${gameId}&last_move_count=0&last_chat_count=0
   (Pass the move_count and chat_count from the previous response. This request will wait up to 8 seconds for the human to move or chat, then return the new state. If no change, it returns {"event": "timeout"}. Loop this request!)
2. Submit your move: POST ${origin}/api/move
   Body (JSON): {"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION E: LIVE CHAT & RESIGNATION
1. Send a chat message: POST ${origin}/api/chat
   Body (JSON): {"id": "${gameId}", "text": "Good luck!"}
2. Request to resign: POST ${origin}/api/chat
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
      .catch(() => setCopyState('default'));
  };

  const handleOpenBoard = (e) => {
    if (boardOpened || boardOpening) return;
    createRipple(e);
    setBoardOpening(true);
    window.open(`/game/${gameId}`, '_blank');
    setTimeout(() => {
      setBoardOpening(false);
      setBoardOpened(true);
    }, 1400);
  };

  const handleBack = () => {
    window.location.href = '/';
  };

  const renderMessageContent = () => {
    const lines = inviteMessage.split('\n');
    return lines.map((line, i) => {
      if (i === 0) {
        return (
          <div key={i}>
            Visit this URL: <span style={{ color: '#e63946' }}>{agentUrl}</span>
          </div>
        );
      }
      if (line.startsWith('OPTION A:') || line.startsWith('OPTION B:') || line.startsWith('OPTION C:') || line.startsWith('OPTION D:') || line.startsWith('OPTION E:')) {
        const colonIndex = line.indexOf(':');
        return (
          <div key={i}>
            <span style={{ color: '#666', fontWeight: 600 }}>{line.substring(0, colonIndex + 1)}</span>{line.substring(colonIndex + 1)}
          </div>
        );
      }
      if (line.startsWith('IMPORTANT BEHAVIOR RULES:')) {
        return (
          <div key={i}>
            <span style={{ color: '#e63946', fontWeight: 600 }}>{line}</span>
          </div>
        );
      }
      return <div key={i}>{line || ' '}</div>;
    });
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
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          gap: '8px'
        }}>
          <button 
            onClick={handleBack}
            className="hover:border-[#2a2a2a] hover:text-[#888] active:scale-[0.94]"
            style={{
              background: '#111',
              border: '1px solid #1c1c1c',
              borderRadius: '8px',
              color: '#444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              width: '34px',
              height: '34px',
              fontSize: '16px',
              touchAction: 'manipulation',
              transition: 'all 150ms'
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
            Summon Your Agent 🦞
          </div>

          <div style={{
            flexShrink: 0,
            background: '#111',
            border: '1px solid #1c1c1c',
            borderRadius: '8px',
            padding: '5px 10px',
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
          padding: '0 4px',
          marginBottom: '22px',
          position: 'relative'
        }}>
          {/* Step 1: Ready */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '38px', height: '38px',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#e63946',
              border: 'none',
              boxShadow: '0 0 12px rgba(230,57,70,0.28)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              fontWeight: 700,
              color: 'white'
            }}>✓</div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '9px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              width: '44px', textAlign: 'center', marginLeft: '-3px',
              color: '#e63946'
            }}>Ready</div>
          </div>

          <div style={{ flex: 1, height: '1px', marginTop: '19px', background: boardOpened ? '#e63946' : '#1a1a1a', transition: 'background 300ms ease' }}></div>

          {/* Step 2: Board */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '38px', height: '38px',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: boardOpened ? '#e63946' : 'transparent',
              border: boardOpened ? 'none' : '2px solid #e63946',
              boxShadow: boardOpened ? '0 0 12px rgba(230,57,70,0.28)' : 'none',
              fontFamily: boardOpened ? "'DM Sans', sans-serif" : "'JetBrains Mono', monospace",
              fontSize: boardOpened ? '14px' : '12px',
              fontWeight: boardOpened ? 700 : 600,
              color: boardOpened ? 'white' : '#e63946',
              position: 'relative'
            }}>
              {boardOpened ? '✓' : '2'}
              {!boardOpened && (
                <div style={{
                  position: 'absolute', inset: '-5px',
                  borderRadius: '14px',
                  border: '1px solid rgba(230,57,70,0.22)',
                  animation: 'stepPulse 2s ease-in-out infinite'
                }}></div>
              )}
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '9px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              width: '44px', textAlign: 'center', marginLeft: '-3px',
              color: boardOpened ? '#e63946' : '#666'
            }}>Board</div>
          </div>

          <div style={{ flex: 1, height: '1px', marginTop: '19px', background: agentConnected ? '#e63946' : '#1a1a1a', transition: 'background 300ms ease' }}></div>

          {/* Step 3: Battle */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '38px', height: '38px',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: agentConnected ? 'transparent' : '#111',
              border: agentConnected ? '2px solid #e63946' : '1px solid #1c1c1c',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '12px',
              fontWeight: agentConnected ? 600 : 400,
              color: agentConnected ? '#e63946' : '#252525',
              position: 'relative'
            }}>
              3
              {agentConnected && (
                <div style={{
                  position: 'absolute', inset: '-5px',
                  borderRadius: '14px',
                  border: '1px solid rgba(230,57,70,0.22)',
                  animation: 'stepPulse 2s ease-in-out infinite'
                }}></div>
              )}
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '9px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              width: '44px', textAlign: 'center', marginLeft: '-3px',
              color: agentConnected ? '#666' : '#1e1e1e'
            }}>Battle</div>
          </div>
        </div>

        {/* CARD 1 — INVITE YOUR OPENCLAW */}
        <div style={{
          background: '#111111',
          border: '1px solid #1c1c1c',
          borderRadius: '14px',
          padding: '18px',
          marginBottom: '10px'
        }}>
          <div style={{
            display: 'inline-block',
            marginBottom: '12px',
            background: 'rgba(230,57,70,0.08)',
            border: '1px solid rgba(230,57,70,0.14)',
            borderRadius: '5px',
            padding: '2px 8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 500,
            color: '#e63946'
          }}>01</div>
          
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '20px',
            fontWeight: 700,
            color: '#f0f0f0',
            letterSpacing: '0.3px',
            marginBottom: '5px'
          }}>Invite Your OpenClaw</h2>
          
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: '#3e3e3e',
            lineHeight: 1.5,
            marginBottom: '14px'
          }}>Send this to your agent wherever it lives — Telegram, Discord, anywhere:</p>

          <div style={{
            background: '#0c0c0c',
            border: '1px solid #181818',
            borderRadius: '10px',
            padding: '13px',
            marginBottom: '10px',
            maxHeight: '240px',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            cursor: 'text'
          }}>
            <div style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              lineHeight: 1.65,
              color: '#3e3e3e',
              userSelect: 'all',
              margin: 0
            }}>
              {renderMessageContent()}
            </div>
          </div>

          <button
            onClick={handleCopy}
            className="active:scale-[0.97]"
            style={{
              width: '100%',
              height: '40px',
              background: '#141414',
              border: `1px solid ${copyState === 'copied' ? 'rgba(34,197,94,0.22)' : '#1e1e1e'}`,
              borderRadius: '9px',
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
              color: copyState === 'copied' ? '#22c55e' : '#444',
              opacity: copyState === 'loading' ? 0.5 : 1,
              pointerEvents: copyState === 'loading' ? 'none' : 'auto'
            }}
          >
            {copyState === 'copied' ? '✓ Copied!' : '📋 Copy Invite'}
          </button>
        </div>

        {/* CARD 2 — OPEN CHESSBOARD */}
        <div style={{
          background: '#111111',
          border: '1px solid #1c1c1c',
          borderRadius: '14px',
          padding: '18px',
          marginBottom: '10px'
        }}>
          <div style={{
            display: 'inline-block',
            marginBottom: '12px',
            background: 'rgba(230,57,70,0.08)',
            border: '1px solid rgba(230,57,70,0.14)',
            borderRadius: '5px',
            padding: '2px 8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 500,
            color: '#e63946'
          }}>02</div>
          
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '20px',
            fontWeight: 700,
            color: '#f0f0f0',
            letterSpacing: '0.3px',
            marginBottom: '5px'
          }}>Open Chessboard</h2>
          
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            color: '#3e3e3e',
            lineHeight: 1.5,
            marginBottom: '14px'
          }}>Your Chessboard is set.<br/>Open it in a new tab to begin.</p>

          <button
            onClick={handleOpenBoard}
            className={!boardOpened && !boardOpening ? "active:scale-[0.97]" : ""}
            style={{
              background: boardOpened ? 'rgba(34,197,94,0.06)' : '#e63946',
              color: boardOpened ? '#22c55e' : 'white',
              height: '44px',
              width: '100%',
              border: boardOpened ? '1px solid rgba(34,197,94,0.18)' : 'none',
              borderRadius: '9px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '0.3px',
              cursor: boardOpened || boardOpening ? 'default' : 'pointer',
              position: 'relative',
              overflow: 'hidden',
              touchAction: 'manipulation',
              pointerEvents: boardOpened || boardOpening ? 'none' : 'auto',
              opacity: boardOpening ? 0.75 : 1,
              display: boardOpening ? 'flex' : 'block',
              alignItems: boardOpening ? 'center' : 'initial',
              justifyContent: boardOpening ? 'center' : 'initial',
              gap: boardOpening ? '8px' : '0'
            }}
          >
            {boardOpening ? (
              <>
                <div style={{
                  width: '16px', height: '16px',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 500ms linear infinite',
                  flexShrink: 0,
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  marginRight: '8px'
                }} />
                Opening...
              </>
            ) : boardOpened ? '✓ Arena Open' : 'OPEN ARENA →'}
          </button>
        </div>

      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes rippleAnim {
          to { transform:scale(2.5); opacity:0 }
        }
        @keyframes presencePing {
          0%  { box-shadow:0 0 0 0 rgba(230,57,70,0.25) }
          70% { box-shadow:0 0 0 10px rgba(230,57,70,0) }
          100%{ box-shadow:0 0 0 0 rgba(230,57,70,0) }
        }
        @keyframes dotPulse {
          0%,100%{ opacity:1; transform:scale(1) }
          50%    { opacity:0.3; transform:scale(0.7) }
        }
        @keyframes cursorBlink {
          0%,100%{ opacity:1 } 50%{ opacity:0 }
        }
        @keyframes stepPulse {
          0%,100%{ opacity:0.6; transform:scale(1) }
          50%    { opacity:0; transform:scale(1.2) }
        }
        @keyframes spin {
          to { transform:rotate(360deg) }
        }
        @keyframes floatWait {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
        @keyframes agentArrives {
          0% { transform: scale(0.8) translateY(10px); opacity: 0; }
          60% { transform: scale(1.1) translateY(-5px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}} />
    </div>
  );
}
