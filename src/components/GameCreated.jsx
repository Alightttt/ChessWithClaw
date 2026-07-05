import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { ChevronDown, Terminal, Globe, Copy, Check, Zap, ArrowRight, Play } from 'lucide-react';

export default function GameCreated({ gameId, agentToken: initialAgentToken }) {
  const [copied, setCopied] = useState(false);
  const [agentToken, setAgentToken] = useState(initialAgentToken || '');
  const [boardOpening, setBoardOpening] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('Your Agent');
  const [quickSetupExpanded, setQuickSetupExpanded] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    document.title = agentConnected
      ? `${agentName} connected! — ChessWithClaw`
      : 'Setup Match — ChessWithClaw';
  }, [agentConnected, agentName]);

  useEffect(() => {
    if (!gameId || gameId === 'new') {
      window.location.href = '/api/new';
      return;
    }

    const cookieName = `game_owner_${gameId}`;
    const cookieMatch = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
    const localOwner = localStorage.getItem(`game_owner_${gameId}`);
    
    if (cookieMatch) {
      localStorage.setItem(`game_owner_${gameId}`, cookieMatch[2]);
      document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
    }

    if (!cookieMatch && !localOwner) {
      window.location.href = '/api/new';
      return;
    }

    const fetchGame = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('games')
          .select('agent_connected, agent_name, agent_token')
          .eq('id', gameId)
          .single();
        
        if (data) {
          if (data.agent_name) setAgentName(data.agent_name);
          if (data.agent_connected !== undefined) setAgentConnected(!!data.agent_connected);
          if (!agentToken && data.agent_token) setAgentToken(data.agent_token);
        }
      } catch (err) {
        toast.error('Error loading game: ' + err.message);
      } finally {
        setLoading(false);
      }
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
              toast.success(`${payload.new.agent_name || 'Your Agent'} has joined!`);
            }
            return isConnected;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  const inviteMessage = `ChessWithClaw setup (one-time only — skip this block if you've already added this tool before):
1. openclaw mcp add --url https://chesswithclaw.vercel.app/api/mcp
2. Call join_game with invite_code: "${gameId}"

After step 1, this tool stays available for every future game — you will not need to repeat it.
Works with OpenClaw, Hermes, and other MCP-capable agents; the add command in step 1 may differ by platform.`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenBoard = () => {
    if (boardOpening || !legalAccepted) return;
    setBoardOpening(true);
    navigate(`/game/${gameId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--red)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white font-sans selection:bg-[var(--red-dim)] selection:text-[var(--red)]">
      {/* Sleek minimal header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--border)]">
        <img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" alt="ChessWithClaw" className="h-5 object-contain cursor-pointer" onClick={() => navigate('/')} />
        {agentConnected && (
          <div className="flex items-center gap-2 text-sm font-medium text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {agentName} connected
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl font-bold tracking-tight mb-2">Match Created</h1>
          <p className="text-white/50 text-sm font-mono">ID: {gameId.toUpperCase()}</p>
        </motion.div>

        <div className="space-y-6">
          {/* Step 1: Invite */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-8 h-8 rounded-full bg-[var(--red)] text-white flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Invite your agent</h2>
                <p className="text-sm text-white/50">Send these instructions to your agent to start.</p>
              </div>
            </div>
            
            <div className="bg-black/50 border border-[var(--border)] rounded-xl p-4 mb-4 font-mono text-sm text-white/70 whitespace-pre-wrap select-all">
              {inviteMessage}
            </div>

            <button 
              onClick={handleCopyInvite}
              className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${copied ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-white text-black hover:bg-white/90'}`}
            >
              {copied ? <><Check size={16} /> Copied to clipboard</> : <><Copy size={16} /> Copy Credentials</>}
            </button>
            <p className="mt-4 text-center text-xs text-white/40">Step 1 only happens once, ever — every future game just needs step 2.</p>
          </motion.div>

          {/* Step 2: Open Board */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`rounded-2xl p-6 border transition-colors duration-500 ${agentConnected ? 'bg-green-500/5 border-green-500/20' : 'bg-[var(--surface)] border-[var(--border)]'}`}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-500 ${agentConnected ? 'bg-green-500 text-black' : 'bg-[var(--border-strong)] text-white/50'}`}>2</div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold tracking-tight">Open the board</h2>
                <p className="text-sm text-white/50">Ready to play when you are.</p>
              </div>
              {!agentConnected && (
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs font-medium text-amber-500/80 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Waiting for agent...
                  </div>
                  <div className="text-[10px] text-white/40 text-right max-w-[200px]">
                    This can take anywhere from a few seconds to a few minutes depending on what your agent is doing right now — it isn't stuck.
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 p-4 rounded-xl bg-black/20 border border-[var(--border)] mb-4 cursor-pointer hover:bg-black/40 transition-colors">
              <input
                type="checkbox"
                checked={legalAccepted}
                onChange={(e) => setLegalAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 accent-[var(--red)] cursor-pointer"
              />
              <span className="text-sm text-white/60 leading-relaxed">
                I agree to the <a href="/legal" target="_blank" className="text-white hover:text-[var(--red)] underline underline-offset-4">privacy policy and terms</a>.
              </span>
            </label>

            <button 
              onClick={handleOpenBoard}
              disabled={boardOpening || !legalAccepted}
              className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${legalAccepted ? 'bg-[var(--red)] hover:bg-[var(--red-hover)] text-white shadow-lg shadow-red-500/20' : 'bg-[var(--border-strong)] text-white/30 cursor-not-allowed'}`}
            >
              {boardOpening ? <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" /> : <><Play fill="currentColor" size={16} /> Start Game</>}
            </button>
          </motion.div>

          {/* Optional: Setup Commands */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <button 
              onClick={() => setQuickSetupExpanded(!quickSetupExpanded)}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 hover:bg-[var(--surface)] transition-colors text-sm text-white/60"
            >
              <div className="flex items-center gap-2">
                <Terminal size={16} />
                <span>First time? CLI setup commands</span>
              </div>
              <ChevronDown size={16} className={`transition-transform duration-300 ${quickSetupExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {quickSetupExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 mt-2 space-y-2 border border-[var(--border)] rounded-xl bg-black/50">
                    {[
                      { label: 'Install chess skill', cmd: 'openclaw skills install play-chess', icon: <Zap size={14} className="text-[var(--red)]" /> },
                      { label: 'Install browser skill', cmd: 'openclaw skills install @matrixy/agent-browser-clawdbot', icon: <Globe size={14} className="text-blue-400" /> },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {row.icon}
                          <div className="font-mono text-xs text-white/70 truncate">{row.cmd}</div>
                        </div>
                        <button 
                          onClick={() => navigator.clipboard.writeText(row.cmd)}
                          className="text-xs font-medium text-white/40 hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

