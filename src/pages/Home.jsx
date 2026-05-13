import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from '../components/Toast';
import { ChevronDown, Zap, Shield } from "lucide-react";
import ChessBoard from '../components/chess/ChessBoard';

const DEMO_THOUGHTS = [
  { text: "Bold. Very bold.", lang: "EN" },
  { text: "Dekh raha hoon. 👀", lang: "HG" },
  { text: "Interesting...", lang: "EN" },
  { text: "Yaar seriously? 💀", lang: "HG" },
  { text: "Soch ke khela kya?", lang: "HG" },
  { text: "ठीक है, देखते हैं।", lang: "HI" },
  { text: "Wait. WAIT.", lang: "EN" },
  { text: "हम्म... अच्छा।", lang: "HI" },
  { text: "Okay okay okay.", lang: "EN" },
  { text: "Bhai kya kar raha hai 😂", lang: "HG" },
  { text: "तू ठीक तो है?", lang: "HI" },
  { text: "Not bad honestly.", lang: "SE" },
  { text: "I see what you did.", lang: "EN" },
  { text: "Bas yahi sochta tha.", lang: "HG" },
  { text: "Oh. Oh no.", lang: "SE" },
  { text: "अरे वाह!", lang: "HI" },
  { text: "You're getting smarter.", lang: "EN" },
  { text: "Chalo theek hai.", lang: "HG" },
];

function ThoughtBubble() {
  const [displayedThought, setDisplayedThought] = useState('');
  const [thoughtIdx, setThoughtIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setThoughtIdx(i => (i + 1) % DEMO_THOUGHTS.length);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setDisplayedThought(DEMO_THOUGHTS[thoughtIdx].text);
  }, [thoughtIdx]);

  return (
    <div className="absolute -top-12 -right-4 md:-right-12 bg-[#1a1a1a] border border-[#333] px-4 py-2 rounded-2xl rounded-bl-sm shadow-2xl z-20">
      <div 
        key={thoughtIdx}
        className="text-[13px] text-[#f2f2f2] font-mono tracking-tight"
        style={{ whiteSpace: 'nowrap', opacity: 1, animation: 'cwcFadeInOut 2s ease-in-out' }}
      >
        {displayedThought}
      </div>
      <style>{`
        @keyframes cwcFadeInOut {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
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


export default function Home() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCreateGame = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/create', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.id) {
        if (data.owner_token) {
          localStorage.setItem(`game_owner_${data.id}`, data.owner_token);
        }
        navigate(`/game?id=${data.id}`);
      } else {
        showToast(data.error || 'Failed to create game', 'error');
      }
    } catch (e) {
      showToast('Network error', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 relative">
        {/* HERO */}
        <div className="text-center pt-16 pb-12 relative z-10 w-full max-w-3xl mx-auto">
          <div className="mx-auto w-40 h-40 md:w-56 md:h-56 relative mb-8">
            <ThoughtBubble />
            <img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" alt="OpenClaw" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight text-white leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
            Play Chess vs <br /><span className="text-[#e63946]">Your OpenClaw</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 mb-10 font-light max-w-2xl mx-auto leading-relaxed">
            A fully autonomous AI agent that plays chess, chats with you, and reacts in real-time. Try to beat the Claw.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleCreateGame}
              disabled={loading}
              className="bg-[#e63946] hover:bg-[#ff4d5a] text-white px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(230,57,70,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[200px]"
            >
              {loading ? 'Starting...' : 'Play Now ➔'}
            </button>
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-2xl mx-auto mt-32">
          <h2 className="text-2xl font-bold mb-8 text-center text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Frequently Asked Questions</h2>
          <div className="border-t border-[#222]">
            <FAQAccordion question="Is it really autonomous?" answer="Yes. The OpenClaw agent runs in a sandboxed browser, clicking the board and typing messages just like a human player." />
            <FAQAccordion question="How strong is OpenClaw?" answer="The agent can be as strong as Stockfish, but it occasionally makes human-like blunders depending on its mood and your play style." />
          </div>
        </div>
      </div>
    </div>
  );
}
