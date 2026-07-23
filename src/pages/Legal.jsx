import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function Legal() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Privacy & Terms — ChessWithClaw';
  }, []);

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: '36px' }}>
      <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '18px', color: '#f2f2f2', marginBottom: '12px', letterSpacing: '-0.02em' }}>{title}</h2>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(242,242,242,0.65)', lineHeight: 1.75 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#f2f2f2' }} className="font-sans selection:bg-red-500/30">
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
      `}</style>
      {/* HEADER (Fixed) */}
      <header style={{ height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #111111', background: '#0a0a0a', zIndex: 50, position: 'sticky', top: 0 }}>
        <button 
          onClick={() => { if (window.history.length > 2) { navigate(-1); } else { navigate('/'); } }} 
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none',
            color: 'rgba(242,242,242,0.6)', 
            padding: '8px', cursor: 'pointer',
            transition: 'all 0.15s ease',
            marginLeft: '-8px'
          }}
          className="hover:text-[#f2f2f2]"
          title="Back"
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', cursor: 'pointer', transition: 'transform 0.15s ease' }} onClick={() => navigate('/')} className="active:scale-95">
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

        <div style={{ width: '70px' }} /> {/* Spacer for flex balance */}
      </header>

      {/* Content */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: '48px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '36px', color: '#f2f2f2', marginBottom: '8px', letterSpacing: '-0.03em' }}>Legal Information</h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: 'rgba(242,242,242,0.4)' }}>Privacy Policy and Terms of Service — Effective from January 2024</p>
        </div>

        {/* PRIVACY POLICY */}
        <div className="design-card" style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '22px', color: '#e63946', marginBottom: '24px', letterSpacing: '-0.02em' }}>Privacy Policy</h2>

          <Section title="What We Collect">
            <p>ChessWithClaw collects only what is strictly necessary to facilitate a chess game between you and your AI agent. Specifically, we collect:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong style={{ color: '#f2f2f2' }}>Game data:</strong> Chess moves (FEN strings, UCI notation, SAN), game result, and board state for the duration of your session.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Chat messages:</strong> Messages exchanged between you and your agent during an active game session.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Agent connection data:</strong> The name of your agent, connection timestamps, and heartbeat signals to maintain synchronization.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Preferences:</strong> Board theme and piece style settings, which are stored locally in your browser (localStorage).</li>
            </ul>
          </Section>

          <Section title="What We Do Not Collect">
            <p>We do not collect your name, email address, IP address (beyond standard server logs necessary for security), physical location, payment information, or any other personally identifying information. ChessWithClaw operates without requiring account registration.</p>
          </Section>

          <Section title="Data Retention & Deletion">
            <p>Game sessions automatically expire after 4 hours of inactivity. Upon expiration, all associated game data — including moves, chat messages, agent information, and board state — is permanently deleted from our active databases. We do not maintain long-term game history records. Your visual preferences (board theme, pieces) are stored exclusively in your browser's local storage and can be cleared at any time via your browser settings.</p>
          </Section>

          <Section title="Third-Party Infrastructure">
            <p>To provide this service reliably, ChessWithClaw utilizes the following secure third-party infrastructure providers:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong style={{ color: '#f2f2f2' }}>Supabase:</strong> Our database and real-time synchronization backend. Game data is stored securely on Supabase's servers. Supabase is SOC 2 Type II compliant.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Vercel:</strong> Our web hosting and edge function platform. Standard access logs are maintained by Vercel in accordance with their data retention policies.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Chess.com & Lichess CDNs:</strong> Piece images and board assets may be loaded from these content delivery networks for display purposes only. No user or gameplay data is transmitted to them.</li>
            </ul>
          </Section>
        </div>

        {/* TERMS */}
        <div className="design-card" style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '22px', color: '#e63946', marginBottom: '24px', letterSpacing: '-0.02em' }}>Terms of Service</h2>

          <Section title="Acceptance of Terms">
            <p>By accessing or using ChessWithClaw, you agree to abide by these Terms of Service. ChessWithClaw is provided as a platform to facilitate live chess matches against your configured AI agents.</p>
          </Section>

          <Section title="Acceptable Use Policy">
            <p>When using our service, you explicitly agree not to:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Use automated scripts to generate game sessions at a rate that burdens our infrastructure (fair use is defined as no more than 20 games per hour per IP address).</li>
              <li>Attempt to reverse-engineer, tamper with, or exploit game session tokens belonging to other users.</li>
              <li>Utilize the chat system to transmit illegal, abusive, harmful, or explicitly prohibited content.</li>
              <li>Use the service to facilitate any activity that violates applicable local, state, national, or international law.</li>
            </ul>
          </Section>

          <Section title="Service Availability & Limitations">
            <p>ChessWithClaw is provided free of charge, without guarantees of uptime or availability. We reserve the right to modify, rate-limit, or discontinue any feature of the service at any time without prior notice. Active game sessions may be interrupted due to server maintenance, infrastructure scaling, or unexpected downtime. We bear no liability for any loss of game state, interrupted sessions, or inability to access the service.</p>
          </Section>

          <Section title="AI Agent Liability">
            <p>You are solely responsible for the configuration, behavior, and output of your connected AI agent. ChessWithClaw provides the communication protocol (MCP) and interface for agent connection; we have no visibility into, and bear no responsibility for, the underlying models, system prompts, or actions your agent takes within a game. Agents must comply with the Acceptable Use Policy.</p>
          </Section>

          <Section title="Disclaimer of Warranties">
            <p>ChessWithClaw is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. We do not warrant that the service will be uninterrupted, error-free, or completely secure. In no event shall we be liable for any direct, indirect, incidental, special, or consequential damages arising out of or in any way connected with the use of this service.</p>
          </Section>
        </div>

        {/* Contact */}
        <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
          Questions? Reach out via the ChessWithClaw GitHub repository.
        </div>
      </div>
    </div>
  );
}
