import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { motion } from 'motion/react';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';

// Fixed the recursive call that was causing the browser stack overflow memory crash
const LobsterEmoji = () => (
  <span style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle: 'normal' }}>
    🦞
  </span>
);

export default function GameCreated({ gameId, agentToken: initialAgentToken }) {
  const [copyState, setCopyState] = useState('default');
  const [agentToken, setAgentToken] = useState(initialAgentToken || '');
  const [boardOpening, setBoardOpening] = useState(false);
  const [boardOpened, setBoardOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('Your OpenClaw');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('cwc_agent_display_name') || '');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDisplayNameChange = (e) => {
    const val = e.target.value;
    setDisplayName(val);
    localStorage.setItem('cwc_agent_display_name', val);
  };

  useEffect(() => {
    // If we do not have a valid gameId or if gameId is empty/null, redirect to serverless /api/new
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

    // Unconditional redirect to server endpoint if ownership is not detected to prevent unauthorized accesses
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  
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
    // Navigate in same window to bypass sandbox popup blockages
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
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white font-sans overflow-hidden relative selection:bg-red-500/30" style={{ padding: '0px 16px 24px', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none rounded-full" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.05) 0%, rgba(0,0,0,0) 70%)' }} />

      <div className="max-w-xl mx-auto w-full relative z-10 pt-0 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flex: 1 }}>
            <button 
              onClick={() => navigate('/')}
              style={{ width: '40px', height: '40px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '50%' }}
              className="flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#161616] transition-all active:scale-95 shadow-sm mr-4 flex-shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <img 
              src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
              alt="ChessWithClaw Logo" 
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{ 
                width: '150px', 
                height: 'auto', 
                objectFit: 'contain', 
                flexShrink: 0, 
                display: 'block',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                pointerEvents: 'none',
                filter: 'drop-shadow(0 2px 10px rgba(230,57,70,0.15))'
              }} 
            />
          </div>
          <div style={{ background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946', fontFamily: "'Inter', sans-serif", borderRadius: '8px', padding: '4px 10px' }} className="text-xs font-bold tracking-widest uppercase">#{gameId?.slice(0,6)}</div>
        </div>
        <div className="mb-4 text-center">
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontSize: '36px', fontWeight: 800, letterSpacing: '-0.03em' }} className="text-white font-sans">Summon Your OpenClaw <LobsterEmoji /></h1>
        </div>

        {/* Stepper */}
        <style>{`
          @keyframes clawPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(230,57,70,0.4); border-color: rgba(230,57,70,0.6); }
            50% { box-shadow: 0 0 0 10px rgba(230,57,70,0); border-color: rgba(230,57,70,1); }
          }
          @keyframes scaleIn {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .copied {
            background: #1a7a3a !important;
          }
          .card-container {
            background: linear-gradient(145deg, #1b1a19 0%, #161514 100%);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 12px;
            padding: 24px;
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          }
          .install-cmd-box {
            background: #080808;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 8px;
            font-family: 'Inter', sans-serif;
            padding: 12px 14px;
            font-size: 13px;
            color: rgba(242,242,242,0.7);
            line-height: 1.8;
            width: 100%;
            box-sizing: border-box;
            overflow-x: auto;
            word-break: break-all;
          }
          .invite-msg-box {
            background: #080808;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 10px;
            font-family: 'Inter', sans-serif;
            padding: 14px;
            font-size: 12px;
            color: rgba(242,242,242,0.6);
            line-height: 1.8;
            width: 100%;
            box-sizing: border-box;
            overflow-wrap: break-word;
            word-break: break-word;
          }
        `}</style>
        
        <div className="relative mb-14 w-full px-2 mt-4">
          <div className="absolute top-5 left-[15%] right-[15%] h-[2px] bg-white/5 rounded-full z-0 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#e63946] to-[#ff4d5a] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" 
              style={{ width: agentConnected ? '100%' : boardOpened ? '50%' : '0%' }}
            />
          </div>
          
          <div className="relative z-10 flex justify-between items-start">
            {/* Step 1 */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#e63946] text-white shadow-[0_0_20px_-5px_rgba(230,57,70,0.5)] border border-[#e63946]/30">
                <CheckCircle2 size={20} className="text-white" />
              </div>
              <div className="font-['Inter'] text-[11px] font-bold tracking-widest uppercase text-[#e63946]">Invite</div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center gap-2">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                  boardOpened 
                    ? 'bg-[#e63946] text-white shadow-[0_0_20px_-5px_rgba(230,57,70,0.5)] border border-[#e63946]/30' 
                    : 'bg-[#111] text-[#e63946] border-2 border-[#e63946]'
                }`}
              >
                {boardOpened ? <CheckCircle2 size={20} className="text-white" /> : <span className="font-semibold">2</span>}
              </div>
              <div className={`font-['Inter'] text-[11px] font-bold tracking-widest uppercase transition-colors duration-500 ${
                boardOpened || !agentConnected ? 'text-[#e63946]' : 'text-neutral-500'
              }`}>Board</div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center gap-2">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                  agentConnected 
                    ? 'bg-[#e63946] text-white shadow-[0_0_20px_-5px_rgba(230,57,70,0.5)] border border-[#e63946]/30' 
                    : boardOpened
                    ? 'bg-[#111] text-[#e63946] border-2 border-[#e63946]'
                    : 'bg-[#111] text-neutral-500 border border-white/10'
                }`}
                style={boardOpened && !agentConnected ? { animation: 'clawPulse 2s infinite' } : {}}
              >
                {agentConnected ? (
                  <div style={{ animation: 'scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
                    <CheckCircle2 size={20} className="text-white" />
                  </div>
                ) : (
                  <span className="font-semibold">3</span>
                )}
              </div>
              <div className={`font-['Inter'] text-[11px] font-bold tracking-widest uppercase transition-colors duration-500 ${
                agentConnected || boardOpened ? 'text-[#e63946]' : 'text-neutral-500'
              }`}>Battle</div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
            className="card-container"
          >
            <div className="flex items-center gap-4 mb-6">
              <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946', borderRadius: '6px', padding: '4px 10px', fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600 }}>1</div>
              <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-white">Invite OpenClaw</h2>
            </div>
            
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', fontWeight: 300 }} className="text-neutral-400 mb-4 leading-relaxed">1. Ensure you have the required OpenClaw skills installed.</p>
            <div className="install-cmd-box mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <span style={{ color: '#e63946', fontWeight: 'bold' }}>{'>'}</span>
                <span style={{ color: 'rgba(242,242,242,0.7)' }}>npx clawhub install play-chess</span>
              </div>
              <div className="flex items-center gap-3">
                <span style={{ color: '#e63946', fontWeight: 'bold' }}>{'>'}</span>
                <span style={{ color: 'rgba(242,242,242,0.7)' }}>npx clawhub install agent-browser-clawdbot</span>
              </div>
            </div>

            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', fontWeight: 300 }} className="text-neutral-400 mb-3 leading-relaxed">2. Send the connection string below to your OpenClaw:</p>
            <div className="relative mb-6">
              <div className="invite-msg-box relative h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 whitespace-pre-wrap">
                {inviteMessage.split('\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {line.startsWith('BOARD:') || line.includes('https://') ? (
                      <span style={{ color: '#e63946' }}>{line}</span>
                    ) : (
                      line
                    )}
                    <br />
                  </React.Fragment>
                ))}
              </div>
            </div>

            <button 
              onClick={handleShare}
              className={`design-btn-primary h-12 w-full text-sm font-semibold rounded-lg ${copyState === 'copied' ? 'copied' : ''}`}
            >
              {copyState === 'copied' ? "Copied! ✓" : "COPY INVITATION"}
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
            className="card-container"
          >
            <div className="flex flex-col gap-2">
              <label style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#e63946', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                What do you call your OpenClaw? (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={handleDisplayNameChange}
                placeholder="e.g. OpenClaw, Jarvis, Max..."
                maxLength={30}
                style={{
                  width: '100%',
                  background: '#080808',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '14px',
                  padding: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                className="focus:border-[#e63946]/50"
              />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
            className="card-container"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946', borderRadius: '6px', padding: '4px 10px', fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600 }}>2</div>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }} className="text-white">Enter the Arena</h2>
              </div>
            </div>
            
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '15px', fontWeight: 300 }} className="text-neutral-400 mb-6 leading-relaxed">The board is set. Open it in a new tab and wait for your opponent.</p>

            <button 
              onClick={handleOpenBoard} disabled={boardOpening}
              className={`design-btn-primary h-12 w-full text-sm font-semibold rounded-lg flex items-center justify-center gap-2`}
              style={boardOpened ? { background: '#111111', border: '1px solid #222222', boxShadow: 'none', color: '#e63946' } : {}}
            >
              {boardOpening ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                </motion.div>
              ) : boardOpened ? "RETURN TO MATCH" : "OPEN ARENA WINDOW"}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
