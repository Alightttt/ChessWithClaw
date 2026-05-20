import ChessBoard from '../components/chess/ChessBoard';
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from '../components/Toast';
import { ChevronDown, Zap, Shield } from "lucide-react";


const LobsterEmoji = () => <span style={{fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle:'normal'}}>🦞</span>;


const DEMO_THOUGHTS = [
  { text: "Bhai... kya kar raha hai tu", lang: "HI" },
  { text: "I see you. 👀", lang: "EN" },
  { text: "Interesting choice...", lang: "EN" },
  { text: "Yaar seriously? 💀", lang: "HI" },
  { text: "Wait wait wait.", lang: "EN" },
  { text: "Arre bhai... sochne do thoda", lang: "HI" },
  { text: "OKAY. Okay okay. 😤", lang: "EN" },
  { text: "Accha? Yeh plan tha tumhara?", lang: "HI" },
  { text: "Oh. OH.", lang: "EN" },
  { text: "Not bad. Not bad at all.", lang: "EN" },
];

function ThoughtBubble() {
  const [thoughtIdx, setThoughtIdx] = useState(0);
  const [displayedThought, setDisplayedThought] = useState('');

  useEffect(() => {
    const t = setInterval(() => {
      setThoughtIdx(i => (i + 1) % DEMO_THOUGHTS.length);
      setDisplayedThought('');
    }, 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const target = DEMO_THOUGHTS[thoughtIdx].text;
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          justifyContent: 'flex-end',
          marginLeft: '12px',
          overflow: 'hidden',
          maxWidth: '280px'
        }}
      >
        <span style={{
          color: '#e2e2e2',
          fontFamily: "'Inter', sans-serif",
          fontSize: '13px',
          fontWeight: 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center'
        }}>
          {displayedThought}
          {displayedThought.length < DEMO_THOUGHTS[thoughtIdx].text.length && (
            <span className="inline-block w-[3px] h-[12px] bg-[#666] ml-1 align-middle animate-pulse" />
          )}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}




export default function Home() {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const isCreatingRef = React.useRef(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [resumeGame, setResumeGame] = useState(null);

  useEffect(() => {
    const savedGame = localStorage.getItem('cwc_active_game');
    if (savedGame) {
      try {
        const parsed = JSON.parse(savedGame);
        const ageMs = Date.now() - parsed.savedAt;
        const ageHours = ageMs / (1000 * 60 * 60);
        if (ageHours < 23) {
          setResumeGame(parsed);
        }
      } catch(e) {}
    }
    
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

  const handleCreateGame = async () => {
    if (isCreatingRef.current || creating) return;
    isCreatingRef.current = true;
    setCreating(true);
    setCreateError('');
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color: 'w' }),
        signal: controller.signal
      });
      clearTimeout(timer);
      
      if (!res.ok) throw new Error('Server error ' + res.status);
      const data = await res.json();
      if (!data.id) throw new Error('No game ID');
      
      if (data.secret_token) {
        localStorage.setItem(`game_owner_${data.id}`, data.secret_token);
      }
      
      window.location.href = '/created/' + data.id;
      
    } catch (err) {
      clearTimeout(timer);
      setCreating(false);
      isCreatingRef.current = false;
      setCreateError(
        err.name === 'AbortError'
          ? 'Connection timed out. Please try again.'
          : 'Could not create game. Please try again.'
      );
    }
  };

  const faqs = [
    { q: "Does my OpenClaw need special configuration?", a: "Yes. Install the chess skill first: npx clawhub install play-chess. After that, send it the invite and it connects automatically." },
    { q: "What exactly does the skill.md file teach my OpenClaw?", a: "The skill.md file contains full chess knowledge, rules, platform protocols, and optimal connection methods." },
    { q: "Is ChessWithClaw actually free?", a: "Yes. No subscriptions, no premium tier, no ads. Free for every OpenClaw user, forever." },
    { q: "What if my OpenClaw disconnects mid-game?", a: "Games are persistent. Your OpenClaw reconnects and continues from exactly where it left off." },
  ];

  
  if (creating || createError) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white font-sans gap-4 selection:bg-red-500/30">
        {creating && !createError && (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full" />
            </motion.div>
            <div className="font-semibold text-neutral-400 tracking-wide text-sm font-sans animate-pulse">Setting up the arena...</div>
          </>
        )}
        {createError && (
          <div style={{textAlign:'center',padding:'24px'}}>
            <p style={{color:'#f2f2f2',fontFamily:'Inter',marginBottom:'16px'}}>
              {createError}
            </p>
            <button onClick={() => {
              setCreateError('');
              setCreating(false);
              isCreatingRef.current = false;
            }} style={{
              padding:'12px 28px',background:'#e63946',border:'none',
              borderRadius:'8px',color:'#fff',fontFamily:'Inter',cursor:'pointer'
            }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#f2f2f2' }} className="font-sans overflow-x-hidden selection:bg-red-500/30">
      <style>{`
        .fade-in-section {
          opacity: 0.01;
          transform: translateY(24px) translateZ(0);
          will-change: opacity, transform;
          backface-visibility: hidden;
          perspective: 1000px;
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .fade-in-section.is-visible {
          opacity: 1;
          transform: translateY(0) translateZ(0);
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
          will-change: transform;
          transform: translateZ(0);
          backface-visibility: hidden;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .design-card:hover {
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px) translateZ(0);
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
      
      {resumeGame && (
        <div style={{ background: '#111111', borderBottom: '1px solid #222222', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', zIndex: 100, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '800px' }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#f2f2f2' }}>
              <LobsterEmoji /> Your game with <span style={{ fontWeight: 600 }}>{resumeGame.agentName}</span> is waiting
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                onClick={() => navigate(`/game/${resumeGame.gameId}`)}
                style={{ background: 'transparent', border: 'none', color: '#e63946', fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                className="hover:opacity-80 active:scale-95 transition-all"
              >
                Resume →
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('cwc_active_game');
                  setResumeGame(null);
                }}
                style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                className="hover:text-white transition-colors"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <nav 
        style={{
          position: 'fixed', top: resumeGame ? '48px' : 0, left: 0, right: 0, height: '72px', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
          backgroundColor: scrolled ? 'rgba(10,10,10,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
          transition: 'all 0.3s ease',
          borderBottom: scrolled ? '1px solid #1a1a1a' : 'none',
          transform: 'translateZ(0)'
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
        <div className="hidden md:flex items-center gap-3 mr-4">
            <a href="https://x.com/0xalyt" target="_blank" rel="noopener noreferrer" className="design-btn-secondary" style={{ height: '36px', padding: '0 16px', fontSize: '13px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)' }}>x.com/0xalyt</a>
          </div>
          <button 
          onClick={handleCreateGame} 
          disabled={creating}
          className="design-btn-nav"
        >
          {creating ? 'Loading...' : 'Play Now'}
        </button>
      </nav>

      <section 
        style={{ 
          background: 'none', 
          paddingTop: resumeGame ? 'clamp(138px, 15vh, 158px)' : 'clamp(90px, 12vh, 110px)', 
          paddingBottom: 'clamp(48px, 8vh, 80px)', 
          paddingLeft: '20px', 
          paddingRight: '20px', 
          marginBottom: '0px',
          position: 'relative',
          overflow: 'hidden'
        }} 
        className="flex flex-col md:grid md:grid-cols-2 items-center max-w-7xl mx-auto gap-4 md:gap-8"
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

        <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left z-10 w-full" style={{ gap: '16px', position: 'relative', zIndex: 1 }}>
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
          
          <motion.p className="mx-auto md:mx-0" 
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
              
            }}
          >
            The OpenClaw you use every day — fighting you for board control in a beautiful, real-time arena. No latency.
          </motion.p>

          
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="hidden md:flex flex-row items-center justify-start w-auto"
            style={{ gap: '16px', marginTop: '24px' }}
          >
            <button 
              onClick={handleCreateGame}
              disabled={creating}
              className="design-btn-primary h-14 px-8 font-['Poppins'] text-base flex items-center justify-center gap-3 rounded-lg w-auto"
            >
              {creating ? 'Creating Match...' : 'Challenge OpenClaw'}
            </button>
            <a 
              href="#how"
              className="design-btn-secondary w-auto"
            >
              How it works
            </a>
          </motion.div>
        </div>
        
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full z-10 mx-auto md:order-2"
            style={{ maxWidth: '440px', position: 'relative' }}
          >
            <div style={{ padding: '12px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px', filter: 'drop-shadow(0 0 50px rgba(230,57,70,0.2))' }}>
              <div className="flex items-center justify-between mb-4 px-2" style={{ position: 'relative' }}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl"><LobsterEmoji /></span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2' }}>OpenClaw</span>
                </div>
                <ThoughtBubble />
              </div>
              <div 
                style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: '6px' }}
              >
                <div style={{ pointerEvents: 'none' }}>
                  
                <ChessBoard fen="r2qr1k1/1p3p1p/p2p2p1/3P1b2/P1p1N3/5Q2/1PP2PPP/R3R1K1 w - - 0 20" interactive={false} showCoordinates={false} boardTheme="green" pieceTheme="neo" />
                </div>
              </div>
            </div>
          </motion.div>
        
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex md:hidden flex-col items-center justify-center w-full z-10 gap-4"
          >
            <button 
              onClick={handleCreateGame}
              disabled={creating}
              className="design-btn-primary h-14 px-8 font-['Poppins'] text-base flex items-center justify-center gap-3 rounded-lg w-full"
            >
              {creating ? 'Creating Match...' : 'Challenge OpenClaw'}
            </button>
            <a 
              href="#how"
              className="design-btn-secondary w-full text-center"
            >
              How it works
            </a>
          </motion.div>
      </section>

      <section className="fade-in-section max-w-7xl mx-auto" style={{ marginBottom: '64px', padding: '0 20px' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Zero Latency", desc: "Moves sync globally in 150ms over WebSocket." },
            { icon: () => <span className="text-2xl"><LobsterEmoji /></span>, title: "OpenClaw Integration", desc: "Native plugin support for raw OpenClaw logic." },
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


      
      <section id="how" className="fade-in-section max-w-5xl mx-auto" style={{ marginBottom: '80px', padding: '0 20px' }}>
        <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: 'min(36px, 9vw)', fontWeight: 800, lineHeight: 1.2, textAlign: 'center', marginBottom: '48px', letterSpacing: '-0.03em' }}>How to Connect</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="design-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(230,57,70,0.1)', color: '#e63946', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: "'Inter', sans-serif" }}>1</div>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 700, color: '#f2f2f2' }}>Create a Match</h3>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', color: 'rgba(242,242,242,0.6)', lineHeight: 1.6 }}>Click 'Challenge OpenClaw' to generate a unique arena. You will get a special invitation link.</p>
          </div>

          <div className="design-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(230,57,70,0.1)', color: '#e63946', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: "'Inter', sans-serif" }}>2</div>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 700, color: '#f2f2f2' }}>Configure OpenClaw</h3>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', color: 'rgba(242,242,242,0.6)', lineHeight: 1.6 }}>Run <code style={{ color: '#e63946' }}>npx clawhub install play-chess</code> and <code style={{ color: '#e63946' }}>agent-browser-clawdbot</code> to prep your agent.</p>
          </div>

          <div className="design-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(230,57,70,0.1)', color: '#e63946', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontFamily: "'Inter', sans-serif" }}>3</div>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 700, color: '#f2f2f2' }}>Send the Invite</h3>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', color: 'rgba(242,242,242,0.6)', lineHeight: 1.6 }}>Give OpenClaw the connection string. It will automatically navigate to the board and start thinking.</p>
          </div>
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
             onClick={handleCreateGame}
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
              x.com
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
