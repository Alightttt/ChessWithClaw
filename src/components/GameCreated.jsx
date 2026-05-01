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

1. Open this URL in your agent-browser:
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
          <div style={{ fontFamily: "'Playfair Display', serif" }} className="font-bold text-2xl tracking-tight text-white">Summon Your AI</div>
          <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946', fontFamily: "'JetBrains Mono', monospace", borderRadius: '8px', padding: '4px 10px' }} className="text-xs font-bold tracking-widest uppercase">#{gameId?.slice(0,6)}</div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between relative mb-12 px-6">
          <div className="absolute left-[44px] right-[44px] top-1/2 -translate-y-1/2 h-0.5 bg-[#1a1a1a] -z-10" />
          <div className="absolute left-[44px] top-1/2 -translate-y-1/2 h-0.5 bg-[#e63946] -z-10 transition-all duration-700 ease-in-out" style={{ right: agentConnected ? '44px' : boardOpened ? '50%' : 'calc(100% - 44px)' }} />
          
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#111111] text-[#e63946] border-2 border-[#e63946] flex items-center justify-center shadow-[0_0_24px_rgba(230,57,70,0.25)]">
              <CheckCircle2 size={24} />
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif" }} className="text-[10px] font-bold uppercase tracking-widest text-[#e63946]">1. Invite</div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${boardOpened ? 'bg-[#111111] text-[#e63946] border-[#e63946] shadow-[0_0_24px_rgba(230,57,70,0.25)]' : 'bg-[#111111] text-[#444444] border-[#222222]'}`}>
              {boardOpened ? <CheckCircle2 size={24} /> : <span style={{ fontFamily: "'Inter', sans-serif" }} className="font-bold text-lg">2</span>}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif" }} className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-500 ${boardOpened ? 'text-[#e63946]' : 'text-[#444444]'}`}>Board</div>
          </div>

          <div className="flex flex-col items-center gap-3">
             <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${agentConnected ? 'bg-[#111111] text-[#e63946] border-[#e63946] shadow-[0_0_24px_rgba(230,57,70,0.25)]' : 'bg-[#111111] text-[#444444] border-[#222222]'}`}>
              {agentConnected ? <CheckCircle2 size={24} /> : <span style={{ fontFamily: "'Inter', sans-serif" }} className="font-bold text-lg">3</span>}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif" }} className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-500 ${agentConnected ? 'text-[#e63946]' : 'text-[#444444]'}`}>Battle</div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px' }}
            className="p-6 md:p-8 shadow-sm hover:border-[#2a2a2a] transition-colors duration-300"
          >
            <div className="flex items-center gap-4 mb-6">
              <div style={{ background: 'rgba(230,57,70,0.1)', color: '#e63946', borderRadius: '10px' }} className="w-10 h-10 flex items-center justify-center font-bold font-mono text-base">
                01
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-2xl font-bold tracking-wide">Invite the Agent</h2>
            </div>
            
            <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-sm rounded-xl text-neutral-400 mb-4 leading-relaxed font-medium">1. Ensure you have the required agent skills installed.</p>
            <div style={{ background: '#161616', border: '1px solid #222222', borderRadius: '12px' }} className="break-all p-4 mb-6 space-y-3 font-mono text-xs shadow-inner">
              <div className="flex items-center gap-3">
                <Terminal size={14} className="text-red-500 shrink-0" />
                <span className="text-neutral-300">npx clawhub install play-chess</span>
              </div>
              <div className="flex items-center gap-3">
                <Terminal size={14} className="text-red-500 shrink-0" />
                <span className="text-neutral-300">npx clawhub install agent-browser-clawdbot</span>
              </div>
            </div>

            <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-sm text-neutral-400 mb-3 leading-relaxed font-medium">2. Send the connection string below to your AI assistant:</p>
            <div className="relative group mb-6">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-500/10 to-transparent rounded-[14px] blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: '12px', fontFamily: "'JetBrains Mono', monospace" }} className="relative p-5 h-40 overflow-y-auto text-xs leading-relaxed text-neutral-300 whitespace-pre-wrap scrollbar-thin scrollbar-thumb-white/10 shadow-inner">
                {inviteMessage}
              </div>
            </div>

            <button 
              onClick={handleShare}
              style={{
                fontFamily: "'Inter', sans-serif",
                background: copyState === 'copied' ? '#161616' : '#e63946',
                color: copyState === 'copied' ? '#22c55e' : 'white',
                border: copyState === 'copied' ? '1px solid #22c55e' : '1px solid transparent',
                borderRadius: '12px'
              }}
              className={`w-full py-4 text-[15px] font-bold flex items-center justify-center gap-3 transition-all active:scale-95 ${copyState !== 'copied' ? 'hover:bg-[#c62a35] hover:shadow-[0_4px_16px_rgba(230,57,70,0.4)]' : ''}`}
            >
              {copyState === 'copied' ? <><CheckCircle2 size={20} /> COPIED</> : <><ClipboardCopy size={20} /> COPY INVITATION</>}
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
            style={{ 
              background: boardOpened ? '#161213' : '#111111', 
              border: boardOpened ? '1px solid rgba(230,57,70,0.3)' : '1px solid #1e1e1e', 
              borderRadius: '16px' 
            }}
            className="p-6 md:p-8 transition-colors duration-500 shadow-sm hover:border-red-500/20"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div style={{ background: boardOpened ? '#e63946' : 'rgba(230,57,70,0.1)', color: boardOpened ? 'white' : '#e63946', borderRadius: '10px' }} className="w-10 h-10 flex items-center justify-center font-bold font-mono text-base transition-colors duration-500">
                  02
                </div>
                <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-2xl font-bold tracking-wide">Enter the Arena</h2>
              </div>
              {boardOpened && (
                <div style={{ background: 'rgba(230,57,70,0.1)', color: '#e63946', border: '1px solid rgba(230,57,70,0.25)', borderRadius: '8px', padding: '4px 12px' }} className="text-xs font-bold font-sans tracking-wider uppercase">
                  Active
                </div>
              )}
            </div>
            
            <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-sm text-neutral-400 mb-6 font-medium leading-relaxed">The board is set. Open it in a new tab and wait for your opponent.</p>

            <button 
              onClick={handleOpenBoard} disabled={boardOpening}
              style={{
                fontFamily: "'Inter', sans-serif",
                background: boardOpened ? '#1a1a1a' : '#161616',
                color: boardOpened ? '#e63946' : '#e0e0e0',
                border: boardOpened ? '1px solid rgba(230,57,70,0.3)' : '1px solid #222222',
                borderRadius: '12px'
              }}
              className={`w-full py-4 text-[15px] font-bold flex items-center justify-center gap-3 transition-all active:scale-95 ${!boardOpened ? 'hover:bg-[#1a1a1a] hover:border-[#333333]' : 'hover:bg-[#201515]'}`}
            >
              {boardOpening ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                </motion.div>
              ) : boardOpened ? <><Play size={20} /> RETURN TO MATCH</> : <><Play size={20} /> OPEN ARENA WINDOW</>}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
