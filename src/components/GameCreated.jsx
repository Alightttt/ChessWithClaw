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
      `}</style>

      {/* HEADER ROW */}
      <header style={{
        height: '52px',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: '#0a0a0a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw Logo" 
            draggable={false}
            style={{ 
              width: '110px', 
              height: 'auto', 
              objectFit: 'contain',
              display: 'block'
            }} 
          />
        </div>
        <div style={{ 
          background: 'rgba(230,57,70,0.1)', 
          border: '1px solid rgba(230,57,70,0.2)', 
          color: '#e63946', 
          fontFamily: "'Inter', sans-serif", 
          borderRadius: '6px', 
          padding: '2px 8px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.05em'
        }}>
          #{gameId?.slice(0,6)}
        </div>
      </header>

      {/* Title & Subtitle Centered Below Header */}
      <div style={{ textAlign: 'center', padding: '24px 16px 0' }}>
        <h1 style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 800,
          fontSize: '24px',
          color: '#f2f2f2',
          marginTop: '24px',
          marginBottom: '6px',
          letterSpacing: '-0.02em'
        }}>
          Summon Your OpenClaw <LobsterEmoji />
        </h1>
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: '13px',
          color: 'rgba(242,242,242,0.4)',
          margin: 0
        }}>
          Your arena is ready. Follow the steps.
        </p>

        {/* Progress indicator (3 dots) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Setup */}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              border: '1px solid #fff',
              boxSizing: 'border-box'
            }} />
            {/* Invite */}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: agentConnected ? 'transparent' : '#e63946',
              border: agentConnected ? '1px solid #fff' : 'none',
              boxSizing: 'border-box'
            }} />
            {/* Battle */}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: agentConnected ? '#e63946' : '#222',
              boxSizing: 'border-box'
            }} />
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '10px', color: '#444', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ color: '#888' }}>Setup</span>
            <span style={{ color: agentConnected ? '#888' : '#fff', fontWeight: agentConnected ? 400 : 600 }}>Invite</span>
            <span style={{ color: agentConnected ? '#fff' : '#444', fontWeight: agentConnected ? 600 : 400 }}>Battle</span>
          </div>
        </div>
      </div>

      {/* Main Form Fields Container */}
      <div style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '24px 16px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxSizing: 'border-box'
      }}>

        {/* QUICK SETUP (Collapsible, CLOSED by default) */}
        <div style={{
          background: '#111111',
          border: '1px solid #1e1e1e',
          borderRadius: '14px',
          padding: '14px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          boxSizing: 'border-box',
          transition: 'all 0.2s ease'
        }} className="hover:border-neutral-800" onClick={() => setQuickSetupExpanded(!quickSetupExpanded)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px', color: '#f2f2f2' }}>
              <Zap size={15} className="text-[#e63946]" />
              <span>⚡ Quick Setup</span>
            </div>
            <ChevronDown 
              size={16} 
              style={{
                transform: quickSetupExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                color: 'rgba(242,242,242,0.4)',
                marginLeft: 'auto'
              }}
            />
          </div>

          {quickSetupExpanded && (
            <div style={{ marginTop: '14px' }} onClick={(e) => e.stopPropagation()}>
              {/* Row 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0' }}>
                <div style={{
                  background: '#080808',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '12px',
                  color: '#888'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Terminal size={14} className="text-[#e63946] flex-shrink-0" />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>openclaw skills install play-chess</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("openclaw skills install play-chess");
                      setCopiedRow1(true);
                      setTimeout(() => setCopiedRow1(false), 1500);
                    }}
                    style={{
                      fontSize: '11px',
                      color: copiedRow1 ? '#39d353' : '#e63946',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: '2px 8px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    {copiedRow1 ? "✓ animate" : (copiedRow1 ? "✓" : "COPY")}
                  </button>
                </div>
              </div>

              {/* Row 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0' }}>
                <div style={{ fontSize: '10px', color: '#888', fontFamily: 'Inter', marginLeft: '4px' }}>Recommended for most users</div>
                <div style={{
                  background: '#080808',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '12px',
                  color: '#888'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Globe size={14} className="text-[#e63946] flex-shrink-0" />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>openclaw skills install agent-browser-clawdbot</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("openclaw skills install agent-browser-clawdbot");
                      setCopiedRow2(true);
                      setTimeout(() => setCopiedRow2(false), 1500);
                    }}
                    style={{
                      fontSize: '11px',
                      color: copiedRow2 ? '#39d353' : '#e63946',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: '2px 8px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    {copiedRow2 ? "✓" : "COPY"}
                  </button>
                </div>
              </div>

              {/* Row 2b */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0' }}>
                <div style={{ fontSize: '10px', color: '#888', fontFamily: 'Inter', marginLeft: '4px' }}>Advanced &mdash; more human-like browsing</div>
                <div style={{
                  background: '#080808',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '12px',
                  color: '#888'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Zap size={14} className="text-amber-500 flex-shrink-0" />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>npx skills add https://github.com/browser-use/browser-harness-js --skill cdp</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("npx skills add https://github.com/browser-use/browser-harness-js --skill cdp");
                      setCopiedRow2b(true);
                      setTimeout(() => setCopiedRow2b(false), 1500);
                    }}
                    style={{
                      fontSize: '11px',
                      color: copiedRow2b ? '#39d353' : '#e63946',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: '2px 8px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    {copiedRow2b ? "✓" : "COPY"}
                  </button>
                </div>
              </div>

              {/* Row 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0' }}>
                <div style={{ fontSize: '10px', color: '#888', fontFamily: 'Inter', marginLeft: '4px' }}>Prevents agent disconnections. Do once.</div>
                <div style={{
                  background: '#080808',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '12px',
                  color: '#888'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Zap size={14} className="text-[#e63946] flex-shrink-0" />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>Set agents.defaults.llm.idleTimeoutSeconds = 0 in your config</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("agents.defaults.llm.idleTimeoutSeconds = 0");
                      setCopiedRow3(true);
                      setTimeout(() => setCopiedRow3(false), 1500);
                    }}
                    style={{
                      fontSize: '11px',
                      color: copiedRow3 ? '#39d353' : '#e63946',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                      padding: '2px 8px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    {copiedRow3 ? "✓" : "COPY"}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: '#555', textAlign: 'center', marginTop: '8px', fontFamily: 'Inter' }}>
                First-time setup. Your OpenClaw learns this once.
              </div>
            </div>
          )}
        </div>

        {/* STEP 1 Card — Invite */}
        <div style={{
          background: '#111111',
          border: '1px solid #1e1e1e',
          borderRadius: '14px',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          {/* Large step number pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              background: '#e63946', color: '#fff', fontSize: '11px', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Inter, sans-serif'
            }}>1</div>
            <h3 style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: '18px',
              color: '#f2f2f2',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <MessageSquare size={16} className="text-[#e63946]" />
              <span>Invite Your OpenClaw</span>
            </h3>
          </div>

          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            color: '#555',
            margin: '0 0 12px',
            lineHeight: 1.4
          }}>
            Send this to your OpenClaw on Telegram.
          </p>

          <div style={{
            background: '#080808',
            border: '1px solid #1e1e1e',
            borderRadius: '10px',
            padding: '12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            color: 'rgba(242,242,242,0.6)',
            lineHeight: 1.5,
            maxHeight: '100px',
            overflowY: 'auto',
            width: '100%',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap'
          }}>
            {inviteMessage}
          </div>

          <button 
            onClick={handleCopyInvite}
            style={{
              background: 'linear-gradient(180deg, #ff4c5a 0%, #e63946 100%)',
              borderRadius: '10px',
              height: '48px',
              border: 'none',
              color: '#fff',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              width: '100%',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(230,57,70,0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{copied ? "✓ Copied!" : "COPY INVITE"}</span>
          </button>
        </div>

        {/* STEP 2 Card — Open Board */}
        <div style={{
          background: '#111111',
          border: '1px solid #1e1e1e',
          borderRadius: '14px',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          {/* Step number pill: "2" */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              background: '#222', color: '#fff', fontSize: '11px', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Inter, sans-serif',
              border: '1px solid #333'
            }}>2</div>
            <h3 style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: '18px',
              color: '#f2f2f2',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Swords size={16} className="text-[#e63946]" />
              <span>Open Your Arena</span>
            </h3>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#080808',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '12px',
            border: '1px solid #1a1a1a'
          }}>
            <div style={{
              width: '8px', 
              height: '8px', 
              borderRadius: '50%',
              background: agentConnected ? '#39d353' : '#333',
              animation: agentConnected ? 'statusPulse 1.8s infinite ease-in-out' : 'none',
              flexShrink: 0
            }} />
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              color: agentConnected ? '#39d353' : 'rgba(242,242,242,0.4)'
            }}>
              {agentConnected 
                ? "OpenClaw connected!"
                : "Waiting for OpenClaw..."
              }
            </span>
          </div>

          <button
            onClick={handleOpenBoard} 
            disabled={boardOpening}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              height: '48px',
              color: '#fff',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            className="hover:bg-white/5 active:bg-white/10"
          >
            {boardOpening ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(242,242,242,0.4)',
                borderTop: '2px solid #e63946',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : "OPEN GAME BOARD →"}
          </button>
        </div>

      </div>
    </div>
  );
}
