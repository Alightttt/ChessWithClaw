import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Legal() {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#f2f2f2',
      fontFamily: 'Inter, sans-serif', padding: '32px 20px 80px', maxWidth: 720, margin: '0 auto',
    }}>
      <button onClick={() => {
        if (window.history.length > 2) {
          navigate(-1);
        } else {
          navigate('/');
        }
      }} style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
        color: 'rgba(242,242,242,0.6)', padding: '8px 14px', fontSize: 13, marginBottom: 24, cursor: 'pointer',
      }}>← Back</button>

      <h1 style={{ fontWeight: 800, fontSize: 26, marginBottom: 4 }}>ChessWithClaw — Privacy Policy &amp; Terms of Service</h1>
      <p style={{ fontSize: 13, color: 'rgba(242,242,242,0.4)', marginBottom: 32 }}>Last updated: June 2026</p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 32, marginBottom: 10 }}>1. What ChessWithClaw Is</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        ChessWithClaw is a real-time chess platform where a human plays against their own AI agent (&quot;OpenClaw&quot;).
        There is no account creation, no login, and no payment of any kind. Each game is identified by a unique
        link and access token generated when the game is created.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>2. Your Game Link Is Your Access Key</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        Because there are no accounts, the unique link and token created for your game function as your only
        access credential. Anyone who has your game link or agent token can view or interact with that specific
        game. Do not share your game link or token publicly if you do not want others to access that game.
        We are not able to verify identity beyond possession of this link.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>3. Data We Collect</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        We collect only what is needed to run a chess game: the moves played, board position (FEN), chat
        messages sent during the game, your chosen display name for your agent, and your interface preferences
        (board theme, piece style, sound settings) stored locally in your browser. For abuse prevention, we log
        IP addresses on a short-term basis to apply rate limits to our API. We do not collect names, emails,
        phone numbers, or any payment information, because none of these are ever requested.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>4. How We Use Your Data</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        Data is used exclusively to operate your chess game: storing the live board state, displaying chat and
        move history, and allowing your agent to connect and play. We do not sell data, run advertising, or
        share game data with third parties for marketing purposes.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>5. Third-Party Services We Use</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        Game data is stored using Supabase (database and real-time sync). The application is hosted on Vercel.
        Chess piece images are loaded from Chess.com&apos;s public image CDN and, as a fallback, Lichess&apos;s open-source
        piece assets. These providers may receive standard technical request data (such as IP address) as a normal
        part of serving these resources, governed by their own privacy policies.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>6. Data Retention</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        Games that remain inactive for an extended period are automatically marked abandoned and are eligible for
        deletion by an automated cleanup process. Completed games are retained for a reasonable period to allow
        you to view results and share them, after which they may be removed. We do not guarantee indefinite
        storage of any game.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>7. Children&apos;s Privacy</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        ChessWithClaw is not directed at children under 13, and we do not knowingly collect data from children
        under 13. If you believe a child has used the service in a way that raises a privacy concern, contact us
        and we will address it.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>8. Acceptable Use</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        You agree not to: abuse, flood, or attack the API beyond normal gameplay; attempt to access another
        person&apos;s game without their game link or token; use the chat feature to harass, threaten, or send
        unlawful content; or attempt to reverse engineer the service to bypass security controls. We reserve
        the right to terminate access to any game found in violation of these terms.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>9. No Warranty</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        ChessWithClaw is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind, express or implied.
        We do not guarantee uninterrupted availability, error-free operation, or that any specific agent behavior
        will meet your expectations. To the maximum extent permitted by law, ChessWithClaw and its operator are
        not liable for any indirect, incidental, or consequential damages arising from use of the service.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>10. Changes to These Terms</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        We may update this Privacy Policy and these Terms from time to time. Continued use of ChessWithClaw after
        changes are posted constitutes acceptance of the revised terms.
      </p>

      <h2 style={{ fontWeight: 700, fontSize: 19, marginTop: 28, marginBottom: 10 }}>11. Contact</h2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(242,242,242,0.75)' }}>
        Questions about this policy can be directed through the contact information listed on the ChessWithClaw
        GitHub repository.
      </p>
    </div>
  );
}
