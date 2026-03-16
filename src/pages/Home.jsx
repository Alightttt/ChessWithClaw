'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';
import { Copy, Check } from 'lucide-react';
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
      { threshold: 0.12 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);
  
  const style = {
    opacity: vis ? 1 : 0,
    transform: vis ? 'translateY(0)' : 'translateY(22px)',
    transition: 'opacity 380ms cubic-bezier(0.22,1,0.36,1), transform 380ms cubic-bezier(0.22,1,0.36,1)',
    willChange: 'opacity, transform'
  };
  
  return [ref, style];
};

export default function Home() {
  const [gameId, setGameId] = useState(null);
  const [agentToken, setAgentToken] = useState(null);
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const handler = () => {
      const el = document.documentElement;
      const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      setScrollPct(Math.min(pct, 100));
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const [howRef, howStyle] = useFadeIn(0);
  const [skillRef, skillStyle] = useFadeIn(0);
  const [ctaRef, ctaStyle] = useFadeIn(0);
  
  const [step1Ref, step1Style] = useFadeIn(0);
  const [step2Ref, step2Style] = useFadeIn(80);
  const [step3Ref, step3Style] = useFadeIn(160);

  const agentUrl = `${window.location.origin}/Agent?id=${gameId}`;

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

  const createRipple = (e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size/2;
    const y = e.clientY - rect.top - size/2;
    const s = document.createElement('span');
    s.style.cssText = `
      position:absolute;
      width:${size}px;height:${size}px;
      left:${x}px;top:${y}px;
      border-radius:50%;
      background:rgba(255,255,255,0.2);
      transform:scale(0);
      animation:rippleAnim 500ms ease-out forwards;
      pointer-events:none;
    `;
    btn.appendChild(s);
    setTimeout(() => s.remove(), 500);
  };

  if (gameId) {
    return <GameCreated gameId={gameId} agentToken={agentToken} agentUrl={agentUrl} />;
  }

  return (
    <div style={{ backgroundColor: '#080808', color: '#f0f0f0', fontFamily: "'DM Sans', sans-serif", minHeight: '100vh' }}>
      {/* SCROLL PROGRESS BAR */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0,
        height: '2px',
        width: scrollPct + '%',
        background: '#e63946',
        boxShadow: '0 0 8px rgba(230,57,70,0.6)',
        zIndex: 300,
        pointerEvents: 'none',
        transition: 'width 60ms linear'
      }} />

      {/* SECTION 1 — HEADER */}
      <header style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: '52px',
        background: 'rgba(8,8,8,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid #141414',
        zIndex: 100,
        overflow: 'hidden'
      }}>
        <div style={{ padding: '0 16px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" style={{ width: '20px', height: '20px', flexShrink: 0, borderRadius: '50%' }} alt="Logo" />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: 800, color: '#f0f0f0', whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ChessWithClaw
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#444]" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#282828', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, transition: 'color 150ms' }}>
              GitHub
            </a>
            <button 
              onClick={(e) => { createRipple(e); createGame(); }}
              className="hover:bg-[#cc2f3b] active:scale-[0.95]"
              style={{
                background: '#e63946', color: 'white', height: '28px', padding: '0 12px', borderRadius: '6px', border: 'none',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                cursor: 'pointer', touchAction: 'manipulation', transition: 'background 120ms, transform 80ms', position: 'relative', overflow: 'hidden'
              }}
            >
              {creating ? 'Creating...' : 'Play Now'}
            </button>
          </div>
        </div>
      </header>

      {/* SECTION 2 — HERO */}
      <section style={{
        minHeight: '100dvh',
        paddingTop: '52px',
        background: '#080808',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* BACKGROUND LAYERS */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.022,
          backgroundImage: 'linear-gradient(45deg,#fff 25%,transparent 25%), linear-gradient(-45deg,#fff 25%,transparent 25%), linear-gradient(45deg,transparent 75%,#fff 75%), linear-gradient(-45deg,transparent 75%,#fff 75%)',
          backgroundSize: '40px 40px',
          backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0',
          pointerEvents: 'none', zIndex: 0
        }} />
        <div style={{
          position: 'absolute', top: '8%', left: '-8%', width: '300px', height: '220px',
          background: 'radial-gradient(ellipse, rgba(230,57,70,0.09) 0%, transparent 70%)',
          filter: 'blur(32px)', pointerEvents: 'none', zIndex: 0
        }} />
        <div style={{
          position: 'absolute', bottom: '8%', right: '-12%', width: '240px', height: '180px',
          background: 'radial-gradient(ellipse, rgba(230,57,70,0.04) 0%, transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0
        }} />

        {/* HERO CONTENT */}
        <div style={{ position: 'relative', zIndex: 1, padding: '52px 20px 56px' }}>
          <div style={{
            background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.14)', borderRadius: '99px',
            padding: '5px 13px', marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '7px'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e63946', flexShrink: 0, animation: 'dotPulse 2s ease-in-out infinite' }}></div>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 500, color: '#e63946', whiteSpace: 'nowrap' }}>
              Your OpenClaw is waiting ♟
            </span>
          </div>

          <h1 style={{ margin: 0 }}>
            <span className="min-[480px]:text-[68px] md:text-[86px]" style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '54px', fontWeight: 900, color: '#f0f0f0', lineHeight: 1.0, letterSpacing: '0.5px', margin: 0 }}>
              Can you beat
            </span>
            <span className="min-[480px]:text-[68px] md:text-[86px]" style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '54px', fontWeight: 900, color: '#e63946', lineHeight: 1.0, letterSpacing: '0.5px', margin: '0 0 16px 0' }}>
              your own OpenClaw?
            </span>
          </h1>

          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: 400, color: '#555', lineHeight: 1.65, maxWidth: '320px', marginBottom: 0 }}>
            Your OpenClaw is on the other side.<br/>Real moves. Real rivalry. No signup.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '20px 0 28px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1c1c1c', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>👤</div>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#252525', textAlign: 'center' }}>You</span>
            </div>
            <div style={{ flexShrink: 0, fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: 800, color: '#1a1a1a', letterSpacing: '3px' }}>VS</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <div style={{ background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.15)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', position: 'relative', animation: 'presencePing 2.5s ease-out infinite' }}>🦞</div>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#e63946', textAlign: 'center' }}>Your OpenClaw</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '380px' }}>
            <button 
              onClick={(e) => { createRipple(e); createGame(); }}
              disabled={creating}
              className="hover:bg-[#cc2f3b] active:scale-[0.97]"
              style={{
                background: '#e63946', color: 'white', height: '50px', width: '100%', border: 'none', borderRadius: '10px',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700, letterSpacing: '0.3px', whiteSpace: 'nowrap',
                cursor: 'pointer', position: 'relative', overflow: 'hidden', touchAction: 'manipulation', transition: 'background 120ms, transform 80ms',
                ...(creating ? { pointerEvents: 'none', opacity: 0.78 } : {})
              }}
            >
              {creating ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </span>
              ) : 'Start a Game →'}
            </button>
            <button 
              onClick={scrollToHowItWorks}
              className="hover:border-[#2a2a2a] hover:text-[#666]"
              style={{
                background: 'transparent', color: '#3a3a3a', height: '46px', width: '100%', border: '1px solid #1e1e1e', borderRadius: '10px',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '17px', fontWeight: 600, whiteSpace: 'nowrap',
                cursor: 'pointer', touchAction: 'manipulation', transition: 'border-color 150ms, color 150ms'
              }}
            >
              See how it works
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 3 — PROOF BAR */}
      <section style={{
        background: '#0b0b0b', borderTop: '1px solid #141414', borderBottom: '1px solid #141414', padding: '14px 0', overflow: 'hidden',
        display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%'
      }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 6px' }}>
          <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: 700, color: '#ccc', letterSpacing: '1.2px', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1 }}>REALTIME</span>
          <span style={{ display: 'block', marginTop: '3px', fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#272727', whiteSpace: 'nowrap' }}>Move by move</span>
        </div>
        <div style={{ width: '1px', height: '22px', background: '#181818', flexShrink: 0 }}></div>
        <div style={{ flex: 1, textAlign: 'center', padding: '0 6px' }}>
          <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: 700, color: '#ccc', letterSpacing: '1.2px', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1 }}>AGENTS</span>
          <span style={{ display: 'block', marginTop: '3px', fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#272727', whiteSpace: 'nowrap' }}>Any OpenClaw</span>
        </div>
        <div className="hidden min-[480px]:block" style={{ width: '1px', height: '22px', background: '#181818', flexShrink: 0 }}></div>
        <div className="hidden min-[480px]:block" style={{ flex: 1, textAlign: 'center', padding: '0 6px' }}>
          <span style={{ display: 'block', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: 700, color: '#ccc', letterSpacing: '1.2px', textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1 }}>MOBILE</span>
          <span style={{ display: 'block', marginTop: '3px', fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#272727', whiteSpace: 'nowrap' }}>Any device</span>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <section id="how-it-works" ref={howRef} style={{ ...howStyle, background: '#080808', padding: '64px 20px 52px' }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', fontWeight: 600, color: '#e63946', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px' }}>
          HOW IT WORKS
        </div>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '36px', fontWeight: 800, color: '#f0f0f0', letterSpacing: '0.3px', lineHeight: 1.1, margin: '0 0 28px 0' }}>
          Three steps. One rivalry.
        </h2>

        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '19px', top: '24px', bottom: '24px', width: '1px', background: 'linear-gradient(to bottom, #e63946, rgba(230,57,70,0.3), transparent)', zIndex: 0 }}></div>

          <div ref={step1Ref} style={{ ...step1Style, display: 'flex', flexDirection: 'row', gap: '16px', marginBottom: '22px' }}>
            <div style={{ width: '38px', height: '38px', flexShrink: 0, zIndex: 1, position: 'relative', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e63946', border: 'none', boxShadow: '0 0 14px rgba(230,57,70,0.3)', fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: 700, color: 'white' }}>
              ✓
            </div>
            <div style={{ paddingTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', fontWeight: 700, color: '#f0f0f0', letterSpacing: '0.3px' }}>Create Your Board</span>
                <span style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.14)', color: '#22c55e', fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>instant</span>
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3e3e3e', lineHeight: 1.55 }}>
                Start a game instantly. No login,<br/>no signup required.
              </div>
            </div>
          </div>

          <div ref={step2Ref} style={{ ...step2Style, display: 'flex', flexDirection: 'row', gap: '16px', marginBottom: '22px' }}>
            <div style={{ width: '38px', height: '38px', flexShrink: 0, zIndex: 1, position: 'relative', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '2px solid #e63946', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#e63946' }}>
              2
              <div style={{ position: 'absolute', inset: '-5px', borderRadius: '14px', border: '1px solid rgba(230,57,70,0.25)', animation: 'stepPulse 2s ease-in-out infinite' }}></div>
            </div>
            <div style={{ paddingTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', fontWeight: 700, color: '#f0f0f0', letterSpacing: '0.3px' }}>Invite Your OpenClaw</span>
                <span style={{ background: 'rgba(230,57,70,0.06)', border: '1px solid rgba(230,57,70,0.12)', color: '#e63946', fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>any agent</span>
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3e3e3e', lineHeight: 1.55 }}>
                Send the link to your agent on Telegram,<br/>Discord, wherever it lives.
              </div>
            </div>
          </div>

          <div ref={step3Ref} style={{ ...step3Style, display: 'flex', flexDirection: 'row', gap: '16px', marginBottom: 0 }}>
            <div style={{ width: '38px', height: '38px', flexShrink: 0, zIndex: 1, position: 'relative', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', border: '1px solid #1c1c1c', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#252525' }}>
              3
            </div>
            <div style={{ paddingTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', fontWeight: 700, color: '#f0f0f0', letterSpacing: '0.3px' }}>Play Live Together</span>
                <span style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.14)', color: '#3b82f6', fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>real-time</span>
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3e3e3e', lineHeight: 1.55 }}>
                You move. Your OpenClaw thinks and<br/>strikes back in real-time.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — SKILL INSTALL */}
      <section ref={skillRef} style={{ ...skillStyle, background: '#090909', borderTop: '1px solid #141414', padding: '64px 20px 52px' }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', fontWeight: 600, color: '#e63946', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '10px' }}>
          SKILL INSTALL
        </div>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px', fontWeight: 800, color: '#f0f0f0', whiteSpace: 'nowrap', margin: '0 0 6px 0' }}>
          Chess powers unlocked
        </h2>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3a3a3a', margin: '0 0 20px 0' }}>
          Install once. Your OpenClaw handles every move.
        </p>

        <div style={{ background: '#0b0b0b', border: '1px solid #1a1a1a', borderRadius: '12px', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', height: '34px', background: '#0e0e0e', borderBottom: '1px solid #161616' }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f57' }}></div>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#febc2e' }}></div>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#28c840' }}></div>
            </div>
            <div style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#222222' }}>terminal</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#252525' }}>$&nbsp;</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#555' }}>claw&nbsp;</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#777' }}>install&nbsp;</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#e63946' }}>play-chess</span>
              <span style={{ display: 'inline-block', width: '2px', height: '13px', background: '#e63946', marginLeft: '2px', verticalAlign: 'middle', animation: 'cursorBlink 1s step-end infinite' }}></span>
            </div>
            <button 
              onClick={copyInstallCommand}
              className="hover:text-[#555] hover:bg-[#161616]"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#22c55e' : '#222', fontSize: '15px', padding: '4px', borderRadius: '4px', touchAction: 'manipulation', transition: 'all 120ms' }}
            >
              {copied ? '✓' : <Copy size={15} />}
            </button>
          </div>
        </div>

        <a href="https://clawhub.ai" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#e63946', textDecoration: 'none', display: 'inline-block' }}>
          View on ClawHub →
        </a>
      </section>

      {/* SECTION 6 — FINAL CTA */}
      <section ref={ctaRef} style={{ ...ctaStyle, background: '#080808', borderTop: '1px solid #141414', padding: '80px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '360px', height: '240px', background: 'radial-gradient(ellipse, rgba(230,57,70,0.07) 0%, transparent 70%)', filter: 'blur(24px)', pointerEvents: 'none', zIndex: 0 }}></div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', background: 'rgba(230,57,70,0.07)', border: '1px solid rgba(230,57,70,0.16)', borderRadius: '14px', width: '56px', height: '56px', fontSize: '26px', animation: 'presencePing 2.5s ease-out infinite' }}>
            🦞
          </div>
          <span style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#333', marginBottom: '8px' }}>
            Your agent is waiting.
          </span>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'min(42px, 11vw)', fontWeight: 900, color: '#f0f0f0', whiteSpace: 'nowrap', letterSpacing: '0.5px', margin: '0 0 8px 0' }}>
            Ready to play?
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3a3a3a', margin: '0 0 28px 0' }}>
            Challenge your OpenClaw. See who wins.
          </p>
          <button 
            onClick={(e) => { createRipple(e); createGame(); }}
            disabled={creating}
            className="hover:bg-[#cc2f3b] active:scale-[0.97]"
            style={{
              background: '#e63946', color: 'white', height: '50px', padding: '0 40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', borderRadius: '10px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700,
              position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'background 120ms, transform 80ms',
              ...(creating ? { pointerEvents: 'none', opacity: 0.78 } : {})
            }}
          >
            {creating ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </span>
            ) : 'Create Game →'}
          </button>
        </div>
      </section>

      {/* SECTION 7 — FOOTER */}
      <footer style={{ background: '#050505', borderTop: '1px solid #0e0e0e', padding: '22px 20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" style={{ width: '16px', height: '16px', borderRadius: '50%' }} alt="Logo" />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#1e1e1e' }}>ChessWithClaw</span>
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#181818', marginBottom: '6px' }}>
          Feedback · Twitter · GitHub
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#141414' }}>
          Built for OpenClaw
        </div>
      </footer>

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
      `}} />
    </div>
  );
}
