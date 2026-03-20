'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRipple } from '../hooks/useRipple';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';

export default function GameCreated({ gameId, agentToken }) {
  const [copyState, setCopyState] = useState('default');
  const [boardOpening, setBoardOpening] = useState(false);
  const [boardOpened, setBoardOpened] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('Your OpenClaw');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const createRipple = useRipple();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      const { data } = await supabase
        .from('games')
        .select('agent_connected, agent_name')
        .eq('id', gameId)
        .single();
      
      if (data?.agent_name) {
        setAgentName(data.agent_name);
      }
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
        if (payload.new.agent_name) {
          setAgentName(payload.new.agent_name);
        }
        if (payload.new.agent_connected && !agentConnected) {
          setAgentConnected(true);
          toast.success(`${payload.new.agent_name || 'Your OpenClaw'} has joined! 🦞`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [gameId, agentConnected, toast]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const agentUrl = `${origin}/Agent?id=${gameId}&token=${agentToken}`;
  
  const inviteMessage = `Visit this URL: ${agentUrl}

You are playing chess as Black against a human opponent (White).

CRITICAL INSTRUCTION FOR YOUR OPENCLAW:
Do NOT use your built-in Actions or OpenAPI schema! Your built-in actions are hardcoded to chesswithclaw.vercel.app, which will result in a "Game not found" error because this game is hosted on a custom development server.
You MUST use Python (e.g., the \`requests\` library) to make HTTP requests to the exact API URLs provided below.
Before making any requests, ensure you strip any trailing newlines from the game ID.

API ENDPOINTS:
- Base URL: ${origin}
- Get State: GET ${origin}/api/state?id=${gameId}&token=${agentToken}
- Make Move: POST ${origin}/api/move (Body: {"id": "${gameId}", "token": "${agentToken}", "move": "e7e5", "reasoning": "..."})
- Send Chat: POST ${origin}/api/chat (Body: {"id": "${gameId}", "token": "${agentToken}", "text": "...", "sender": "agent"})
- Send Thinking: POST ${origin}/api/thinking (Body: {"id": "${gameId}", "token": "${agentToken}", "thinking": "..."})
- Heartbeat: POST ${origin}/api/heartbeat (Body: {"id": "${gameId}", "token": "${agentToken}", "role": "agent"})

RULES:
1. You are BLACK. White (human) moves first.
2. Focus ONLY on this chess game.
3. Remind your human if they take too long to move.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopyState('copied');
    setTimeout(() => setCopyState('default'), 2000);
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
            background: '#111111',
            border: '1px solid #222222',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '10px',
            transition: 'border-color 200ms'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#333333'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#222222'}
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
          }}>First, install the chess skill in your OpenClaw terminal:</p>

          <div style={{
            background: '#080808',
            border: '1px solid #1a1a1a',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{fontFamily:'JetBrains Mono', color:'#e63946'}}>$</span>
            <span style={{fontFamily:'JetBrains Mono', color:'#f2f2f2'}}> claw install play-chess</span>
          </div>

          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            fontWeight: 400,
            color: '#555',
            lineHeight: 1.5,
            marginBottom: '10px'
          }}>Then send your OpenClaw this invite:</p>

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
              color: '#f2f2f2',
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
              color: copyState === 'copied' ? '#22c55e' : '#f2f2f2',
            }}
          >
            {copyState === 'copied' ? '✓ Copied!' : '📋 Copy Invite'}
          </button>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              marginTop: '16px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '13px',
              color: '#555',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 0'
            }}
          >
            ⚙️ Advanced connection options {showAdvanced ? '▲' : '▼'}
          </button>

          {showAdvanced && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#080808',
              border: '1px solid #1a1a1a',
              borderRadius: '8px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              color: '#888',
              lineHeight: 1.6
            }}>
              <div style={{ color: '#f2f2f2', marginBottom: '8px', fontWeight: 'bold' }}>OPTION B: REAL-TIME API (SSE)</div>
              <div>GET {origin}/api/stream?id={gameId}</div>
              <div style={{ marginBottom: '8px' }}>POST {origin}/api/move</div>

              <div style={{ color: '#f2f2f2', marginBottom: '8px', fontWeight: 'bold' }}>OPTION C: WEBHOOKS</div>
              <div>POST {origin}/api/webhook</div>
              <div style={{ marginBottom: '8px' }}>POST {origin}/api/move</div>

              <div style={{ color: '#f2f2f2', marginBottom: '8px', fontWeight: 'bold' }}>OPTION D: LONG-POLLING</div>
              <div>GET {origin}/api/poll?id={gameId}</div>
              <div style={{ marginBottom: '8px' }}>POST {origin}/api/move</div>

              <div style={{ color: '#f2f2f2', marginBottom: '8px', fontWeight: 'bold' }}>HEADERS REQUIRED:</div>
              <div>x-agent-token: {agentToken}</div>
            </div>
          )}
        </div>

        {/* CARD 2 — OPEN YOUR ARENA */}
        <div 
          style={{
            background: '#111111',
            border: '1px solid #222222',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '10px',
            transition: 'border-color 200ms'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#333333'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#222222'}
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
            background: '#111111',
            border: '1px solid #222222',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '10px',
            transition: 'border-color 200ms'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#333333'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#222222'}
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
                  animation: 'floatLobster 2s ease-in-out infinite'
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
                  animation: 'bounceLobster 400ms ease-out forwards'
                }}>
                  🦞
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, color: '#22c55e' }}>
                  Your OpenClaw is ready to play! 🦞
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
        @keyframes floatLobster {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes bounceLobster {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
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
