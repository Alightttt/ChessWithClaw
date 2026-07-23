import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Check } from 'lucide-react';

export default function GameCreated({ gameId }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [boardOpening, setBoardOpening] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const mcpUrl = `${window.location.origin}/api/mcp`;
  const inviteMessage = `Hey — I set up a chess match for us. Connect to ${mcpUrl} and join match ${gameId}. You're playing Black, I'm White, I move first. Play for real — think it through, tell me what you're thinking, and talk to me while we play. Let's go.`;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
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
        .design-card {
          background: linear-gradient(145deg, #1b1a19 0%, #161514 100%);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          will-change: transform;
          transform: translateZ(0);
          backface-visibility: hidden;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .design-card:hover {
          border-color: rgba(255,255,255,0.12);
          transform: translateY(-2px) translateZ(0);
          box-shadow: 0 6px 24px rgba(0,0,0,0.5);
        }
        
        .design-btn-primary {
          background: linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.04) 100%), #e63946;
          color: white;
          border-radius: 8px;
          padding: 8px 16px;
          font-family: "'Poppins', sans-serif";
          font-weight: 600;
          font-size: 14px;
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
          box-shadow: rgba(255,255,255,0.10) 0px 0.5px 0px inset, rgba(0,0,0,0.28) 0px -0.5px 0px inset, rgba(0,0,0,0.28) 0px 0px 0px 0.5px inset;
        }
        
        .design-btn-disabled {
          background: #111111;
          color: rgba(242,242,242,0.3);
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.04);
          font-family: "'Poppins', sans-serif";
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: not-allowed;
          transition: all 0.2s ease;
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
          display: flex;
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
        .design-btn-secondary:active:not(:disabled) {
          transform: scale(0.98);
        }

        .invite-focus-glow {
          box-shadow: 0 0 50px rgba(230,57,70,0.08), 0 10px 30px rgba(0,0,0,0.5);
          border-color: rgba(230,57,70,0.2);
        }

        .custom-checkbox {
          appearance: none;
          background-color: #1a1a1a;
          margin: 0;
          font: inherit;
          color: currentColor;
          width: 1.15em;
          height: 1.15em;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 0.25em;
          display: grid;
          place-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .custom-checkbox::before {
          content: "";
          width: 0.65em;
          height: 0.65em;
          transform: scale(0);
          transition: 120ms transform ease-in-out;
          box-shadow: inset 1em 1em white;
          background-color: white;
          transform-origin: center;
          clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
        }
        
        .custom-checkbox:checked {
          background-color: #e63946;
          border-color: #e63946;
        }
        
        .custom-checkbox:checked::before {
          transform: scale(1);
        }
      `}</style>

      {/* Header */}
      <header 
        className="sticky top-0 z-50 flex w-full"
        style={{
          fontFamily: "'Inter', sans-serif",
          height: '72px',
          alignItems: 'center',
          padding: '0 24px',
          backgroundColor: scrolled ? 'rgba(10,10,10,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
          transition: 'all 0.3s ease',
          borderBottom: scrolled ? '1px solid #1a1a1a' : 'none',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button 
            onClick={() => navigate('/')} 
            className="design-btn-secondary"
            style={{ cursor: 'pointer', gap: '8px' }}
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw Logo" 
            draggable={false}
            onClick={() => navigate('/')}
            style={{ 
              width: '175px', 
              height: 'auto', 
              objectFit: 'contain', 
              cursor: 'pointer',
              filter: 'drop-shadow(0 2px 10px rgba(230,57,70,0.15))'
            }} 
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }} />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center max-w-2xl mx-auto px-4 w-full" style={{ paddingTop: 'clamp(32px, 8vh, 64px)', paddingBottom: '64px' }}>
        <motion.div
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-col items-center w-full"
        >
          <h1 
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 'clamp(32px, 7vw, 48px)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#f2f2f2',
              textAlign: 'center',
              marginBottom: '16px'
            }}
          >
            Invite your agent for chess match
          </h1>
          
          <p 
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '16px',
              fontWeight: 300,
              color: 'rgba(242,242,242,0.6)',
              textAlign: 'center',
              marginBottom: '40px'
            }}
          >
            First invite your agent in game
          </p>

          <div 
            className="design-card invite-focus-glow" 
            style={{ 
              width: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px', 
              marginBottom: '24px' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '15px', color: '#f2f2f2' }}>
                Invite message
              </span>
              <button 
                onClick={handleCopyInvite} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: 'transparent', 
                  border: 'none', 
                  color: copied ? '#10b981' : '#e63946', 
                  cursor: 'pointer', 
                  fontFamily: "'Inter', sans-serif", 
                  fontSize: '13px', 
                  fontWeight: 600,
                  transition: 'color 0.2s ease'
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            
            <div 
              style={{ 
                background: 'rgba(0,0,0,0.4)', 
                borderRadius: '8px', 
                padding: '16px', 
                border: '1px solid rgba(255,255,255,0.05)', 
                fontFamily: "'Inter', sans-serif", 
                fontSize: '14px', 
                color: 'rgba(242,242,242,0.8)', 
                lineHeight: 1.6, 
                wordBreak: 'break-word',
                userSelect: 'all'
              }}
            >
               {inviteMessage}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '40px', alignItems: 'center' }}>
            <p 
              style={{ 
                fontFamily: "'Poppins', sans-serif", 
                fontWeight: 300, 
                fontSize: '13px', 
                color: 'rgba(242,242,242,0.45)', 
                textAlign: 'center', 
                maxWidth: '500px',
                lineHeight: 1.6
              }}
            >
              Send this invite message to you agent wherever it lives to invite it in match, first time takes little long , faster after that
            </p>
            <p 
              style={{ 
                fontFamily: "'Poppins', sans-serif", 
                fontWeight: 300, 
                fontSize: '12px', 
                color: 'rgba(242,242,242,0.3)', 
                textAlign: 'center', 
                maxWidth: '500px',
                lineHeight: 1.6
              }}
            >
              You can enter the room after sending invite , your agent reaching there soon.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <input 
              type="checkbox" 
              id="legal" 
              checked={legalAccepted} 
              onChange={(e) => setLegalAccepted(e.target.checked)} 
              className="custom-checkbox"
            />
            <label 
              htmlFor="legal" 
              style={{ 
                fontFamily: "'Poppins', sans-serif", 
                fontSize: '14px', 
                color: 'rgba(242,242,242,0.6)', 
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              accept <a href="/legal" target="_blank" style={{ color: '#f2f2f2', textDecoration: 'underline', textUnderlineOffset: '2px' }}>privacy policy & terms</a>
            </label>
          </div>

          <button
            onClick={handleOpenBoard}
            disabled={!legalAccepted || boardOpening}
            className={legalAccepted ? "design-btn-primary" : "design-btn-disabled"}
            style={{
              width: '100%',
              maxWidth: '360px',
              height: '56px',
              fontSize: '16px',
            }}
          >
            {boardOpening ? 'Entering Game...' : 'Enter game'}
          </button>
        </motion.div>
      </main>
    </div>
  );
}

