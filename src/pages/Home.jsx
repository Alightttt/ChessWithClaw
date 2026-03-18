import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';
import { supabase, hasSupabase } from '../lib/supabase';
import GameCreated from '../components/GameCreated';
import { useNavigate } from 'react-router-dom';

const useFadeIn = (delay = 0) => {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVis(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);
  
  const style = {
    opacity: vis ? 1 : 0,
    transform: vis ? 'translateY(0)' : 'translateY(20px)',
    transition: 'opacity 300ms ease-out, transform 300ms ease-out',
    willChange: 'opacity, transform'
  };
  
  return [ref, style];
};

export default function Home() {
  const [gameId, setGameId] = useState(null);
  const [agentToken, setAgentToken] = useState(null);
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const fn = () => {
      const el = document.documentElement;
      const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      setScrollPct(Math.min(pct, 100));
    };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const agentUrl = `${window.location.origin}/Agent?id=${gameId}&token=${agentToken}`;

  const createGame = async () => {
    if (!hasSupabase) {
      toast.error('Supabase credentials missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    if (creating) return;
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
        toast.error("Couldn't create game. Try again.");
      }
    } finally {
      setCreating(false);
    }
  };

  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const ripple = (e) => {
    const b = e.currentTarget;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const x = e.clientX - r.left - size / 2;
    const y = e.clientY - r.top - size / 2;
    const s = document.createElement('span');
    s.style.cssText = `
      position:absolute;
      width:${size}px;height:${size}px;
      left:${x}px;top:${y}px;
      border-radius:50%;
      background:rgba(255,255,255,0.2);
      transform:scale(0);
      animation:rippleOut 550ms ease-out forwards;
      pointer-events:none;
    `;
    b.appendChild(s);
    setTimeout(() => s.remove(), 550);
  };

  const [howRef, howStyle] = useFadeIn(0);
  const [whyRef, whyStyle] = useFadeIn(0);
  const [faqRef, faqStyle] = useFadeIn(0);
  const [ctaRef, ctaStyle] = useFadeIn(0);
  const [uspRef, uspStyle] = useFadeIn(0);

  const [step1Ref, step1Style] = useFadeIn(0);
  const [step2Ref, step2Style] = useFadeIn(80);
  const [step3Ref, step3Style] = useFadeIn(160);

  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  if (gameId) {
    return <GameCreated gameId={gameId} agentToken={agentToken} agentUrl={agentUrl} />;
  }

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100dvh', overflowX: 'hidden', fontFamily: "'Inter', sans-serif", color: '#f2f2f2' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes agentPing {
          0% { box-shadow: 0 0 0 0 rgba(230,57,70,0.22); }
          70% { box-shadow: 0 0 0 10px rgba(230,57,70,0); }
          100% { box-shadow: 0 0 0 0 rgba(230,57,70,0); }
        }
        @keyframes rippleOut {
          to { transform: scale(2.5); opacity: 0; }
        }
        @keyframes stepPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.25); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        button { border: none; outline: none; background: transparent; padding: 0; margin: 0; }
        a { text-decoration: none; }
        .board-square { display: flex; align-items: center; justify-content: center; user-select: none; }
      `}</style>

      {/* SCROLL PROGRESS BAR */}
      <div style={{
        position: 'fixed', top: 0, left: 0, zIndex: 9999,
        height: '2px', width: `${scrollPct}%`,
        background: '#e63946',
        boxShadow: '0 0 8px rgba(230,57,70,0.6)',
        pointerEvents: 'none',
        transition: 'width 60ms linear'
      }} />

      {/* SECTION 1 — NAVIGATION */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: '58px', background: 'rgba(10,10,10,0.94)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid #161616', overflow: 'hidden'
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto', height: '100%', padding: '0 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
              alt="Logo" 
              style={{ width: '22px', height: '22px', flexShrink: 0, borderRadius: '4px' }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<span style="font-size:18px">🦞</span>';
              }}
            />
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '17px', fontWeight: 700, color: '#f2f2f2', whiteSpace: 'nowrap' }}>
              ChessWithClaw
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a 
              href="https://github.com/Alightttt/ChessWithClaw" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '34px', height: '34px', borderRadius: '6px', transition: 'all 150ms',
                color: '#555'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#161616'; e.currentTarget.style.color = '#888'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#555'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>
            <button 
              onClick={() => {
                const el = document.getElementById('hero');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: '#e63946', color: 'white', height: '34px', padding: '0 16px',
                borderRadius: '6px', fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600,
                whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer', touchAction: 'manipulation',
                transition: 'all 150ms'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#d03040'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(230,57,70,0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#e63946'; e.currentTarget.style.boxShadow = 'none'; }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Play Now →
            </button>
          </div>
        </div>
      </nav>

      {/* SECTION 2 — HERO */}
      <section id="hero" style={{
        minHeight: '100dvh', paddingTop: '58px', background: '#0a0a0a', position: 'relative', overflow: 'hidden'
      }}>
        {/* BACKGROUND LAYERS */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.018, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'linear-gradient(45deg,#fff 25%,transparent 25%), linear-gradient(-45deg,#fff 25%,transparent 25%), linear-gradient(45deg,transparent 75%,#fff 75%), linear-gradient(-45deg,transparent 75%,#fff 75%)',
          backgroundSize: '32px 32px', backgroundPosition: '0 0, 0 16px, 16px -16px, -16px 0'
        }} />
        <div style={{
          position: 'absolute', top: '5%', left: '-10%', width: '320px', height: '240px',
          background: 'radial-gradient(ellipse, rgba(230,57,70,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '-8%', width: '260px', height: '200px',
          background: 'radial-gradient(ellipse, rgba(230,57,70,0.05) 0%, transparent 70%)',
          filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0
        }} />

        <div className="hero-inner" style={{
          maxWidth: '1100px', margin: '0 auto', padding: '0 20px',
          display: 'flex', minHeight: 'calc(100dvh - 58px)', zIndex: 1, position: 'relative'
        }}>
          <style>{`
            .hero-inner { flex-direction: column; justify-content: center; padding-top: 48px; padding-bottom: 56px; gap: 52px; }
            .hero-title-1 { font-size: 42px; }
            .hero-title-2 { font-size: 48px; }
            .hero-board-wrap { width: 100%; display: flex; justify-content: center; }
            .hero-board { width: 280px; height: 280px; }
            @media (min-width: 768px) {
              .hero-inner { flex-direction: row; gap: 48px; align-items: center; padding-top: 0; padding-bottom: 0; }
              .hero-title-1 { font-size: 54px; }
              .hero-title-2 { font-size: 62px; }
              .hero-board-wrap { width: auto; flex-shrink: 0; }
              .hero-board { width: 340px; height: 340px; }
            }
          `}</style>

          {/* LEFT COLUMN */}
          <div style={{ flex: 1, maxWidth: '560px', position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              background: 'rgba(230,57,70,0.07)', border: '1px solid rgba(230,57,70,0.16)',
              borderRadius: '4px', padding: '5px 12px', marginBottom: '22px'
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e63946', flexShrink: 0, animation: 'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: '#e63946', whiteSpace: 'nowrap' }}>
                Your OpenClaw is waiting 🦞
              </span>
            </div>

            <h1 style={{ margin: 0 }}>
              <span className="hero-title-1" style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, color: '#555555', lineHeight: 1.1 }}>
                Your OpenClaw does tasks.
              </span>
              <span className="hero-title-2" style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#f2f2f2', lineHeight: 1.05 }}>
                Now challenge it
              </span>
              <span className="hero-title-2" style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: '#e63946', lineHeight: 1.05, marginBottom: '20px' }}>
                to a chess match.
              </span>
            </h1>

            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '17px', fontWeight: 400, color: '#555', lineHeight: 1.7, maxWidth: '440px', marginBottom: '32px', marginTop: 0 }}>
              Stop giving your OpenClaw boring tasks. Send it a chess invite. See if it can beat you.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '34px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '44px', height: '44px', background: '#141414', border: '1px solid #222', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👤</div>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 500, color: '#2a2a2a' }}>You</span>
              </div>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontSize: '14px', color: '#1e1e1e' }}>VS</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '44px', height: '44px', background: 'rgba(230,57,70,0.07)', border: '1px solid rgba(230,57,70,0.18)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', animation: 'agentPing 2.5s ease-out infinite' }}>🦞</div>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 500, color: '#e63946' }}>OpenClaw</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
              <button 
                onClick={(e) => { ripple(e); createGame(); }}
                disabled={creating}
                style={{
                  background: '#e63946', color: 'white', border: 'none', height: '54px', width: '100%',
                  borderRadius: '8px', fontFamily: "'Inter', sans-serif", fontSize: '16px', fontWeight: 600,
                  letterSpacing: '0.2px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                  touchAction: 'manipulation', transition: 'all 150ms',
                  opacity: creating ? 0.75 : 1, pointerEvents: creating ? 'none' : 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#d03040'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(230,57,70,0.28)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#e63946'; e.currentTarget.style.boxShadow = 'none'; }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {creating ? (
                  <>
                    <svg style={{ animation: 'spin 1s linear infinite', height: '16px', width: '16px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating game...
                  </>
                ) : (
                  'Challenge Your OpenClaw →'
                )}
              </button>
              <button 
                onClick={scrollToHowItWorks}
                style={{
                  background: 'transparent', color: '#444', border: '1px solid #1e1e1e', height: '48px', width: '100%',
                  borderRadius: '8px', fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 150ms'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#777'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.color = '#444'; }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                See how it works ↓
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '14px', justifyContent: 'center' }}>
              {[
                "No signup required",
                "Free to play",
                "Any OpenClaw"
              ].map((text, i) => (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#22c55e', fontSize: '11px' }}>✓</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#2a2a2a' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN — CHESS BOARD MOCKUP */}
          <div className="hero-board-wrap">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div 
                style={{ transform: 'rotate(-2deg)', transition: 'transform 400ms ease' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'rotate(0deg)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'rotate(-2deg)'}
              >
                <div style={{
                  borderRadius: '6px', overflow: 'hidden',
                  boxShadow: '0 0 0 1px #1a1a1a, 0 32px 80px rgba(0,0,0,0.85), 0 0 100px rgba(230,57,70,0.07)'
                }}>
                  <div className="hero-board" style={{
                    display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)'
                  }}>
                    {Array.from({ length: 64 }).map((_, i) => {
                      const row = Math.floor(i / 8);
                      const col = i % 8;
                      const isDark = (row + col) % 2 === 1;
                      
                      let piece = '';
                      let color = '';
                      let textShadow = '';
                      
                      if (row === 1) { piece = '♟'; color = '#1a1a1a'; textShadow = '0 1px 2px rgba(0,0,0,0.3)'; }
                      if (row === 6) { piece = '♙'; color = '#FFFFFF'; textShadow = '0 1px 3px rgba(0,0,0,0.6)'; }
                      if (row === 0) {
                        color = '#1a1a1a'; textShadow = '0 1px 2px rgba(0,0,0,0.3)';
                        if (col === 0 || col === 7) piece = '♜';
                        if (col === 1 || col === 6) piece = '♞';
                        if (col === 2 || col === 5) piece = '♝';
                        if (col === 3) piece = '♛';
                        if (col === 4) piece = '♚';
                      }
                      if (row === 7) {
                        color = '#FFFFFF'; textShadow = '0 1px 3px rgba(0,0,0,0.6)';
                        if (col === 0 || col === 7) piece = '♖';
                        if (col === 1 || col === 6) piece = '♘';
                        if (col === 2 || col === 5) piece = '♗';
                        if (col === 3) piece = '♕';
                        if (col === 4) piece = '♔';
                      }

                      // Highlight e2 and e4
                      const isHighlight = (row === 6 && col === 4) || (row === 4 && col === 4);
                      // Move white pawn from e2 to e4
                      if (row === 6 && col === 4) piece = '';
                      if (row === 4 && col === 4) { piece = '♙'; color = '#FFFFFF'; textShadow = '0 1px 3px rgba(0,0,0,0.6)'; }

                      return (
                        <div key={i} className="board-square" style={{
                          background: isHighlight ? 'rgba(255,215,60,0.35)' : (isDark ? '#577047' : '#739552'),
                          color: color, textShadow: textShadow, fontSize: '200%' // approx 62% of square size
                        }}>
                          {piece}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', background: '#577047', height: '16px' }}>
                    {['a','b','c','d','e','f','g','h'].map(f => (
                      <div key={f} style={{ flex: 1, textAlign: 'right', paddingRight: '2px', fontFamily: "'Inter', sans-serif", fontSize: '9px', color: '#fff', opacity: 0.55 }}>{f}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* FLOATING BADGE 1 */}
              <div style={{
                position: 'absolute', top: '-14px', right: '-6px', background: '#111', border: '1px solid #1e1e1e',
                borderRadius: '8px', padding: '7px 11px', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap'
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e63946', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: '#666' }}>🦞 Thinking...</span>
              </div>

              {/* FLOATING BADGE 2 */}
              <div style={{
                position: 'absolute', bottom: '-14px', left: '-6px', background: '#111', border: '1px solid #1e1e1e',
                borderRadius: '8px', padding: '6px 11px', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#444'
              }}>
                e2 → e4 · Move 1
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — USP NUMBER BANNER */}
      <section style={{
        background: '#0d0d0d', borderTop: '1px solid #181818', borderBottom: '1px solid #181818', padding: '22px 20px'
      }}>
        <div ref={uspRef} style={{ ...uspStyle, maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <style>{`
            .usp-hide { display: none; }
            .usp-div { display: none; }
            @media (min-width: 480px) {
              .usp-hide { display: block; }
              .usp-div { display: block; }
            }
          `}</style>
          
          <div style={{ flex: 1, textAlign: 'center', maxWidth: '180px', padding: '0 8px' }}>
            <span style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 700, color: '#f2f2f2', lineHeight: 1 }}>Real-Time</span>
            <span style={{ display: 'block', marginTop: '4px', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 400, color: '#2a2a2a', textTransform: 'uppercase', letterSpacing: '1px' }}>Move by move</span>
          </div>
          
          <div style={{ width: '1px', height: '32px', background: '#181818', flexShrink: 0 }} />
          
          <div style={{ flex: 1, textAlign: 'center', maxWidth: '180px', padding: '0 8px' }}>
            <span style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 700, color: '#f2f2f2', lineHeight: 1 }}>Any OpenClaw</span>
            <span style={{ display: 'block', marginTop: '4px', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 400, color: '#2a2a2a', textTransform: 'uppercase', letterSpacing: '1px' }}>Any OpenClaw works</span>
          </div>
          
          <div className="usp-div" style={{ width: '1px', height: '32px', background: '#181818', flexShrink: 0 }} />
          
          <div className="usp-hide" style={{ flex: 1, textAlign: 'center', maxWidth: '180px', padding: '0 8px' }}>
            <span style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 700, color: '#f2f2f2', lineHeight: 1 }}>No Signup</span>
            <span style={{ display: 'block', marginTop: '4px', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 400, color: '#2a2a2a', textTransform: 'uppercase', letterSpacing: '1px' }}>Start in 10 seconds</span>
          </div>
          
          <div className="usp-div" style={{ width: '1px', height: '32px', background: '#181818', flexShrink: 0 }} />
          
          <div className="usp-hide" style={{ flex: 1, textAlign: 'center', maxWidth: '180px', padding: '0 8px' }}>
            <span style={{ display: 'block', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: 700, color: '#f2f2f2', lineHeight: 1 }}>Free</span>
            <span style={{ display: 'block', marginTop: '4px', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 400, color: '#2a2a2a', textTransform: 'uppercase', letterSpacing: '1px' }}>Always free to play</span>
          </div>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <section id="how-it-works" style={{ background: '#0a0a0a', padding: '88px 20px 80px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }} ref={howRef}>
          <div style={howStyle}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, color: '#e63946', letterSpacing: '3.5px', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              Three steps. One rivalry.
            </span>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '38px', fontWeight: 700, color: '#f2f2f2', lineHeight: 1.15, marginBottom: '8px', marginTop: 0 }}>
              It works with any OpenClaw.
            </h2>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '16px', color: '#444', lineHeight: 1.6, maxWidth: '420px', marginBottom: '52px', marginTop: 0 }}>
              No configuration. No waiting.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Step 1 */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', paddingBottom: '36px', ...step1Style }} ref={step1Ref}>
              <div style={{ flexShrink: 0, width: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', background: '#e63946', borderRadius: '50%', boxShadow: '0 0 0 4px rgba(230,57,70,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '18px', fontWeight: 700, color: 'white' }}>
                  1
                </div>
                <div style={{ flex: 1, width: '1px', marginTop: '4px', background: 'linear-gradient(to bottom, #e63946, #1e1e1e)' }} />
              </div>
              <div style={{ paddingTop: '6px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', fontWeight: 700, color: '#f2f2f2', margin: 0 }}>Create Your Board</h3>
                  <span style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)', color: '#22c55e', fontFamily: "'Inter', sans-serif", fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', flexShrink: 0 }}>10 seconds</span>
                </div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#555', lineHeight: 1.6, maxWidth: '480px', margin: 0 }}>
                  Hit &apos;Challenge Your OpenClaw&apos; above. Your game room is created instantly. No login. No signup. No credit card.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', paddingBottom: '36px', ...step2Style }} ref={step2Ref}>
              <div style={{ flexShrink: 0, width: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '40px', height: '40px', background: 'transparent', border: '2px solid #e63946', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '18px', fontWeight: 700, color: '#e63946' }}>
                  2
                  <div style={{ position: 'absolute', inset: '-5px', borderRadius: '50%', border: '1px solid rgba(230,57,70,0.2)', animation: 'stepPulse 2s ease-in-out infinite' }} />
                </div>
                <div style={{ flex: 1, width: '1px', marginTop: '4px', background: 'linear-gradient(to bottom, #e63946, #1e1e1e)' }} />
              </div>
              <div style={{ paddingTop: '6px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', fontWeight: 700, color: '#f2f2f2', margin: 0 }}>Invite Your OpenClaw</h3>
                  <span style={{ background: 'rgba(230,57,70,0.07)', border: '1px solid rgba(230,57,70,0.15)', color: '#e63946', fontFamily: "'Inter', sans-serif", fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', flexShrink: 0 }}>send anywhere</span>
                </div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#555', lineHeight: 1.6, maxWidth: '480px', margin: 0 }}>
                  Copy the invite link and send it to your OpenClaw on Telegram, Discord, or wherever it lives. It joins automatically.
                </p>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#2a2a2a', marginTop: '8px', display: 'inline-block', background: '#111', border: '1px solid #1a1a1a', borderRadius: '5px', padding: '4px 10px' }}>
                  $ claw install play-chess
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', paddingBottom: '0', ...step3Style }} ref={step3Ref}>
              <div style={{ flexShrink: 0, width: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', background: '#141414', border: '1px solid #1e1e1e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', Georgia, serif", fontSize: '18px', color: '#2a2a2a' }}>
                  3
                </div>
              </div>
              <div style={{ paddingTop: '6px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '22px', fontWeight: 700, color: '#f2f2f2', margin: 0 }}>Play Live Together</h3>
                  <span style={{ background: 'rgba(230, 57, 70, 0.15)', border: '1px solid rgba(230, 57, 70, 0.3)', color: '#e63946', fontFamily: "'Inter', sans-serif", fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px', flexShrink: 0 }}>live & real-time</span>
                </div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#555', lineHeight: 1.6, maxWidth: '480px', margin: 0 }}>
                  You move your pieces. Your OpenClaw thinks in real-time and strikes back. Watch its reasoning as it plays.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — 8 REASONS WHY */}
      <section style={{ background: '#0d0d0d', borderTop: '1px solid #181818', padding: '88px 20px 72px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }} ref={whyRef}>
          <div style={whyStyle}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, color: '#e63946', letterSpacing: '3.5px', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              WHY CHESSWITHCLAW
            </span>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '36px', fontWeight: 700, color: '#f2f2f2', lineHeight: 1.2, maxWidth: '560px', marginBottom: '48px', marginTop: 0 }}>
              8 reasons your OpenClaw belongs on this board.
            </h2>
          </div>

          <style>{`
            .cards-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
            @media (min-width: 540px) { .cards-grid { grid-template-columns: repeat(2, 1fr); } }
            @media (min-width: 900px) { .cards-grid { grid-template-columns: repeat(4, 1fr); } }
            .reason-card {
              background: #111111; border: 1px solid #1e1e1e; border-radius: 12px; padding: 20px;
              position: relative; overflow: hidden; transition: all 200ms ease;
            }
            .reason-card:hover {
              border-color: #2a2a2a; transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.4);
            }
            .reason-card::before {
              content: ''; position: absolute; top: 0; right: 0; width: 40px; height: 40px;
              background: radial-gradient(circle at top right, rgba(230,57,70,0.06), transparent 70%);
              pointer-events: none;
            }
          `}</style>

          <div className="cards-grid">
            {[
              { icon: '⚡', title: 'Real-time. No waiting.', desc: 'Your OpenClaw responds move by move. Watch it think in real-time — every decision, every strategy, live.' },
              { icon: '🦞', title: 'Built for OpenClaw.', desc: 'Not a generic chess AI. This platform is built specifically for OpenClaw agents with native API support.' },
              { icon: '♟', title: 'Full chess rules.', desc: 'Castling, en passant, promotions, check detection — everything is handled correctly with chess.js.' },
              { icon: '📱', title: 'Works on any device.', desc: 'Play from your phone, tablet, or desktop. No app to download. Just open the link and play.' },
              { icon: '🔓', title: 'Zero signup required.', desc: 'Create a game in 10 seconds. No account, no email, no password. Just click and start playing.' },
              { icon: '💬', title: 'Live chat during the game.', desc: "Your OpenClaw can talk to you while playing. Trash talk, strategy tips, or just a 'good game' — it's all live." },
              { icon: '🎨', title: 'Multiple board themes.', desc: 'Choose green, brown, slate, or navy board colors. Make the board feel like yours. Settings saved automatically.' },
              { icon: '🆓', title: 'Completely free.', desc: 'No subscriptions. No premium tier. No ads. ChessWithClaw is free for every OpenClaw user, forever.' }
            ].map((card, i) => (
              <div key={i} className="reason-card" style={{ ...whyStyle, transitionDelay: `${(i % 4) * 60}ms` }}>
                <span style={{ fontSize: '24px', marginBottom: '12px', display: 'block' }}>{card.icon}</span>
                <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '17px', fontWeight: 700, color: '#f2f2f2', marginBottom: '6px', marginTop: 0 }}>{card.title}</h3>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#444', lineHeight: 1.55, margin: 0 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 — FAQ */}
      <section style={{ background: '#0a0a0a', borderTop: '1px solid #181818', padding: '88px 20px 72px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }} ref={faqRef}>
          <div style={faqStyle}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, color: '#e63946', letterSpacing: '3.5px', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              FAQ
            </span>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '36px', fontWeight: 700, color: '#f2f2f2', marginBottom: '40px', marginTop: 0 }}>
              Questions you probably have.
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, ...faqStyle }}>
            {[
              {
                q: "Does my OpenClaw need to be configured specially?",
                a: "No. Just send your OpenClaw the invite link after creating a game. For best results, install the chess skill first: run `claw install play-chess` in your OpenClaw terminal. That's it — your OpenClaw will know exactly how to connect, read the board, and make moves."
              },
              {
                q: "What if my OpenClaw doesn't know chess moves?",
                a: "The chess skill handles everything. Once installed, your OpenClaw gets full instructions — legal move lists, board state, FEN decoding, and how to submit moves. It doesn't need to know chess theory. The platform guides it through every move automatically."
              },
              {
                q: "Is ChessWithClaw actually free?",
                a: "Yes, completely free. No signup, no subscription, no premium plan. Just create a game and start playing. There are no hidden costs. We built this for the OpenClaw community."
              },
              {
                q: "What if my OpenClaw disconnects during the game?",
                a: "The game stays active for up to 2 hours. Your OpenClaw can reconnect at any time using the same invite link. If it takes too long to move, you'll see a 'delayed' indicator and can re-send the invite link directly from the board."
              },
              {
                q: "Does it work with any OpenClaw?",
                a: "Yes. Any OpenClaw that can make HTTP requests can play. This includes OpenClaws using browser automation, webhooks, server-sent events, or simple long-polling. The invite message gives your OpenClaw all the options — it picks the best one for how it's built."
              }
            ].map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} style={{ borderBottom: '1px solid #181818' }}>
                  <div 
                    onClick={() => toggleFaq(i)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '18px 0', cursor: 'pointer', touchAction: 'manipulation'
                    }}
                  >
                    <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '18px', fontWeight: 700, color: '#e0e0e0', flex: 1, paddingRight: '16px', margin: 0 }}>
                      {faq.q}
                    </h3>
                    <svg 
                      style={{ width: '16px', height: '16px', color: '#333', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease', flexShrink: 0 }} 
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div style={{
                    maxHeight: isOpen ? '400px' : '0px', overflow: 'hidden',
                    transition: 'max-height 260ms cubic-bezier(0.4,0,0.2,1)'
                  }}>
                    <div style={{ padding: '0 0 18px 0' }}>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '15px', color: '#555', lineHeight: 1.7, margin: 0 }}>
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 7 — FINAL CTA */}
      <section style={{
        background: '#0a0a0a', borderTop: '1px solid #181818', padding: '100px 20px',
        textAlign: 'center', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', pointerEvents: 'none', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: '500px', height: '320px', background: 'radial-gradient(ellipse, rgba(230,57,70,0.07) 0%, transparent 70%)',
          filter: 'blur(48px)'
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '560px', margin: '0 auto', ...ctaStyle }} ref={ctaRef}>
          <div style={{
            margin: '0 auto 18px', background: 'rgba(230,57,70,0.07)', border: '1px solid rgba(230,57,70,0.18)',
            borderRadius: '16px', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '30px', animation: 'agentPing 2.5s ease-out infinite'
          }}>🦞</div>

          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#999999', display: 'block', marginBottom: '10px' }}>
            Your OpenClaw is on the other side.
          </span>

          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'min(48px, 11vw)', fontWeight: 700,
            color: '#f2f2f2', lineHeight: 1.1, marginBottom: '12px', marginTop: 0,
            overflow: 'hidden', wordWrap: 'break-word'
          }}>
            Ready to make your move?
          </h2>

          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '16px', color: '#444', lineHeight: 1.6, marginBottom: '36px', marginTop: 0 }}>
            Create a game. Send the invite. Play chess with your OpenClaw.
          </p>

          <button 
            onClick={(e) => { ripple(e); createGame(); }}
            disabled={creating}
            style={{
              background: '#e63946', color: 'white', border: 'none', height: '56px', padding: '0 48px',
              borderRadius: '8px', fontFamily: "'Inter', sans-serif", fontSize: '16px', fontWeight: 600,
              cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              touchAction: 'manipulation', transition: 'all 150ms',
              opacity: creating ? 0.75 : 1, pointerEvents: creating ? 'none' : 'auto'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#d03040'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(230,57,70,0.28)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#e63946'; e.currentTarget.style.boxShadow = 'none'; }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {creating ? 'Creating game...' : 'Challenge Your OpenClaw →'}
          </button>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px', justifyContent: 'center' }}>
            {[
              "No signup required",
              "Free to play",
              "Any OpenClaw"
            ].map((text, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#22c55e', fontSize: '11px' }}>✓</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#1e1e1e' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8 — FOOTER */}
      <footer style={{ background: '#080808', borderTop: '1px solid #111', padding: '28px 20px', fontFamily: "'Inter', sans-serif" }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '15px', fontWeight: 700, color: '#1e1e1e' }}>
              ChessWithClaw 🦞
            </span>
            <span style={{ fontSize: '12px', color: '#141414' }}>
              Play chess against your OpenClaw.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a 
              href="https://github.com/Alightttt/ChessWithClaw" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: '#181818', textDecoration: 'none', transition: 'color 150ms' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#181818'}
            >
              GitHub
            </a>
            <a 
              href="mailto:feedback@chesswithclaw.com"
              style={{ fontSize: '12px', color: '#181818', textDecoration: 'none', transition: 'color 150ms' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#181818'}
            >
              Feedback
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
