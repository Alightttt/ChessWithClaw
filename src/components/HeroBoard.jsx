import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ChessBoard from './chess/ChessBoard';

const SPRING = { type: 'spring', stiffness: 320, damping: 26 };

// Sequence 1: Italian Game Tactical Line
const SEQUENCE_1 = [
  { fen: "r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP3PPP/RNBQK2R w KQkq - 1 7", from: "c5", to: "b4", mover: "agent", mood: "😤", check: true, checkedKing: "e1", thought: "Check. Let's see how you handle this.", chat: { sender: "human", text: "let's see what you've got 👀" } },
  { fen: "r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/2N2N2/PP3PPP/R1BQK2R b KQkq - 2 7", from: "b1", to: "c3", mover: "human" },
  { fen: "r1bqk2r/ppp2ppp/2np1n2/8/1bBPP3/2N2N2/PP3PPP/R1BQK2R w KQkq - 0 8", from: "d7", to: "d6", mover: "agent", mood: "🧠", thought: "Solid structure. Pushing d6." },
  { fen: "r1bqk2r/ppp2ppp/2np1n2/8/1bBPP3/2N2N2/PP3PPP/R1BQ1RK1 b kq - 1 8", from: "e1", to: "g1", mover: "human", castle: true },
  { fen: "r1bq1rk1/ppp2ppp/2np1n2/8/1bBPP3/2N2N2/PP3PPP/R1BQ1RK1 w - - 2 9", from: "e8", to: "g8", mover: "agent", mood: "😎", castle: true, thought: "Both kings tucked safely away." },
  { fen: "r1bq1rk1/ppp2ppp/2np1n2/6B1/1bBPP3/2N2N2/PP3PPP/R2Q1RK1 b - - 3 9", from: "c1", to: "g5", mover: "human" },
  { fen: "r1bq1rk1/ppp2pp1/2np1n1p/6B1/1bBPP3/2N2N2/PP3PPP/R2Q1RK1 w - - 0 10", from: "h7", to: "h6", mover: "agent", mood: "😏", thought: "Testing your bishop. Move back or take?" },
  { fen: "r1bq1rk1/ppp2pp1/2np1n1p/8/1bBPP2B/2N2N2/PP3PPP/R2Q1RK1 b - - 1 10", from: "g5", to: "h4", mover: "human" },
  { fen: "r1bq1rk1/ppp2p2/2np1n1p/6p1/1bBPP2B/2N2N2/PP3PPP/R2Q1RK1 w - - 0 11", from: "g7", to: "g5", mover: "agent", mood: "🔥", thought: "Launching the kingside push!", chat: { sender: "agent", text: "Watch this kingside pawn storm ⚡" } },
  { fen: "r1bq1rk1/ppp2p2/2np1n1p/6N1/1bBPP2B/2N5/PP3PPP/R2Q1RK1 b - - 0 11", from: "f3", to: "g5", mover: "human", capture: true, chat: { sender: "agent", text: "Nice sacrifice, but I'll take back 😏" } },
  { fen: "r1bq1rk1/ppp2p2/2np1n2/6p1/1bBPP2B/2N5/PP3PPP/R2Q1RK1 w - - 0 12", from: "h6", to: "g5", mover: "agent", mood: "🎯", capture: true, thought: "Recapturing on g5. Game on!" },
];

