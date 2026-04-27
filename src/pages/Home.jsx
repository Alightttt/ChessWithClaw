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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bsize, setBsize] = useState(360);

  useEffect(() => {
    const calcBoard = () => {
      const vw = window.innerWidth;
      if(vw < 420) setBsize(vw - 48);
      else if(vw < 640) setBsize(Math.min(vw - 64, 380));
      else if(vw < 1024) setBsize(420);
      else setBsize(480);
    };
    calcBoard();
    window.addEventListener("resize", calcBoard);
    return () => window.removeEventListener("resize", calcBoard);
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
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-red-500/30">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 h-16 z-50 glass flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-6 w-auto object-contain" onError={e => e.target.style.display='none'} />
          <span className="font-bold tracking-tight text-lg text-white">ChessWithClaw</span>
        </div>
        <div className="hidden sm:flex items-center gap-8 text-sm font-medium text-neutral-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how" className="hover:text-white transition-colors">How it Works</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <button 
          onClick={handleStart} 
          disabled={creating}
          className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-neutral-200 transition-colors flex items-center gap-2 active:scale-95"
        >
          {creating ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
            </motion.div>
          ) : (
            <>Play Now <ArrowRight size={16} /></>
          )}
        </button>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16 lg:gap-24 max-w-7xl mx-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none animate-glow-pulse" />
        
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left z-10 w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-semibold tracking-wider font-mono mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            LIVE REAL-TIME CHESS
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05] mb-6"
          >
            Play Chess with your <span className="text-gradient-red">OpenClaw.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-neutral-400 text-lg sm:text-xl max-w-lg mb-10 leading-relaxed font-normal"
          >
            The same AI agent you use every day — now playing chess with you in a beautiful, real-time arena.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <button 
              onClick={handleStart}
              disabled={creating}
              className="w-full sm:w-auto px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 shadow-[0_0_40px_-10px_rgba(220,38,38,0.5)]"
            >
              {creating ? 'Creating Match...' : 'Challenge OpenClaw'}
            </button>
            <a 
              href="#how"
              className="w-full sm:w-auto px-8 py-4 text-white rounded-xl font-semibold text-lg transition-all active:scale-95 flex items-center justify-center border border-white/10 hover:bg-white/5"
            >
              How it works
            </a>
          </motion.div>

          {/* Social Proof */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 flex items-center gap-4 text-sm text-neutral-500"
          >
            <div className="flex -space-x-3">
              <img src="https://i.pravatar.cc/100?img=33" alt="" className="w-8 h-8 rounded-full border-2 border-black" />
              <img src="https://i.pravatar.cc/100?img=47" alt="" className="w-8 h-8 rounded-full border-2 border-black" />
              <img src="https://i.pravatar.cc/100?img=12" alt="" className="w-8 h-8 rounded-full border-2 border-black" />
            </div>
            <span>Used by <strong className="text-white">1,000+</strong> agents</span>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 w-full flex justify-center lg:justify-end z-10"
        >
          <div className="relative animate-float">
            {/* Agent Bar */}
            <div className="flex items-center justify-between mb-4 px-1 w-full max-w-[480px]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(239,68,68,0.15)]">🦞</div>
                <div>
                  <div className="text-sm font-semibold text-neutral-100">OpenClaw Agent</div>
                  <div className="text-xs text-red-500 font-mono mt-0.5 uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"/> Thinking...
                  </div>
                </div>
              </div>
              <div className="glass px-4 py-2.5 rounded-lg max-w-[160px] truncate border-white/10 hidden sm:block">
                <Typewriter lines={LINES} />
              </div>
            </div>
            
            {/* Board */}
            <div 
              style={{ width: bsize, height: bsize }}
              className="rounded-xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,1),0_0_40px_-10px_rgba(239,68,68,0.15)] border border-white/10 ring-1 ring-white/5"
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
            <div className="flex items-center justify-between mt-4 px-1 w-full max-w-[480px]">
               <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-center text-xl text-neutral-500">♙</div>
                <div>
                  <div className="text-sm font-semibold text-neutral-300">You</div>
                  <div className="text-xs text-neutral-500 mt-0.5">White · your turn next</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Precision Engineering.</h2>
          <p className="text-neutral-400 text-lg">Everything you need for a seamless agentic chess experience.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Zero Latency", desc: "Moves sync globally in 150ms over WebSocket." },
            { icon: Bot, title: "Agent Integration", desc: "Native plugin support for raw OpenClaw logic." },
            { icon: Shield, title: "Persistent Match", desc: "Close the tab. Come back. The game remains." }
          ].map((f, i) => (
            <div key={i} className="glass-card p-8 group">
              <div className="w-14 h-14 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center mb-6 group-hover:bg-red-500/10 group-hover:border-red-500/20 group-hover:text-red-500 transition-colors">
                <f.icon className="text-neutral-400 group-hover:text-red-500 transition-colors" size={28} />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">{f.title}</h3>
              <p className="text-neutral-400 leading-relaxed text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how" className="py-24 px-6 lg:px-12 max-w-4xl mx-auto border-t border-white/5">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-16 text-center">How to Connect</h2>
        
        <div className="space-y-12 relative">
          <div className="absolute top-0 bottom-0 left-[23px] w-px bg-gradient-to-b from-red-500/50 to-transparent" />
          
          {[
            { tag: "01", title: "Install the plugin", desc: "Give your OpenClaw the ability to play.", code: "npx clawhub install play-chess" },
            { tag: "02", title: "Create a match", desc: "Click Play Now to generate a secure real-time game room for you and your agent." },
            { tag: "03", title: "Send the invite", desc: "Copy the agent invite text and drop it into your CLI or web interface to start." }
          ].map((step, i) => (
            <div key={i} className="flex gap-8 relative">
              <div className="w-12 h-12 rounded-full border border-red-500/20 bg-black flex items-center justify-center shrink-0 z-10 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <span className="font-mono text-red-500 text-sm font-bold">{step.tag}</span>
              </div>
              <div className="pt-2">
                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-neutral-400 mb-5 leading-relaxed">{step.desc}</p>
                {step.code && (
                  <div className="inline-flex glass border-white/10 px-5 py-3 rounded-lg font-mono text-sm items-center gap-3">
                    <Terminal size={16} className="text-red-500" />
                    <span className="text-neutral-300">{step.code}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-24 px-6 lg:px-12 max-w-7xl mx-auto border-t border-white/5">
        <div className="glass-card p-10 md:p-16 text-center relative overflow-hidden max-w-4xl mx-auto">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-32 bg-red-500/10 blur-[60px] pointer-events-none" />
          <div className="text-5xl text-red-500 mb-6 opacity-50">&quot;</div>
          <p className="text-2xl md:text-3xl font-medium leading-relaxed mb-10 text-neutral-200">
            Holy shit the best thing I saw today, we can play Chess with our OpenClaw. Like can&apos;t believe this. We are heading towards a new era of gaming with AI agents.
          </p>
          <div className="flex items-center justify-center gap-4">
            <img src="https://i.pravatar.cc/150?img=11" alt="Jake" className="w-12 h-12 rounded-full border border-white/10" />
            <div className="text-left">
              <div className="font-bold text-white tracking-wide">Jake Reynolds</div>
              <div className="text-sm text-neutral-500">Tech Enthusiast</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 lg:px-12 max-w-3xl mx-auto border-t border-white/5">
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
        <div className="flex items-center justify-center gap-6 text-sm">
          <a href="#" className="text-neutral-400 hover:text-white transition-colors">Twitter</a>
          <a href="#" className="text-neutral-400 hover:text-white transition-colors">ClawHub</a>
          <a href="#" className="text-neutral-400 hover:text-white transition-colors">GitHub</a>
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
