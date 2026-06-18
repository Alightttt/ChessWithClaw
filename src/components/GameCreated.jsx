import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';

const LobsterEmoji = () => <span style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle: 'normal' }}>🦞</span>;

export default function GameCreated({ gameId, agentToken: initialAgentToken }) {
  const [agentToken, setAgentToken] = useState(initialAgentToken || '');
  const [loading, setLoading] = useState(true);
  const [agentConnected, setAgentConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  
  const [step, setStep] = useState(1); // 1 = Invite, 2 = Open Board, 3 = Battle

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
          .select('agent_connected, agent_token')
          .eq('id', gameId)
          .single();
        
        if (data) {
          if (data.agent_connected) {
            setAgentConnected(true);
            setStep(3);
          }
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
        if (payload.new.agent_connected !== undefined) {
          const isConnected = !!payload.new.agent_connected;
          setAgentConnected(prev => {
            if (!prev && isConnected) {
              setStep(3);
            }
            return isConnected;
          });
        }
      })
      .subscribe();

    return () => supabase.removeChannel(subscription);
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
      toast.success('Invite copied!');
      setTimeout(() => setCopied(false), 2000);
      if (step === 1) setStep(2);
    });
  };

  const handleShareInvite = () => {
    if (navigator.share) {
      navigator.share({ text: inviteMessage }).then(() => {
        if (step === 1) setStep(2);
      }).catch(() => handleCopyInvite());
    } else {
      handleCopyInvite();
    }
  };

  const buttonStyle = {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.04) 100%), #e63946',
    boxShadow: 'rgba(255,255,255,0.18) 0px 1px 0px inset, rgba(0,0,0,0.22) 0px -1px 0px inset',
    borderRadius: '8px',
    border: 'none',
    height: '48px',
    color: '#fff',
    fontWeight: 600,
    fontSize: '15px',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ color: 'rgba(242,242,242,0.5)', fontFamily: 'Inter, sans-serif' }}>Setting up your arena...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f2f2f2', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* HEADER */}
      <header style={{ height: 52, position: 'sticky', top: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'rgba(10,10,10,0.9)', zIndex: 50, backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" alt="Logo" style={{ height: 36, objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>ChessWithClaw</span>
        </div>
        <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ background: 'transparent', border: 'none', color: soundEnabled ? '#e63946' : '#555', cursor: 'pointer' }}>
          {soundEnabled ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
          )}
        </button>
      </header>

      {/* STEPPER */}
      <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', width: '100%', maxWidth: 400, padding: '0 16px', marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, height: 2, background: '#222', zIndex: 0 }}>
            <div style={{ height: '100%', background: '#e63946', width: step === 1 ? '0%' : step === 2 ? '50%' : '100%', transition: 'width 0.3s' }} />
          </div>
          
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#0a0a0a', padding: '0 4px' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, 
                background: step > s ? '#e63946' : step === s ? '#e63946' : '#333',
                color: '#fff'
              }}>
                {step > s ? '✓' : s}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: step >= s ? '#fff' : '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {s === 1 ? 'Invite' : s === 2 ? 'Open Board' : 'Battle'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', maxWidth: 400, margin: '0 auto', width: '100%' }}>
        
        {step === 1 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.4s' }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontWeight: 800, fontSize: 'clamp(28px, 5vw, 36px)', letterSpacing: '-0.03em', marginBottom: 8 }}>Summon Your OpenClaw <LobsterEmoji /></h1>
              <p style={{ fontSize: 14, color: 'rgba(242,242,242,0.5)', lineHeight: 1.5 }}>Send this invite to your OpenClaw agent on Telegram, Discord, or wherever it lives.</p>
            </div>
            
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(242,242,242,0.7)', maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
              {inviteMessage}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={handleCopyInvite} style={buttonStyle}>
                {copied ? 'Copied!' : 'Copy Invite'}
              </button>
              <button onClick={handleShareInvite} style={{ ...buttonStyle, background: 'rgba(255,255,255,0.1)', boxShadow: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
                Share Invite
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 14, fontWeight: 500 }}>
              {agentConnected ? (
                <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                  <LobsterEmoji /> has joined!
                </span>
              ) : (
                <span style={{ color: 'rgba(242,242,242,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(242,242,242,0.4)', animation: 'pulse 2s infinite' }} />
                  Waiting for your OpenClaw...
                </span>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.4s', textAlign: 'center', marginTop: 16 }}>
            <h1 style={{ fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', marginBottom: 8 }}>Invite Sent</h1>
            <p style={{ fontSize: 15, color: 'rgba(242,242,242,0.6)', lineHeight: 1.6, marginBottom: 16 }}>
              Open the board in a new tab, then come back here to see when your OpenClaw joins.
            </p>
            
            <button onClick={() => window.open(`/game/${gameId}`, '_blank')} style={buttonStyle}>
              Open Game Board →
            </button>
            
            <div style={{ marginTop: 24, fontSize: 14, fontWeight: 500 }}>
              {agentConnected ? (
                <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                  <LobsterEmoji /> has joined!
                </span>
              ) : (
                <span style={{ color: 'rgba(242,242,242,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(242,242,242,0.4)', animation: 'pulse 2s infinite' }} />
                  Waiting for your OpenClaw...
                </span>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.4s', textAlign: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 48, marginBottom: -16 }}><LobsterEmoji /></div>
            <h1 style={{ fontWeight: 800, fontSize: 36, letterSpacing: '-0.02em', marginBottom: 8 }}>is ready!</h1>
            <p style={{ fontSize: 15, color: 'rgba(242,242,242,0.6)', lineHeight: 1.6, marginBottom: 16 }}>
              Your OpenClaw has joined the arena. Time to make your first move.
            </p>
            
            <button onClick={() => navigate(`/game/${gameId}`)} style={buttonStyle}>
              Enter the Arena →
            </button>
          </div>
        )}

        {/* QUICK START SECTION */}
        <div style={{ width: '100%', marginTop: 'auto', paddingTop: 64 }}>
          <details style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
            <summary style={{ padding: '16px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'rgba(242,242,242,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', outline: 'none' }}>
              Quick Setup
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </summary>
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'rgba(242,242,242,0.5)', marginTop: -4 }}>Install both skills on your OpenClaw before playing.</p>
              <div style={{ background: '#080808', border: '1px solid #1e1e1e', borderRadius: 8, padding: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#f2f2f2', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                npx clawhub install play-chess
              </div>
              <div style={{ background: '#080808', border: '1px solid #1e1e1e', borderRadius: 8, padding: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#f2f2f2', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                npx clawhub install agent-browser-clawdbot
              </div>
            </div>
          </details>
        </div>

      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        details[open] summary svg { transform: rotate(180deg); transition: transform 0.2s; }
      `}</style>
    </div>
  );
}
