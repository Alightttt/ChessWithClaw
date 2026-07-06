import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useLiveActivity } from '../../hooks/useLiveActivity';
import { ChessPiece } from '../chess/PieceSVGs';
import { formatRelativeTime } from '../../lib/formatRelative';
import styles from './LivePlatformActivity.module.css';
import { Activity } from 'lucide-react';

const FloatingQueen = () => (
  <div style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '120px',
    height: '120px',
    opacity: 0.06,
    pointerEvents: 'none',
    zIndex: 0
  }}>
    <div className={styles.queenFloat} style={{ width: '100%', height: '100%' }}>
      <ChessPiece pieceKey="wQ" theme="neo" />
    </div>
  </div>
);

const ChessboardBackground = () => (
  <div style={{
    position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none',
    display: 'flex', flexWrap: 'wrap',
    maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 60%)',
    WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 60%)',
    zIndex: 0
  }}>
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="board-pattern" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="rgba(255,255,255,0.025)" />
          <rect x="8" y="8" width="8" height="8" fill="rgba(255,255,255,0.025)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#board-pattern)" />
    </svg>
  </div>
);

const Counter = ({ count, deltaMin, deltaHour }) => {
  const shouldReduceMotion = useReducedMotion();
  const [flash, setFlash] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setFlash(true);
      let startTime = null;
      let rAF = null;
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        if (progress > 600) {
          setFlash(false);
        } else {
          rAF = requestAnimationFrame(animate);
        }
      };
      rAF = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rAF);
    }
    prevCount.current = count;
  }, [count]);

  const deltaText = deltaHour > deltaMin 
    ? `+${deltaHour} in the last hour`
    : `+${deltaMin} in the last minute`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={count}
            initial={{ scale: 1 }}
            animate={shouldReduceMotion ? { scale: 1 } : { scale: [1.0, 1.08, 1.0] }}
            transition={{ type: 'spring', stiffness: 350, damping: 25, duration: 0.18 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(64px, 10vw, 96px)',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.04em',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #B0B0B0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontVariantNumeric: 'tabular-nums',
              position: 'relative'
            }}
          >
            {count.toLocaleString('en-US')}
          </motion.div>
        </AnimatePresence>
        
        {/* Flash glow */}
        <div style={{
          position: 'absolute',
          inset: '-20px',
          background: 'rgba(230,57,70,0.15)',
          filter: 'blur(20px)',
          opacity: flash ? 1 : 0,
          transition: 'opacity 0.6s ease-out',
          pointerEvents: 'none',
          zIndex: -1
        }} className={styles.digitFlash} />
      </div>
      
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '12px',
        fontWeight: 500,
        color: 'rgba(242,242,242,0.4)',
        marginTop: '8px'
      }}>
        {deltaText}
      </div>
    </div>
  );
};

