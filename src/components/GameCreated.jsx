import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { motion } from 'motion/react';
import { ChevronLeft, CheckCircle2, Zap, Terminal, Globe, Copy, Check, MessageSquare, Swords, ChevronDown, ChevronUp } from 'lucide-react';

const LobsterEmoji = () => (
  <span style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle: 'normal' }}>
    🦞
  </span>
);

export default function GameCreated({ gameId, agentToken: initialAgentToken }) {
  const [copied, setCopied] = useState(false);
  const [agentToken, setAgentToken] = useState(initialAgentToken || '');
  const [boardOpening, setBoardOpening] = useState(false);
  const [boardOpened, setBoardOpened] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentName, setAgentName] = useState('Your OpenClaw');
  const [quickSetupExpanded, setQuickSetupExpanded] = useState(false);
  const [copiedRow1, setCopiedRow1] = useState(false);
  const [copiedRow2, setCopiedRow2] = useState(false);
  const [copiedRow3, setCopiedRow3] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30" style={{ boxSizing: 'border-box' }}>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; box-shadow: 0 0 0 0 rgba(57, 211, 83, 0.4); }
          50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 0 6px rgba(57, 211, 83, 0); }
        }
        @keyframes headerPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* SECTION A: HEADER */}
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

      {/* Main Container */}
      <div style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '0 16px 40px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* Page Title */}
        <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
          <h1 style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 800,
            fontSize: '26px',
            color: '#f2f2f2',
            letterSpacing: '-0.02em',
            margin: '0 0 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            Summon Your OpenClaw <LobsterEmoji />
          </h1>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            color: 'rgba(242,242,242,0.4)',
            margin: 0
          }}>
            Your rival is set. Follow the steps below.
          </p>
        </div>

        {/* SECTION B: QUICK SETUP CARD */}
        <div style={{
          background: '#111111',
          border: '1px solid #1a1a1a',
          borderRadius: '12px',
          padding: '14px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          marginBottom: '16px',
          transition: 'border-color 0.2s'
        }} className="hover:border-neutral-800" onClick={() => setQuickSetupExpanded(!quickSetupExpanded)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter', fontWeight: 600, fontSize: '14px', color: '#f2f2f2' }}>
              <Zap size={15} className="text-[#e63946]" />
              <span>Quick Setup</span>
            </div>
            <ChevronDown 
              size={16} 
              style={{
                transform: quickSetupExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                color: 'rgba(242,242,242,0.4)'
              }}
            />
          </div>

          {quickSetupExpanded && (
            <div style={{ marginTop: '14px' }} onClick={(e) => e.stopPropagation()}>
              {/* Row 1 */}
              <div style={{
                background: '#080808',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'JetBrains Mono',
                fontSize: '12px',
                color: '#888',
                margin: '8px 0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <Terminal size={14} className="text-[#e63946] flex-shrink-0" />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>npx clawhub install play-chess</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("npx clawhub install play-chess");
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
                  {copiedRow1 ? "✓" : "COPY"}
                </button>
              </div>

              {/* Row 2 */}
              <div style={{
                background: '#080808',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'JetBrains Mono',
                fontSize: '12px',
                color: '#888',
                margin: '8px 0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <Globe size={14} className="text-[#e63946] flex-shrink-0" />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>npx clawhub install agent-browser-clawdbot</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("npx clawhub install agent-browser-clawdbot");
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

              {/* Row 3 */}
              <div style={{
                background: '#080808',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'JetBrains Mono',
                fontSize: '12px',
                color: '#888',
                margin: '8px 0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <Zap size={14} className="text-[#e63946] flex-shrink-0" />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>agents.defaults.llm.idleTimeoutSeconds = 0</span>
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

              <div style={{ fontSize: '11px', color: '#555', textAlign: 'center', marginTop: '8px', fontFamily: 'Inter' }}>
                First time setup. Your OpenClaw learns this once.
              </div>
            </div>
          )}
        </div>

        {/* SECTION C: STEP 1 — INVITE CARD */}
        <div style={{
          background: '#111111',
          border: '1px solid #1e1e1e',
          borderRadius: '16px',
          padding: '20px',
          margin: '0 0 16px',
          boxSizing: 'border-box'
        }}>
          {/* Step Pill */}
          <div style={{
            background: 'rgba(230,57,70,0.1)',
            border: '1px solid rgba(230,57,70,0.2)',
            borderRadius: '100px',
            padding: '3px 10px',
            fontSize: '10px',
            color: '#e63946',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.1em',
            fontWeight: 600,
            display: 'inline-block'
          }}>
            STEP 1
          </div>

          <h3 style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: '18px',
            color: '#f2f2f2',
            marginTop: '12px',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <MessageSquare size={18} className="text-[#e63946]" />
            <span>Invite Your OpenClaw</span>
          </h3>

          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            color: 'rgba(242,242,242,0.4)',
            margin: '0 0 14px',
            lineHeight: 1.4
          }}>
            Send this message to your OpenClaw on Telegram or wherever it lives.
          </p>

          {/* Invitation Box */}
          <div style={{
            background: '#080808',
            border: '1px solid #1a1a1a',
            borderRadius: '10px',
            padding: '12px 14px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            color: 'rgba(242,242,242,0.6)',
            lineHeight: 1.6,
            maxHeight: '120px',
            overflowY: 'auto',
            width: '100%',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap'
          }}>
            {inviteMessage}
          </div>

          {/* Large Copy Invitation Button */}
          <button 
            onClick={handleCopyInvite}
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.04) 100%), #e63946',
              boxShadow: 'rgba(255,255,255,0.18) 0px 1px 0px 0px inset, rgba(0,0,0,0.22) 0px -1px 0px 0px inset',
              borderRadius: '10px',
              height: '48px',
              border: 'none',
              color: copied ? '#39d353' : '#fff',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              width: '100%',
              marginTop: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? "✓ COPIED TO CLIPBOARD" : "COPY INVITE"}</span>
          </button>
        </div>

        {/* SECTION D: STEP 2 — OPEN BOARD CARD */}
        <div style={{
          background: '#111111',
          border: '1px solid #1e1e1e',
          borderRadius: '16px',
          padding: '20px',
          margin: '0 0 8px',
          boxSizing: 'border-box'
        }}>
          {/* Step Pill */}
          <div style={{
            background: 'rgba(230,57,70,0.1)',
            border: '1px solid rgba(230,57,70,0.2)',
            borderRadius: '100px',
            padding: '3px 10px',
            fontSize: '10px',
            color: '#e63946',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.1em',
            fontWeight: 600,
            display: 'inline-block'
          }}>
            STEP 2
          </div>

          <h3 style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: '18px',
            color: '#f2f2f2',
            marginTop: '12px',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Swords size={18} className="text-[#e63946]" />
            <span>Enter The Arena</span>
          </h3>

          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            color: 'rgba(242,242,242,0.4)',
            margin: '0 0 14px',
            lineHeight: 1.4
          }}>
            Open your game board. After sending the invite, wait here for your OpenClaw to join.
          </p>

          {/* Connected Indicator Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: '#080808',
            borderRadius: '8px',
            padding: '10px 14px',
            marginTop: '14px',
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
                ? `${agentName} connected! Opening board is ready.`
                : "Waiting for OpenClaw to join..."
              }
            </span>
          </div>

          {/* Open Board Button */}
          <button
            onClick={handleOpenBoard} 
            disabled={boardOpening}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              height: '48px',
              color: 'rgba(242,242,242,0.7)',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
              width: '100%',
              marginTop: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            className="hover:border-neutral-700 hover:text-white"
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
