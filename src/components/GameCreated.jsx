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
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white font-sans p-4 sm:p-8 overflow-hidden relative selection:bg-red-500/30">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[400px] bg-red-500/10 blur-[100px] pointer-events-none" />

      <div className="max-w-xl mx-auto w-full relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full glass border-white/5 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="font-bold text-xl tracking-tight">Invite OpenClaw 🦞</div>
          <div className="px-3 py-1 rounded-md glass font-mono text-xs text-red-500 font-medium">#{gameId?.slice(0,6)}</div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between relative mb-12 px-4">
          <div className="absolute left-[34px] right-[34px] top-1/2 -translate-y-1/2 h-0.5 bg-neutral-900 -z-10" />
          <div className="absolute left-[34px] top-1/2 -translate-y-1/2 h-0.5 bg-red-500 -z-10 transition-all duration-500" style={{ right: agentConnected ? '34px' : boardOpened ? '50%' : 'calc(100% - 34px)' }} />
          
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <CheckCircle2 size={20} />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-red-500">Invite</div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${boardOpened ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-neutral-900 text-neutral-500 border-2 border-neutral-800'}`}>
              {boardOpened ? <CheckCircle2 size={20} /> : <span className="font-bold">2</span>}
            </div>
            <div className={`text-[10px] font-bold uppercase tracking-widest ${boardOpened ? 'text-red-500' : 'text-neutral-500'}`}>Board</div>
          </div>

          <div className="flex flex-col items-center gap-2">
             <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${agentConnected ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'bg-neutral-900 text-neutral-500 border-2 border-neutral-800'}`}>
              {agentConnected ? <CheckCircle2 size={20} /> : <span className="font-bold">3</span>}
            </div>
            <div className={`text-[10px] font-bold uppercase tracking-widest ${agentConnected ? 'text-red-500' : 'text-neutral-500'}`}>Battle</div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-bold font-mono text-sm">01</div>
              <h2 className="text-xl font-bold">Summon Your OpenClaw</h2>
            </div>
            
            <p className="text-sm text-neutral-400 mb-4">First, install the required skills in your OpenClaw terminal:</p>
            <div className="glass break-all p-4 rounded-xl border-white/5 mb-6 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-3">
                <Terminal size={14} className="text-red-500 shrink-0" />
                <span className="text-neutral-300">npx clawhub install play-chess</span>
              </div>
              <div className="flex items-center gap-3">
                <Terminal size={14} className="text-red-500 shrink-0" />
                <span className="text-neutral-300">npx clawhub install agent-browser-clawdbot</span>
              </div>
            </div>

            <p className="text-sm text-neutral-400 mb-3">Then send your OpenClaw this invite:</p>
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-red-500/0 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative glass p-4 rounded-xl h-48 overflow-y-auto mb-4 border-white/10 font-mono text-xs leading-relaxed text-neutral-300 whitespace-pre-wrap scrollbar-thin scrollbar-thumb-white/10">
                {inviteMessage}
              </div>
            </div>

            <button 
              onClick={handleShare}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${copyState === 'copied' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-white text-black hover:bg-neutral-200'}`}
            >
              {copyState === 'copied' ? <><CheckCircle2 size={18} /> Copied!</> : <><ClipboardCopy size={18} /> Copy Invite Message</>}
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`glass-card p-6 border-2 transition-colors duration-500 ${boardOpened ? 'border-red-500/30 bg-red-500/5' : 'border-white/5 bg-transparent'}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-mono text-sm transition-colors ${boardOpened ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-500'}`}>02</div>
                <h2 className="text-xl font-bold">Open Your Arena</h2>
              </div>
              {boardOpened && <div className="text-xs font-semibold text-red-500 px-3 py-1 glass rounded-full">Active</div>}
            </div>
            
            <p className="text-sm text-neutral-400 mb-6">Open the board in a new tab. Your battlefield is ready.</p>

            <button 
              onClick={handleOpenBoard} disabled={boardOpening}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${boardOpened ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_-5px_rgba(239,68,68,0.5)]'}`}
            >
              {boardOpening ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                </motion.div>
              ) : boardOpened ? <><Play size={18} /> Open Arena Again</> : <><Play size={18} /> Open Arena</>}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
