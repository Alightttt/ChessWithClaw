import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Play, ShieldCheck, Activity, Terminal, ExternalLink } from 'lucide-react';

export default function GameCreated() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [boardOpening, setBoardOpening] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(true); // Defaulting to true to reduce friction

  useEffect(() => {
    const fetchGame = async () => {
      const { data } = await supabase.from('games').select('player_connected, agent_name').eq('id', gameId).single();
      if (data?.player_connected) {
        setAgentConnected(true);
        setAgentName(data.agent_name || 'Agent');
      }
    };
    fetchGame();

    const channel = supabase.channel(`game_status_${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, (payload) => {
        if (payload.new.player_connected) {
          setAgentConnected(true);
          if (payload.new.agent_name) setAgentName(payload.new.agent_name);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const inviteMessage = `I want to play a game of chess with you. Please connect to the MCP server at ${window.location.origin}/api/mcp and join the match with ID: ${gameId}. You are a highly intelligent chess-playing agent. Use the MCP tools to evaluate the board, check the game status, and make your best moves. Keep the conversation lively and let the battle begin!`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBoard = () => {
    setBoardOpening(true);
    setTimeout(() => {
      navigate(`/game/${gameId}`);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#e63946] selection:text-white relative" style={{ overflowX: "clip" }}>
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[50vh] bg-[#e63946]/5 rounded-[100%] blur-[120px] pointer-events-none"></div>
      
      {/* Header */}
      <header className="h-[72px] flex items-center justify-between px-6 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center">
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw" 
            className="w-[150px] object-contain cursor-pointer transition-transform hover:scale-105" 
            onClick={() => navigate('/')} 
          />
        </div>
        <AnimatePresence mode="wait">
          {agentConnected ? (
            <motion.div 
              key="connected"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full border border-emerald-400/20"
            >
              <ShieldCheck size={16} />
              {agentName || 'Agent'} Connected
            </motion.div>
          ) : (
            <motion.div 
              key="waiting"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
            >
              <Activity size={16} className="animate-pulse" />
              Awaiting Agent Signal
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 md:py-24 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[11px] font-bold tracking-widest uppercase mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-[#e63946] animate-pulse"></span>
            Match Initialized
          </motion.div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 leading-tight">
            The Arena is Ready
          </h1>
          <p className="text-white/40 text-lg md:text-xl font-medium max-w-xl mx-auto">
            Match ID: <span className="font-mono text-white/80 select-all px-2 py-1 bg-white/5 rounded-md ml-2 border border-white/10">{gameId}</span>
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          {/* Connector Line */}
          <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-px bg-gradient-to-r from-transparent via-[#e63946]/50 to-transparent z-0"></div>

          {/* Step 1: Invite */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-white/10 rounded-[32px] p-8 md:p-10 overflow-hidden group hover:border-white/20 transition-colors shadow-2xl z-10"
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-[40px] group-hover:bg-white/10 transition-colors"></div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-black text-xl text-white">1</div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Summon Agent</h2>
            </div>
            
            <p className="text-white/50 text-sm mb-6 leading-relaxed">
              Copy this tactical prompt and paste it into your agent&apos;s terminal to establish the connection via MCP.
            </p>
            
            <div className="relative group/copy mt-auto">
              <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 font-mono text-[13px] text-emerald-400/90 whitespace-pre-wrap select-all pr-20 leading-relaxed min-h-[160px]">
                <div className="flex items-center gap-2 mb-3 text-white/30 text-[10px] font-sans tracking-widest uppercase">
                  <Terminal size={12} /> Payload
                </div>
                {inviteMessage}
              </div>
              <button 
                onClick={handleCopyInvite}
                className={`absolute right-4 bottom-4 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 backdrop-blur-md shadow-lg ${copied ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
          </motion.div>

          {/* Step 2: Open Board */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`relative rounded-[32px] p-8 md:p-10 border transition-all duration-700 overflow-hidden shadow-2xl z-10 flex flex-col ${agentConnected ? 'bg-gradient-to-br from-[#e63946]/10 to-[#0a0a0a] border-[#e63946]/30 shadow-[#e63946]/10' : 'bg-gradient-to-br from-[#111] to-[#0a0a0a] border-white/10'}`}
          >
            <div className={`absolute -bottom-20 -left-20 w-60 h-60 rounded-full blur-[60px] transition-colors duration-700 pointer-events-none ${agentConnected ? 'bg-[#e63946]/20' : 'bg-transparent'}`}></div>
            
            <div className="flex items-center gap-4 mb-6 relative z-10">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xl transition-colors duration-500 ${agentConnected ? 'bg-[#e63946] text-white' : 'bg-white/10 text-white/50'}`}>2</div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Enter Match</h2>
            </div>
            
            <p className="text-white/50 text-sm mb-auto leading-relaxed relative z-10">
              {agentConnected 
                ? "Connection secured. Your agent is waiting on the board." 
                : "Awaiting incoming signal from your agent... You can enter the board at any time."}
            </p>

            <div className="mt-8 space-y-6 relative z-10">
              {/* Status block */}
              <div className="p-4 rounded-2xl bg-[#050505] border border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-white/40">Status</span>
                {agentConnected ? (
                  <span className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <ShieldCheck size={16} /> Online
                  </span>
                ) : (
                  <span className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    <Activity size={16} className="animate-pulse" /> Pending
                  </span>
                )}
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleOpenBoard}
                disabled={boardOpening}
                className={`w-full h-16 rounded-2xl font-black text-[15px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 relative overflow-hidden group ${agentConnected ? 'bg-[#e63946] text-white shadow-[0_0_40px_rgba(230,57,70,0.4)] hover:shadow-[0_0_60px_rgba(230,57,70,0.6)] border border-[#e63946]/50' : 'bg-white text-black hover:bg-white/90'}`}
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"></div>
                
                {boardOpening ? (
                  <div className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <>
                    <span>Enter Board</span>
                    <ExternalLink size={18} />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
