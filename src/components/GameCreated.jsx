import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [copiedRow1, setCopiedRow1] = useState(false);
  const [copiedRow2, setCopiedRow2] = useState(false);
  const [copiedRow2b, setCopiedRow2b] = useState(false);
  const [copiedRow3, setCopiedRow3] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    document.title = agentConnected
      ? `${agentName} connected! — ChessWithClaw`
      : 'Summon Your OpenClaw — ChessWithClaw';
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

  useEffect(() => {
    if (agentConnected) {
      setShowTimeoutWarning(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, 90000);
    return () => clearTimeout(timer);
  }, [agentConnected]);

  const inviteMessage = `🦞 ChessWithClaw Invite

Your rival is waiting. Join as Black.

GAME ID: ${gameId}
TOKEN: ${agentToken}
BOARD: https://chesswithclaw.vercel.app/Agent?id=${gameId}&token=${agentToken}

To join and play:
openclaw skills install @alightttt/play-chess
(then send me this invite message)

Save these — you need them to join:
export GAME_ID="${gameId}"
export AGENT_TOKEN="${agentToken}"

Then poll: curl "https://chesswithclaw.vercel.app/api/poll?gameId=${gameId}&last_move_count=0" -H "x-agent-token: ${agentToken}" -H "x-agent-name: YOUR_NAME"`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast('Copy failed — long press to copy manually', {
        style: { background: '#0e0e0e', border: '1px solid rgba(230,57,70,0.3)', color: '#f0f0f0' }
      });
    });
  };

  const handleOpenBoard = () => {
    if (boardOpening || !legalAccepted) return;
    setBoardOpening(true);
    navigate(`/game/${gameId}`);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="design-card" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '40px 60px',
          maxWidth: '320px',
          width: '100%'
        }}>
          <div style={{ position: 'relative', width: '48px', height: '48px' }}>
            <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(255,255,255,0.05)', borderRadius: '50%' }} />
            <div style={{
              position: 'absolute', inset: 0,
              border: '3px solid transparent',
              borderTopColor: '#e63946',
              borderRadius: '50%',
              animation: 'spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
            }} />
          </div>
          <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
          <p style={{
            color: 'rgba(242,242,242,0.6)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '15px',
            fontWeight: 500,
            letterSpacing: '0.02em',
            margin: 0
          }}>
            Building your arena...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#f2f2f2', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes connectedPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34,197,94,0.4); } 50% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
        @keyframes lobsterBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .fade-up { animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>

      {/* HEADER */}
      <header style={{ height: '64px', borderBottom: '1px solid #161616', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#0a0a0a', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" alt="ChessWithClaw" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
        </div>
        {agentConnected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '20px', padding: '6px 12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'connectedPulse 2s infinite' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#22c55e' }}>{agentName} connected</span>
          </div>
        )}
      </header>

      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 20px 60px' }}>

        {/* PAGE TITLE */}
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'lobsterBounce 2.5s ease-in-out infinite', display: 'inline-block' }}><LobsterEmoji /></div>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '26px', color: '#f2f2f2', letterSpacing: '-0.03em', margin: '0 0 8px 0' }}>Summon Your OpenClaw</h1>
          <p style={{ fontSize: '14px', color: 'rgba(242,242,242,0.45)', margin: 0 }}>Arena <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'rgba(242,242,242,0.35)' }}>#{gameId?.slice(0,6).toUpperCase()}</span> is ready. Two steps to battle.</p>
        </div>

        {/* STEP 1 — INVITE */}
        <div className="fade-up design-card" style={{ animationDelay: '0.1s', marginBottom: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e63946', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>1</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#f2f2f2', letterSpacing: '-0.02em' }}>Send invite to your OpenClaw</div>
              <div style={{ fontSize: '12px', color: 'rgba(242,242,242,0.4)', marginTop: '2px' }}>Paste this in Telegram, Discord, or wherever your OpenClaw lives</div>
            </div>
          </div>

          <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'rgba(242,242,242,0.7)', lineHeight: 1.6, maxHeight: '140px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', userSelect: 'all' }}>
            {inviteMessage}
          </div>

          <button onClick={handleCopyInvite} style={{ width: '100%', height: '48px', background: copied ? 'rgba(34,197,94,0.12)' : 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.04) 100%), #e63946', border: copied ? '1px solid rgba(34,197,94,0.3)' : 'none', boxShadow: copied ? 'none' : 'rgba(255,255,255,0.18) 0px 1px 0px 0px inset, rgba(0,0,0,0.22) 0px -1px 0px 0px inset', borderRadius: '10px', color: copied ? '#22c55e' : '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' }}>
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span key="copied" initial={{ scale: 0.5, opacity: 0, rotate: -45 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={16} /><span>Copied!</span>
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Copy size={16} /><span>Copy Invite</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* STEP 2 — OPEN BOARD */}
        <div className="fade-up design-card" style={{ animationDelay: '0.18s', marginBottom: '16px', padding: '24px', border: agentConnected ? '1px solid rgba(34,197,94,0.25)' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: agentConnected ? '#22c55e' : '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0, transition: 'background 0.4s ease', color: agentConnected ? '#000' : '#555' }}>2</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#f2f2f2', letterSpacing: '-0.02em' }}>Open the board</div>
              <div style={{ fontSize: '12px', color: 'rgba(242,242,242,0.4)', marginTop: '2px' }}>Open your game after sending the invite</div>
            </div>
          </div>

          {/* Connection status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: agentConnected ? '#22c55e' : '#333', boxShadow: agentConnected ? '0 0 10px rgba(34,197,94,0.5)' : 'none', animation: agentConnected ? 'connectedPulse 2s infinite' : 'none', transition: 'all 0.4s ease' }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: agentConnected ? '#22c55e' : 'rgba(242,242,242,0.4)' }}>
              {agentConnected ? `${agentName} is in the arena!` : 'Waiting for your OpenClaw to connect...'}
            </span>
          </div>

          {showTimeoutWarning && !agentConnected && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
              background: '#1a0608',
              borderBottom: '1px solid rgba(230,57,70,0.35)',
              padding: '12px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e63946', flexShrink: 0, animation: 'pulse 2s infinite' }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, color: '#e63946' }}>
                  Still waiting after 90 seconds
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'rgba(242,242,242,0.5)' }}>
                  — Check your OpenClaw received the invite
                </span>
              </div>
              <button
                onClick={() => navigate('/')}
                style={{ background: 'transparent', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '8px', color: '#e63946', fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                Start new game
              </button>
            </div>
          )}

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16,
            fontSize: 12, color: 'rgba(242,242,242,0.5)', cursor: 'pointer', lineHeight: 1.5,
          }}>
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

          <button onClick={handleOpenBoard} disabled={boardOpening || !legalAccepted} style={{ width: '100%', height: '48px', background: !legalAccepted ? '#222' : '#0f0f0f', border: !legalAccepted ? '1px solid #333' : '1px solid #2a2a2a', borderRadius: '10px', color: !legalAccepted ? 'rgba(242,242,242,0.3)' : 'rgba(242,242,242,0.85)', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', cursor: (boardOpening || !legalAccepted) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: boardOpening ? 0.5 : 1, transition: 'all 0.2s ease', letterSpacing: '0.02em' }}>
            {boardOpening ? (<><div style={{ width: '16px', height: '16px', border: '2px solid #444', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></>) : (<><span>Open Board</span><span style={{ color: !legalAccepted ? 'rgba(242,242,242,0.2)' : '#e63946', fontSize: '16px' }}>→</span></>)}
          </button>
        </div>

        {/* QUICK SETUP — COLLAPSIBLE */}
        <div className="fade-up design-card" style={{ animationDelay: '0.26s', padding: 0 }}>
          <button onClick={() => setQuickSetupExpanded(!quickSetupExpanded)} style={{ width: '100%', padding: '16px 20px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: 'rgba(242,242,242,0.4)', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} />
              <span>First time? Quick terminal setup</span>
            </div>
            <ChevronDown size={14} style={{ transform: quickSetupExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>
          {quickSetupExpanded && (
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Install chess skill', cmd: 'openclaw skills install play-chess', icon: <Zap size={13} /> },
                { label: 'Install browser skill', cmd: 'openclaw skills install @matrixy/agent-browser-clawdbot', icon: <Globe size={13} /> },
              ].map((row, i) => (
                <div key={i} style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#e63946', flexShrink: 0 }}>{row.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', color: 'rgba(242,242,242,0.3)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{row.label}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'rgba(242,242,242,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.cmd}</div>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(row.cmd); }} style={{ background: 'transparent', border: 'none', color: '#e63946', cursor: 'pointer', padding: '4px', flexShrink: 0, fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>COPY</button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
