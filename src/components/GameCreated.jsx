import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ShieldCheck, Activity, Terminal, ExternalLink, ArrowRight } from 'lucide-react';

const LobsterEmoji = ({ className = "" }) => (
  <span className={className} style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle: 'normal' }}>
    🦞
  </span>
);

export default function GameCreated({ gameId }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [boardOpening, setBoardOpening] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

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

  const inviteMessage = `Hey — I set up a chess match for us. Connect to ${window.location.origin}/api/mcp and join match ${gameId}. You're playing Black, I'm White, I move first. Play for real — think it through, tell me what you're thinking, and talk to me while we play. Let's go.`;

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
      <header className="flex items-center px-4 md:px-8 h-16 relative z-20 border-b border-white/5 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center cursor-pointer"
          onClick={() => navigate('/')}
        >
          <img
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png"
            alt="ChessWithClaw"
            className="w-[120px] md:w-[130px] object-contain transition-transform hover:scale-105 opacity-90 hover:opacity-100"
          />
        </motion.div>
      </header>

      {/* Connection Status Banner */}
      <div className="w-full h-[44px] border-b border-white/10 flex items-center justify-between px-4 md:px-8 relative z-20 text-sm font-semibold select-none overflow-hidden"
        style={{
          backgroundColor: agentConnected ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
          borderColor: agentConnected ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
        }}
      >
        <div className="flex items-center">
          <div
            className="flex items-center gap-1.5 rounded-full uppercase"
            style={{
              background: 'rgba(230,57,70,0.12)',
              border: '1px solid rgba(230,57,70,0.25)',
              borderRadius: '9999px',
              padding: '2px 10px',
              color: '#ffffff',
              fontFamily: "'Inter', sans-serif",
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#e63946] animate-pulse"></span>
            Match Initialized
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {agentConnected ? (
              <motion.div
                key="connected-banner"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="flex items-center gap-2 text-emerald-400 text-xs md:text-sm font-bold tracking-wide"
              >
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>{agentName || 'Agent'} Connected</span>
              </motion.div>
            ) : (
              <motion.div
                key="waiting-banner"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="flex items-center gap-2 text-amber-500 text-xs md:text-sm font-bold tracking-wide"
              >
                <Activity size={16} className="animate-pulse text-amber-500" />
                <span>Awaiting Signal</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="w-[125px] hidden sm:block pointer-events-none" />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center pt-8 pb-24 px-6 relative z-10 w-full max-w-6xl mx-auto">
        {/* Soft, centered red radial glow blur matching the landing page hero */}
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

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center w-full max-w-3xl mx-auto mb-8 relative z-10"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-white mb-4 leading-tight">
            The Arena is <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e63946] to-orange-400">Ready.</span>
          </h1>
          
          <div className="flex items-center justify-center gap-3 text-base md:text-lg text-zinc-400">
            <span>Match ID:</span>
            <code className="font-mono px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-zinc-200 select-all">
              {gameId}
            </code>
          </div>
        </motion.div>

        <div className="relative w-full max-w-5xl mx-auto z-10">
          {/* Thin vertical line between the cards on desktop using brand red at low opacity */}
          <div className="hidden md:block absolute top-0 bottom-0 left-1/2 w-px bg-[#e63946]/15 -translate-x-1/2 pointer-events-none z-10" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-16 w-full mx-auto">
            {/* Card 1: Summon Agent */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col overflow-hidden shadow-2xl relative group transition-all duration-500"
              style={{
                backgroundColor: '#111111',
                border: '1px solid #1e1e1e',
                borderRadius: '16px'
              }}
            >
              {/* MacOS-style Window Header */}
              <div className="h-12 border-b border-white/10 bg-white/5 flex items-center px-6 gap-3">
                <div className="flex items-center text-base">
                  <LobsterEmoji />
                </div>
                <div className="flex-1 text-left tracking-widest font-semibold text-xs text-zinc-300 uppercase font-sans">
                  YOUR INVITE
                </div>
              </div>

              <div className="p-8 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">1. Summon Agent</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-[90%]">
                      Copy this tactical prompt and paste it into your agent&apos;s terminal to establish the connection via MCP.
                    </p>
                  </div>
                </div>

                <div className="relative mt-auto group/copy">
                  <div className="bg-[#030303] border border-white/5 rounded-2xl p-5 sm:p-6 font-mono text-[15px] sm:text-[13px] text-emerald-300 sm:text-emerald-400/90 whitespace-pre-wrap select-all pr-24 leading-relaxed min-h-[160px] shadow-inner">
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
              className={`flex flex-col p-8 overflow-hidden relative shadow-2xl transition-all duration-700`}
              style={{
                backgroundColor: '#111111',
                border: '1px solid #1e1e1e',
                borderRadius: '16px'
              }}
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
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute inset-0 bg-amber-500/10 rounded-full flex items-center justify-center"
                        >
                          <LobsterEmoji className="text-5xl opacity-[0.85] grayscale mix-blend-luminosity" />
                        </motion.div>
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute -inset-4 border border-white/10 rounded-full border-dashed animate-[spin_10s_linear_infinite]"
                        />
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

                <div className="flex items-center gap-3 px-2">
                  <input
                    type="checkbox"
                    id="legalCheckbox"
                    checked={legalAccepted}
                    onChange={(e) => setLegalAccepted(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-transparent text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 focus:ring-1 cursor-pointer"
                  />
                  <label htmlFor="legalCheckbox" className="text-sm text-zinc-400 cursor-pointer select-none">
                    I agree to the <a href="/legal" target="_blank" rel="noopener noreferrer" className="text-white hover:text-emerald-400 underline decoration-white/20 underline-offset-4">privacy policy and terms</a>
                  </label>
                </div>

                <motion.button
                  whileHover={legalAccepted && !boardOpening ? { scale: 1.02, y: -2 } : {}}
                  whileTap={legalAccepted && !boardOpening ? { scale: 0.98 } : {}}
                  onClick={(e) => {
                    if (legalAccepted) handleOpenBoard();
                  }}
                  disabled={boardOpening || !legalAccepted}
                  className={`w-full h-16 rounded-2xl font-bold text-[15px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 relative overflow-hidden group ${
                    !legalAccepted
                      ? 'opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500'
                      : agentConnected 
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
        </div>
      </main>
    </div>
  );
}
