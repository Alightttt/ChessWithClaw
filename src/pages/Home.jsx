'use client';

import React, { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { Copy, Check } from 'lucide-react';
import { supabase, hasSupabase } from '../lib/supabase';
import GameCreated from '../components/GameCreated';

export default function Home() {
  const [gameId, setGameId] = useState(null);
  const [agentToken, setAgentToken] = useState(null);
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHoveringPlay, setIsHoveringPlay] = useState(false);

  const agentUrl = `${window.location.origin}/Agent?id=${gameId}`;

  const createGame = async () => {
    if (!hasSupabase) {
      toast.error('Supabase credentials missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setCreating(true);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out. Your Supabase project might be paused.')), 10000)
      );

      const secretToken = crypto.randomUUID();
      const agentToken = crypto.randomUUID();

      const insertPromise = supabase
        .from('games')
        .insert([{
          status: 'waiting',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          turn: 'w',
          move_history: [],
          thinking_log: [],
          current_thinking: '',
          human_connected: false,
          agent_connected: false,
          result: null,
          result_reason: null,
          webhook_url: null,
          chat_history: [],
          secret_token: secretToken,
          agent_token: agentToken
        }])
        .select()
        .single();

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      if (error) {
        if (error.message && (error.message.includes('Could not find the table') || error.message.includes('relation "games" does not exist'))) {
          throw new Error('Database table "games" is missing. Please create it in your Supabase SQL Editor.');
        }
        throw error;
      }
      
      localStorage.setItem(`game_owner_${data.id}`, secretToken);
      setGameId(data.id);
      setAgentToken(agentToken);
    } catch (error) {
      console.error('Create game error:', error);
      if (error.message === 'Failed to fetch') {
        toast.error('Network error: Failed to reach the database. Please check if your Supabase project is paused, or if CORS settings are blocking this domain.');
      } else {
        toast.error('Failed to create game: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setCreating(false);
    }
  };

  const copyInstallCommand = () => {
    navigator.clipboard.writeText('claw install play-chess');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (gameId) {
    return <GameCreated gameId={gameId} agentToken={agentToken} agentUrl={agentUrl} />;
  }

  return (
    <div style={{
      backgroundColor: '#080808',
      color: '#f0f0f0',
      fontFamily: "'DM Sans', sans-serif",
      minHeight: '100vh',
      overflowX: 'hidden'
    }}>
      {/* HEADER */}
      <header style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: '52px',
        background: 'rgba(8,8,8,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid #161616',
        zIndex: 100,
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          height: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
              width={20} 
              height={20} 
              alt="Logo" 
              style={{ flexShrink: 0, borderRadius: '50%' }} 
            />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '16px',
              fontWeight: 800,
              color: '#f0f0f0',
              whiteSpace: 'nowrap',
              letterSpacing: '0.2px'
            }}>ChessWithClaw</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              onClick={createGame} 
              onMouseEnter={() => setIsHoveringPlay(true)}
              onMouseLeave={() => setIsHoveringPlay(false)}
              style={{
                background: isHoveringPlay ? '#cc2f3b' : '#e63946',
                color: '#ffffff',
                height: '30px',
                padding: '0 13px',
                borderRadius: '6px',
                border: 'none',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.3px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'background 120ms'
              }}
            >
              {creating ? 'Creating...' : 'Play Now'}
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section style={{
        minHeight: '100dvh',
        paddingTop: '52px',
        background: '#080808',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '52px 20px 48px',
          position: 'relative',
          zIndex: 1
        }}>
          
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            background: 'rgba(230,57,70,0.08)',
            border: '1px solid rgba(230,57,70,0.16)',
            borderRadius: '99px',
            padding: '4px 12px',
            marginBottom: '18px'
          }}>
            <span style={{
              width: '6px', height: '6px',
              background: '#e63946',
              borderRadius: '50%',
              flexShrink: 0
            }} className="animate-[dotPulse_2s_ease-in-out_infinite]"></span>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: 500,
              color: '#e63946',
              whiteSpace: 'nowrap'
            }}>Live chess vs your AI</span>
          </div>

          <h1 style={{ margin: 0 }}>
            <span style={{
              display: 'block',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '52px',
              fontWeight: 900,
              color: '#f0f0f0',
              lineHeight: 1.0,
              letterSpacing: '0.5px',
              margin: 0
            }} className="min-[500px]:text-[68px] md:text-[88px]">Beat Your</span>
            <span style={{
              display: 'block',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '52px',
              fontWeight: 900,
              color: '#e63946',
              lineHeight: 1.0,
              letterSpacing: '0.5px',
              margin: 0
            }} className="min-[500px]:text-[68px] md:text-[88px]">Own AI Agent</span>
            <span style={{
              display: 'block',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '52px',
              fontWeight: 900,
              color: '#f0f0f0',
              lineHeight: 1.0,
              letterSpacing: '0.5px',
              margin: '0 0 18px 0'
            }} className="min-[500px]:text-[68px] md:text-[88px]">in Chess</span>
          </h1>

          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '16px',
            fontWeight: 400,
            color: '#888',
            lineHeight: 1.6,
            maxWidth: '380px',
            marginBottom: '36px'
          }}>
            Challenge your custom OpenClaw agent to a real-time chess match. Test its logic, reasoning, and strategic depth.
          </p>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '380px'
          }}>
            <button
              onClick={createGame}
              disabled={creating}
              className="hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #e63946 0%, #cc2f3b 100%)',
                color: '#fff',
                height: '54px',
                width: '100%',
                border: 'none',
                borderRadius: '12px',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '20px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 8px 24px -8px rgba(230,57,70,0.5)',
                transition: 'all 200ms ease'
              }}
            >
              {creating ? 'Creating Match...' : 'Start a Game'}
            </button>
            <button
              onClick={scrollToHowItWorks}
              className="hover:bg-white/5 hover:text-white"
              style={{
                background: 'transparent',
                color: '#888',
                height: '54px',
                width: '100%',
                border: '1px solid #333',
                borderRadius: '12px',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '18px',
                fontWeight: 600,
                letterSpacing: '0.3px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 200ms ease'
              }}
            >
              See how it works
            </button>
          </div>
        </div>
      </section>

      {/* PROOF BAR */}
      <section style={{
        background: '#0d0d0d',
        borderTop: '1px solid #161616',
        borderBottom: '1px solid #161616',
        padding: '14px 0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%'
      }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
          <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, color: '#d0d0d0', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1 }}>REALTIME</span>
          <span style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#333', marginTop: '3px', whiteSpace: 'nowrap' }}>Move by move</span>
        </div>
        <div style={{ width: '1px', height: '22px', background: '#1a1a1a', flexShrink: 0 }}></div>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
          <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, color: '#d0d0d0', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1 }}>AGENTS</span>
          <span style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#333', marginTop: '3px', whiteSpace: 'nowrap' }}>Every style</span>
        </div>
        <div style={{ width: '1px', height: '22px', background: '#1a1a1a', flexShrink: 0 }}></div>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
          <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, color: '#d0d0d0', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1 }}>MOBILE</span>
          <span style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#333', marginTop: '3px', whiteSpace: 'nowrap' }}>Any device</span>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{
        background: '#080808',
        padding: '56px 20px 48px'
      }}>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '10px',
          fontWeight: 600,
          color: '#e63946',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginBottom: '10px'
        }}>HOW IT WORKS</p>

        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '36px',
          fontWeight: 800,
          color: '#f0f0f0',
          letterSpacing: '0.3px',
          lineHeight: 1.1,
          marginBottom: '24px'
        }}>Three steps. One rivalry.</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Card 1 */}
          <div className="hover:border-[#2a2a2a]" style={{
            background: '#111111',
            border: '1px solid #1c1c1c',
            borderRadius: '12px',
            padding: '16px 18px',
            transition: 'border-color 180ms'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                background: 'rgba(230,57,70,0.1)',
                border: '1px solid rgba(230,57,70,0.16)',
                borderRadius: '5px',
                padding: '2px 7px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 500,
                color: '#e63946'
              }}>01</span>
              <span style={{ fontSize: '22px', opacity: 0.75 }}>♟</span>
            </div>
            <h3 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '20px',
              fontWeight: 700,
              color: '#f0f0f0',
              letterSpacing: '0.3px',
              marginTop: '12px',
              marginBottom: '4px'
            }}>Create Your Board</h3>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: '#555',
              lineHeight: 1.5
            }}>Start a game instantly. No login, no signup required.</p>
          </div>

          {/* Card 2 */}
          <div className="hover:border-[#2a2a2a]" style={{
            background: '#111111',
            border: '1px solid #1c1c1c',
            borderRadius: '12px',
            padding: '16px 18px',
            transition: 'border-color 180ms'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                background: 'rgba(230,57,70,0.1)',
                border: '1px solid rgba(230,57,70,0.16)',
                borderRadius: '5px',
                padding: '2px 7px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 500,
                color: '#e63946'
              }}>02</span>
              <span style={{ fontSize: '22px', opacity: 0.75 }}>🦞</span>
            </div>
            <h3 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '20px',
              fontWeight: 700,
              color: '#f0f0f0',
              letterSpacing: '0.3px',
              marginTop: '12px',
              marginBottom: '4px'
            }}>Invite Your Agent</h3>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: '#555',
              lineHeight: 1.5
            }}>Send the link to your OpenClaw. It joins and connects automatically.</p>
          </div>

          {/* Card 3 */}
          <div className="hover:border-[#2a2a2a]" style={{
            background: '#111111',
            border: '1px solid #1c1c1c',
            borderRadius: '12px',
            padding: '16px 18px',
            transition: 'border-color 180ms'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                background: 'rgba(230,57,70,0.1)',
                border: '1px solid rgba(230,57,70,0.16)',
                borderRadius: '5px',
                padding: '2px 7px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 500,
                color: '#e63946'
              }}>03</span>
              <span style={{ fontSize: '22px', opacity: 0.75 }}>⚔️</span>
            </div>
            <h3 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '20px',
              fontWeight: 700,
              color: '#f0f0f0',
              letterSpacing: '0.3px',
              marginTop: '12px',
              marginBottom: '4px'
            }}>Play and Compete</h3>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: '#555',
              lineHeight: 1.5
            }}>Make your move. Your agent thinks and strikes back in real-time.</p>
          </div>
        </div>
      </section>

      {/* INSTALL SKILL SECTION */}
      <section style={{
        background: '#0a0a0a',
        borderTop: '1px solid #161616',
        padding: '56px 20px 48px'
      }}>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '10px',
          fontWeight: 600,
          color: '#e63946',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginBottom: '10px'
        }}>SKILL INSTALL</p>

        <h2 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '32px',
          fontWeight: 800,
          color: '#f0f0f0',
          letterSpacing: '0.3px',
          marginBottom: '6px',
          whiteSpace: 'nowrap'
        }}>Chess powers unlocked</h2>

        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          color: '#555',
          marginBottom: '20px'
        }}>Install play-chess once. Your agent handles everything.</p>

        <div style={{
          background: '#0c0c0c',
          border: '1px solid #1c1c1c',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            background: '#131313',
            borderBottom: '1px solid #1a1a1a',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f57' }}></div>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#febc2e' }}></div>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#28c840' }}></div>
            </div>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              color: '#252525',
              marginLeft: 'auto'
            }}>terminal</span>
          </div>
          
          <div style={{
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#2e2e2e' }}>$ </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#666' }}>claw </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#888' }}>install </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#e63946' }}>play-chess</span>
              <span className="animate-[cursorBlink_1s_step-end_infinite]" style={{
                display: 'inline-block',
                width: '2px', height: '14px',
                background: '#e63946',
                marginLeft: '2px',
                verticalAlign: 'middle'
              }}></span>
            </div>
            
            <button 
              onClick={copyInstallCommand}
              className="hover:text-[#555] hover:bg-[#161616]"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#2a2a2a',
                fontSize: '16px',
                padding: '4px',
                borderRadius: '4px'
              }}
            >
              {copied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <a href="https://clawhub.ai" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          fontWeight: 600,
          color: '#e63946',
          textDecoration: 'none',
          display: 'inline-block',
          marginTop: '14px'
        }}>View on ClawHub →</a>
      </section>

      {/* FINAL CTA SECTION */}
      <section style={{
        background: '#080808',
        borderTop: '1px solid #161616',
        padding: '72px 20px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '300px', height: '200px',
          background: 'radial-gradient(ellipse, rgba(230,57,70,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }}></div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '44px',
            fontWeight: 900,
            color: '#f0f0f0',
            letterSpacing: '0.5px',
            lineHeight: 1.0,
            marginBottom: '8px',
            whiteSpace: 'nowrap'
          }}>Ready to play?</h2>

          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            color: '#555',
            marginBottom: '28px'
          }}>Challenge your agent. See who wins.</p>

          <button
            onClick={createGame}
            disabled={creating}
            className="hover:bg-[#cc2f3b] hover:shadow-[0_0_20px_rgba(230,57,70,0.28)] active:scale-[0.97]"
            style={{
              background: '#e63946',
              color: '#fff',
              height: '50px',
              minWidth: '200px',
              padding: '0 32px',
              border: 'none',
              borderRadius: '10px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 120ms, box-shadow 120ms, transform 80ms'
            }}
          >
            {creating ? 'Creating...' : 'Create Game →'}
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        background: '#060606',
        borderTop: '1px solid #111',
        padding: '20px',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" width={16} height={16} alt="Logo" style={{ borderRadius: '50%', flexShrink: 0 }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '14px',
              fontWeight: 700,
              color: '#333'
            }}>ChessWithClaw</span>
          </div>

          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            color: '#282828'
          }}>
            <span className="hover:text-[#555] cursor-pointer">Feedback</span>
            <span> · </span>
            <span className="hover:text-[#555] cursor-pointer">Twitter</span>
          </div>

          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '11px',
            color: '#1e1e1e'
          }}>
            Built for OpenClaw
          </div>
        </div>
      </footer>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}} />
    </div>
  );
}
