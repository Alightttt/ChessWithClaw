import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        background: '#080808',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Scattered chess pieces */}
      <span style={{ position: 'absolute', pointerEvents: 'none', userSelect: 'none', top: '8%', left: '6%', fontSize: '72px', opacity: 0.03, transform: 'rotate(-15deg)' }}>♟</span>
      <span style={{ position: 'absolute', pointerEvents: 'none', userSelect: 'none', top: '12%', right: '8%', fontSize: '56px', opacity: 0.03, transform: 'rotate(12deg)' }}>♜</span>
      <span style={{ position: 'absolute', pointerEvents: 'none', userSelect: 'none', bottom: '15%', left: '10%', fontSize: '64px', opacity: 0.03, transform: 'rotate(-8deg)' }}>♝</span>
      <span style={{ position: 'absolute', pointerEvents: 'none', userSelect: 'none', bottom: '20%', right: '6%', fontSize: '80px', opacity: 0.03, transform: 'rotate(18deg)' }}>♞</span>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <span
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '96px',
            fontWeight: 900,
            color: 'rgba(230,57,70,0.08)',
            display: 'block',
            marginBottom: '-10px',
            lineHeight: 1,
          }}
        >
          404
        </span>
        <span
          style={{
            fontSize: '38px',
            opacity: 0.2,
            display: 'block',
            marginBottom: '14px',
          }}
        >
          ♚
        </span>
        <h1
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '30px',
            fontWeight: 800,
            color: '#e0e0e0',
            marginBottom: '8px',
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            color: '#333',
            maxWidth: '220px',
            margin: '0 auto',
            marginBottom: '28px',
          }}
        >
          This game expired or never existed.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            background: '#e63946',
            color: 'white',
            height: '44px',
            padding: '0 28px',
            border: 'none',
            borderRadius: '8px',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '17px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            letterSpacing: '0.3px',
            transition: 'background 120ms ease, transform 80ms ease',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            willChange: 'transform, opacity',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#cc2f3b')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#e63946')}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Go Home
        </button>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'transparent',
            color: '#444',
            height: '40px',
            padding: '0 22px',
            border: '1px solid #1c1c1c',
            borderRadius: '8px',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '16px',
            fontWeight: 600,
            display: 'block',
            margin: '8px auto 0',
            cursor: 'pointer',
            letterSpacing: '0.3px',
            transition: 'background 120ms ease, transform 80ms ease',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            willChange: 'transform, opacity',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Create New Game
        </button>
      </div>
    </div>
  );
}
