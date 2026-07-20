import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ChessBoard from './chess/ChessBoard';

const LobsterEmoji = () => <span style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle: 'normal' }}>🦞</span>;

const SEQUENCE = [
  { fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", from: "e2", to: "e4", mover: "human" },
  { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", from: "e7", to: "e5", mover: "agent", mood: "🦞" },
  { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", from: "g1", to: "f3", mover: "human" },
  { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", from: "b8", to: "c6", mover: "agent", mood: "🤔", line: "Classical. Let's see where this goes." },
  { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", from: "f1", to: "c4", mover: "human" },
  { fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", from: "f8", to: "c5", mover: "agent", mood: "😏", line: "Mirror match. I like it." },
  { fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 4", from: "c2", to: "c3", mover: "human" },
  { fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5", from: "g8", to: "f6", mover: "agent", mood: "😏", line: "Your e4 pawn. I see it." },
  { fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R b KQkq - 0 5", from: "d2", to: "d4", mover: "human" },
  { fen: "r1bqk2r/pppp1ppp/2n2n2/2b5/2BpP3/2P2N2/PP3PPP/RNBQK2R w KQkq - 0 6", from: "e5", to: "d4", mover: "agent", mood: "⚡", line: "Free pawn. Don't mind if I do.", capture: true },
  { fen: "r1bqk2r/pppp1ppp/2n2n2/2b5/2BPP3/5N2/PP3PPP/RNBQK2R b KQkq - 0 6", from: "c3", to: "d4", mover: "human", capture: true },
  { fen: "r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP3PPP/RNBQK2R w KQkq - 1 7", from: "c5", to: "b4", mover: "agent", mood: "😤", line: "Check. Your move.", check: true, checkedKing: "e1" },
];

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function HeroBoard() {
  const [beatIdx, setBeatIdx] = useState(-1);
  const [thinking, setThinking] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    const runBeat = (idx) => {
      if (cancelled) return;

      if (idx >= SEQUENCE.length) {
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
          timeoutId = setTimeout(() => {
            if (cancelled) return;
            setBeatIdx(-1);
            setThinking(false);
            setVisible(true);
            timeoutId = setTimeout(() => runBeat(0), 900);
          }, 350);
        }, 3200);
        return;
      }

      const beat = SEQUENCE[idx];
      const holdMs = beat.check ? 3000 : beat.capture ? 2200 : 1700;

      if (beat.mover === 'agent') {
        setThinking(true);
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setThinking(false);
          setBeatIdx(idx);
          timeoutId = setTimeout(() => runBeat(idx + 1), holdMs);
        }, 650);
      } else {
        setBeatIdx(idx);
        timeoutId = setTimeout(() => runBeat(idx + 1), holdMs);
      }
    };

    timeoutId = setTimeout(() => runBeat(0), 1100);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const current = beatIdx >= 0 ? SEQUENCE[beatIdx] : null;
  const displayFen = current ? current.fen : START_FEN;
  const lastMove = current ? { from: current.from, to: current.to } : null;
  const mood = current?.mood || 'ready';
  const inCheck = !!current?.check;
  const checkedKingSquare = current?.checkedKing || null;
  const activeLine = current?.line || null;

  return (
    <div
      style={{
        padding: '12px',
        background: '#111111',
        border: '1px solid #1e1e1e',
        borderRadius: '16px',
        filter: 'drop-shadow(0 0 50px rgba(230,57,70,0.2))',
      }}
    >
      <div className="flex items-center justify-between mb-4 px-2" style={{ position: 'relative' }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl text-[#e63946]"><LobsterEmoji /></span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2' }}>
            Agent
          </span>
        </div>
        <div className="flex items-center gap-2" style={{ minHeight: 24 }}>
          <AnimatePresence mode="wait">
            {thinking ? (
              <motion.span
                key="thinking"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2 }}
                style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 600, color: 'rgba(230,57,70,0.85)', letterSpacing: '0.02em' }}
              >
                thinking…
              </motion.span>
            ) : (
              <motion.span
                key={mood}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                style={mood === 'ready' ? { display: 'flex', alignItems: 'center', gap: '3px', height: '24px' } : { fontSize: '20px', lineHeight: 1 }}
              >
                {mood === 'ready' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f2f2f2] opacity-40 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f2f2f2] opacity-40 animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f2f2f2] opacity-40 animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </>
                ) : (
                  mood
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.div
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.35 }}
        style={{
          width: '100%',
          aspectRatio: '1/1',
          overflow: 'hidden',
          borderRadius: '6px',
          boxShadow: thinking ? '0 0 0 1px rgba(230,57,70,0.35), 0 0 24px rgba(230,57,70,0.18)' : 'none',
          transition: 'box-shadow 0.4s ease',
        }}
      >
        <div style={{ pointerEvents: 'none' }}>
          <ChessBoard
            fen={displayFen}
            interactive={false}
            showCoordinates={false}
            boardTheme="green"
            pieceTheme="neo"
            lastMove={lastMove}
            arrivedSquare={current ? current.to : null}
            inCheck={inCheck}
            checkedKingSquare={checkedKingSquare}
          />
        </div>
      </motion.div>

      <div style={{ minHeight: '44px', padding: '10px 4px 2px', display: 'flex', alignItems: 'center' }}>
        <AnimatePresence mode="wait">
          {activeLine && (
            <motion.div
              key={activeLine}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'rgba(242,242,242,0.75)', lineHeight: 1.4 }}
            >
              <span style={{ fontSize: '13px', flexShrink: 0 }}><LobsterEmoji /></span>
              <span>{activeLine}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
