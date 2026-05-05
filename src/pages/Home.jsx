import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from '../components/Toast';
import ChessBoard from '../components/chess/ChessBoard';
import { ChevronDown, Zap, Shield } from "lucide-react";

const LINES = [
  "Analyzing d5 push...",
  "Bishop c4 is strong.",
  "Checking Nf4 response...",
  "Rook d8 centralizes.",
  "Yes. Rd8."
];

function Typewriter({ lines }) {
  const [li, setLi] = useState(0);
  const [ci, setCi] = useState(0);
  const [txt, setTxt] = useState("");

  useEffect(() => {
    const l = lines[li];
    if (ci < l.length) {
      const t = setTimeout(() => {
        setTxt(l.slice(0, ci + 1));
        setCi(x => x + 1);
      }, 42);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setLi(x => (x + 1) % lines.length);
        setCi(0);
        setTxt("");
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [li, ci, lines]);

  return (
    <span className="font-mono text-xs flex items-center" style={{ color: '#e63946', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
      {txt}
      <motion.span 
        animate={{ opacity: [1, 0, 1] }} 
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="inline-block w-1.5 h-3.5 bg-[#e63946] ml-1.5"
      />
    </span>
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
          background: #111111;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }
        .design-card:hover {
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px);
        }
        
        .design-btn-primary {
          background: #e63946;
          color: white;
          border-radius: 8px;
          height: 56px;
          padding: 0 32px;
          font-family: "'Poppins', sans-serif";
          font-weight: 600;
          font-size: 16px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: rgba(0,0,0,0.08) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.16) 0px -0.5px 0px 0px inset, rgba(0,0,0,0.3) 0px 0px 0px 0.5px inset, rgba(255,255,255,0.15) 0px 1px 0px 0px inset, rgba(255,255,255,0.1) 0px -1px 0px 0px inset, rgba(0,0,0,0.15) 0px 2px 4px -1px, rgba(0,0,0,0.1) 0px 4px 8px -2px;
        }
        .design-btn-primary:hover:not(:disabled) {
          box-shadow: rgba(0,0,0,0.08) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.16) 0px -0.5px 0px 0px inset, rgba(0,0,0,0.3) 0px 0px 0px 0.5px inset, rgba(255,255,255,0.15) 0px 1px 0px 0px inset, rgba(255,255,255,0.1) 0px -1px 0px 0px inset, rgba(0,0,0,0.15) 0px 2px 4px -1px, rgba(0,0,0,0.1) 0px 4px 8px -2px, rgba(0,0,0,0.25) 0px 8px 20px 0px;
          transform: translateY(-1px);
        }
        .design-btn-primary:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: rgba(0,0,0,0.1) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.2) 0px -0.5px 0px 0px inset, rgba(0,0,0,0.35) 0px 0px 0px 0.5px inset, rgba(255,255,255,0.1) 0px 0.5px 0px 0px inset;
        }
        
        .design-btn-nav {
          background: #e63946;
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
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: rgba(0,0,0,0.08) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.16) 0px -0.5px 0px 0px inset, rgba(0,0,0,0.3) 0px 0px 0px 0.5px inset, rgba(255,255,255,0.15) 0px 1px 0px 0px inset, rgba(255,255,255,0.1) 0px -1px 0px 0px inset, rgba(0,0,0,0.15) 0px 2px 4px -1px, rgba(0,0,0,0.1) 0px 4px 8px -2px;
        }
        .design-btn-nav:hover:not(:disabled) {
          box-shadow: rgba(0,0,0,0.08) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.16) 0px -0.5px 0px 0px inset, rgba(0,0,0,0.3) 0px 0px 0px 0.5px inset, rgba(255,255,255,0.15) 0px 1px 0px 0px inset, rgba(255,255,255,0.1) 0px -1px 0px 0px inset, rgba(0,0,0,0.15) 0px 2px 4px -1px, rgba(0,0,0,0.1) 0px 4px 8px -2px, rgba(0,0,0,0.25) 0px 8px 20px 0px;
          transform: translateY(-1px);
        }
        .design-btn-nav:active:not(:disabled) {
          transform: translateY(1px);
          box-shadow: rgba(0,0,0,0.1) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.2) 0px -0.5px 0px 0px inset, rgba(0,0,0,0.35) 0px 0px 0px 0.5px inset, rgba(255,255,255,0.1) 0px 0.5px 0px 0px inset;
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
          <img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" alt="ChessWithClaw Logo" style={{ width: 'clamp(140px, 20vw, 180px)', height: 'auto', objectFit: 'contain', flexShrink: 0, display: 'block' }} />
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
          marginBottom: '48px',
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

        <div className="flex-1 flex flex-col items-center text-center z-10 w-full" style={{ gap: '24px', position: 'relative', zIndex: 1 }}>
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
            style={{ maxWidth: '360px', position: 'relative', marginTop: '16px' }}
          >
            <div style={{ padding: '8px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '12px', filter: 'drop-shadow(0 0 40px rgba(230,57,70,0.15))' }}>
              <div className="flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🦞</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, color: '#f2f2f2' }}>OpenClaw</span>
                </div>
                <Typewriter lines={LINES} />
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
              className="design-btn-primary w-full sm:w-auto"
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

      <section id="features" className="fade-in-section max-w-5xl mx-auto" style={{ marginBottom: '64px', padding: '24px 20px 0' }}>
        <div className="text-center mb-12" style={{ gap: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'min(40px, 10vw)', fontWeight: 800, lineHeight: 1.2, margin: '0 0 48px 0', color: '#f2f2f2', letterSpacing: '-0.03em', textAlign: 'center' }}>Built for the game.</h2>
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

      <section id="how" className="fade-in-section max-w-4xl mx-auto" style={{ marginBottom: '64px', padding: '0 20px' }}>
        <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'min(36px, 9vw)', fontWeight: 800, lineHeight: 1.2, textAlign: 'center', marginBottom: '64px', letterSpacing: '-0.03em' }}>How to Connect</h2>
        
        <div className="space-y-12" style={{ gap: '48px', display: 'flex', flexDirection: 'column' }}>
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
        <div className="social-proof-card">
          <div className="flex gap-4">
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #e63946, #8b1a21)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '16px', fontWeight: '700', fontFamily: "'Inter', sans-serif", border: '2px solid rgba(230,57,70,0.3)', flexShrink: 0 }}>
              J
            </div>
            <div>
              <div style={{ color: '#e63946', fontSize: '48px', fontFamily: "'Poppins', sans-serif", lineHeight: 1, marginBottom: '8px', marginTop: '-12px' }}>&quot;</div>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontStyle: 'italic', fontSize: '17px', lineHeight: 1.7, color: 'rgba(242,242,242,0.85)', marginBottom: '16px', marginTop: '-16px', fontWeight: 300 }}>
                Holy shit the best thing I saw today, we can play Chess with our OpenClaw. Like can&apos;t believe this. We are heading towards a new era of gaming with OpenClaws.
              </p>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '15px', color: '#f2f2f2' }}>Jake Reynolds</div>
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

      <section className="fade-in-section text-center" style={{ marginBottom: '64px', padding: '0 20px' }}>
        <div className="max-w-2xl mx-auto flex flex-col items-center" style={{ gap: '24px' }}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'min(48px, 11vw)', fontWeight: 800, lineHeight: 1.1, color: '#f2f2f2', letterSpacing: '-0.03em' }}>Ready to challenge OpenClaw?</h2>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300, fontSize: '18px', color: 'rgba(242,242,242,0.6)', marginBottom: '8px' }}>Start a match instantly. No sign-up required.</p>
          <button 
             onClick={handleStart}
             disabled={creating}
             className="design-btn-primary"
          >
             {creating ? 'Taking you to the board...' : 'Enter the Arena'}
          </button>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #1a1a1a', padding: '48px 24px', textAlign: 'center', background: '#0a0a0a' }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'rgba(242,242,242,0.3)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <span>© 2026 ChessWithClaw</span>
          <a href="https://x.com/0xalyt" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(242,242,242,0.5)', textDecoration: 'none', transition: 'color 0.2s ease' }} onMouseOver={e => e.currentTarget.style.color = '#f2f2f2'} onMouseOut={e => e.currentTarget.style.color = 'rgba(242,242,242,0.5)'}>x.com/0xalyt</a>
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
