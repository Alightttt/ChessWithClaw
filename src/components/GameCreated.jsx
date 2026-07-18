import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ShieldCheck, Activity, Terminal, ExternalLink, ArrowRight } from 'lucide-react';

const LobsterEmoji = ({ className = "" }) => (
  <span className={className} style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle: 'normal' }}>
    🦞
  </span>
);

export default function GameCreated() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [boardOpening, setBoardOpening] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(true);

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
    <div className="min-h-screen bg-[#030303] text-zinc-200 font-sans relative overflow-hidden flex flex-col">
      {/* Background & Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>
      
      {/* Ambient Glow */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.2, 0.15]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] rounded-full blur-[140px] pointer-events-none transition-colors duration-1000 ${agentConnected ? 'bg-emerald-500/20' : 'bg-[#e63946]/20'}`} 
      />

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 relative z-20 border-b border-white/5 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center cursor-pointer"
          onClick={() => navigate('/')}
        >
          <img
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png"
            alt="ChessWithClaw"
            className="w-[140px] object-contain transition-transform hover:scale-105 opacity-90 hover:opacity-100"
          />
        </motion.div>

        <AnimatePresence mode="wait">
          {agentConnected ? (
            <motion.div
              key="connected"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold shadow-[0_0_20px_rgba(16,185,129,0.1)]"
            >
              <ShieldCheck size={16} />
              <span>{agentName || 'Agent'} Connected</span>
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm font-semibold shadow-[0_0_20px_rgba(245,158,11,0.1)]"
            >
              <Activity size={16} className="animate-pulse" />
              <span>Awaiting Signal</span>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center pt-16 pb-24 px-6 relative z-10 w-full max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center w-full max-w-3xl mx-auto mb-16"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold tracking-widest uppercase mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-[#e63946] animate-pulse"></span>
            Match Initialized
          </motion.div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter text-white mb-6 leading-tight">
            The Arena is <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e63946] to-orange-400">Ready.</span>
          </h1>
          
          <div className="flex items-center justify-center gap-3 text-lg md:text-xl text-zinc-400">
            <span>Match ID:</span>
            <code className="font-mono px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-zinc-200 select-all">
              {gameId}
            </code>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-5xl mx-auto">
          {/* Card 1: Summon Agent */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl relative group hover:border-white/20 transition-all duration-500"
          >
            {/* MacOS-style Window Header */}
            <div className="h-12 border-b border-white/10 bg-white/5 flex items-center px-6 gap-2">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              </div>
              <div className="ml-4 flex-1 text-center pr-12 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
                summon_agent.sh
              </div>
            </div>

            <div className="p-8 flex flex-col flex-1">
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">1. Summon Agent</h2>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-[90%]">
                    Copy this tactical prompt and paste it into your agent's terminal to establish the connection via MCP.
                  </p>
                </div>
              </div>

              <div className="relative mt-auto group/copy">
                <div className="bg-[#030303] border border-white/5 rounded-2xl p-6 font-mono text-[13px] text-emerald-400/90 whitespace-pre-wrap select-all pr-24 leading-relaxed min-h-[160px] shadow-inner">
                  <div className="flex items-center gap-2 mb-3 text-white/30 text-[10px] font-sans tracking-widest uppercase">
                    <Terminal size={12} /> Payload
                  </div>
                  {inviteMessage}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopyInvite}
                  className={`absolute right-4 bottom-4 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 backdrop-blur-md shadow-lg ${copied ? 'bg-emerald-500 text-black shadow-emerald-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Enter Match */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`flex flex-col rounded-[32px] p-8 overflow-hidden relative shadow-2xl transition-all duration-700 border ${
              agentConnected 
                ? 'bg-gradient-to-br from-emerald-950/30 to-[#0a0a0a] border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.1)]' 
                : 'bg-[#0a0a0a] border-white/10'
            }`}
          >
            {/* Glow background for connected state */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none transition-opacity duration-1000 ${agentConnected ? 'opacity-100' : 'opacity-0'}`}></div>

            <div className="flex items-start justify-between mb-8 relative z-10">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">2. Enter Match</h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {agentConnected
                    ? `${agentName || 'Your agent'} has successfully entered the arena. You may now proceed.`
                    : "Listening for your agent's signal. You can enter the board at any time."}
                </p>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-8 relative z-10 min-h-[160px]">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {agentConnected ? (
                    <motion.div
                      key="connected-avatar"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="absolute inset-0"
                    >
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full border border-emerald-500/50 flex items-center justify-center z-10">
                        <LobsterEmoji className="text-5xl" />
                      </div>
                      <motion.div
                        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                        className="absolute inset-0 bg-emerald-500/30 rounded-full"
                      />
                      <motion.div
                        animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                        className="absolute inset-0 border border-emerald-500/30 rounded-full"
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="waiting-avatar"
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 bg-amber-500/10 rounded-full flex items-center justify-center"
                      >
                        <LobsterEmoji className="text-5xl opacity-50 grayscale mix-blend-luminosity" />
                      </motion.div>
                      <div className="absolute -inset-4 border border-white/10 rounded-full border-dashed animate-[spin_10s_linear_infinite]"></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-auto relative z-10 space-y-4">
              <div className="p-4 rounded-2xl bg-[#030303] border border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Status</span>
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
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleOpenBoard}
                disabled={boardOpening}
                className={`w-full h-16 rounded-2xl font-bold text-[15px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 relative overflow-hidden group ${
                  agentConnected 
                    ? 'bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)]' 
                    : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"></div>

                {boardOpening ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    <span>Initializing...</span>
                  </div>
                ) : (
                  <>
                    <span>Enter Board</span>
                    <ExternalLink className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
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
