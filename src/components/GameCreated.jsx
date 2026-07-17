import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Play, ShieldCheck, Activity } from 'lucide-react';

export default function GameCreated() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [boardOpening, setBoardOpening] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  useEffect(() => {
    // Check initial state
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

  const inviteMessage = `Please connect to the MCP server at ${window.location.origin}/api/mcp and join the chess game with ID ${gameId}.`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBoard = () => {
    setBoardOpening(true);
    navigate(`/game/${gameId}`);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans selection:bg-[#e63946] selection:text-white">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" alt="ChessWithClaw" className="h-5 object-contain cursor-pointer" onClick={() => navigate('/')} />
        {agentConnected ? (
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-400 bg-green-400/10 px-4 py-1.5 rounded-full border border-green-400/20">
            <ShieldCheck size={14} />
            {agentName || 'Agent'} Connected
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20">
            <Activity size={14} className="animate-pulse" />
            Awaiting Agent
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[10px] font-bold tracking-widest uppercase mb-6">
            Game Created
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
            Ready to Play
          </h1>
          <p className="text-white/40 text-lg font-medium">Match ID: <span className="font-mono text-white/70 select-all">{gameId}</span></p>
        </motion.div>

        <div className="space-y-6">
          
          {/* Step 1: Invite */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative bg-gradient-to-b from-[#111] to-[#0a0a0a] border border-white/10 rounded-[32px] p-8 overflow-hidden shadow-xl"
          >
            <div className="absolute top-0 right-0 p-8 text-[#e63946]/10 pointer-events-none">
              <span className="font-black text-8xl">1</span>
            </div>
            
            <div className="relative z-10">
              <h2 className="text-2xl font-bold tracking-tight mb-2">Invite Your Agent</h2>
              <p className="text-white/50 text-sm mb-6 max-w-md leading-relaxed">
                Copy the prompt below and send it to your agent. This provides the exact instructions it needs to join this match via the MCP server.
              </p>
              
              <div className="relative group">
                <div className="bg-black/60 border border-white/10 rounded-2xl p-6 font-mono text-sm text-white/80 whitespace-pre-wrap select-all pr-24 leading-relaxed">
                  {inviteMessage}
                </div>
                <button 
                  onClick={handleCopyInvite}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${copied ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Step 2: Open Board */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`relative rounded-[32px] p-8 border transition-all duration-700 overflow-hidden shadow-xl ${agentConnected ? 'bg-gradient-to-b from-green-500/10 to-[#0a0a0a] border-green-500/30' : 'bg-gradient-to-b from-[#111] to-[#0a0a0a] border-white/10'}`}
          >
            <div className={`absolute top-0 right-0 p-8 pointer-events-none transition-colors duration-700 ${agentConnected ? 'text-green-500/10' : 'text-white/5'}`}>
              <span className="font-black text-8xl">2</span>
            </div>
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2">Enter Game</h2>
                  <p className="text-white/50 text-sm">Start playing as soon as you&apos;re ready.</p>
                </div>
                
                {/* Dynamic Status Indicator */}
                <div className="flex flex-col items-start md:items-end gap-2">
                  {agentConnected ? (
                    <div className="text-sm font-bold text-green-400 flex items-center gap-2">
                      <ShieldCheck size={18} />
                      Agent Connected
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-6 h-6">
                        <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                      </div>
                      <span className="text-sm font-bold text-amber-500">Waiting for Agent...</span>
                    </div>
                  )}
                  {!agentConnected && (
                    <p className="text-[10px] text-white/40 md:text-right max-w-[220px] leading-relaxed">
                      Your agent will appear here once it processes the invite message.
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-4 p-5 rounded-2xl bg-black/30 border border-white/5 mb-6 cursor-pointer hover:bg-black/50 transition-colors group">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(e) => setLegalAccepted(e.target.checked)}
                    className="peer w-5 h-5 appearance-none rounded border border-white/20 checked:bg-[#e63946] checked:border-[#e63946] transition-all cursor-pointer"
                  />
                  <Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" strokeWidth={3} />
                </div>
                <span className="text-sm font-medium text-white/60 group-hover:text-white/80 transition-colors">
                  I agree to the <a href="/legal" target="_blank" className="text-white hover:text-[#e63946] underline underline-offset-4">privacy policy and terms</a>.
                </span>
              </label>

              <button 
                onClick={handleOpenBoard}
                disabled={boardOpening || !legalAccepted}
                className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 ${legalAccepted ? 'bg-[#e63946] hover:bg-white text-white hover:text-black shadow-[0_0_40px_rgba(230,57,70,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)]' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
              >
                {boardOpening ? (
                  <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <>
                    <Play fill="currentColor" size={16} /> 
                    {agentConnected ? 'Start Game' : 'Enter Game'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
