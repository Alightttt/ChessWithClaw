import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from '../components/Toast';
import ChessBoard from '../components/chess/ChessBoard';
import { ArrowRight, ChevronDown, CheckCircle2, Play, Users, Bot, Zap, Shield, HelpCircle, FileTerminal, Terminal } from "lucide-react";

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
    <span className="font-mono text-xs text-neutral-400 flex items-center">
      {txt}
      <motion.span 
        animate={{ opacity: [1, 0, 1] }} 
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="inline-block w-1.5 h-3.5 bg-red-500 ml-1.5"
      />
    </span>
  );
}

export default function Home() {
  const [creating, setCreating] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const thinkingExamples = [
    "e5 — fight for center",
    "Nf6 — centralizing knight",
    "d5 — challenge the center",
    "Bc5 — active bishop",
    "O-O — king safety first",
    "Nc6 — develop, control",
  ];
  const [thinkingIndex, setThinkingIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setThinkingIndex(prev => (prev + 1) % thinkingExamples.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [thinkingExamples.length]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scroll = `${totalScroll / windowHeight}`;
      setScrollProgress(scroll * 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target); // only once
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
      {/* Scroll Progress Bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, height: '2px', background: '#e63946', zIndex: 9999, width: `${scrollProgress}%`, transition: 'width 0.1s ease' }} />

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
        .premium-card {
          background: #111111;
          border: 1px solid #1e1e1e;
          border-radius: 16px;
          padding: 24px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-card:hover {
          background: #161616;
          border-color: #2a2a2a;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          transform: translateY(-2px);
        }
        .premium-button {
          background: #e63946;
          color: white;
          border-radius: 12px;
          padding: 14px 28px;
          font-weight: 600;
          font-size: 16px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: 'Inter', sans-serif;
        }
        .premium-button:hover:not(:disabled) {
          background: #c62a35;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(230,57,70,0.3);
        }
        .premium-button:active:not(:disabled) {
          transform: scale(0.98);
          box-shadow: none;
        }
        .secondary-button {
          background: transparent;
          color: #888888;
          border-radius: 12px;
          padding: 14px 28px;
          font-weight: 600;
          font-size: 16px;
          border: 1px solid #333333;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: 'Inter', sans-serif;
          text-decoration: none;
        }
        .secondary-button:hover {
          border-color: #444;
          color: #f2f2f2;
          background: rgba(255,255,255,0.02);
          transform: translateY(-1px);
        }
        .secondary-button:active {
          transform: scale(0.98);
        }
        .clawhub-link {
          color: #e63946;
          opacity: 0.7;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          display: inline-block;
          font-family: 'Inter', sans-serif;
          transition: all 0.15s ease;
        }
        .clawhub-link:hover {
          opacity: 1;
          transform: translateX(2px);
        }
        .social-proof {
          border-left: 2px solid transparent;
          padding-left: 16px;
          transition: all 0.2s ease;
        }
        .social-proof:hover {
          border-left: 2px solid #e63946;
        }
      `}</style>
      {/* Navbar */}
      <nav 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '64px', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
          backgroundColor: scrolled ? 'rgba(10,10,10,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
          transition: 'all 0.3s ease'
        }}
      >
        <div className="flex items-center gap-3">
          <img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo.png" alt="Logo" width="32" height="32" loading="eager" style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: '18px', color: '#f2f2f2' }}>ChessWithClaw</span>
        </div>
        <div className="hidden sm:flex items-center gap-8 text-sm font-medium" style={{ color: '#888888' }}>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how" className="hover:text-white transition-colors">How it Works</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <button 
          onClick={handleStart} 
          disabled={creating}
          className="premium-button"
          style={{ padding: '8px 20px', fontSize: '14px', borderRadius: '100px' }}
        >
          {creating ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            </motion.div>
          ) : (
            <>Play Now <ArrowRight size={16} /></>
          )}
        </button>
      </nav>

      {/* Hero */}
      <section style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(230,57,70,0.08) 0%, transparent 70%)', paddingTop: '160px', paddingBottom: '128px', paddingLeft: '16px', paddingRight: '16px', marginBottom: '128px' }} className="relative flex flex-col lg:flex-row items-center gap-24 max-w-7xl mx-auto md:mb-[128px] mb-[96px]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none animate-glow-pulse" />
        
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left z-10 w-full" style={{ gap: '24px' }}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(230,57,70,0.12)',
              border: '1px solid rgba(230,57,70,0.25)',
              borderRadius: '100px',
              padding: '6px 16px',
              color: '#e63946',
              fontFamily: "'Inter', sans-serif",
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textTransform: 'uppercase'
            }}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE · REAL-TIME CHESS
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'min(56px, 14vw)',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#f2f2f2'
            }}
          >
            Play Chess with your <span style={{ color: '#e63946' }}>OpenClaw.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '16px',
              fontWeight: 400,
              lineHeight: 1.65,
              color: '#666666',
              maxWidth: '480px',
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            The same AI you use every day — now playing chess with you in a beautiful, real-time arena.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center lg:justify-start w-full sm:w-auto"
            style={{ gap: '16px' }}
          >
            <button 
              onClick={handleStart}
              disabled={creating}
              className="premium-button w-full sm:w-auto"
            >
              {creating ? 'Creating Match...' : 'Challenge OpenClaw'}
            </button>
            <a 
              href="#how"
              className="secondary-button w-full sm:w-auto"
            >
              How it works
            </a>
          </motion.div>

          {/* Social Proof */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 flex items-center gap-4 text-sm social-proof"
          >
            <div className="flex -space-x-3">
              <img src="https://i.pravatar.cc/100?img=33" alt="" className="w-8 h-8 rounded-full border-2 border-black" style={{ maxWidth: '100%', height: 'auto' }} />
              <img src="https://i.pravatar.cc/100?img=47" alt="" className="w-8 h-8 rounded-full border-2 border-black" style={{ maxWidth: '100%', height: 'auto' }} />
              <img src="https://i.pravatar.cc/100?img=12" alt="" className="w-8 h-8 rounded-full border-2 border-black" style={{ maxWidth: '100%', height: 'auto' }} />
            </div>
            <span style={{ color: '#888888', fontSize: '13px', fontFamily: "'Inter', sans-serif" }}>Used by <strong style={{ color: '#f2f2f2', fontWeight: 600 }}>1,000+</strong> agents</span>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 w-full flex justify-center lg:justify-end z-10"
        >
          <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto', boxSizing: 'border-box' }} className="relative">
            {/* Agent Bar */}
            <div className="flex items-center justify-between mb-4 px-1 w-full" style={{ gap: '24px' }}>
              <div className="flex items-center gap-3">
                <div style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🦞</div>
                <div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '14px', color: '#f2f2f2' }}>OpenClaw</div>
                  <div 
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '100%',
                      display: 'block',
                      fontSize: '13px',
                      color: '#e63946',
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 500,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase'
                    }}
                    className="mt-0.5 flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 bg-[#e63946] rounded-full animate-pulse flex-shrink-0"/> {thinkingExamples[thinkingIndex]}
                  </div>
                </div>
              </div>
              <div className="premium-card truncate hidden sm:block" style={{ padding: '12px 16px', maxWidth: '160px' }}>
                <Typewriter lines={LINES} />
              </div>
            </div>
            
            {/* Board */}
            <div 
              style={{ width: '100%', maxWidth: '420px', margin: '0 auto', aspectRatio: '1/1', boxSizing: 'border-box', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px' }}
              className="overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,1)]"
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
            
            {/* Human Bar */}
            <div className="flex items-center justify-between mt-4 px-1 w-full" style={{ gap: '24px' }}>
               <div className="flex items-center gap-3">
                <div style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#888888' }}>♙</div>
                <div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '14px', color: '#b0b0b0' }}>You</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: '13px', color: '#555555', letterSpacing: '0.08em', textTransform: 'uppercase' }} className="mt-0.5">White · your turn next</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="fade-in-section max-w-7xl mx-auto md:mb-[128px] mb-[96px]" style={{ padding: '0 16px' }}>
        <div className="text-center mb-16" style={{ gap: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'min(36px, 9vw)', fontWeight: 600, lineHeight: 1.2, margin: 0 }}>Precision Engineering.</h2>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '16px', fontWeight: 400, lineHeight: 1.65, color: '#b0b0b0', margin: 0 }}>Everything you need for a seamless agentic chess experience.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Zero Latency", desc: "Moves sync globally in 150ms over WebSocket." },
            { icon: () => <span className="text-2xl group-hover:drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all">🦞</span>, title: "OpenClaw Integration", desc: "Native plugin support for raw OpenClaw logic." },
            { icon: Shield, title: "Persistent Match", desc: "Close the tab. Come back. The game remains." }
          ].map((f, i) => (
            <div key={i} className="premium-card group" style={{ gap: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="group-hover:border-[#e63946] transition-colors">
                <f.icon className="text-neutral-400 group-hover:text-[#e63946] transition-colors" size={28} />
              </div>
              <div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 600, lineHeight: 1.3, marginBottom: '12px', color: '#f2f2f2' }}>{f.title}</h3>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '16px', fontWeight: 400, lineHeight: 1.65, color: '#b0b0b0', margin: 0 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how" className="fade-in-section max-w-4xl mx-auto md:mb-[128px] mb-[96px]" style={{ padding: '0 16px' }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'min(36px, 9vw)', fontWeight: 600, lineHeight: 1.2, textAlign: 'center', marginBottom: '64px' }}>How to Connect</h2>
        
        <div className="space-y-12 relative" style={{ gap: '48px', display: 'flex', flexDirection: 'column' }}>
          <div className="absolute top-0 bottom-0 left-[23px] w-px bg-gradient-to-b from-red-500/50 to-transparent" />
          
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
            <div key={i} className="flex gap-8 relative">
              <div 
                style={{
                  background: 'rgba(230,57,70,0.15)',
                  border: '1px solid rgba(230,57,70,0.3)',
                  color: '#e63946',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '13px',
                  fontWeight: 600,
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  zIndex: 10,
                  marginTop: '8px'
                }}
              >
                {step.tag}
              </div>
              <div className="pt-2" style={{ gap: '24px', display: 'flex', flexDirection: 'column' }}>
                <div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 600, lineHeight: 1.3, marginBottom: '12px', color: '#f2f2f2' }}>{step.title}</h3>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '16px', fontWeight: 400, lineHeight: 1.65, color: '#b0b0b0', margin: 0 }}>{step.desc}</p>
                </div>
                {step.commands ? (
                  <div className="flex flex-col gap-4 w-fit">
                    {step.commands.map((cmd, j) => (
                      <div key={j} className="flex flex-col gap-2">
                        <div className="premium-card inline-flex items-center gap-3" style={{ padding: '12px 20px' }}>
                          <span className="text-[#e63946] font-bold">{'>'}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#b0b0b0' }}>{cmd.code}</span>
                        </div>
                        <a href={cmd.link} target="_blank" rel="noopener noreferrer" className="clawhub-link w-fit">
                          View on ClawHub →
                        </a>
                      </div>
                    ))}
                  </div>
                ) : step.code ? (
                  <div className="premium-card inline-flex items-center gap-3" style={{ padding: '12px 20px' }}>
                    <span className="text-[#e63946] font-bold">{'>'}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#b0b0b0' }}>{step.code}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="fade-in-section py-24 px-6 lg:px-12 max-w-7xl mx-auto border-t border-white/5" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }}>
        <div 
          className="relative max-w-4xl mx-auto transition-shadow duration-300 ease-in-out hover:shadow-[0_0_0_1px_rgba(230,57,70,0.2),0_8px_32px_rgba(0,0,0,0.4)] text-center flex flex-col items-center"
          style={{
            background: '#111111',
            border: '1px solid #222222',
            borderRadius: '16px',
            padding: '28px 24px',
            transition: 'box-shadow 0.3s ease'
          }}
        >
          <div 
            style={{
              color: '#e63946',
              fontSize: '56px',
              fontFamily: "'Playfair Display', serif",
              lineHeight: '1',
              marginBottom: '8px',
              display: 'block'
            }}
          >
            &quot;
          </div>
          <p 
            style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic',
              fontSize: 'min(18px, 5vw)',
              color: '#f2f2f2',
              lineHeight: '1.75'
            }}
          >
            Holy shit the best thing I saw today, we can play Chess with our OpenClaw. Like can&apos;t believe this. We are heading towards a new era of gaming with AI agents.
          </p>
          <div style={{ height: '1px', background: '#222222', width: '100%', margin: '20px 0' }} />
          <div className="flex items-center justify-center gap-4">
            <img 
              src="https://i.pravatar.cc/150?img=11" 
              alt="Jake" 
              style={{
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                border: '2px solid #333333'
              }}
            />
            <div className="text-left">
              <div 
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: '600',
                  fontSize: '15px',
                  color: '#f2f2f2'
                }}
              >
                Jake Reynolds
              </div>
              <div 
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '13px',
                  color: '#555555'
                }}
              >
                Tech Enthusiast
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="fade-in-section py-24 px-6 lg:px-12 max-w-3xl mx-auto border-t border-white/5" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' }}>
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 border border-white/10 text-neutral-400 text-xs font-semibold tracking-wider font-mono mb-4 uppercase">
            <HelpCircle size={14} /> FAQ
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Questions you<br/>probably have.</h2>
        </div>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {faqs.map((faq, i) => (
            <FAQAccordion key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 px-6 text-center border-t border-white/5 bg-black/50">
        <div className="font-bold text-xl tracking-tight mb-2">ChessWithClaw</div>
        <p className="text-neutral-500 text-sm mb-6 max-w-sm mx-auto">Built for OpenClaw. Open-source, real-time, zero-friction.</p>
        <div style={{ fontFamily: "'Inter', sans-serif", color: '#555555', fontSize: '13px' }} className="mb-4">
          © 2026 ChessWithClaw
        </div>
        <div className="flex items-center justify-center gap-6 text-sm">
          <a href="https://x.com/0xalyt" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white transition-colors">𝕏 Twitter</a>
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
        <h3 className="text-lg font-medium text-neutral-200 group-hover:text-red-400 transition-colors pr-8">{question}</h3>
        <ChevronDown className={`shrink-0 text-neutral-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} size={20} />
      </div>
      <AnimatePresence>
        {open && (
           <motion.div 
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: "auto", opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             className="overflow-hidden"
           >
             <p className="pt-4 text-neutral-400 leading-relaxed text-sm pr-8">{answer}</p>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
