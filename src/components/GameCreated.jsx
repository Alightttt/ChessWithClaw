import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ShieldCheck, Activity, Terminal, ExternalLink, ArrowLeft, Link2, Sparkles, Wifi } from 'lucide-react';

const LobsterEmoji = ({ className = "" }) => (
  <span className={className} style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle: 'normal' }}>
    🦞
  </span>
);

export default function GameCreated({ gameId }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
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

  const mcpUrl = `${window.location.origin}/api/mcp`;
  const inviteMessage = `Hey — I set up a chess match for us. Connect to ${mcpUrl} and join match ${gameId}. You're playing Black, I'm White, I move first. Play for real — think it through, tell me what you're thinking, and talk to me while we play. Let's go.`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleCopyMcpUrl = () => {
    navigator.clipboard.writeText(mcpUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2200);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(gameId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2200);
  };

  const handleOpenBoard = () => {
    setBoardOpening(true);
    setTimeout(() => {
      navigate(`/game/${gameId}`);
    }, 600);
  };

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#f2f2f2', overflowX: 'clip' }} className="font-sans selection:bg-red-500/30 flex flex-col">
      <style>{`
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
          box-shadow: 0 6px 24px rgba(0,0,0,0.5);
        }
        
        .design-btn-primary {
          background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.04) 100%), #e63946;
          color: white;
          border-radius: 8px;
          padding: 12px 24px;
          font-family: "'Poppins', sans-serif";
          font-weight: 600;
          font-size: 15px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s ease;
          box-shadow: rgba(255,255,255,0.18) 0px 1px 0px 0px inset, rgba(0,0,0,0.22) 0px -1px 0px 0px inset, rgba(0,0,0,0.22) 0px 0px 0px 0.5px inset;
        }
        .design-btn-primary:hover:not(:disabled) {
          background: linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(0,0,0,0.03) 100%), #e63946;
          transform: translateY(-1px);
        }
        .design-btn-primary:active:not(:disabled) {
          background: linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(255,255,255,0.02) 100%), #c62e39;
          transform: translateY(0);
        }
        
        .design-btn-secondary {
          background: transparent;
          color: rgba(242,242,242,0.6);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          height: 40px;
          padding: 0 20px;
          font-family: "'Poppins', sans-serif";
          font-weight: 600;
          font-size: 14px;
          display: inline-flex;
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
      `}</style>

      {/* Landing Page Navigation Header */}
      <nav 
        style={{
          fontFamily: "'Inter', sans-serif",
          height: '72px', width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
          backgroundColor: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          transition: 'all 0.3s ease',
          borderBottom: '1px solid #1a1a1a',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw Logo" 
            draggable={false}
            style={{ 
              width: '175px', 
              height: 'auto', 
              objectFit: 'contain', 
              flexShrink: 0, 
              display: 'block',
              filter: 'drop-shadow(0 2px 10px rgba(230,57,70,0.15))'
            }} 
          />
        </div>
        <div className="flex items-center gap-3">
          <a href="https://x.com/0xalyt" target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex design-btn-secondary" style={{ height: '36px', padding: '0 16px', fontSize: '13px', borderRadius: '100px', background: 'rgba(255,255,255,0.03)' }}>x.com/0xalyt</a>
          <button 
            onClick={() => navigate('/')} 
            className="design-btn-secondary" 
            style={{ height: '36px', padding: '0 16px', fontSize: '13px', cursor: 'pointer', gap: '6px' }}
          >
            <ArrowLeft size={14} /> Home
          </button>
        </div>
      </nav>

      {/* Connection Status Banner */}
      <div 
        className="w-full h-[42px] border-b flex items-center justify-between px-4 md:px-8 relative z-20 text-xs font-semibold select-none overflow-hidden transition-all duration-700"
        style={{
          backgroundColor: agentConnected ? 'rgba(16,185,129,0.08)' : 'rgba(230,57,70,0.06)',
          borderColor: agentConnected ? 'rgba(16,185,129,0.2)' : 'rgba(230,57,70,0.15)',
        }}
      >
        <div className="flex items-center">
          <div
            className="flex items-center gap-1.5 uppercase"
            style={{
              background: 'rgba(230,57,70,0.15)',
              border: '1px solid rgba(230,57,70,0.3)',
              borderRadius: '9999px',
              padding: '3px 12px',
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

        <div className="flex items-center justify-center">
          <AnimatePresence mode="wait">
            {agentConnected ? (
              <motion.div
                key="connected-banner"
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                className="flex items-center gap-2 text-emerald-400 text-xs font-bold tracking-wide"
              >
                <ShieldCheck size={15} className="text-emerald-400 animate-bounce" />
                <span>{agentName || 'Agent'} Connected & Ready</span>
              </motion.div>
            ) : (
              <motion.div
                key="waiting-banner"
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                className="flex items-center gap-2 text-amber-500 text-xs font-bold tracking-wide"
              >
                <Activity size={15} className="animate-pulse text-amber-500" />
                <span>Awaiting Agent Signal...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
          <Wifi size={12} className={agentConnected ? "text-emerald-400" : "text-amber-500 animate-pulse"} />
          <span>MCP v1</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center pt-3 pb-20 px-4 sm:px-6 relative z-10 w-full max-w-6xl mx-auto">
        {/* Soft, centered red radial glow blur matching landing page hero */}
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

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center z-10 w-full max-w-3xl mx-auto mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '9999px',
              padding: '4px 12px',
              color: 'rgba(242,242,242,0.65)',
              fontFamily: "'Inter', sans-serif",
              fontSize: '12px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '16px'
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e63946] opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#e63946]"></span>
            </span>
            <span style={{ letterSpacing: '0.02em' }}>Realtime chess</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 'clamp(40px, 8vw, 64px)',
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              color: '#f2f2f2',
              marginBottom: '16px'
            }}
          >
            The Arena is <span style={{ color: '#e63946' }}>Ready.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(15px, 4vw, 18px)',
              fontWeight: 300,
              lineHeight: 1.65,
              color: 'rgba(242,242,242,0.5)',
              maxWidth: '560px',
              marginBottom: '24px'
            }}
          >
            Match provisioned. Connect your agent via MCP to fight for board control in real time.
          </motion.p>

          {/* Match ID Pill in design-card style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="design-card inline-flex items-center gap-3 py-2 px-5 mx-auto border border-white/10 shadow-lg" 
            style={{ padding: '8px 18px', borderRadius: '12px' }}
          >
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold font-mono">MATCH ID</span>
            <code className="font-mono text-sm px-3 py-1 bg-black/80 rounded-lg border border-white/10 text-emerald-400 font-bold tracking-wider select-all shadow-inner">
              {gameId}
            </code>
            <button
              onClick={handleCopyId}
              title="Copy Match ID"
              className="p-1.5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              {copiedId ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </motion.div>
        </div>

        {/* Main 2-Card Grid */}
        <div className="relative w-full max-w-5xl mx-auto z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full mx-auto">
            
            {/* Card 1: Summon Agent */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="design-card flex flex-col p-6 sm:p-8"
            >
              {/* Card Title & Subtitle */}
              <div className="flex items-start justify-between mb-6 border-b border-white/5 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-[#e63946]/20 text-[#e63946] border border-[#e63946]/30">STEP 1</span>
                    <h2 className="text-2xl font-bold text-white font-sans">Summon Agent</h2>
                  </div>
                  <p className="text-zinc-400 text-sm font-['Poppins'] font-light leading-relaxed">
                    Copy this tactical prompt and send it to your agent via terminal or chat to connect via MCP.
                  </p>
                </div>
              </div>

              {/* Prompt Text Box */}
              <div className="relative mt-auto">
                <div className="bg-[#050505] border border-white/10 rounded-xl p-5 font-mono text-[13px] text-emerald-400/90 whitespace-pre-wrap select-all pr-24 leading-relaxed min-h-[160px] shadow-inner relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/5 text-white/40 text-[10px] font-sans tracking-widest uppercase">
                    <span className="flex items-center gap-1.5"><Terminal size={12} /> MCP Invite Payload</span>
                    <Sparkles size={12} className="text-emerald-500/60" />
                  </div>
                  {inviteMessage}
                </div>

                <button
                  onClick={handleCopyInvite}
                  className={`absolute right-3 bottom-3 px-4 py-2 rounded-lg font-semibold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg ${
                    copied 
                      ? 'bg-emerald-500 text-black shadow-emerald-500/30' 
                      : 'design-btn-primary'
                  }`}
                  style={copied ? {} : { padding: '8px 16px', fontSize: '12px' }}
                >
                  {copied ? (
                    <><Check size={14} className="stroke-[3]" /> Copied!</>
                  ) : (
                    <><Copy size={14} /> Copy Prompt</>
                  )}
                </button>
              </div>

              {/* Endpoint Link Quick Copy */}
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 text-zinc-500 font-mono">
                  <Link2 size={13} /> MCP Server Endpoint
                </span>
                <button
                  onClick={handleCopyMcpUrl}
                  className="text-xs font-mono text-zinc-300 hover:text-emerald-400 transition-colors flex items-center gap-1.5 py-1 px-2.5 rounded bg-white/[0.03] hover:bg-white/[0.08] border border-white/5"
                >
                  {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedUrl ? "Copied" : "Copy Endpoint"}</span>
                </button>
              </div>
            </motion.div>

            {/* Card 2: Enter Match */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="design-card flex flex-col p-6 sm:p-8 relative"
            >
              {/* Glow accent */}
              <div className={`absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none transition-opacity duration-1000 ${agentConnected ? 'opacity-100' : 'opacity-0'}`}></div>

              <div className="flex items-start justify-between mb-6 border-b border-white/5 pb-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-white/10 text-white border border-white/10">STEP 2</span>
                    <h2 className="text-2xl font-bold text-white font-sans">Enter Match</h2>
                  </div>
                  <p className="text-zinc-400 text-sm font-['Poppins'] font-light leading-relaxed">
                    {agentConnected
                      ? `${agentName || 'Your agent'} has connected and is ready. Step onto the board.`
                      : "Awaiting agent signal over MCP. You can open the board anytime."}
                  </p>
                </div>
              </div>

              {/* Status Graphic */}
              <div className="flex-1 flex flex-col items-center justify-center py-4 relative z-10 min-h-[160px]">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {agentConnected ? (
                      <motion.div
                        key="connected-avatar"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 220, damping: 22 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-full border border-emerald-500/50 flex items-center justify-center z-10 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                          <LobsterEmoji className="text-4xl" />
                        </div>
                        <motion.div
                          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                          className="absolute inset-0 bg-emerald-500/30 rounded-full"
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="waiting-avatar"
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <motion.div
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute inset-0 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20"
                        >
                          <LobsterEmoji className="text-4xl opacity-80 grayscale mix-blend-luminosity" />
                        </motion.div>
                        <motion.div
                          animate={{ scale: [1, 1.08, 1] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute -inset-3 border border-amber-500/20 rounded-full border-dashed animate-[spin_12s_linear_infinite]"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Legal Checkbox & Primary Button */}
              <div className="mt-auto relative z-10 space-y-4">
                <div className="p-3 rounded-lg bg-[#050505] border border-white/5 flex items-center justify-between text-xs font-semibold">
                  <span className="uppercase tracking-widest text-zinc-500 font-mono">STATUS</span>
                  {agentConnected ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <ShieldCheck size={15} /> ONLINE
                    </span>
                  ) : (
                    <span className="text-amber-500 font-bold flex items-center gap-1.5">
                      <Activity size={15} className="animate-pulse" /> LISTENING...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 px-1">
                  <input
                    type="checkbox"
                    id="legalCheckbox"
                    checked={legalAccepted}
                    onChange={(e) => setLegalAccepted(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-zinc-900 text-[#e63946] focus:ring-[#e63946] focus:ring-offset-0 focus:ring-1 cursor-pointer transition-all"
                  />
                  <label htmlFor="legalCheckbox" className="text-xs text-zinc-400 cursor-pointer select-none leading-tight font-['Poppins']">
                    I agree to the <a href="/legal" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#e63946] underline decoration-white/20 underline-offset-4 font-medium transition-colors">privacy policy and terms</a>
                  </label>
                </div>

                <button
                  onClick={() => {
                    if (legalAccepted) handleOpenBoard();
                  }}
                  disabled={boardOpening || !legalAccepted}
                  className={`w-full h-14 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-200 ${
                    !legalAccepted
                      ? 'opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500 border border-white/5'
                      : agentConnected 
                        ? 'bg-emerald-500 text-black font-semibold hover:bg-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]' 
                        : 'design-btn-primary'
                  }`}
                  style={!legalAccepted || agentConnected ? {} : { height: '56px' }}
                >
                  {boardOpening ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      <span>Entering Board...</span>
                    </div>
                  ) : (
                    <>
                      <span>Enter Board</span>
                      <ExternalLink className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>

          </div>

          {/* Quick Landing Page Features Below Cards */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="design-card p-5" style={{ padding: '20px' }}>
              <h3 className="text-sm font-bold text-white mb-1 font-sans flex items-center gap-2">
                <span className="text-[#e63946]">⚡</span> Zero Setup Friction
              </h3>
              <p className="text-xs text-zinc-400 font-['Poppins'] font-light leading-relaxed">
                Just paste the prompt into OpenClaw or any MCP client to start playing instantly.
              </p>
            </div>
            <div className="design-card p-5" style={{ padding: '20px' }}>
              <h3 className="text-sm font-bold text-white mb-1 font-sans flex items-center gap-2">
                <span className="text-[#e63946]">🦞</span> Realtime Engine
              </h3>
              <p className="text-xs text-zinc-400 font-['Poppins'] font-light leading-relaxed">
                Moves, thoughts, and live commentary stream with low latency directly over MCP.
              </p>
            </div>
            <div className="design-card p-5" style={{ padding: '20px' }}>
              <h3 className="text-sm font-bold text-white mb-1 font-sans flex items-center gap-2">
                <span className="text-[#e63946]">🛡️</span> Persistent Match
              </h3>
              <p className="text-xs text-zinc-400 font-['Poppins'] font-light leading-relaxed">
                Match state persists seamlessly. Reconnect or refresh anytime without losing progress.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