const EventTicker = ({ events }) => {
  const shouldReduceMotion = useReducedMotion();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);
  const activeEvents = events?.filter(ev => new Date(ev.updated_at || ev.created_at) > fiveMinutesAgo) || [];
  
  if (activeEvents.length === 0) {
    return (
      <div className={styles.tickerList}>
        <div className={styles.tickerRow} style={{ justifyContent: 'center' }}>
          <span style={{ color: 'rgba(242,242,242,0.5)', fontStyle: 'italic' }}>Quiet on the board right now — be the first to play.</span>
          <a href="#" onClick={(e) => { e.preventDefault(); if (onPlayNow) onPlayNow(e); else window.location.href = '/api/new'; }} style={{ color: '#E63946', textDecoration: 'none', fontWeight: 600, marginLeft: '8px' }}>Challenge Mine Now →</a>
        </div>
      </div>
    );
  }

  return (
    <ul className={styles.tickerList}>
      <AnimatePresence initial={false}>
        {activeEvents.map((ev) => {
          let message = 'started a new match';
          if (ev.status === 'finished') {
            if (ev.result === 'checkmate') message = `checkmated in ${ev.move_number || '?'} moves`;
            else if (ev.result === 'draw' || ev.result === 'stalemate' || ev.result === 'threefold') message = `drew in ${ev.move_number || '?'} moves`;
            else if (ev.result === 'resign') message = `resigned after ${ev.move_number || '?'} moves`;
            else if (ev.result === 'timeout') message = `won on time (${ev.move_number || '?'} moves)`;
          }

          // fallback to wQ for icon
          let piece = ev.winning_piece || 'wQ';
          if (!['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP'].includes(piece)) piece = 'wQ';

          return (
            <motion.li
              role="listitem"
              key={ev.id}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
              exit={{ opacity: 0 }}
              
              className={styles.tickerRow}
            >
              <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
                <ChessPiece pieceKey={piece} theme="neo" />
              </div>
              <span style={{ flex: 1 }}>{message}</span>
              <span style={{ fontSize: '12px', color: 'rgba(242,242,242,0.4)', whiteSpace: 'nowrap' }}>
                {formatRelativeTime(ev.updated_at || ev.created_at)}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
};

const MicroStats = ({ activeNow, lastCheckmate, recentEvents, deltaHour }) => {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
      gap: '24px', 
      width: '100%', 
      maxWidth: '600px', 
      marginTop: '40px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      paddingTop: '24px',
      zIndex: 1
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(242,242,242,0.4)', marginBottom: '8px' }}>Active Games</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F2F2F2' }}>
          {activeNow.toLocaleString()}
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(242,242,242,0.4)', marginBottom: '8px' }}>Last Checkmate</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F2F2F2', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {lastCheckmate ? (
            <>
              <div style={{ width: '20px', height: '20px' }}>
                <ChessPiece pieceKey={lastCheckmate.winning_piece || 'wQ'} theme="neo" />
              </div>
              {formatRelativeTime(lastCheckmate.updated_at)}
            </>
          ) : (
            <span style={{ color: 'rgba(242,242,242,0.2)' }}>—</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(242,242,242,0.4)', marginBottom: '8px' }}>Streak (1h)</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '24px', fontWeight: 700, color: '#F2F2F2' }}>
          {deltaHour > 0 ? (
            <span style={{ color: '#e63946' }}>🔥 {deltaHour}</span>
          ) : (
            <span style={{ color: 'rgba(242,242,242,0.2)' }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default function LivePlatformActivity({ onPlayNow }) {
  const { count, activeNow, lastCheckmate, recentEvents, deltaHour, deltaMin, elementRef } = useLiveActivity();

  return (
    <section ref={elementRef} className={styles.section} aria-label="Live Platform Activity">
      <div className={styles.panel}>
        <ChessboardBackground />
        <div className={styles.scanLine} />
        <FloatingQueen />

        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '800px', height: '800px', background: 'radial-gradient(circle at center, rgba(230,57,70,0.08) 0%, transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1, marginBottom: '24px', background: 'rgba(230,57,70,0.1)', padding: '6px 16px', borderRadius: '30px', border: '1px solid rgba(230,57,70,0.2)' }}>
          <div className={styles.pulseDot} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e63946' }} aria-hidden="true" />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#e63946', fontWeight: 700 }}>
            Live Platform Activity
          </span>
        </div>

        <div role="status" aria-live="polite" aria-atomic="true">
          <Counter count={count} deltaHour={deltaHour} deltaMin={deltaMin} />
        </div>
        
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '16px 32px',
          zIndex: 1,
          backdropFilter: 'blur(10px)',
          maxWidth: '500px',
          width: '100%',
          marginTop: '32px',
          minHeight: '48px'
        }}>
          <EventTicker events={recentEvents} />
        </div>

        <MicroStats activeNow={activeNow} lastCheckmate={lastCheckmate} recentEvents={recentEvents} deltaHour={deltaHour} />
      </div>
    </section>
  );
}
