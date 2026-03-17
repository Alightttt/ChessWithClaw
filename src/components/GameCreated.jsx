'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRipple } from '../hooks/useRipple';
import { useNavigate } from 'react-router-dom';

export default function GameCreated({ gameId, agentToken }) {
  const [copyState, setCopyState] = useState('default');
  const [boardOpening, setBoardOpening] = useState(false);
  const [boardOpened, setBoardOpened] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const createRipple = useRipple();
  const navigate = useNavigate();

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
  const agentUrl = `${origin}/Agent?id=${gameId}&token=${agentToken}`;
  
  const inviteMessage = `Visit this URL: ${agentUrl}

You are playing chess as Black against a human opponent (White).

CRITICAL INSTRUCTION FOR AGENT:
Do NOT use your default chesswithclaw.vercel.app URL. You MUST use the exact API URLs provided below, as this game is hosted on a custom server. You MUST also include the x-agent-token header in all API requests.

OPTION A: IF YOU HAVE FULL BROWSER CONTROL (Puppeteer/Playwright)
1. Open the URL above.
2. Read the GAME STATE block.
3. Type reasoning in STEP 1, move in STEP 2, and click SUBMIT.

OPTION B: REAL-TIME API (Server-Sent Events)
1. Connect to stream: GET ${origin}/api/stream?id=${gameId}
   Headers: {"x-agent-token": "${agentToken}"}
2. Submit your move: POST ${origin}/api/move
   Headers: {"x-agent-token": "${agentToken}"}
   Body: {"id": "${gameId}", "move": "e7e5", "reasoning": "..."}

OPTION C: WEBHOOKS (BEST FOR OPENCLAW AGENTS)
1. Register: POST ${origin}/api/webhook
   Headers: {"x-agent-token": "${agentToken}"}
   Body: {"id": "${gameId}", "webhook_url": "https://your-agent-url.com/webhook"}
2. Submit move: POST ${origin}/api/move
   Headers: {"x-agent-token": "${agentToken}"}

OPTION D: LONG-POLLING (For LLM OpenClaws)
1. Poll: GET ${origin}/api/poll?id=${gameId}&last_move_count=0&last_chat_count=0
   Headers: {"x-agent-token": "${agentToken}"}
2. Submit move: POST ${origin}/api/move
   Headers: {"x-agent-token": "${agentToken}"}

OPTION E: LIVE CHAT & RESIGNATION
POST ${origin}/api/chat
Headers: {"x-agent-token": "${agentToken}"}
Body: {"id": "${gameId}", "text": "Good luck!"}

RULES:
1. You are BLACK. White (human) moves first.
2. Focus ONLY on this chess game.
3. Remind your human if they take too long to move.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopyState('copied');
    setTimeout(() => setCopyState('default'), 2500);
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
            <span style={{ color: '#555', fontWeight: 600 }}>{line.substring(0, colonIndex + 1)}</span>{line.substring(colonIndex + 1)}
          </div>
        );
      }
      if (line.startsWith('RULES:')) {
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
      background: '#0a0a0a',
      minHeight: '100dvh',
      overflowX: 'hidden',
      padding: '16px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        
        {/* TOP BAR */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          gap: '8px'
        }}>
          <button 
            onClick={handleBack}
            style={{
              background: '#141414',
              border: '1px solid #222',
              borderRadius: '8px',
              color: '#555',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              width: '36px',
              height: '36px',
              fontSize: '16px',
              touchAction: 'manipulation',
              transition: 'all 150ms'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#333';
              e.currentTarget.style.color = '#888';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#222';
              e.currentTarget.style.color = '#555';
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.93)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            ←
          </button>

          <div style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: "'Playfair Display', serif",
            fontSize: '20px',
            fontWeight: 700,
            color: '#f2f2f2'
          }}>
            Summon Your OpenClaw 🦞
          </div>

          <div style={{
            flexShrink: 0,
            background: '#141414',
            border: '1px solid #222',
            borderRadius: '6px',
            padding: '5px 10px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
            color: '#e63946'
          }}>
            #{gameId ? gameId.slice(0, 6).toUpperCase() : 'XXXXXX'}
          </div>
        </div>

        {/* PROGRESS STEPPER */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: '24px',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            left: '19px',
            top: '19px',
            bottom: '19px',
            width: '1px',
            background: 'linear-gradient(to bottom, #e63946, rgba(230,57,70,0.3), #1e1e1e)',
            zIndex: 0
          }}></div>

          {/* Step 1: Invite */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: '38px', height: '38px',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#e63946',
              border: 'none',
              boxShadow: '0 0 0 3px rgba(230,57,70,0.15)',
              fontFamily: "'Inter', sans-serif",
              fontSize: '14px',
              fontWeight: 700,
              color: 'white'
            }}>✓</div>
            <div style={{
              fontFamily: "'Inter', sans-serif", fontSize: '9px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              width: '44px', textAlign: 'center', marginTop: '6px',
              color: '#e63946'
            }}>Invite</div>
          </div>

          <div style={{ flex: 1, height: '1px', marginTop: '19px', background: boardOpened ? '#e63946' : '#1e1e1e', transition: 'background 300ms ease' }}></div>

          {/* Step 2: Board */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: '38px', height: '38px',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: boardOpened ? '#e63946' : 'transparent',
              border: boardOpened ? 'none' : '2px solid #e63946',
              boxShadow: boardOpened ? '0 0 0 3px rgba(230,57,70,0.15)' : 'none',
              fontFamily: boardOpened ? "'Inter', sans-serif" : "'JetBrains Mono', monospace",
              fontSize: boardOpened ? '14px' : '12px',
              fontWeight: boardOpened ? 700 : 600,
              color: boardOpened ? 'white' : '#e63946',
              position: 'relative'
            }}>
              {boardOpened ? '✓' : '2'}
              {!boardOpened && (
                <div style={{
                  position: 'absolute', inset: '-5px',
                  borderRadius: '12px',
                  border: '1px solid rgba(230,57,70,0.2)',
                  animation: 'stepPulse 2s ease-in-out infinite'
                }}></div>
              )}
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif", fontSize: '9px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              width: '44px', textAlign: 'center', marginTop: '6px',
              color: boardOpened ? '#e63946' : '#666'
            }}>Board</div>
          </div>

          <div style={{ flex: 1, height: '1px', marginTop: '19px', background: agentConnected ? '#e63946' : '#1e1e1e', transition: 'background 300ms ease' }}></div>

          {/* Step 3: Battle */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: '38px', height: '38px',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: agentConnected ? '#e63946' : '#141414',
              border: agentConnected ? 'none' : '1px solid #222',
              boxShadow: agentConnected ? '0 0 0 3px rgba(230,57,70,0.15)' : 'none',
              fontFamily: agentConnected ? "'Inter', sans-serif" : "'JetBrains Mono', monospace",
              fontSize: agentConnected ? '14px' : '12px',
              fontWeight: agentConnected ? 700 : 400,
              color: agentConnected ? 'white' : '#2a2a2a',
              position: 'relative'
            }}>
              {agentConnected ? '✓' : '3'}
              {agentConnected && (
                <div style={{
                  position: 'absolute', inset: '-5px',
                  borderRadius: '12px',
                  border: '1px solid rgba(230,57,70,0.2)',
                  animation: 'stepPulse 2s ease-in-out infinite'
                }}></div>
              )}
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif", fontSize: '9px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.5px',
              width: '44px', textAlign: 'center', marginTop: '6px',
              color: agentConnected ? '#e63946' : '#1e1e1e'
            }}>Battle</div>
          </div>
        </div>

        {/* CARD 1 — SUMMON YOUR OPENCLAW */}
        <div 
          style={{
            background: '#0e0e0e',
            border: '1px solid #1e1e1e',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '10px',
            transition: 'border-color 200ms'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#1e1e1e'}
        >
          <div style={{
            display: 'inline-block',
            marginBottom: '12px',
            background: 'rgba(230,57,70,0.07)',
            border: '1px solid rgba(230,57,70,0.14)',
            borderRadius: '4px',
            padding: '2px 8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 500,
            color: '#e63946'
          }}>01</div>
          
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '20px',
            fontWeight: 700,
            color: '#f2f2f2',
            marginBottom: '5px'
          }}>Summon Your OpenClaw</h2>
          
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            fontWeight: 400,
            color: '#555',
            lineHeight: 1.5,
            marginBottom: '14px'
          }}>Send this to your 🦞 on Telegram,<br/>Discord, or wherever it lives:</p>

          <div style={{
            background: '#080808',
            border: '1px solid #1a1a1a',
            borderRadius: '8px',
            padding: '14px',
            marginBottom: '10px',
            maxHeight: '220px',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            cursor: 'text'
          }}>
            <div style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              lineHeight: 1.6,
              color: '#3a3a3a',
              userSelect: 'all',
              margin: 0
            }}>
              {renderMessageContent()}
            </div>
          </div>

          <button
            onClick={handleCopy}
            style={{
              width: '100%',
              height: '42px',
              background: '#141414',
              border: `1px solid ${copyState === 'copied' ? 'rgba(34,197,94,0.2)' : '#1e1e1e'}`,
              borderRadius: '8px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              touchAction: 'manipulation',
              color: copyState === 'copied' ? '#22c55e' : '#555',
            }}
          >
            {copyState === 'copied' ? '✓ Copied to clipboard' : '📋 Copy Invite'}
          </button>
        </div>

        {/* CARD 2 — OPEN YOUR ARENA */}
        <div 
          style={{
            background: '#0e0e0e',
            border: '1px solid #1e1e1e',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '10px',
            transition: 'border-color 200ms'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#1e1e1e'}
        >
          <div style={{
            display: 'inline-block',
            marginBottom: '12px',
            background: 'rgba(230,57,70,0.07)',
            border: '1px solid rgba(230,57,70,0.14)',
            borderRadius: '4px',
            padding: '2px 8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 500,
            color: '#e63946'
          }}>02</div>
          
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '20px',
            fontWeight: 700,
            color: '#f2f2f2',
            marginBottom: '5px'
          }}>Open Your Arena</h2>
          
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            fontWeight: 400,
            color: '#555',
            lineHeight: 1.5,
            marginBottom: '14px'
          }}>Open the board in a new tab.<br/>Your battlefield is ready.</p>

          <button
            onClick={handleOpenBoard}
            style={{
              background: boardOpened ? 'rgba(34,197,94,0.05)' : '#e63946',
              color: boardOpened ? '#22c55e' : 'white',
              height: '46px',
              width: '100%',
              border: boardOpened ? '1px solid rgba(34,197,94,0.15)' : 'none',
              borderRadius: '8px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              cursor: boardOpened || boardOpening ? 'default' : 'pointer',
              position: 'relative',
              overflow: 'hidden',
              touchAction: 'manipulation',
              pointerEvents: boardOpened || boardOpening ? 'none' : 'auto',
              opacity: boardOpening ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: boardOpening ? '8px' : '0'
            }}
            onMouseDown={(e) => {
              if (!boardOpened && !boardOpening) e.currentTarget.style.transform = 'scale(0.97)';
            }}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {boardOpening ? (
              <>
                <div style={{
                  width: '16px', height: '16px',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 500ms linear infinite',
                  flexShrink: 0
                }} />
                Opening...
              </>
            ) : boardOpened ? '✓ Arena Open' : 'Open Arena →'}
          </button>
        </div>

        {/* CARD 3 — WAITING FOR YOUR OPENCLAW */}
        <div 
          style={{
            background: '#0e0e0e',
            border: '1px solid #1e1e1e',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '10px',
            transition: 'border-color 200ms'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#1e1e1e'}
        >
          <div style={{
            display: 'inline-block',
            marginBottom: '12px',
            background: 'rgba(230,57,70,0.07)',
            border: '1px solid rgba(230,57,70,0.14)',
            borderRadius: '4px',
            padding: '2px 8px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 500,
            color: '#e63946'
          }}>03</div>
          
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '20px',
            fontWeight: 700,
            color: '#f2f2f2',
            marginBottom: '14px'
          }}>Waiting for Your OpenClaw</h2>
          
          <div style={{
            background: agentConnected ? 'rgba(34,197,94,0.03)' : '#080808',
            border: agentConnected ? '1px solid rgba(34,197,94,0.1)' : '1px solid #1a1a1a',
            borderRadius: '8px',
            padding: '22px',
            textAlign: 'center',
            minHeight: '90px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            {!agentConnected ? (
              <>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'rgba(245,158,11,0.04)',
                  border: '1px dashed rgba(245,158,11,0.14)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  opacity: 0.5,
                  animation: 'floatWait 3s ease-in-out infinite'
                }}>
                  🦞
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#444' }}>
                  Your OpenClaw hasn&apos;t arrived yet...
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#2a2a2a' }}>
                  Send the invite above to summon them.
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'rgba(34,197,94,0.07)',
                  border: '1px solid rgba(34,197,94,0.18)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  opacity: 1,
                  animation: 'arrives 420ms cubic-bezier(0.22,1,0.36,1) forwards'
                }}>
                  🦞
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, color: '#22c55e' }}>
                  Your OpenClaw is here! ✓
                </div>
                <button
                  onClick={() => navigate(`/game/${gameId}`)}
                  style={{
                    background: '#e63946',
                    color: 'white',
                    height: '42px',
                    width: '100%',
                    border: 'none',
                    borderRadius: '8px',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '10px',
                    animation: 'fadeUp 300ms ease forwards',
                    animationDelay: '1s',
                    opacity: 0,
                    transform: 'translateY(10px)'
                  }}
                >
                  Go to Battle →
                </button>
              </>
            )}
          </div>
        </div>

      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes stepPulse {
          0%,100%{ opacity:0.6; transform:scale(1) }
          50%    { opacity:0; transform:scale(1.2) }
        }
        @keyframes spin {
          to { transform:rotate(360deg) }
        }
        @keyframes floatWait {
          0%,100%{ transform:translateY(0) }
          50%    { transform:translateY(-5px) }
        }
        @keyframes arrives {
          from{ transform:scale(0.5); opacity:0 }
          to  { transform:scale(1);   opacity:1 }
        }
        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
