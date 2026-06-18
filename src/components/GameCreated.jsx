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
  const [legalAccepted, setLegalAccepted] = useState(false);
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
    if (boardOpening || !legalAccepted) return;
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
          50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 0 4px rgba(57, 211, 83, 0); }
        }
        @keyframes subtleFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: subtleFadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* HEADER ROW */}
      <header className="h-[72px] border-b border-[#111111] flex items-center justify-between px-6 bg-[#0a0a0a] sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw Logo" 
            draggable={false}
            className="w-[140px] h-auto object-contain block hover:opacity-90 transition-opacity"
            style={{ filter: 'drop-shadow(0 2px 10px rgba(230,57,70,0.15))' }}
          />
        </div>
      </header>

      {/* Hero Header Area */}
      <div className="text-center pt-12 pb-8 px-4 animate-fade-up relative z-10" style={{ animationDelay: '0.05s' }}>
        <div className="inline-flex mb-4 bg-white/5 border border-white/10 text-white/80 rounded-full px-4 py-1.5 text-sm font-medium tracking-wide">
          ARENA #{gameId?.slice(0, 6).toUpperCase()}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-neutral-100 tracking-tight mb-4" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.03em' }}>
          Summon Your OpenClaw <LobsterEmoji />
        </h1>
        <p className="text-[16px] sm:text-[18px] text-neutral-400 max-w-lg mx-auto" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Your digital battlefield is prepared. Command your OpenClaw to enter the arena and begin the match.
        </p>
      </div>

      <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100vw',
          height: '500px',
          background: 'radial-gradient(ellipse 60% 50% at 50% -20%, rgba(230,57,70,0.12) 0%, rgba(230,57,70,0.02) 40%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

      {/* Main Layout Card Grid */}
      <div className="max-w-[800px] mx-auto px-4 pb-16 flex flex-col gap-6 animate-fade-up relative z-10" style={{ animationDelay: '0.15s' }}>

        <div className="bg-[#111111] border border-[#222222] rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -mt-20 -mr-20 pointer-events-none" />
          
          {/* LOBBY HEADER */}
          <div className="bg-[#161616] px-6 py-5 sm:px-8 sm:py-6 border-b border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${agentConnected ? 'bg-[#22c55e]' : 'bg-neutral-600'}`} style={{ animation: agentConnected ? 'statusPulse 2s infinite ease-in-out' : 'none', boxShadow: agentConnected ? '0 0 12px rgba(34,197,94,0.6)' : 'none' }} />
              <div>
                <h2 className="text-white font-bold text-lg leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>Lobby Status</h2>
                <div className={`text-[14px] font-medium leading-tight mt-1 ${agentConnected ? 'text-[#22c55e]' : 'text-neutral-400'}`}>
                  {agentConnected ? `${agentName || "OpenClaw"} successfully connected!` : "Awaiting incoming OpenClaw connection..."}
                </div>
              </div>
            </div>
            
            <div className="text-right">
               <div className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Game Origin</div>
               <div className="font-mono text-sm text-neutral-300 bg-black/40 px-3 py-1 rounded-md mt-1 border border-white/5">{gameId?.slice(0, 8)}</div>
            </div>
          </div>

          <div className="p-6 sm:p-8 flex flex-col md:flex-row gap-8 sm:gap-10 relative z-10">
            
            {/* LEFT COLUMN: INVITE */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-[#333] text-neutral-300 text-xs font-bold flex items-center justify-center font-mono">1</div>
                <h3 className="font-semibold text-[17px] text-neutral-100 flex items-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <MessageSquare size={16} className="text-[#e63946]" />
                  <span>Send Invite Payload</span>
                </h3>
              </div>
              <p className="text-[14px] text-neutral-400 mb-4 leading-relaxed" style={{ fontFamily: "'Inter', sans-serif" }}>
                Copy and send this encrypted bridge payload to your OpenClaw to allow it to connect.
              </p>
              
              <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 font-mono text-[12px] text-neutral-300 leading-relaxed h-[140px] overflow-y-auto w-full box-border whitespace-pre-wrap select-all mb-4 scrollbar-thin scrollbar-thumb-neutral-800">
                {inviteMessage}
              </div>

              <button 
                onClick={handleCopyInvite}
                className="w-full h-12 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] text-[13px] text-white font-semibold tracking-wide uppercase rounded-xl flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              >
                {copied ? <><Check size={16} className="text-green-500"/> <span className="text-green-500">Copied!</span></> : <><Copy size={16} /> <span>Copy Invite Payload</span></>}
              </button>
            </div>

            {/* RIGHT COLUMN: ENTER ARENA */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-[#333] text-neutral-300 text-xs font-bold flex items-center justify-center font-mono">2</div>
                <h3 className="font-semibold text-[17px] text-neutral-100 flex items-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <Swords size={16} className="text-[#e63946]" />
                  <span>Enter Battlefield</span>
                </h3>
              </div>
              <p className="text-[14px] text-neutral-400 mb-6 leading-relaxed flex-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                You can enter the arena now and wait for your agent, or wait here until the lobby connection is confirmed.
              </p>

              <div className="mt-auto">
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16,
                  fontSize: 12, color: 'rgba(242,242,242,0.5)', cursor: 'pointer', lineHeight: 1.5,
                }} className="hover:text-neutral-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(e) => setLegalAccepted(e.target.checked)}
                    style={{ marginTop: 2, width: 14, height: 14, accentColor: '#e63946', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    By checking this you agree with the{' '}
                    <a href="/legal" target="_blank" rel="noopener noreferrer" style={{ color: '#e63946', textDecoration: 'underline' }}>
                      privacy policy and terms &amp; conditions
                    </a>{' '}of ChessWithClaw.
                  </span>
                </label>
                
                <button
                  onClick={handleOpenBoard}
                  disabled={!legalAccepted || boardOpening}
                  className="w-full h-14 bg-[#e63946] text-white font-bold text-[14px] hover:bg-[#ff4d5a] rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:bg-[#333] disabled:text-neutral-500 uppercase tracking-widest shadow-[0_0_20px_rgba(230,57,70,0.2)] disabled:shadow-none"
                  style={{ cursor: legalAccepted ? 'pointer' : 'not-allowed' }}
                >
                  {boardOpening ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Launch Game</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* CARD 2: Quick Developer Instructions (Moved to bottom) */}
        <div className="bg-[#111111] border border-[#222222] rounded-3xl p-6 sm:p-8 hover:border-white/10 transition-colors relative overflow-hidden">
          <div 
            className="flex items-center justify-between cursor-pointer user-select-none relative z-10" 
            onClick={() => setQuickSetupExpanded(!quickSetupExpanded)}
          >
            <div className="flex items-center gap-3 font-semibold text-lg text-neutral-200" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em' }}>
              <Zap size={20} className="text-amber-500" />
              <span>Terminal Setup Refresher</span>
            </div>
            <ChevronDown 
              size={20} 
              className="text-neutral-500 transition-transform duration-300"
              style={{ transform: quickSetupExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </div>

          {quickSetupExpanded && (
            <div className="mt-6 flex flex-col gap-4 animate-fade-up relative z-10" onClick={(e) => e.stopPropagation()}>
              
              {/* Row 1 */}
              <div className="flex flex-col gap-2">
                <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3.5 flex justify-between items-center font-mono text-[13px] text-neutral-300">
                  <div className="flex items-center gap-3 overflow-hidden mr-3">
                    <Terminal size={16} className="text-[#e63946] flex-shrink-0" />
                    <span className="truncate">openclaw skills install play-chess</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("openclaw skills install play-chess");
                      setCopiedRow1(true);
                      setTimeout(() => setCopiedRow1(false), 1500);
                    }}
                    className="text-[11px] text-[#e63946] hover:text-[#fff] font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2 py-1 rounded transition-colors"
                  >
                    {copiedRow1 ? "✓" : "COPY"}
                  </button>
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex flex-col gap-2">
                <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-3.5 flex justify-between items-center font-mono text-[13px] text-neutral-300">
                  <div className="flex items-center gap-3 overflow-hidden mr-3">
                    <Globe size={16} className="text-[#e63946] flex-shrink-0" />
                    <span className="truncate">openclaw skills install agent-browser-clawdbot</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("openclaw skills install agent-browser-clawdbot");
                      setCopiedRow2(true);
                      setTimeout(() => setCopiedRow2(false), 1500);
                    }}
                    className="text-[11px] text-[#e63946] hover:text-[#fff] font-mono font-semibold uppercase bg-transparent border-none cursor-pointer flex-shrink-0 px-2 py-1 rounded transition-colors"
                  >
                    {copiedRow2 ? "✓" : "COPY"}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
