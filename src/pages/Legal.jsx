import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const LobsterEmoji = () => <span style={{fontFamily:'"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',fontStyle:'normal'}}>🦞</span>;

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
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#f2f2f2' }}>
      {/* Header */}
      <header style={{ height: '64px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 50 }}>
        <button onClick={() => { if (window.history.length > 2) { navigate(-1); } else { navigate('/'); } }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1px solid #222', borderRadius: '8px', color: 'rgba(242,242,242,0.7)', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, padding: '6px 14px', cursor: 'pointer' }}>
          ← Back
        </button>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '15px', color: '#f2f2f2' }}>
          <LobsterEmoji /> ChessWithClaw
        </div>
        <div style={{ width: '80px' }} />
      </header>

      {/* Content */}
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ marginBottom: '48px' }}>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '32px', color: '#f2f2f2', marginBottom: '8px', letterSpacing: '-0.03em' }}>Legal</h1>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: 'rgba(242,242,242,0.4)' }}>Privacy Policy and Terms of Service — Last updated June 2026</p>
        </div>

        {/* PRIVACY POLICY */}
        <div style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '22px', color: '#e63946', marginBottom: '24px', letterSpacing: '-0.02em' }}>Privacy Policy</h2>

          <Section title="What We Collect">
            <p>ChessWithClaw collects only what is necessary to run a chess game between you and your agent. Specifically, we collect:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li><strong style={{ color: '#f2f2f2' }}>Game data:</strong> Chess moves (FEN strings, UCI notation, SAN), game result, and board state for the duration of your session.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Chat messages:</strong> Messages exchanged between you and your agent during a game. These are stored in the game session and expire with the game.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Agent connection data:</strong> The name of your agent (as you configure it), connection timestamps, and heartbeat signals used to maintain a live game session.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Preferences:</strong> Board theme and piece style settings, stored locally in your browser (localStorage). These never leave your device.</li>
            </ul>
          </Section>

          <Section title="What We Do Not Collect">
            <p>We do not collect your name, email address, IP address (beyond standard server logs), location, payment information, or any personal identifying information. ChessWithClaw requires no account registration to play.</p>
          </Section>

          <Section title="How Long We Keep Data">
            <p>Game sessions automatically expire after 4 hours of inactivity. All associated game data — moves, chat messages, agent information, and board state — is permanently deleted when a session expires. We do not maintain long-term game history databases. Your board preferences are stored in your browser only and can be cleared at any time through your browser settings.</p>
          </Section>

          <Section title="Third-Party Services">
            <p>ChessWithClaw uses the following third-party services:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li><strong style={{ color: '#f2f2f2' }}>Supabase (supabase.com):</strong> Our database and real-time infrastructure. Game data is stored on Supabase&apos;s US-based servers. Supabase is SOC 2 Type II compliant. See their privacy policy at supabase.com/privacy.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Vercel (vercel.com):</strong> Our hosting and serverless function platform. Standard access logs are maintained by Vercel per their standard data retention policy. See vercel.com/legal/privacy-policy.</li>
              <li><strong style={{ color: '#f2f2f2' }}>Chess.com CDN:</strong> Piece images and board assets may be loaded from Chess.com&apos;s image CDN for display purposes only. No data is sent to Chess.com.</li>
            </ul>
          </Section>

          <Section title="Cookies and Local Storage">
            <p>ChessWithClaw uses browser localStorage to remember your game ownership (so you can return to a game after closing the tab), your board theme preference, and your piece style preference. We do not use tracking cookies, advertising cookies, or any third-party analytics scripts.</p>
          </Section>

          <Section title="Your Rights (GDPR / Data Subject Rights)">
            <p>If you are in the European Economic Area, you have the right to access, correct, or delete your data. Because ChessWithClaw does not require an account, the only data linked to you is stored in active game sessions identifiable by your game ID. If you want any game data removed before automatic expiry, you can resign or abandon the game, which will mark it for cleanup. For any other requests, contact us at the address below.</p>
          </Section>

          <Section title="Children">
            <p>ChessWithClaw is not directed at children under 13. We do not knowingly collect data from users under 13. If you believe a minor has used this service, please contact us and we will remove the relevant session data.</p>
          </Section>
        </div>

        {/* TERMS */}
        <div style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '32px', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '22px', color: '#e63946', marginBottom: '24px', letterSpacing: '-0.02em' }}>Terms of Service</h2>

          <Section title="Using ChessWithClaw">
            <p>By accessing or using ChessWithClaw at chesswithclaw.vercel.app, you agree to these terms. ChessWithClaw is provided as-is for the purpose of playing live chess against your personal AI agent. Use of this service is at your own discretion.</p>
          </Section>

          <Section title="Acceptable Use">
            <p>You agree not to:</p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li>Use automated scripts to create game sessions at a rate that burdens our infrastructure (fair use: no more than 20 games per hour per IP)</li>
              <li>Attempt to reverse-engineer, tamper with, or exploit game tokens belonging to other users</li>
              <li>Use the chat system to send illegal, abusive, or harmful content</li>
              <li>Use this service to facilitate any activity that violates applicable law</li>
            </ul>
          </Section>

          <Section title="Availability and Service Limitations">
            <p>ChessWithClaw is a free service provided without guarantees of uptime or availability. We reserve the right to modify, limit, or discontinue any feature of the service at any time without notice. Active game sessions may be interrupted due to server maintenance or unexpected downtime. We are not liable for any loss of game state, interrupted sessions, or inability to access the service.</p>
          </Section>

          <Section title="AI Agent Responsibility">
            <p>You are solely responsible for the behavior of your agent during games. ChessWithClaw provides the platform and API for agent connection; we have no visibility into, and bear no responsibility for, what instructions you give your agent or what actions your agent takes within a game. Agents must comply with the acceptable use policy above.</p>
          </Section>

          <Section title="Intellectual Property">
            <p>ChessWithClaw and its design, code, and branding are proprietary to Alightttt. Chess piece images are loaded from third-party CDNs for display purposes and remain the property of their respective owners. Standard chess rules and notation are not proprietary.</p>
          </Section>

          <Section title="Disclaimer and Limitation of Liability">
            <p>ChessWithClaw is provided &quot;as is&quot; without warranty of any kind. We are not liable for any direct, indirect, incidental, or consequential damages arising from your use of this service, including but not limited to lost game state, agent connection failures, or interrupted matches. Some jurisdictions do not allow the exclusion of certain warranties, so some of the above limitations may not apply to you.</p>
          </Section>

          <Section title="Changes to These Terms">
            <p>We may update these terms from time to time. Continued use of ChessWithClaw after any change constitutes your acceptance of the new terms. The date at the top of this page always reflects the last update.</p>
          </Section>
        </div>

        {/* Contact */}
        <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
          Questions? Reach out via the ChessWithClaw GitHub repository or through your agent&apos;s developer channels.
        </div>
      </div>
    </div>
  );
}
