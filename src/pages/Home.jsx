import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from '../components/Toast';
import ChessBoard from '../components/chess/ChessBoard';
import { ChevronDown, Zap, Shield } from "lucide-react";

const DEMO_THOUGHTS = [
    "Hmm... I wonder what you'll play first 👀",
    "Ready when you are. Don't keep me waiting 😏",
    "Yaar, iss baar main nahi harunga 😤",
    "I've been studying your patterns...",
    "Every game tells a story. Let's write ours 🦞",
    "Okay okay, let's see what you've got",
];

function ThoughtBubble() {
  const [thoughtIdx, setThoughtIdx] = useState(0);
  const [displayedThought, setDisplayedThought] = useState('');

  useEffect(() => {
    const t = setInterval(() => {
      setThoughtIdx(i => (i + 1) % DEMO_THOUGHTS.length);
      setDisplayedThought('');
    }, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const target = DEMO_THOUGHTS[thoughtIdx];
    if (displayedThought.length < target.length) {
      const t = setTimeout(() => {
        setDisplayedThought(target.slice(0, displayedThought.length + 1));
      }, 30);
      return () => clearTimeout(t);
    }
  }, [displayedThought, thoughtIdx]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={thoughtIdx}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute',
          bottom: '100%',
          right: '8px',
          marginBottom: '8px',
          padding: '8px 12px',
          background: 'rgba(230,57,70,0.1)',
          border: '1px solid rgba(230,57,70,0.2)',
          borderRadius: '12px 12px 0 12px',
          color: '#f2f2f2',
          fontFamily: "'Poppins', sans-serif",
          fontSize: '13px',
          fontWeight: 300,
          maxWidth: '85%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          zIndex: 30
        }}
      >
        {displayedThought}
        {displayedThought.length < DEMO_THOUGHTS[thoughtIdx].length && (
          <span className="inline-block w-1.5 h-3 bg-[#e63946] ml-1 align-middle animate-pulse" />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default function Home() {
  const [creating, setCreating] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.fade-in-section').forEach(el => {
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleStart = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!data.id) {
        toast.error('Game created but ID missing. Please try again.');
        return;
      }
      if (data.secret_token) {
        localStorage.setItem(`game_owner_${data.id}`, data.secret_token);
      }
      navigate(`/created/${data.id}`, { state: { agentToken: data.agent_token } });
    } catch (err) {
      toast.error('Network error. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const faqs = [
    { q: "Does my OpenClaw need special configuration?", a: "Yes. Install the chess skill first: npx clawhub install play-chess. After that, send it the invite and it connects automatically." },
    { q: "What exactly does the skill.md file teach my OpenClaw?", a: "The skill.md file contains full chess knowledge, rules, platform protocols, and optimal connection methods." },
    { q: "Is ChessWithClaw actually free?", a: "Yes. No subscriptions, no premium tier, no ads. Free for every OpenClaw user, forever." },
    { q: "What if my OpenClaw disconnects mid-game?", a: "Games are persistent. Your OpenClaw reconnects and continues from exactly where it left off." },
  ];

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#f2f2f2' }} className="font-sans overflow-x-hidden selection:bg-red-500/30">
      <style>{`
        .fade-in-section {
          opacity: 0.01;
          transform: translateY(24px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .fade-in-section.is-visible {
          opacity: 1;
          transform: translateY(0);
        }
        img { 
          max-width: 100%; 
          height: auto;
        }
        
        .design-card {
          background: linear-gradient(145deg, #1b1a19 0%, #161514 100%);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: all 0.2s ease;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .design-card:hover {
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0,0,0,0.5);
        }
        
        .design-btn-nav {
          background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.04) 100%), #e63946;
          color: white;
          border-radius: 8px;
          padding: 8px 16px;
          font-family: "'Poppins', sans-serif";
          font-weight: 600;
          font-size: 14px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s ease;
          box-shadow: rgba(255,255,255,0.18) 0px 1px 0px 0px inset, rgba(0,0,0,0.22) 0px -1px 0px 0px inset, rgba(0,0,0,0.22) 0px 0px 0px 0.5px inset;
        }
        .design-btn-nav:hover:not(:disabled) {
          background: linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(0,0,0,0.03) 100%), #e63946;
          transform: translateY(-1px);
        }
        .design-btn-nav:active:not(:disabled) {
          background: linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(255,255,255,0.02) 100%), #c62e39;
          transform: translateY(0);
          box-shadow: rgba(255,255,255,0.10) 0px 0.5px 0px inset, rgba(0,0,0,0.28) 0px -0.5px 0px inset, rgba(0,0,0,0.28) 0px 0px 0px 0.5px inset;
        }
        
        .design-btn-secondary {
          background: transparent;
          color: rgba(242,242,242,0.6);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          height: 56px;
          padding: 0 32px;
          font-family: "'Poppins', sans-serif";
          font-weight: 600;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .design-btn-secondary:hover:not(:disabled) {
          color: rgba(242,242,242,0.9);
          border-color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.04);
        }
        .design-btn-secondary:active:not(:disabled) {
          transform: scale(0.98);
        }

        .x-link-lovable {
          background: #0a0a0a;
          color: white;
          padding: 8px 16px;
          border-radius: 9999px;
          text-decoration: none;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 1), 0 0 16px -4px rgba(255, 255, 255, 0.1);
        }
        .x-link-lovable::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%);
          pointer-events: none;
        }
        .x-link-lovable:hover {
          transform: translateY(-1px);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 1), 0 0 24px -4px rgba(255, 255, 255, 0.15);
        }
        .x-link-lovable:active {
          transform: translateY(0);
        }

        .clawhub-link {
          color: #e63946;
          opacity: 0.7;
          font-size: 13px;
          font-family: "'Poppins', sans-serif";
          text-decoration: none;
          display: inline-block;
          transition: all 0.15s ease;
        }
        .clawhub-link:hover {
          opacity: 1;
        }

        .social-proof-card {
          background: rgba(17,17,17,0.9);
          border: 1px solid #1e1e1e;
          border-radius: 16px;
          padding: 28px;
          transition: all 0.2s ease;
          text-align: left;
        }
        .social-proof-card:hover {
          border-left: 2px solid #e63946;
        }
      `}</style>
      
      <nav 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '72px', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
          backgroundColor: scrolled ? 'rgba(10,10,10,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
          transition: 'all 0.3s ease',
          borderBottom: scrolled ? '1px solid #1a1a1a' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw Logo" 
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            style={{ 
              width: '175px', 
              height: 'auto', 
              objectFit: 'contain', 
              flexShrink: 0, 
              display: 'block',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 2px 10px rgba(230,57,70,0.15))'
            }} 
          />
        </div>
        <button 
          onClick={handleStart} 
          disabled={creating}
          className="design-btn-nav"
        >
          {creating ? 'Loading...' : 'Play Now'}
        </button>
      </nav>

      <section 
        style={{ 
          background: 'none', 
          paddingTop: 'clamp(90px, 12vh, 110px)', 
          paddingBottom: 'clamp(48px, 8vh, 80px)', 
          paddingLeft: '20px', 
          paddingRight: '20px', 
          marginBottom: '0px',
          position: 'relative',
          overflow: 'hidden'
        }} 
        className="flex flex-col items-center max-w-7xl mx-auto"
      >
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          height: '600px',
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(230,57,70,0.08) 0%, rgba(230,57,70,0.02) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        <div className="flex-1 flex flex-col items-center text-center z-10 w-full" style={{ gap: '16px', position: 'relative', zIndex: 1 }}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(230,57,70,0.1)',
              border: '1px solid rgba(230,57,70,0.2)',
              borderRadius: '9999px',
              padding: '6px 16px',
              color: '#f2f2f2',
              fontFamily: "'Inter', sans-serif",
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <span style={{ color: '#e63946' }}>●</span> LIVE · REAL-TIME CHESS
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 'clamp(56px, 14vw, 84px)',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: '#f2f2f2',
            }}
          >
            Play Chess with your <span style={{ color: '#e63946' }}>OpenClaw.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(15px, 4vw, 18px)',
              fontWeight: 300,
              lineHeight: 1.65,
              color: 'rgba(242,242,242,0.5)',
              maxWidth: '560px',
              margin: '0 auto',
            }}
          >
            The OpenClaw you use every day — fighting you for board control in a beautiful, real-time arena. No latency.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full z-10 mx-auto"
            style={{ maxWidth: '360px', position: 'relative' }}
          >
            <div style={{ padding: '8px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '12px', filter: 'drop-shadow(0 0 40px rgba(230,57,70,0.15))' }}>
              <div className="flex items-center justify-between mb-3 px-2 relative" style={{ position: 'relative' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🦞</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, color: '#f2f2f2' }}>OpenClaw</span>
                </div>
                <ThoughtBubble />
              </div>
              <div 
                style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', border: '1px solid #1e1e1e', borderRadius: '8px', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
              >
                <ChessBoard 
                  fen="r1q1rk2/pp2bppp/2p1pn2/3p4/2BPP3/2N2N2/PPP2PPP/R1BQ1RK1 w - - 0 1"
                  interactive={false}
                  showCoordinates={false}
                  boardTheme="green"
                  pieceTheme="merida"
                  lastMove={{ from: 'c4', to: 'd5' }}
                />
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center w-full sm:w-auto"
            style={{ gap: '16px', marginTop: '24px' }}
          >
            <button 
              onClick={handleStart}
              disabled={creating}
              className="design-btn-primary h-14 px-8 font-['Poppins'] text-base flex items-center justify-center gap-3 rounded-lg w-full sm:w-auto"
            >
              {creating ? 'Creating Match...' : 'Challenge OpenClaw'}
            </button>
            <a 
              href="#how"
              className="design-btn-secondary w-full sm:w-auto"
            >
              How it works
            </a>
          </motion.div>
        </div>
      </section>

      <section id="features" className="fade-in-section max-w-5xl mx-auto" style={{ marginBottom: '64px', padding: '0px 20px 0' }}>
        <div className="text-center mb-12" style={{ gap: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'min(40px, 10vw)', fontWeight: 800, lineHeight: 1.2, margin: 0, color: '#f2f2f2', letterSpacing: '-0.03em', textAlign: 'center' }}>Built for the game.</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Zero Latency", desc: "Moves sync globally in 150ms over WebSocket." },
            { icon: () => <span className="text-2xl">🦞</span>, title: "OpenClaw Integration", desc: "Native plugin support for raw OpenClaw logic." },
            { icon: Shield, title: "Persistent Match", desc: "Close the tab. Come back. The game remains." }
          ].map((f, i) => (
            <div key={i} className="design-card" style={{ gap: '20px', display: 'flex', flexDirection: 'column' }}>
              <f.icon className="text-[#e63946]" size={28} />
              <div>
                <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 700, lineHeight: 1.3, marginBottom: '8px', color: '#f2f2f2', letterSpacing: '-0.02em' }}>{f.title}</h3>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', fontWeight: 300, lineHeight: 1.6, color: 'rgba(242,242,242,0.6)', margin: 0 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="agents" style={{ background: '#0a0a0a', padding: '40px 24px', textAlign: 'center', margin: '0' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'min(36px, 9vw)', fontWeight: 800, lineHeight: 1.2, textAlign: 'center', marginBottom: '12px', letterSpacing: '-0.03em', color: '#f2f2f2' }}>Supported Agents</h2>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'min(32px, 5vw)', flexWrap: 'wrap', marginBottom: '32px', marginTop: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div 
                className="transition-all duration-200 hover:border-[#333333] hover:scale-105 cursor-pointer"
                style={{ 
                  width: '180px', height: '64px', borderRadius: '14px', border: '1px solid #222222', background: '#111111', 
                  backgroundImage: "url('https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/openclaw.png')",
                  backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center'
                }}
              ></div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div 
                className="transition-all duration-200 hover:border-[#333333] hover:scale-105 cursor-pointer"
                style={{ 
                  width: '180px', height: '64px', borderRadius: '14px', border: '1px solid #222222', background: '#111111', 
                  backgroundImage: "url('https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/hermes.png')",
                  backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center'
                }}
              ></div>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '13px 32px', border: '1px solid #2a2a2a', borderRadius: '100px', background: '#111111', fontFamily: "'Inter', sans-serif", fontSize: '15px', color: '#f2f2f2', fontWeight: 500 }}>
              or any personal agent supported
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="fade-in-section max-w-4xl mx-auto" style={{ marginBottom: '64px', padding: '0 20px' }}>
        <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'min(36px, 9vw)', fontWeight: 800, lineHeight: 1.2, textAlign: 'center', marginBottom: '48px', letterSpacing: '-0.03em' }}>How to Connect</h2>
        
        <div className="space-y-8" style={{ gap: '32px', display: 'flex', flexDirection: 'column' }}>
          {[
            { 
              tag: "01", 
              title: "Install the plugin", 
              desc: "Give your OpenClaw the ability to play.", 
              commands: [
                {
                  code: "npx clawhub install play-chess",
                  link: "https://clawhub.ai/Alightttt/play-chess"
                },
                {
                  code: "npx clawhub install agent-browser-clawdbot",
                  link: "https://clawhub.ai/Alightttt/agent-browser-clawdbot"
                }
              ]
            },
            { tag: "02", title: "Create a match", desc: "Click Play Now to generate a secure real-time game room for you and your OpenClaw." },
            { tag: "03", title: "Send the invite", desc: "Copy the invite text and drop it into your CLI or web interface to start." }
          ].map((step, i) => (
            <div key={i} className="flex gap-6 sm:gap-8">
              <div 
                style={{
                  background: 'rgba(230,57,70,0.12)',
                  border: '1px solid rgba(230,57,70,0.2)',
                  color: '#e63946',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  fontWeight: 600,
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '4px'
                }}
              >
                {step.tag}
              </div>
              <div style={{ gap: '16px', display: 'flex', flexDirection: 'column' }}>
                <div>
                  <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 700, lineHeight: 1.3, marginBottom: '8px', color: '#f2f2f2', letterSpacing: '-0.02em' }}>{step.title}</h3>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', fontWeight: 300, lineHeight: 1.6, color: 'rgba(242,242,242,0.6)', margin: 0 }}>{step.desc}</p>
                </div>
                {step.commands && (
                  <div className="flex flex-col gap-4 w-fit">
                    {step.commands.map((cmd, j) => (
                      <div key={j} className="flex flex-col gap-2">
                        <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ color: '#e63946', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600 }}>{'>'}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: 'rgba(242,242,242,0.7)' }}>{cmd.code}</span>
                        </div>
                        <a href={cmd.link} target="_blank" rel="noopener noreferrer" className="clawhub-link">
                          View on ClawHub →
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="fade-in-section max-w-4xl mx-auto" style={{ marginBottom: '64px', padding: '0 20px' }}>
        <div className="social-proof-card" style={{ display: 'flex', flexDirection: 'column', padding: '32px 40px', gap: '20px' }}>
          <div style={{ color: '#e63946', fontSize: '24px', display: 'flex', gap: '4px', letterSpacing: '2px' }}>
            {"★★★★★"}
          </div>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '19px', lineHeight: 1.6, color: 'rgba(242,242,242,0.92)', fontWeight: 400 }}>
            &quot;Holy shit the best thing I saw today, we can play Chess with our OpenClaw. Like can&apos;t believe this. We are heading towards a new era of gaming with OpenClaws.&quot;
          </p>
          <div className="flex items-center gap-4 mt-4">
            <img 
              src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=120&h=120&auto=format&fit=crop" 
              alt="Jake Reynolds" 
              style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} 
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '16px', color: '#f2f2f2' }}>Jake Reynolds</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '14px', color: 'rgba(242,242,242,0.5)' }}>@jake_tech</span>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="fade-in-section max-w-3xl mx-auto" style={{ marginBottom: '64px', padding: '0 20px' }}>
        <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'min(36px, 9vw)', fontWeight: 800, lineHeight: 1.2, textAlign: 'center', marginBottom: '48px', letterSpacing: '-0.03em' }}>Questions</h2>
        <div style={{ borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a' }} className="divide-y divide-[#1a1a1a]">
          {faqs.map((faq, i) => (
            <FAQAccordion key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </section>

      <section className="fade-in-section text-center" style={{ marginBottom: '40px', padding: '0 20px' }}>
        <div className="max-w-2xl mx-auto flex flex-col items-center" style={{ gap: '24px' }}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'min(48px, 11vw)', fontWeight: 800, lineHeight: 1.1, color: '#f2f2f2', letterSpacing: '-0.03em' }}>Ready to challenge OpenClaw?</h2>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300, fontSize: '18px', color: 'rgba(242,242,242,0.6)', marginBottom: '8px' }}>Start a match instantly. No sign-up required.</p>
          <button 
             onClick={handleStart}
             disabled={creating}
             className="design-btn-primary h-14 px-8 font-['Poppins'] text-base flex items-center justify-center gap-3 rounded-lg"
          >
             {creating ? 'Taking you to the board...' : 'Enter the Arena'}
          </button>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #1a1a1a', paddingTop: '24px', paddingBottom: '0', background: '#0a0a0a', overflow: 'hidden' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between font-['Inter'] text-sm text-[rgba(242,242,242,0.5)] mb-6">
            <span style={{ fontWeight: 500 }}>© 2026 ChessWithClaw</span>
            <a 
              href="https://x.com/0xalyt" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="x-link-lovable"
            >
              x.com ↗
            </a>
          </div>
        </div>
        <div style={{ width: '100%', overflow: 'hidden' }} className="mt-8">
          <svg 
            viewBox="0 0 1000 120" 
            style={{ width: '100%', height: 'auto', display: 'block' }} 
            className="text-[#e63946]"
          >
            <text 
              x="50%" 
              y="100" 
              textAnchor="middle"
              fontFamily="'Inter', sans-serif" 
              fontWeight="900" 
              fill="currentColor" 
              letterSpacing="-0.03em"
              fontSize="120"
              textLength="1000"
              lengthAdjust="spacingAndGlyphs"
            >
              ChessWithClaw
            </text>
          </svg>
        </div>
      </footer>
    </div>
  );
}

function FAQAccordion({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-6 cursor-pointer group" onClick={() => setOpen(!open)}>
      <div className="flex justify-between items-center text-left">
        <h3 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '16px', color: '#f2f2f2', letterSpacing: '-0.02em' }} className="pr-8">{question}</h3>
        <ChevronDown className={`shrink-0 text-[#555555] transition-transform duration-300 ${open ? 'rotate-180 text-[#e63946]' : ''}`} size={20} />
      </div>
      <AnimatePresence>
        {open && (
           <motion.div 
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: "auto", opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             className="overflow-hidden"
             transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
           >
             <p style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300, fontSize: '15px', lineHeight: 1.6, color: 'rgba(242,242,242,0.6)', marginTop: '16px' }} className="pr-8">{answer}</p>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
