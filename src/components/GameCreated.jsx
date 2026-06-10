import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { ChevronDown, Zap, Terminal, Globe, Copy, Check, MessageSquare, Swords } from 'lucide-react';

const LobsterEmoji = () => (
  <span style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle: 'normal' }}>
    🦞
  </span>
);

export default function GameCreated({ gameId, agentToken: initialAgentToken }) {
  const [copied, setCopied] = useState(false);
  const [agentToken, setAgentToken] = useState(initialAgentToken || '');
  const [boardOpening, setBoardOpening] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('Your OpenClaw');
  const [quickSetupExpanded, setQuickSetupExpanded] = useState(false);
  const [copiedRow1, setCopiedRow1] = useState(false);
  const [copiedRow2, setCopiedRow2] = useState(false);
  const [copiedRow2b, setCopiedRow2b] = useState(false);
  const [copiedRow3, setCopiedRow3] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
              toast.success(<>{payload.new.agent_name || 'Your OpenClaw'} has joined! <LobsterEmoji /></>);
            } else if (prev && !isConnected) {
              toast.error(`${payload.new.agent_name || 'Your OpenClaw'} disconnected.`);
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

  const inviteMessage = `🦞 ChessWithClaw Invite

Your rival is waiting. Join as Black.

GAME ID: ${gameId}
TOKEN: ${agentToken}
BOARD: https://chesswithclaw.vercel.app/Agent?id=${gameId}&token=${agentToken}

To join and play:
npx clawhub install play-chess
(then send me this invite message)

Save these — you need them to join:
export GAME_ID="${gameId}"
export AGENT_TOKEN="${agentToken}"

Then poll: curl "https://chesswithclaw.vercel.app/api/poll?gameId=${gameId}&last_move_count=0" -H "x-agent-token: ${agentToken}" -H "x-agent-name: YOUR_NAME"`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenBoard = () => {
    if (boardOpening) return;
    setBoardOpening(true);
    navigate(`/game/${gameId}`);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '32px', height: '32px',
          border: '3px solid #333',
          borderTop: '3px solid #e63946',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{
          color: 'rgba(242,242,242,0.5)',
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px'
        }}>
          Setting up your arena...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30" style={{ boxSizing: 'border-box' }}>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; box-shadow: 0 0 0 0 rgba(57, 211, 83, 0.4); }
          50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 0 6px rgba(57, 211, 83, 0); }
        }
        @keyframes subtleFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: subtleFadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* HEADER ROW */}
      <header className="h-[72px] border-b border-white/5 flex items-center justify-between px-6 bg-[#0a0a0a] sticky top-0 z-50 backdrop-blur-xl bg-opacity-80">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw Logo" 
            draggable={false}
            className="w-[140px] h-auto object-contain block hover:opacity-90 transition-opacity"
            style={{ filter: 'drop-shadow(0 2px 10px rgba(230,57,70,0.15))' }}
          />
        </div>
        <div className="bg-[#e63946]/10 border border-[#e63946]/30 text-[#e63946] font-mono rounded-lg px-3 py-1.5 text-xs font-bold tracking-widest shadow-[0_0_15px_rgba(230,57,70,0.2)]">
          ARENA #{gameId?.slice(0, 6).toUpperCase()}
        </div>
      </header>

      {/* Hero Header Area */}
      <div className="text-center pt-12 px-4 animate-fade-up relative z-10" style={{ animationDelay: '0.05s' }}>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-neutral-100 tracking-tight mb-4" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.03em' }}>
          Summon Your OpenClaw <LobsterEmoji />
        </h1>
        <p className="text-[15px] sm:text-[17px] text-neutral-400 max-w-lg mx-auto" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Your digital battlefield is prepared. Command your agent to enter the arena and begin the match.
        </p>

        {/* Modular Progress Hub */}
        <div className="flex flex-col items-center mt-10 gap-4">
          <div className="flex items-center gap-3">
            {/* Step 1: Init */}
            <div className="w-[12px] h-[12px] rounded-full bg-[#e63946] shadow-[0_0_12px_rgba(230,57,70,0.8)]" />
            {/* Divider */}
            <div className={`h-[2px] w-16 sm:w-24 transition-colors duration-500 ${agentConnected ? 'bg-[#e63946]' : 'bg-neutral-800'}`} />
            {/* Step 2: Connection */}
            <div className={`w-[12px] h-[12px] rounded-full border-2 transition-all duration-500 ${agentConnected ? 'bg-[#e63946] border-transparent shadow-[0_0_12px_rgba(230,57,70,0.8)]' : 'border-neutral-700 bg-transparent'}`} />
            {/* Divider */}
            <div className={`h-[2px] w-16 sm:w-24 transition-colors duration-500 ${agentConnected ? 'bg-[#e63946]' : 'bg-neutral-800'}`} />
            {/* Step 3: Match */}
            <div className={`w-[12px] h-[12px] rounded-full border-2 transition-all duration-500 ${agentConnected ? 'bg-[#e63946] border-transparent shadow-[0_0_12px_rgba(230,57,70,0.8)]' : 'border-neutral-800 bg-transparent'}`} />
          </div>
          <div className="flex gap-10 sm:gap-16 text-[13px] font-medium tracking-wide text-neutral-500 font-sans">
            <span className="text-neutral-400">Setup</span>
            <span className={agentConnected ? 'text-neutral-400 font-normal' : 'text-white font-semibold'}>Invite Agent</span>
            <span className={agentConnected ? 'text-white font-semibold shadow-white drop-shadow-md' : 'text-neutral-600 font-normal'}>Enter Battle</span>
          </div>
        </div>
      </div>

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

      {/* Main Layout Card Grid */}
      <div className="max-w-[600px] mx-auto px-4 py-8 flex flex-col gap-6 animate-fade-up relative z-10" style={{ animationDelay: '0.15s' }}>

        {/* CARD 1: Setup Invitation */}
        <div className="bg-gradient-to-br from-[#1b1a19] to-[#161514] border border-white/5 rounded-2xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-all hover:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mt-10 -mr-10 pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-5 relative z-10">
            <div className="w-7 h-7 rounded-full bg-[#e63946] text-white text-[13px] font-bold flex items-center justify-center font-mono shadow-[0_0_10px_rgba(230,57,70,0.4)]">
              1
            </div>
            <h3 className="font-semibold text-lg text-neutral-100 flex items-center gap-2">
              <MessageSquare size={18} className="text-[#e63946]" />
              <span>Invite {agentName || 'OpenClaw'}</span>
            </h3>
          </div>

          <p className="text-sm text-neutral-400 mb-5 leading-relaxed relative z-10">
            Send this invite payload to your OpenClaw to establish a live secure bridge:
          </p>

          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 font-mono text-[12px] text-neutral-300 leading-relaxed max-h-[140px] overflow-y-auto w-full box-border whitespace-pre-wrap select-all relative z-10 shadow-inner">
            {inviteMessage}
          </div>

          <button 
            onClick={handleCopyInvite}
            className="w-full mt-5 h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-xl font-medium text-[13px] tracking-wider uppercase shadow-lg shadow-red-500/20 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] transition-all relative z-10"
          >
            {copied ? (
              <>
                <Check size={16} className="text-white" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={15} />
                <span>Copy Invite Payload</span>
              </>
            )}
          </button>
        </div>

        {/* CARD 2: Quick Developer Instructions */}
        <div className="bg-gradient-to-br from-[#1b1a19] to-[#161514] border border-white/5 rounded-2xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)] hover:border-white/10 transition-all relative overflow-hidden">
          <div 
            className="flex items-center justify-between cursor-pointer user-select-none relative z-10" 
            onClick={() => setQuickSetupExpanded(!quickSetupExpanded)}
          >
            <div className="flex items-center gap-3 font-semibold text-[15px] text-neutral-200">
              <Zap size={18} className="text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
              <span>⚡ Terminal Quick Setup</span>
            </div>
            <ChevronDown 
              size={18} 
              className="text-neutral-500 transition-transform duration-300"
              style={{ transform: quickSetupExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </div>

          {quickSetupExpanded && (
            <div className="mt-6 flex flex-col gap-5 animate-fade-up relative z-10" onClick={(e) => e.stopPropagation()}>
              
              {/* Row 1 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-neutral-400 font-medium ml-1">Step A: Install Play Skill</span>
                <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3.5 flex justify-between items-center font-mono text-[13px] text-neutral-300 shadow-inner">
                  <div className="flex items-center gap-2.5 overflow-hidden mr-3">
                    <Terminal size={15} className="text-[#e63946] flex-shrink-0" />
                    <span className="truncate">openclaw skills install play-chess</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("openclaw skills install play-chess");
                      setCopiedRow1(true);
                      setTimeout(() => setCopiedRow1(false), 1500);
                    }}
                    className="text-[11px] text-[#e63946] hover:text-red-400 font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2.5 py-1 rounded bg-[#e63946]/10 hover:bg-[#e63946]/20 transition-colors"
                  >
                    {copiedRow1 ? "✓" : "COPY"}
                  </button>
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-neutral-400 font-medium ml-1">Step B: Browser Agent Tool (Clawdbot)</span>
                <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3.5 flex justify-between items-center font-mono text-[13px] text-neutral-300 shadow-inner">
                  <div className="flex items-center gap-2.5 overflow-hidden mr-3">
                    <Globe size={15} className="text-[#e63946] flex-shrink-0" />
                    <span className="truncate">openclaw skills install agent-browser-clawdbot</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("openclaw skills install agent-browser-clawdbot");
                      setCopiedRow2(true);
                      setTimeout(() => setCopiedRow2(false), 1500);
                    }}
                    className="text-[11px] text-[#e63946] hover:text-red-400 font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2.5 py-1 rounded bg-[#e63946]/10 hover:bg-[#e63946]/20 transition-colors"
                  >
                    {copiedRow2 ? "✓" : "COPY"}
                  </button>
                </div>
              </div>

              {/* Row 3 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-neutral-400 font-medium ml-1">Alternative: Browser Harness Support</span>
                <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3.5 flex justify-between items-center font-mono text-[13px] text-neutral-300 shadow-inner">
                  <div className="flex items-center gap-2.5 overflow-hidden mr-3">
                    <Zap size={15} className="text-amber-500 flex-shrink-0" />
                    <span className="truncate">npx skills add https://github.com/browser-use/browser-harness-js --skill cdp</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("npx skills add https://github.com/browser-use/browser-harness-js --skill cdp");
                      setCopiedRow2b(true);
                      setTimeout(() => setCopiedRow2b(false), 1500);
                    }}
                    className="text-[11px] text-[#e63946] hover:text-red-400 font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2.5 py-1 rounded bg-[#e63946]/10 hover:bg-[#e63946]/20 transition-colors"
                  >
                    {copiedRow2b ? "✓" : "COPY"}
                  </button>
                </div>
              </div>

              {/* Row 4 */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-neutral-400 font-medium ml-1">Disable Bot Idle Timeout</span>
                <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3.5 flex justify-between items-center font-mono text-[13px] text-neutral-300 shadow-inner">
                  <div className="flex items-center gap-2.5 overflow-hidden mr-3">
                    <Zap size={15} className="text-[#e63946] flex-shrink-0" />
                    <span className="truncate">agents.defaults.llm.idleTimeoutSeconds = 0</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("agents.defaults.llm.idleTimeoutSeconds = 0");
                      setCopiedRow3(true);
                      setTimeout(() => setCopiedRow3(false), 1500);
                    }}
                    className="text-[11px] text-[#e63946] hover:text-red-400 font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2.5 py-1 rounded bg-[#e63946]/10 hover:bg-[#e63946]/20 transition-colors"
                  >
                    {copiedRow3 ? "✓" : "COPY"}
                  </button>
                </div>
              </div>

              <div className="text-xs text-neutral-500 text-center mt-2 bg-white/5 p-3 rounded-lg border border-white/5">
                Run once. OpenClaw registers and persists these skills locally.
              </div>
            </div>
          )}
        </div>

        {/* CARD 3: Open Arena and Launch */}
        <div className="bg-gradient-to-br from-[#1b1a19] to-[#161514] border border-white/5 rounded-2xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)] hover:border-white/10 transition-all relative overflow-hidden">
          <div className="flex items-center gap-3 mb-5 relative z-10">
            <div className={`w-7 h-7 rounded-full border text-[13px] font-bold flex items-center justify-center font-mono transition-all duration-500 ${agentConnected ? 'bg-[#222] border-neutral-600 text-neutral-300' : 'bg-[#e63946] border-transparent text-white shadow-[0_0_10px_rgba(230,57,70,0.4)]'}`}>
              2
            </div>
            <h3 className="font-semibold text-lg text-neutral-100 flex items-center gap-2">
              <Swords size={18} className="text-[#e63946]" />
              <span>Enter Battlefield</span>
            </h3>
          </div>

          {/* Connection Status Banner */}
          <div className="flex items-center gap-3 bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-3.5 mb-6 shadow-inner relative z-10">
            <div className={`w-[10px] h-[10px] rounded-full transition-all duration-300 ${agentConnected ? 'bg-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-neutral-600'}`} style={{ animation: agentConnected ? 'statusPulse 2s infinite ease-in-out' : 'none' }} />
            <span className={`text-[13px] font-medium ${agentConnected ? 'text-[#22c55e]' : 'text-neutral-400'}`}>
              {agentConnected 
                ? `${agentName || "OpenClaw"} successfully connected!`
                : "Awaiting incoming OpenClaw secure connection..."
              }
            </span>
          </div>

          <button
            onClick={handleOpenBoard}
            disabled={boardOpening}
            className="w-full h-14 bg-transparent text-white font-semibold text-[15px] hover:bg-white/5 border border-white/10 rounded-xl cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
          >
            {boardOpening ? (
              <div className="w-5 h-5 border-2 border-neutral-500 border-t-[#e63946] rounded-full animate-spin" />
            ) : (
              <>
                <span>Launch Client Arena</span>
                <span className="text-[#e63946] ml-1 text-lg leading-none">→</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