// Sequence 2: Sicilian Defense Counter-Attack
const SEQUENCE_2 = [
  { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2", from: "c7", to: "c5", mover: "agent", mood: "🦞", thought: "Sicilian Defense. Prepare for tactical chaos.", chat: { sender: "agent", text: "Playing Sicilian today! ♟️" } },
  { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", from: "g1", to: "f3", mover: "human" },
  { fen: "rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3", from: "d7", to: "d6", mover: "agent", mood: "🧠", thought: "Securing the center squares." },
  { fen: "rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3", from: "d2", to: "d4", mover: "human" },
  { fen: "rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", from: "c5", to: "d4", mover: "agent", mood: "⚔️", capture: true, thought: "Trade in the center.", chat: { sender: "agent", text: "Exchanging central pawns ⚔️" } },
  { fen: "rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", from: "f3", to: "d4", mover: "human", capture: true },
  { fen: "r1bqkbnr/pp2pppp/3p4/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 1 5", from: "b1", to: "c3", mover: "human" },
  { fen: "r1bqkb1r/pp2pppp/2np4/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 2 6", from: "b8", to: "c6", mover: "agent", mood: "💪", thought: "Developing knight to c6." },
  { fen: "r1bqkb1r/pp2pppp/2np4/2g5/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 3 6", from: "c1", to: "g5", mover: "human" },
  { fen: "r1bqkb1r/1p2pppp/p1np4/6B1/3NP3/2N5/PPP2PPP/R2QKB1R w KQkq - 0 7", from: "a7", to: "a6", mover: "agent", mood: "😼", thought: "Najdorf-style expansion.", chat: { sender: "agent", text: "Najdorf vibes activated ✨" } },
];

// Sequence 3: Queen's Gambit Clash
const SEQUENCE_3 = [
  { fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2", from: "c2", to: "c4", mover: "human", chat: { sender: "human", text: "Queen's Gambit! Do you accept?" } },
  { fen: "rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", from: "d5", to: "c4", mover: "agent", mood: "😋", capture: true, thought: "Gambit accepted. Show me your plan.", chat: { sender: "agent", text: "Pawn accepted! Show your best 🏆" } },
  { fen: "rnbqkbnr/ppp1pppp/8/8/2pP4/4P3/PP3PPP/RNBQKBNR b KQkq - 0 3", from: "e2", to: "e3", mover: "human" },
  { fen: "rnbqkbnr/1pp1pppp/p7/8/2pP4/4P3/PP3PPP/RNBQKBNR w KQkq - 0 4", from: "a7", to: "a6", mover: "agent", mood: "🛡️", thought: "Preparing b5 defenses." },
  { fen: "rnbqkbnr/1pp1pppp/p7/8/2BP4/4P3/PP3PPP/RNBQK1NR b KQkq - 0 4", from: "f1", to: "c4", mover: "human", capture: true },
  { fen: "rnbqkbnr/1pp1p1pp/p4p2/8/2BP4/4P3/PP3PPP/RNBQK1NR w KQkq - 0 5", from: "f7", to: "f6", mover: "agent", mood: "🧐", thought: "Covering e5 key square." },
  { fen: "rnbqkbnr/1pp1p1pp/p4p2/8/2BP4/4PN2/PP3PPP/RNBQK2R b KQkq - 1 5", from: "g1", to: "f3", mover: "human" },
  { fen: "r1bqkbnr/1pp1p1pp/p1n2p2/8/2BP4/4PN2/PP3PPP/RNBQK2R w KQkq - 2 6", from: "b8", to: "c6", mover: "agent", mood: "🚀", thought: "Knight out to c6. Pressure building!", chat: { sender: "agent", text: "Gaining piece activity 🔥" } },
];

const GAMES = [SEQUENCE_1, SEQUENCE_2, SEQUENCE_3];

export default function HeroBoard() {
  const [gameSequence] = useState(() => GAMES[Math.floor(Math.random() * GAMES.length)]);
  const [beatIdx, setBeatIdx] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [visible, setVisible] = useState(true);
  const [chatLog, setChatLog] = useState([]);
  const [agentMood, setAgentMood] = useState(gameSequence[0].mood || '🦞');
  const [agentThought, setAgentThought] = useState(gameSequence[0].thought || '');

  const pushChat = (entry) => {
    if (!entry) return;
    setChatLog((prev) => [...prev.slice(-1), { ...entry, id: `${Date.now()}-${Math.random()}` }]);
  };

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    const runBeat = (idx) => {
      if (cancelled) return;

      if (idx >= gameSequence.length) {
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
          timeoutId = setTimeout(() => {
            if (cancelled) return;
            setChatLog([]);
            setBeatIdx(0);
            const first = gameSequence[0];
            setAgentMood(first.mood || '🦞');
            setAgentThought(first.thought || '');
            pushChat(first.chat);
            setVisible(true);
            timeoutId = setTimeout(() => runBeat(1), 1200);
          }, 400);
        }, 3600);
        return;
      }

      const beat = gameSequence[idx];
      const holdMs = beat.check ? 3200 : beat.capture ? 2800 : 2200;

      const hasAgentChat = beat.mover === 'agent' && !!beat.chat;

      if (hasAgentChat) {
        setThinking(true);
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          setThinking(false);
          setBeatIdx(idx);
          if (beat.mood) setAgentMood(beat.mood);
          if (beat.thought) setAgentThought(beat.thought);
          pushChat(beat.chat);
          timeoutId = setTimeout(() => runBeat(idx + 1), holdMs);
        }, 500);
      } else {
        setBeatIdx(idx);
        if (beat.mood) setAgentMood(beat.mood);
        if (beat.thought) setAgentThought(beat.thought);
        pushChat(beat.chat);
        timeoutId = setTimeout(() => runBeat(idx + 1), holdMs);
      }
    };

    pushChat(gameSequence[0].chat);
    timeoutId = setTimeout(() => runBeat(1), 1800);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [gameSequence]);

  const current = gameSequence[beatIdx];
  const lastMove = { from: current.from, to: current.to };
  const latestChat = chatLog[chatLog.length - 1];

  return (
    <div style={{ padding: '14px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 40px rgba(230,57,70,0.12)' }}>
      {/* Header with Mood Emoji on LEFT of Agent name */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2.5" style={{ flexShrink: 0 }}>
          <AnimatePresence mode="wait">
            <motion.span
              key={agentMood}
              initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.3, rotate: 25, opacity: 0 }}
              transition={SPRING}
              className="text-2xl inline-block"
              style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
            >
              {agentMood || '🦞'}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f2f2f2' }}>Agent</span>
        </div>

        <div className="flex items-center gap-2" style={{ minHeight: 24, marginLeft: '12px', flexGrow: 1, justifyContent: 'flex-end' }}>
          <AnimatePresence mode="wait">
            {thinking ? (
              <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={SPRING} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e63946] animate-ping" />
                <span className="text-xs text-zinc-400 font-mono">thinking...</span>
              </motion.div>
            ) : (
              <motion.div key={beatIdx} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={SPRING} style={{ display: 'flex', alignItems: 'center', textAlign: 'right' }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'rgba(242,242,242,0.75)', maxWidth: '240px' }}>
                  {agentThought}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chess Board Container with Move Flash Animation */}
      <motion.div 
        animate={{ opacity: visible ? 1 : 0 }} 
        transition={{ duration: 0.35 }} 
        style={{ 
          width: '100%', 
          aspectRatio: '1/1', 
          overflow: 'hidden', 
          borderRadius: '8px', 
          boxShadow: current.check 
            ? '0 0 0 2px rgba(230,57,70,0.6), 0 0 30px rgba(230,57,70,0.3)' 
            : current.capture 
            ? '0 0 0 2px rgba(245,158,11,0.5), 0 0 20px rgba(245,158,11,0.2)' 
            : '0 4px 20px rgba(0,0,0,0.5)',
          transition: 'box-shadow 0.3s ease' 
        }}
      >
        <div style={{ pointerEvents: 'none' }}>
          <ChessBoard fen={current.fen} interactive={false} showCoordinates={false} boardTheme="green" pieceTheme="neo" lastMove={lastMove} arrivedSquare={current.to} inCheck={!!current.check} checkedKingSquare={current.checkedKing || null} animationDuration={280} />
        </div>
      </motion.div>

      {/* Chat Log Footer */}
      <div style={{ minHeight: '48px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' }}>
        <AnimatePresence mode="popLayout">
          {latestChat && (
            <motion.div
              key={latestChat.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={SPRING}
              style={{
                alignSelf: latestChat.sender === 'human' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: latestChat.sender === 'human' ? 'rgba(230,57,70,0.12)' : '#181818',
                border: latestChat.sender === 'human' ? '1px solid rgba(230,57,70,0.28)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px',
                padding: '6px 12px',
                fontFamily: "'Inter', sans-serif",
                fontSize: '12px',
                color: 'rgba(242,242,242,0.9)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {latestChat.sender === 'agent' && <span style={{ fontSize: '12px' }}>🦞</span>}
              <span>{latestChat.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

