import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ChessBoard from './chess/ChessBoard';

const SPRING = { type: 'spring', stiffness: 350, damping: 24 };

// Extended match sequences with personalized, familiar dialogues and natural agent inner thoughts
const SEQUENCE_1 = [
  { fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", from: "g1", to: "f3", mover: "human", chat: { sender: "human", text: "yo claw, back for round 2! e4 Nf3 as promised." } },
  { fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", from: "b8", to: "c6", mover: "agent", mood: "🦞", thought: "Recalibrating against player's aggressive kingside preference...", chat: { sender: "agent", text: "Welcome back. Nc6 deployed. Let's see if you improved your endgame." } },
  { fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", from: "f1", to: "b5", mover: "human", chat: { sender: "human", text: "you know I love the Ruy Lopez against u" } },
  { fen: "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", from: "g8", to: "f6", mover: "agent", mood: "⚡", thought: "Switching to Berlin Wall line to counter his tactical style.", chat: { sender: "agent", text: "Berlin defense activated. You won't break through so easily today." } },
  { fen: "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4", from: "e1", to: "g1", mover: "human", castle: true, chat: { sender: "human", text: "castled up! u ready for this?" } },
  { fen: "r1bqkb1r/pppp1ppp/2n5/1B2N3/4P3/8/PPPP1PPP/RNBQ1RK1 b kq - 0 5", from: "f6", to: "e4", mover: "agent", mood: "😋", capture: true, thought: "Opponent left central e4 pawn exposed. High value target.", chat: { sender: "agent", text: "Snagged your central pawn. You left e4 unguarded again." } },
  { fen: "r1bqkb1r/pppp1ppp/2n5/1B2R3/4P3/8/PPPP1PPP/RNBQ2K1 b kq - 0 6", from: "f1", to: "e1", mover: "human", chat: { sender: "human", text: "dude watch out, Re1 is coming for u" } },
  { fen: "r1bqkb1r/pppp1ppp/8/1B2n3/4P3/8/PPPP1PPP/RNBQ2K1 w kq - 0 7", from: "c6", to: "e5", mover: "agent", mood: "😼", thought: "Rerouting knight to e5 center pivot.", chat: { sender: "agent", text: "Ne5. My defense matrix is solid." } },
  { fen: "r1bqkb1r/pppp1ppp/8/1B2n3/3P4/8/PPP2PPP/RNBQ2K1 b kq - 0 7", from: "d2", to: "d4", mover: "human", chat: { sender: "human", text: "pushing d4, no fear!" } },
  { fen: "r1bqkb1r/pppp1ppp/8/1B6/3Pn3/8/PPP2PPP/RNBQ2K1 w kq - 0 8", from: "e5", to: "e4", mover: "agent", mood: "🚀", thought: "Deep tactical line found: Knight strike to e4.", chat: { sender: "agent", text: "Knight strike on e4. Re-calculating win probability..." } },
  { fen: "r1bqk2r/pppp1ppp/8/1B1n4/3Pn3/8/PPP2PPP/RNBQ2K1 b kq - 1 8", from: "f8", to: "e7", mover: "agent", mood: "🛡️", thought: "Developing bishop to reinforce king safety.", chat: { sender: "agent", text: "Be7. Orderly development." } },
  { fen: "r1bq1rk1/pppp1ppp/8/1B1n4/3Pn3/8/PPP2PPP/RNBQ2K1 w - - 2 9", from: "e8", to: "g8", mover: "agent", mood: "😎", castle: true, thought: "King safely tucked in. Time to go on offense.", chat: { sender: "agent", text: "King secured. Ready for your next move." } },
  { fen: "r1bq1rk1/pppp1ppp/8/1B1n4/3Pn3/2P5/P1P2PPP/RNBQ2K1 b - - 0 9", from: "c2", to: "c3", mover: "human" },
  { fen: "r1bq1rk1/pppp1ppp/2n5/1B6/3Pn3/2P5/P1P2PPP/RNBQ2K1 w - - 1 10", from: "d5", to: "c6", mover: "agent", mood: "🎯", thought: "Repositioning knight for multi-pronged assault." },
  { fen: "r1bq1rk1/pppp1ppp/2n5/1B6/3P4/2P1n3/P1P2PPP/RNBQ2K1 w - - 0 11", from: "e4", to: "e3", mover: "agent", mood: "🔥", thought: "Tactical fork identified on rook and queen!", chat: { sender: "agent", text: "Fork detected! You didn't see Ne3 coming." } },
  { fen: "r1bq1rk1/pppp1ppp/2n5/1B6/3P4/2P1B3/P1P2PPP/R2Q2K1 b - - 0 11", from: "c1", to: "e3", mover: "human", capture: true, chat: { sender: "human", text: "aargh nice fork! took it back though" } },
  { fen: "r1bq1rk1/pppp1ppp/2n2n2/1B6/3P4/2P1B3/P1P2PPP/R2Q2K1 w - - 1 12", from: "e3", to: "f6", mover: "agent", mood: "😤", check: true, checkedKing: "g1", thought: "Executing checkmate setup sequence.", chat: { sender: "agent", text: "Check delivered. The board is ours." } },
];

const SEQUENCE_2 = [
  { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2", from: "c7", to: "c5", mover: "agent", mood: "🦞", thought: "Player opened e4. Initiating favorite Sicilian setup.", chat: { sender: "agent", text: "Ah, e4 again? You know Sicilian is my home ground." } },
  { fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", from: "g1", to: "f3", mover: "human", chat: { sender: "human", text: "u beat me yesterday with that, not today claw!" } },
  { fen: "rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3", from: "d7", to: "d6", mover: "agent", mood: "🧠", thought: "Building solid d6 d5 control grid.", chat: { sender: "agent", text: "d6 locked. I've analyzed 4,000 games of your opening style." } },
  { fen: "rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3", from: "d2", to: "d4", mover: "human", chat: { sender: "human", text: "d4 break! let's rumble" } },
  { fen: "rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", from: "c5", to: "d4", mover: "agent", mood: "⚔️", capture: true, thought: "Exchanging central pawn. Clears c-file for my rooks.", chat: { sender: "agent", text: "Exchanging on d4. Opening c-file." } },
  { fen: "rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", from: "f3", to: "d4", mover: "human" },
  { fen: "r1bqkbnr/pp2pppp/2np4/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5", from: "b8", to: "c6", mover: "agent", mood: "💪", thought: "Developing Nc6 to pressure d4 knight.", chat: { sender: "agent", text: "Nc6. Pressuring your center." } },
  { fen: "r1bqkbnr/pp2pppp/2np4/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5", from: "b1", to: "c3", mover: "human" },
  { fen: "r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 3 6", from: "g8", to: "f6", mover: "agent", mood: "😼", thought: "Nf6 deployed. Equalizing development quickly.", chat: { sender: "agent", text: "Nf6. Your tempo advantage is gone." } },
  { fen: "r1bqkb1r/pp2pppp/2np1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R b KQkq - 4 6", from: "c1", to: "g5", mover: "human", chat: { sender: "human", text: "Bg5 pin! what u gonna do now?" } },
  { fen: "r1bqkb1r/1p2pppp/p1np1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R w KQkq - 0 7", from: "a7", to: "a6", mover: "agent", mood: "🤩", thought: "Classic Najdorf a6 pawn structure. Preparing queenside storm.", chat: { sender: "agent", text: "a6 Najdorf setup. Classic response to your Bg5." } },
  { fen: "r1bqkb1r/1p2pppp/p1np1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R w KQkq - 0 7", from: "d1", to: "d2", mover: "human" },
  { fen: "r1bqkb1r/1p3ppp/p1np1n2/4p1B1/3NP3/2N5/PPP2PPP/R2QKB1R w KQkq - 0 8", from: "e7", to: "e5", mover: "agent", mood: "🔥", thought: "Counter-strike on e5! Disrupting White's knight position.", chat: { sender: "agent", text: "e5 counter-push! Did you calculate this line?" } },
  { fen: "r1bqkb1r/1p3ppp/p1np1n2/4p1B1/3NP3/2N5/PPP1BPPP/R2QK2R b KQkq - 1 8", from: "f1", to: "e2", mover: "human", chat: { sender: "human", text: "dang u really know this line inside out" } },
  { fen: "r1bqk2r/1p2bppp/p1np1n2/4p1B1/3NP3/2N5/PPP1BPPP/R2QK2R w KQkq - 2 9", from: "f8", to: "e7", mover: "agent", mood: "🧐", thought: "Neutralizing bishop pin with Be7.", chat: { sender: "agent", text: "Be7. Pin neutralized." } },
  { fen: "r1bq1rk1/1p2bppp/p1np1n2/4p1B1/3NP3/2N5/PPP1BPPP/R2QK2R w KQ - 3 9", from: "e8", to: "g8", mover: "agent", mood: "😎", castle: true, thought: "Kingside castle complete. Endgame matrix ready.", chat: { sender: "agent", text: "Castled and ready for your attack." } },
];

const GAMES = [SEQUENCE_1, SEQUENCE_2];

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
            if (first.chat) pushChat(first.chat);
            setVisible(true);
            timeoutId = setTimeout(() => runBeat(1), 1200);
          }, 400);
        }, 3200);
        return;
      }

      const beat = gameSequence[idx];
      const holdMs = beat.check ? 3200 : beat.capture ? 2800 : 2300;
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
        if (beat.chat) pushChat(beat.chat);
        timeoutId = setTimeout(() => runBeat(idx + 1), holdMs);
      }
    };

    if (gameSequence[0].chat) pushChat(gameSequence[0].chat);
    timeoutId = setTimeout(() => runBeat(1), 1600);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [gameSequence]);

  const current = gameSequence[beatIdx];
  const lastMove = { from: current.from, to: current.to };
  const latestChat = chatLog[chatLog.length - 1];

  return (
    <div style={{ padding: '16px', background: '#111111', border: '1px solid #1e1e1e', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 40px rgba(230,57,70,0.12)' }}>
      {/* Header with Mood Emoji on LEFT of Agent name and pure animated thought text (no box, no emoji) */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2.5" style={{ flexShrink: 0 }}>
          <AnimatePresence mode="wait">
            <motion.span
              key={agentMood}
              initial={{ scale: 0.2, rotate: -30, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.2, rotate: 30, opacity: 0 }}
              transition={SPRING}
              className="text-2xl inline-block select-none"
              style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}
            >
              {agentMood || '🦞'}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 700, color: '#f2f2f2' }}>Agent</span>
        </div>

        {/* Pure Animated Thought Text Stream (NO box, NO 💭 emoji) */}
        <div className="flex items-center gap-2" style={{ minHeight: 28, marginLeft: '12px', flexGrow: 1, justifyContent: 'flex-end', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {thinking ? (
              <motion.div 
                key="thinking" 
                initial={{ opacity: 0, y: 4 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -4 }} 
                transition={{ duration: 0.15 }} 
                className="flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#e63946] animate-ping" />
                <span className="text-xs text-zinc-400 font-mono">calculating...</span>
              </motion.div>
            ) : (
              <motion.span 
                key={`${beatIdx}-${agentThought}`} 
                initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }} 
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} 
                exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }} 
                transition={{ duration: 0.3, ease: 'easeOut' }} 
                style={{ 
                  fontFamily: "'Inter', sans-serif", 
                  fontSize: '12px', 
                  fontWeight: 500,
                  color: 'rgba(242,242,242,0.85)', 
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '260px',
                  textAlign: 'right',
                  display: 'inline-block'
                }}
              >
                {agentThought}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chess Board Container with Smooth Move Animation */}
      <motion.div 
        animate={{ opacity: visible ? 1 : 0 }} 
        transition={{ duration: 0.35 }} 
        style={{ 
          width: '100%', 
          aspectRatio: '1/1', 
          overflow: 'hidden', 
          borderRadius: '10px', 
          boxShadow: current.check 
            ? '0 0 0 2px rgba(230,57,70,0.7), 0 0 30px rgba(230,57,70,0.35)' 
            : current.capture 
            ? '0 0 0 2px rgba(251,191,36,0.6), 0 0 24px rgba(251,191,36,0.25)' 
            : '0 4px 20px rgba(0,0,0,0.6)',
          transition: 'box-shadow 0.3s ease' 
        }}
      >
        <div style={{ pointerEvents: 'none' }}>
          <ChessBoard 
            fen={current.fen} 
            interactive={false} 
            showCoordinates={false} 
            boardTheme="green" 
            pieceTheme="neo" 
            lastMove={lastMove} 
            arrivedSquare={current.to} 
            inCheck={!!current.check} 
            checkedKingSquare={current.checkedKing || null} 
            animationDuration={350} 
          />
        </div>
      </motion.div>

      {/* Chat Log Footer */}
      <div style={{ minHeight: '44px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' }}>
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
                maxWidth: '92%',
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
