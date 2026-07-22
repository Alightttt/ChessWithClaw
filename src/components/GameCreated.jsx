import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ArrowLeft, ExternalLink, Link2, Sparkles, Terminal, ShieldCheck, Activity } from 'lucide-react';

export default function GameCreated({ gameId }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
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

  const handleOpenBoard = () => {
    if (!legalAccepted) return;
    setBoardOpening(true);
    setTimeout(() => {
      navigate(`/game/${gameId}`);
    }, 500);
  };

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#f2f2f2', overflowX: 'clip' }} className="font-sans selection:bg-red-500/30 flex flex-col">
      <style>{`
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
          padding: 0 16px;
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

        .invite-focus-glow {
          box-shadow: 0 0 40px rgba(230,57,70,0.15), 0 10px 30px rgba(0,0,0,0.8);
        }
      `}</style>

      {/* Header: Left Back Arrow Button | CENTER App Logo */}
      <header 
        style={{
          fontFamily: "'Inter', sans-serif",
          height: '72px', width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '0 24px',
          backgroundColor: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid #1a1a1a',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}
      >
        {/* Left: Back Arrow Button */}
        <div className="flex items-center justify-start">
          <button 
            onClick={() => navigate('/')} 
            className="design-btn-secondary"
            style={{ cursor: 'pointer', gap: '8px' }}
            title="Return to Home"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>

        {/* Center: Main Logo (Same size as landing page) */}
        <div className="flex items-center justify-center cursor-pointer" onClick={() => navigate('/')}>
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

        {/* Right Balance Area */}
        <div className="flex items-center justify-end">
          {agentConnected && (
            <div className="hidden sm:flex items-center gap-2 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck size={14} />
              <span>{agentName || 'Agent'} Connected</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Page Flow */}
      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-4 py-8 md:py-12">
        {/* Headline */}
        <h1 
          className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-center tracking-tight mb-8"
          style={{ fontFamily: "'Inter', sans-serif", color: '#f2f2f2' }}
        >
          Invite your agent for chess match
        </h1>

        {/* Line above section */}
        <div className="w-full text-left mb-2.5">
          <span 
            className="text-xs font-semibold uppercase tracking-wider text-zinc-400"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            First invite your agent in game
          </span>
        </div>

        {/* Invite Section (Subconsciously grabs full visual focus) */}
        <div 
          className="w-full rounded-2xl border border-white/10 bg-[#111111] p-5 sm:p-6 mb-3 invite-focus-glow relative overflow-hidden"
        >
          {/* Top Bar of Section */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div className="flex items-center gap-2 text-sm font-bold text-white font-mono">
              <Terminal size={16} className="text-[#e63946]" />
              <span>Invite message</span>
            </div>

            <button
              onClick={handleCopyInvite}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                copied 
                  ? 'bg-emerald-500 text-black font-bold shadow-lg shadow-emerald-500/20' 
                  : 'bg-[#e63946] text-white hover:bg-[#c62e39] shadow-md shadow-red-900/30'
              }`}
            >
              {copied ? (
                <><Check size={14} className="stroke-[3]" /> Copied!</>
              ) : (
                <><Copy size={14} /> Copy Invite Message</>
              )}
            </button>
          </div>

          {/* Payload Box */}
          <div 
            className="bg-[#050505] border border-white/10 rounded-xl p-4 font-mono text-xs sm:text-sm text-emerald-400/95 leading-relaxed select-all whitespace-pre-wrap break-words mb-4"
            style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)' }}
          >
            {inviteMessage}
          </div>

          {/* MCP Endpoint Quick Access */}
          <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
            <span className="font-mono">Match ID: <strong className="text-white">{gameId}</strong></span>
            <button 
              onClick={handleCopyMcpUrl}
              className="text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1 font-mono text-[11px]"
            >
              <Link2 size={12} />
              <span>{copiedUrl ? 'Copied URL!' : 'Copy MCP URL'}</span>
            </button>
          </div>
        </div>

        {/* Line bottom of section */}
        <p 
          className="text-center text-xs text-zinc-400 leading-relaxed mb-8 max-w-lg"
          style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 300 }}
        >
          Send this invite message to you agent wherever it lives to invite it in match, first time takes little long , faster after that
        </p>

        {/* Checkbox and Legal Terms line */}
        <div className="flex items-center justify-center gap-3 mb-6 select-none">
          <input
            type="checkbox"
            id="legalConsent"
            checked={legalAccepted}
            onChange={(e) => setLegalAccepted(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-zinc-900 text-[#e63946] focus:ring-[#e63946] focus:ring-offset-0 focus:ring-1 cursor-pointer transition-all"
          />
          <label 
            htmlFor="legalConsent" 
            className="text-xs sm:text-sm text-zinc-300 cursor-pointer"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            accept <a href="/legal" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#e63946] underline decoration-white/30 underline-offset-4 transition-colors font-medium">privacy policy & terms</a>
          </label>
        </div>

        {/* Enter Game Button */}
        <button
          onClick={handleOpenBoard}
          disabled={!legalAccepted || boardOpening}
          className={`w-full max-w-md h-14 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            !legalAccepted
              ? 'opacity-35 cursor-not-allowed bg-zinc-900 text-zinc-600 border border-white/5'
              : 'design-btn-primary shadow-[0_0_30px_rgba(230,57,70,0.35)]'
          }`}
        >
          {boardOpening ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Entering Game...</span>
            </div>
          ) : (
            <>
              <span>Enter game</span>
              <ExternalLink size={18} />
            </>
          )}
        </button>

        {/* Live Connection Listener Status Footer */}
        <div className="mt-8 flex items-center gap-2 text-xs text-zinc-500 font-mono">
          <Activity size={13} className={agentConnected ? "text-emerald-400" : "animate-pulse text-amber-500"} />
          <span>
            {agentConnected 
              ? `Agent (${agentName || 'Connected'}) is in the room!` 
              : 'Listening for agent connection on MCP server...'}
          </span>
        </div>
      </main>
    </div>
  );
}
