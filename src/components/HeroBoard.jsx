import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ChessBoard from './chess/ChessBoard';

const LobsterEmoji = () => <span style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle: 'normal' }}>🦞</span>;

const SPRING = { type: 'spring', stiffness: 320, damping: 26 };

const SEQUENCE = [
  { fen: "r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP3PPP/RNBQK2R w KQkq - 1 7", from: "c5", to: "b4", mover: "agent", mood: "😤", check: true, checkedKing: "e1", thought: "Check. Let's see how you handle this.", chat: { sender: "human", text: "let's see what you've got 👀" } },
  { fen: "r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/2N2N2/PP3PPP/R1BQK2R b KQkq - 2 7", from: "b1", to: "c3", mover: "human" },
  { fen: "r1bqk2r/ppp2ppp/2np1n2/8/1bBPP3/2N2N2/PP3PPP/R1BQK2R w KQkq - 0 8", from: "d7", to: "d6", mover: "agent", mood: "🦞", thought: "Solid. Not flashy." },
  { fen: "r1bqk2r/ppp2ppp/2np1n2/8/1bBPP3/2N2N2/PP3PPP/R1BQ1RK1 b kq - 1 8", from: "e1", to: "g1", mover: "human", castle: true },
  { fen: "r1bq1rk1/ppp2ppp/2np1n2/8/1bBPP3/2N2N2/PP3PPP/R1BQ1RK1 w - - 2 9", from: "e8", to: "g8", mover: "agent", mood: "😎", castle: true, thought: "Both kings tucked in. For now." },
  { fen: "r1bq1rk1/ppp2ppp/2np1n2/6B1/1bBPP3/2N2N2/PP3PPP/R2Q1RK1 b - - 3 9", from: "c1", to: "g5", mover: "human" },
  { fen: "r1bq1rk1/ppp2pp1/2np1n1p/6B1/1bBPP3/2N2N2/PP3PPP/R2Q1RK1 w - - 0 10", from: "h7", to: "h6", mover: "agent", mood: "😏", thought: "Kick the bishop, why not." },
  { fen: "r1bq1rk1/ppp2pp1/2np1n1p/8/1bBPP2B/2N2N2/PP3PPP/R2Q1RK1 b - - 1 10", from: "g5", to: "h4", mover: "human" },
  { fen: "r1bq1rk1/ppp2p2/2np1n1p/6p1/1bBPP2B/2N2N2/PP3PPP/R2Q1RK1 w - - 0 11", from: "g7", to: "g5", mover: "agent", mood: "😬", thought: "Bold. Maybe too bold.", chat: { sender: "agent", text: "watch closely 👀" } },
  { fen: "r1bq1rk1/ppp2p2/2np1n1p/6N1/1bBPP2B/2N5/PP3PPP/R2Q1RK1 b - - 0 11", from: "f3", to: "g5", mover: "human", capture: true, chat: { sender: "agent", text: "didn't see that coming 😅" } },
  { fen: "r1bq1rk1/ppp2p2/2np1n2/6p1/1bBPP2B/2N5/PP3PPP/R2Q1RK1 w - - 0 12", from: "h6", to: "g5", mover: "agent", mood: "🤝", capture: true, thought: "Fair trade. Let's keep going." },
  { fen: "r1bq1rk1/ppp2p2/2np1n2/6B1/1bBPP3/2N5/PP3PPP/R2Q1RK1 b - - 0 12", from: "h4", to: "g5", mover: "human", capture: true, chat: { sender: "human", text: "ha, called it 😎" } },
];

export default function HeroBoard() {
  const [beatIdx, setBeatIdx] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [visible, setVisible] = useState(true);
  const [chatLog, setChatLog] = useState([]);

  const pushChat = (entry) => {
    if (!entry) return;
    setChatLog((prev) => [...prev.slice(-1), { ...entry, id: `${Date.now()}-${Math.random()}` }]);
  };

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
            setChatLog([]);
            setBeatIdx(0);
            const first = SEQUENCE[0];
            pushChat(first.chat);
            setVisible(true);
            timeoutId = setTimeout(() => runBeat(1), 900);
          }, 350);
        }, 3200);
        return;
      }

      const beat = SEQUENCE[idx];
      const holdMs = beat.check ? 2800 : beat.capture ? 2200 : 1800;

      if (beat.mover === 'agent') {
        setThinking(true);
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setThinking(false);
          setBeatIdx(idx);
          pushChat(beat.chat);
          timeoutId = setTimeout(() => runBeat(idx + 1), holdMs);
        }, 650);
      } else {
        setBeatIdx(idx);
        pushChat(beat.chat);
        timeoutId = setTimeout(() => runBeat(idx + 1), holdMs);
      }
    };

    pushChat(SEQUENCE[0].chat);
    timeoutId = setTimeout(() => runBeat(1), 1400);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const current = SEQUENCE[beatIdx];
  const lastMove = { from: current.from, to: current.to };
  const mood = current.mood || '🦞';
  const latestChat = chatLog[chatLog.length - 1];

  return (
    <div style={{ padding: '12px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px', filter: 'drop-shadow(0 0 50px rgba(230,57,70,0.2))' }}>
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          <span className="text-2xl text-[#e63946]"><LobsterEmoji /></span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2' }}>Agent</span>
        </div>
        <div className="flex items-center gap-2" style={{ minHeight: 24, marginLeft: '12px', flexGrow: 1, justifyContent: 'flex-end' }}>
          <AnimatePresence mode="wait">
            {thinking ? (
              <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e63946] opacity-70 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#e63946] opacity-70 animate-pulse" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#e63946] opacity-70 animate-pulse" style={{ animationDelay: '0.3s' }} />
              </motion.div>
            ) : (
              <motion.div key={beatIdx} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={SPRING} style={{ display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'right' }}>
                <span style={{ fontSize: '16px' }}>{mood}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'rgba(242,242,242,0.75)', maxWidth: '180px' }}>
                  {current.thought || ''}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.div animate={{ opacity: visible ? 1 : 0 }} transition={{ duration: 0.35 }} style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', borderRadius: '6px', boxShadow: thinking ? '0 0 0 1px rgba(230,57,70,0.35), 0 0 24px rgba(230,57,70,0.18)' : 'none', transition: 'box-shadow 0.4s ease' }}>
        <div style={{ pointerEvents: 'none' }}>
          <ChessBoard fen={current.fen} interactive={false} showCoordinates={false} boardTheme="green" pieceTheme="neo" lastMove={lastMove} arrivedSquare={current.to} inCheck={!!current.check} checkedKingSquare={current.checkedKing || null} animationDuration={320} />
        </div>
      </motion.div>

      <div style={{ minHeight: '52px', padding: '10px 4px 2px', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' }}>
        <AnimatePresence mode="popLayout">
          {latestChat && (
            <motion.div
              key={latestChat.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SPRING}
              style={{
                alignSelf: latestChat.sender === 'human' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: latestChat.sender === 'human' ? 'rgba(230,57,70,0.12)' : '#161616',
                border: latestChat.sender === 'human' ? '1px solid rgba(230,57,70,0.25)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '6px 10px',
                fontFamily: "'Inter', sans-serif",
                fontSize: '13px',
                color: 'rgba(242,242,242,0.85)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {latestChat.sender === 'agent' && <span style={{ fontSize: '12px' }}><LobsterEmoji /></span>}
              <span>{latestChat.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
