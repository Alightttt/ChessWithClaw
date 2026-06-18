import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Legal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('privacy');

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#f2f2f2',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Sticky Top Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(10,10,10,0.9)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50
      }}>
        <Link to="/" style={{ color: 'rgba(242,242,242,0.6)', textDecoration: 'none', fontSize: 14 }}>← Back</Link>
        <div style={{ fontWeight: 600, fontSize: 14 }}>ChessWithClaw 🦞</div>
      </div>

      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '48px 24px 80px'
      }}>
        <h1 style={{ fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#f2f2f2', marginBottom: 8 }}>
          ChessWithClaw — Legal
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(242,242,242,0.5)', marginBottom: 40 }}>
          Last updated: June 2026
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 16 }}>
          <button
            onClick={() => setActiveTab('privacy')}
            style={{
              background: 'transparent',
              border: 'none',
              color: activeTab === 'privacy' ? '#e63946' : 'rgba(242,242,242,0.6)',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              outline: 'none',
              padding: '0 8px'
            }}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            style={{
              background: 'transparent',
              border: 'none',
              color: activeTab === 'terms' ? '#e63946' : 'rgba(242,242,242,0.6)',
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              outline: 'none',
              padding: '0 8px'
            }}
          >
            Terms of Service
          </button>
        </div>

        {activeTab === 'privacy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Information We Collect</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                Game IDs (randomly generated UUIDs), agent names (user-provided), chat messages (stored in game records), move history, board settings preferences. No email, no password, no personal identification required.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>How We Use Information</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                To facilitate real-time chess games between users and their AI agents. To display game state, chat, and companion thoughts. To improve service reliability.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Data Storage</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                All game data stored in Supabase (PostgreSQL) with row-level security. Games auto-expire after 4 hours of inactivity. No permanent user accounts.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Third-Party Services</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                Supabase (database), Vercel (hosting), Chess.com CDN (piece images). No advertising trackers. No analytics that identify individuals.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>AI Agent Communication</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                Your OpenClaw agent connects via authenticated API endpoints. Agent tokens are game-specific and expire with the game. We do not store your agent&apos;s internal data.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Data Retention</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                Active games retained while in progress. Abandoned games marked as expired after 4 hours. Game records may be retained in aggregated, anonymized form for analytics.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Your Rights</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                No account to delete. Clear localStorage to remove preferences. Game data expires automatically. Contact us to request data deletion.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Children&apos;s Privacy</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                Service not directed at children under 13. No age verification required as no personal data is collected.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Changes to This Policy</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                We may update this policy. Changes posted on this page with updated date.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Acceptance</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                By using ChessWithClaw, you agree to these terms.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Service Description</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                Free real-time chess platform for OpenClaw users to play chess against their personal AI agents.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Acceptable Use</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                No cheating, no abuse of API endpoints, no attempts to crash the service, no spamming chat, no reverse engineering. Rate limiting may be applied.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Intellectual Property</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                ChessWithClaw name, logo, and code are property of their respective owners. Chess piece images from Chess.com CDN. OpenClaw is a separate service.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Disclaimer</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                Service provided &quot;as is&quot; without warranties. Games may experience connectivity issues. Agent behavior depends on your OpenClaw configuration and is not controlled by ChessWithClaw.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Limitation of Liability</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                ChessWithClaw is not liable for any damages arising from use of the service. Maximum liability is limited to $0 as this is a free service.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Game Fairness</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                Games are played in real-time. The platform does not guarantee agent performance. Connection issues may affect gameplay.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Termination</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                Games auto-expire after 4 hours of inactivity. We reserve the right to terminate abusive sessions.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Governing Law</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                These terms are governed by applicable laws.
              </p>
            </div>
            <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32 }}>
              <h2 style={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 20, marginBottom: 12 }}>Contact</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(242,242,242,0.7)' }}>
                For questions about these terms, reach out via the GitHub repository.
              </p>
            </div>
          </div>
        )}

        <div style={{ marginTop: 48, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(0,0,0,0.04) 100%), #e63946',
              boxShadow: 'rgba(255,255,255,0.18) 0px 1px 0px inset, rgba(0,0,0,0.22) 0px -1px 0px inset',
              borderRadius: 8,
              border: 'none',
              height: 48,
              padding: '0 32px',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: 300
            }}
          >
            Back to Home
          </button>
        </div>

      </div>
    </div>
  );
}
