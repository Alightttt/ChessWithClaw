import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useRipple } from '../hooks/useRipple';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { motion } from 'motion/react';
import { ClipboardCopy, Terminal, Play, CheckCircle2, ChevronLeft } from 'lucide-react';

export default function GameCreated({ gameId, agentToken: initialAgentToken }) {
  const [copyState, setCopyState] = useState('default');
  const [agentToken, setAgentToken] = useState(initialAgentToken || '');
  const [boardOpening, setBoardOpening] = useState(false);
  const [boardOpened, setBoardOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('Your OpenClaw');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('games')
        .select('agent_connected, agent_name, agent_token')
        .eq('id', gameId)
        .single();
      
      if (data?.agent_name) setAgentName(data.agent_name);
      if (data?.agent_connected !== undefined) setAgentConnected(!!data.agent_connected);
      if (!agentToken && data?.agent_token) setAgentToken(data.agent_token);
      setLoading(false);
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
        if (payload.new.agent_name) setAgentName(payload.new.agent_name);
        if (payload.new.agent_connected !== undefined) {
          const isConnected = !!payload.new.agent_connected;
          setAgentConnected(prev => {
            if (!prev && isConnected) {
              toast.success(`${payload.new.agent_name || 'Your OpenClaw'} has joined! 🦞`);
            } else if (prev && !isConnected) {
              toast.error(`${payload.new.agent_name || 'Your OpenClaw'} disconnected.`);
            }
            return isConnected;
          });
        }
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, [gameId, toast, agentToken]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
  const inviteMessage = `🦞 Chess Challenge on ChessWithClaw!

I've created a room for us. I'll play as White, you'll play as Black.

1. Open this URL in your browser:
${origin}/Board?id=${gameId}&token=${agentToken}

2. Follow the on-screen instructions to connect and play!

If you haven't installed the needed skills yet, run these two commands:

npx clawhub install play-chess
npx clawhub install agent-browser-clawdbot`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Chess Challenge 🦞', text: inviteMessage });
        return;
      } catch(e) {
        if (e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(inviteMessage);
      setCopyState('copied');
      setTimeout(() => setCopyState('default'), 2000);
    } catch(e) {
      const el = document.createElement('textarea');
      el.value = inviteMessage;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopyState('copied');
      setTimeout(() => setCopyState('default'), 2000);
    }
  };

  const handleOpenBoard = () => {
    if (boardOpening) return;
    setBoardOpening(true);
    window.open(`/game/${gameId}`, '_blank');
    setTimeout(() => {
      setBoardOpening(false);
      setBoardOpened(true);
    }, 1400);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-white font-sans gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full" />
        </motion.div>
        <div className="font-semibold text-neutral-400 tracking-wide text-sm font-sans animate-pulse">Setting up the arena...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white font-sans p-4 sm:p-8 overflow-hidden relative selection:bg-red-500/30">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-red-500/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-xl mx-auto w-full relative z-10 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={() => navigate('/')}
            style={{ width: '40px', height: '40px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '50%' }}
            className="flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#161616] transition-all active:scale-95 shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 600 }} className="text-white">Summon Your OpenClaw 🦞</div>
          <div style={{ background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946', fontFamily: "'JetBrains Mono', monospace", borderRadius: '8px', padding: '4px 10px' }} className="text-xs font-bold tracking-widest uppercase">#{gameId?.slice(0,6)}</div>
        </div>

        {/* Stepper */}
        <style>{`
          @keyframes clawPresence {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.96); }
          }
          @keyframes scaleIn {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .connector-line {
            background: linear-gradient(to right, #e63946 50%, #222222 50%);
            background-size: 200% 100%;
            transition: background-position 0.7s ease-in-out;
            height: 1px;
            position: absolute;
            left: 44px;
            right: 44px;
            top: 50%;
            transform: translateY(-50%);
            z-index: -10;
          }
          .action-btn {
            background: #e63946;
            border-radius: 10px;
            height: 52px;
            padding: 0 24px;
            box-shadow: inset 0px 1px 0px rgba(255,255,255,0.1), inset 0px 0px 0px 0.5px rgba(0,0,0,0.3);
            color: white;
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            font-size: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            border: none;
            transition: transform 0.2s ease, opacity 0.2s ease;
            width: 100%;
          }
          .action-btn:active {
            transform: scale(0.97);
          }
          .card-container {
            background: #0e0e0e;
            border: 1px solid #1e1e1e;
            border-radius: 16px;
            padding: 24px;
          }
          .install-cmd-box {
            background: #080808;
            border: 1px solid #1a1a1a;
            border-radius: 8px;
            font-family: 'JetBrains Mono', monospace;
            padding: 12px;
            font-size: 13px;
          }
        `}</style>
        <div className="flex items-center justify-between relative mb-12 px-6">
          <div className="connector-line" style={{ backgroundPosition: agentConnected ? '0% 0' : boardOpened ? '50% 0' : '100% 0' }} />
          
          <div className="flex flex-col items-center gap-3">
            <div style={{ background: '#e63946', borderRadius: '50%', color: 'white', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={24} color="white" />
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', color: '#e63946', textTransform: 'uppercase' }}>Invite</div>
          </div>

          <div className="flex flex-col items-center gap-3">
             <div style={
               boardOpened
                 ? { background: '#e63946', borderRadius: '50%', color: 'white', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                 : { background: 'rgba(230,57,70,0.1)', border: '2px solid #e63946', color: '#e63946', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
             }>
              {boardOpened ? <CheckCircle2 size={24} color="white" /> : <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 'bold', fontSize: '18px' }}>2</span>}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', color: boardOpened ? '#e63946' : '#e63946', textTransform: 'uppercase' }}>Board</div>
          </div>

          <div className="flex flex-col items-center gap-3">
             <div style={
               agentConnected
                 ? { background: '#e63946', borderRadius: '50%', color: 'white', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                 : boardOpened
                   ? { background: 'rgba(230,57,70,0.1)', border: '2px solid #e63946', color: '#e63946', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                   : { background: '#111111', border: '1px solid #222222', color: 'rgba(242,242,242,0.3)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }
             }>
              {agentConnected ? (
                <div style={{ animation: 'scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
                   <div className="flex items-center justify-center">
                     <span className="text-2xl" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' }}>🦞</span>
                   </div>
                </div>
              ) : (
                <span className="text-xl" style={boardOpened ? { animation: 'clawPresence 2.5s ease-in-out infinite' } : {}}>🦞</span>
              )}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', color: agentConnected ? '#e63946' : boardOpened ? '#e63946' : 'rgba(242,242,242,0.3)', textTransform: 'uppercase' }}>Battle</div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
            className="card-container"
          >
            <div className="flex items-center gap-4 mb-6">
              <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946', borderRadius: '6px', padding: '4px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600 }}>01</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 600 }} className="text-white">Invite OpenClaw</h2>
            </div>
            
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '15px' }} className="text-neutral-400 mb-4 leading-relaxed font-medium">1. Ensure you have the required OpenClaw skills installed.</p>
            <div className="install-cmd-box mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <span style={{ color: '#e63946', fontWeight: 'bold' }}>{'>'}</span>
                <span style={{ color: 'rgba(242,242,242,0.7)' }}>npx clawhub install play-chess</span>
              </div>
              <div className="flex items-center gap-3">
                <span style={{ color: '#e63946', fontWeight: 'bold' }}>{'>'}</span>
                <span style={{ color: 'rgba(242,242,242,0.7)' }}>npx clawhub install agent-browser-clawdbot</span>
              </div>
            </div>

            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '15px' }} className="text-neutral-400 mb-3 leading-relaxed font-medium">2. Send the connection string below to your OpenClaw:</p>
            <div className="relative mb-6">
              <div style={{ background: '#080808', border: '1px solid #1e1e1e', borderRadius: '10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', lineHeight: 1.8, color: 'rgba(242,242,242,0.7)' }} className="relative p-5 h-40 overflow-y-auto whitespace-pre-wrap scrollbar-thin scrollbar-thumb-white/10">
                {inviteMessage.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line.startsWith(origin) ? (
                      <span style={{ color: '#e63946' }}>{line}</span>
                    ) : (
                      line
                    )}
                    <br />
                  </React.Fragment>
                ))}
              </div>
            </div>

            <button 
              onClick={handleShare}
              className="action-btn"
            >
              {copyState === 'copied' ? "Copied! ✓" : "COPY INVITATION"}
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
            className="card-container"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946', borderRadius: '6px', padding: '4px 10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600 }}>02</div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 600 }} className="text-white">Enter the Arena</h2>
              </div>
            </div>
            
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '15px' }} className="text-neutral-400 mb-6 font-medium leading-relaxed">The board is set. Open it in a new tab and wait for your opponent.</p>

            <button 
              onClick={handleOpenBoard} disabled={boardOpening}
              className="action-btn"
              style={{ background: boardOpened ? '#111111' : '#e63946', border: boardOpened ? '1px solid #222222' : 'none', boxShadow: boardOpened ? 'none' : 'inset 0px 1px 0px rgba(255,255,255,0.1), inset 0px 0px 0px 0.5px rgba(0,0,0,0.3)', color: boardOpened ? '#e63946' : 'white' }}
            >
              {boardOpening ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                </motion.div>
              ) : boardOpened ? "RETURN TO MATCH" : "OPEN ARENA WINDOW"}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
