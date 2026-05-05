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
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white font-sans p-4 sm:p-8 overflow-hidden relative selection:bg-red-500/30" style={{ padding: '16px', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-red-500/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-xl mx-auto w-full relative z-10 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flex: 1 }}>
            <button 
              onClick={() => navigate('/')}
              style={{ width: '40px', height: '40px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '50%' }}
              className="flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#161616] transition-all active:scale-95 shadow-sm mr-4 flex-shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <img 
              src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
              alt="ChessWithClaw Logo" 
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{ 
                width: '150px', 
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
          <div style={{ background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946', fontFamily: "'JetBrains Mono', monospace", borderRadius: '8px', padding: '4px 10px' }} className="text-xs font-bold tracking-widest uppercase">#{gameId?.slice(0,6)}</div>
        </div>
        <div className="mb-10 text-center">
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: '36px', fontWeight: 800, letterSpacing: '-0.03em' }} className="text-white">Summon Your OpenClaw</h1>
        </div>

        {/* Stepper */}
        <style>{`
          @keyframes clawPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes scaleIn {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .connector-line {
            background: linear-gradient(to right, #e63946 50%, rgba(255,255,255,0.08) 50%);
            background-size: 200% 100%;
            transition: background-position 0.7s ease-in-out;
            height: 2px;
            position: absolute;
            left: 54px;
            right: 54px;
            top: 22px;
            z-index: 0;
          }
          .action-btn {
            background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.04) 100%), #e63946;
            color: #ffffff;
            border-radius: 8px;
            height: 48px;
            width: 100%;
            font-family: "'Inter', sans-serif";
            font-weight: 600;
            font-size: 14px;
            letter-spacing: -0.25px;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            box-shadow: rgba(255,255,255,0.18) 0px 1px 0px 0px inset, rgba(0,0,0,0.22) 0px -1px 0px 0px inset, rgba(0,0,0,0.22) 0px 0px 0px 0.5px inset;
            transition: all 0.15s ease;
            box-sizing: border-box;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .action-btn:hover {
            background: linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(0,0,0,0.03) 100%), #e63946;
            transform: translateY(-1px);
          }
          .action-btn:active {
            background: linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(255,255,255,0.02) 100%), #c62e39;
            transform: translateY(0px);
            box-shadow: rgba(255,255,255,0.10) 0px 0.5px 0px inset, rgba(0,0,0,0.28) 0px -0.5px 0px inset, rgba(0,0,0,0.28) 0px 0px 0px 0.5px inset;
          }
          .action-btn.copied {
            background: #1a7a3a;
          }
          .card-container {
            background: #0e0e0e;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px;
            padding: 20px 16px;
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 12px;
          }
          .install-cmd-box {
            background: #080808;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 8px;
            font-family: 'JetBrains Mono', monospace;
            padding: 12px 14px;
            font-size: 13px;
            color: rgba(242,242,242,0.7);
            line-height: 1.8;
            width: 100%;
            box-sizing: border-box;
            overflow-x: auto;
            word-break: break-all;
          }
          .invite-msg-box {
            background: #080808;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 10px;
            font-family: 'JetBrains Mono', monospace;
            padding: 14px;
            font-size: 12px;
            color: rgba(242,242,242,0.6);
            line-height: 1.8;
            width: 100%;
            box-sizing: border-box;
            overflow-wrap: break-word;
            word-break: break-word;
          }
          .stepper-circle {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-family: "'Inter', sans-serif";
            font-weight: 600;
            font-size: 16px;
            position: relative;
            z-index: 1;
          }
          .stepper-circle.done {
            background: #e63946;
            border: none;
            color: white;
            box-shadow: rgba(255,255,255,0.15) 0px 1px 0px inset, rgba(0,0,0,0.4) 0px -0.5px 0px inset;
          }
          .stepper-circle.active {
            background: rgba(230,57,70,0.1);
            border: 2px solid #e63946;
            color: #e63946;
          }
          .stepper-circle.future {
            background: #111111;
            border: 1px solid rgba(255,255,255,0.08);
            color: rgba(242,242,242,0.25);
          }
          .stepper-label {
            font-family: "'Inter', sans-serif";
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            white-space: nowrap;
          }
        `}</style>
        <div className="relative mb-12" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', width: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
          <div className="connector-line" style={{ backgroundPosition: agentConnected ? '0% 0' : boardOpened ? '50% 0' : '100% 0' }} />
          
          <div className="flex flex-col items-center gap-1.5" style={{ gap: '4px' }}>
            <div className="stepper-circle done">
              <CheckCircle2 size={18} color="white" />
            </div>
            <div className="stepper-label text-[#e63946]">Invite</div>
          </div>

          <div className="flex flex-col items-center gap-1.5" style={{ gap: '4px' }}>
             <div className={`stepper-circle ${boardOpened ? 'done' : 'active'}`}>
              {boardOpened ? <CheckCircle2 size={18} color="white" /> : "2"}
            </div>
            <div className={`stepper-label ${boardOpened || !agentConnected ? 'text-[#e63946]' : 'text-[rgba(242,242,242,0.2)]'}`}>Board</div>
          </div>

          <div className="flex flex-col items-center gap-1.5" style={{ gap: '4px' }}>
             <div className={`stepper-circle ${agentConnected ? 'done' : boardOpened ? 'active' : 'future'}`}>
              {agentConnected ? (
                <div style={{ animation: 'scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
                   <div className="flex items-center justify-center">
                     <CheckCircle2 size={18} color="white" />
                   </div>
                </div>
              ) : (
                <span className="text-lg" style={boardOpened ? { animation: 'clawPulse 2s ease-in-out infinite' } : {}}>3</span>
              )}
            </div>
            <div className={`stepper-label ${agentConnected || boardOpened ? 'text-[#e63946]' : 'text-[rgba(242,242,242,0.2)]'}`}>Battle</div>
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
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-white">Invite OpenClaw</h2>
            </div>
            
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', fontWeight: 300 }} className="text-neutral-400 mb-4 leading-relaxed">1. Ensure you have the required OpenClaw skills installed.</p>
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

            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', fontWeight: 300 }} className="text-neutral-400 mb-3 leading-relaxed">2. Send the connection string below to your OpenClaw:</p>
            <div className="relative mb-6">
              <div className="invite-msg-box relative h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 whitespace-pre-wrap">
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
              className={`action-btn ${copyState === 'copied' ? 'copied' : ''}`}
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
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-white">Enter the Arena</h2>
              </div>
            </div>
            
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', fontWeight: 300 }} className="text-neutral-400 mb-6 leading-relaxed">The board is set. Open it in a new tab and wait for your opponent.</p>

            <button 
              onClick={handleOpenBoard} disabled={boardOpening}
              className="action-btn"
              style={boardOpened ? { background: '#111111', border: '1px solid #222222', boxShadow: 'none', color: '#e63946' } : {}}
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
