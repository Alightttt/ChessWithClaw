'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChessBoard({ fen, onMove, isMyTurn, lastMove, moveHistory, showCoordinates = true, interactive = true, boardTheme = 'green', pieceTheme = 'merida', onIllegalMove, onCapture, playerColor = 'w' }) {
  const [chess, setChess] = useState(() => {
    if (typeof window.Chess !== 'function') return null;
    try {
      return new window.Chess(fen);
    } catch(e) {
      return new window.Chess();
    }
  });

  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [promotionMove, setPromotionMove] = useState(null);
  const [pieces, setPieces] = useState([]);
  const prevMoveHistoryLength = useRef(0);

  useEffect(() => {
    if (typeof window.Chess !== 'function') return;

    let newChess;
    try {
      newChess = new window.Chess(fen);
    } catch(e) {
      newChess = new window.Chess();
    }
    
    setChess(newChess);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionMove(null);
    
    // Generate stable pieces for animation
    const initialChess = new window.Chess();
    const currentPieces = [];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
    
    for (let r of ranks) {
      for (let f of files) {
        const sq = f + r;
        const p = initialChess.get(sq);
        if (p) {
          currentPieces.push({ id: `${p.color}${p.type}-${sq}`, type: p.type, color: p.color, square: sq });
        }
      }
    }
    
    let lastMoveWasCapture = false;

    if (moveHistory && moveHistory.length > 0) {
      for (let i = 0; i < moveHistory.length; i++) {
        const moveInput = moveHistory[i];
        let moveObj;
        try {
          moveObj = initialChess.move(typeof moveInput === 'string' ? moveInput : (moveInput.san || moveInput));
        } catch (e) {
          console.error("Error replaying move:", moveInput, e);
          continue;
        }
        if (!moveObj) continue;

        // Handle capture
        const isEnPassant = moveObj.flags.includes('e');
        let capturedSquare = moveObj.to;
        if (isEnPassant) {
          capturedSquare = moveObj.to[0] + moveObj.from[1];
        }
        
        // Remove captured piece if any
        const capturedIndex = currentPieces.findIndex(p => p.square === capturedSquare && p.square !== moveObj.from);
        if (capturedIndex !== -1) {
          currentPieces[capturedIndex].captured = true;
          if (i === moveHistory.length - 1) {
            lastMoveWasCapture = true;
          }
        }
        
        // Update moved piece
        const pieceIndex = currentPieces.findIndex(p => p.square === moveObj.from);
        if (pieceIndex !== -1) {
          currentPieces[pieceIndex].square = moveObj.to;
          
          // Handle promotion
          if (moveObj.promotion) {
            currentPieces[pieceIndex].type = moveObj.promotion;
          }
          
          // Handle castling
          if (moveObj.flags.includes('k') || moveObj.flags.includes('q')) {
            let rookFrom, rookTo;
            if (moveObj.to === 'g1') { rookFrom = 'h1'; rookTo = 'f1'; }
            else if (moveObj.to === 'c1') { rookFrom = 'a1'; rookTo = 'd1'; }
            else if (moveObj.to === 'g8') { rookFrom = 'h8'; rookTo = 'f8'; }
            else if (moveObj.to === 'c8') { rookFrom = 'a8'; rookTo = 'd8'; }
            
            const rookIndex = currentPieces.findIndex(p => p.square === rookFrom);
            if (rookIndex !== -1) {
              currentPieces[rookIndex].square = rookTo;
            }
          }
        }
      }
      
      if (lastMoveWasCapture && moveHistory.length > prevMoveHistoryLength.current) {
        if (onCapture) onCapture();
      }
      prevMoveHistoryLength.current = moveHistory.length;
      
      // Check if moveHistory matches fen to prevent flashing during split-second Realtime sync
      const historyFen = initialChess.fen().split(' ')[0];
      const targetFen = newChess.fen().split(' ')[0];
      if (historyFen !== targetFen) {
        console.warn("historyFen and targetFen mismatch", historyFen, targetFen);
        // Fallback to customPieces but try to preserve IDs from currentPieces
        const customPieces = [];
        const availableCurrentPieces = [...currentPieces];
        
        for (let r of ranks) {
          for (let f of files) {
            const sq = f + r;
            const p = newChess.get(sq);
            if (p) {
              // Find a matching piece in currentPieces to preserve its ID
              // First try to find a piece of the same type/color at the EXACT SAME square
              let matchingPieceIndex = availableCurrentPieces.findIndex(cp => cp.type === p.type && cp.color === p.color && cp.square === sq && !cp.captured);
              
              // If not found, find ANY piece of the same type/color
              if (matchingPieceIndex === -1) {
                matchingPieceIndex = availableCurrentPieces.findIndex(cp => cp.type === p.type && cp.color === p.color && !cp.captured);
              }
              
              let id;
              if (matchingPieceIndex !== -1) {
                id = availableCurrentPieces[matchingPieceIndex].id;
                availableCurrentPieces.splice(matchingPieceIndex, 1);
              } else {
                id = `${p.color}${p.type}-${sq}-${Date.now()}`;
              }
              customPieces.push({ id, type: p.type, color: p.color, square: sq });
            }
          }
        }
        setPieces(customPieces);
        return;
      }
    } else {
      // If no move history (e.g. custom FEN), just use the current board state
      const customPieces = [];
      for (let r of ranks) {
        for (let f of files) {
          const sq = f + r;
          const p = newChess.get(sq);
          if (p) {
            customPieces.push({ id: `${p.color}${p.type}-${sq}`, type: p.type, color: p.color, square: sq });
          }
        }
      }
      setPieces(customPieces);
      return;
    }
    
    setPieces(currentPieces);
  }, [fen, moveHistory, onCapture]);

  const pieceMap = {
    wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
  };

  const files = playerColor === 'b' ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = playerColor === 'b' ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];

  const handleSquareClick = (row, col) => {
    if (!interactive || !isMyTurn) return;

    const square = files[col] + ranks[row];
    const piece = chess.get(square);

    if (!selectedSquare) {
      if (piece && piece.color === playerColor) {
        setSelectedSquare(square);
        setLegalMoves(chess.moves({ square, verbose: true }));
      }
    } else {
      const movesToSquare = legalMoves.filter(m => m.to === square);
      if (movesToSquare.length > 0) {
        if (movesToSquare[0].promotion) {
          setPromotionMove({ from: selectedSquare, to: square });
        } else {
          onMove(selectedSquare, square);
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      } else if (piece && piece.color === playerColor) {
        setSelectedSquare(square);
        setLegalMoves(chess.moves({ square, verbose: true }));
      } else {
        if (onIllegalMove) onIllegalMove();
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    }
  };

  const isLight = (row, col) => (row + col) % 2 === 0;
  
  const isLastMoveSquare = (sq) => {
    if (!lastMove) return false;
    let lastMoveFrom, lastMoveTo;
    if (typeof lastMove === 'string') {
        lastMoveFrom = lastMove.substring(0, 2);
        lastMoveTo = lastMove.substring(2, 4);
    } else {
        lastMoveFrom = lastMove.from;
        lastMoveTo = lastMove.to;
    }
    if (!lastMoveFrom || !lastMoveTo) return false;
    return sq === lastMoveFrom || sq === lastMoveTo;
  };
  
  const isLegalDestination = (sq) => legalMoves.some(m => m.to === sq);
  const isCapture = (sq) => legalMoves.some(m => m.to === sq && m.captured);
  const isKingInCheck = (sq, piece) => piece && piece.type === 'k' && piece.color === chess.turn() && (chess.in_check ? chess.in_check() : chess.isCheck ? chess.isCheck() : false);

  const [agentMoveFlash, setAgentMoveFlash] = useState(null);

  useEffect(() => {
    if (lastMove && lastMove.color === 'b') {
      let toSq = typeof lastMove === 'string' ? lastMove.substring(2, 4) : lastMove.to;
      setAgentMoveFlash(toSq);
      const timer = setTimeout(() => setAgentMoveFlash(null), 400);
      return () => clearTimeout(timer);
    }
  }, [lastMove]);

  const themes = {
    green: { light: '#739552', dark: '#577047' },
    brown: { light: '#f0d9b5', dark: '#b58863' },
    slate: { light: '#8ca2ad', dark: '#4f6f7e' },
    navy: { light: '#9db2c2', dark: '#445b73' },
  };

  const currentTheme = themes[boardTheme] || themes.green;

  const renderPiece = (piece) => {
    if (!piece) return null;
    if (pieceTheme === 'unicode') {
      return (
        <span
          className="relative z-10 drop-shadow-md text-[9vw] sm:text-5xl leading-none"
          style={{
            color: piece.color === 'w' ? '#ffffff' : '#000000',
            textShadow: piece.color === 'w' ? '0 0 2px #000' : '0 0 2px #fff'
          }}
        >
          {pieceMap[piece.color + piece.type.toUpperCase()]}
        </span>
      );
    } else {
      const pieceName = `${piece.color}${piece.type.toUpperCase()}`;
      let url = '';
      if (pieceTheme === 'merida' || pieceTheme === 'cburnett' || pieceTheme === 'alpha') {
        url = `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${pieceTheme}/${pieceName}.svg`;
      } else {
        url = `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/${pieceName}.svg`;
      }
      return <img src={url} alt={pieceName} className="relative z-10 w-[85%] h-[85%] drop-shadow-md pointer-events-none" />;
    }
  };

  if (!chess) {
    return (
      <div className="w-full h-full aspect-square flex items-center justify-center" style={{ backgroundColor: currentTheme.dark }}>
        <span className="font-mono text-sm opacity-50">Initializing engine...</span>
      </div>
    );
  }

  return (
    <div data-testid="chess-board" className={`flex flex-col select-none w-full h-full ${!interactive || !isMyTurn ? 'opacity-90' : 'opacity-100'}`}>
      <div className="relative w-full h-full aspect-square">
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
          {ranks.map((rank, row) =>
          files.map((file, col) => {
            const sq = file + rank;
            const piece = chess.get(sq);
            const isSelected = selectedSquare === sq;
            const isLast = isLastMoveSquare(sq);
            const isLegal = isLegalDestination(sq);
            const isCap = isCapture(sq);
            const isCheck = isKingInCheck(sq, piece);

            return (
              <div
                key={sq}
                data-testid={`square-${sq}`}
                onClick={() => handleSquareClick(row, col)}
                className="relative w-full h-full flex items-center justify-center cursor-pointer hover:bg-white/50 transition-colors"
                style={{ backgroundColor: isLight(row, col) ? currentTheme.light : currentTheme.dark }}
                aria-label={`${sq}, ${piece ? (piece.color === 'w' ? 'white ' : 'black ') + piece.type : 'empty'}`}
              >
                {/* Overlays */}
                {isSelected && <div className="absolute inset-0 bg-[#e63946]/40 z-0" />}
                {!isSelected && isLast && <div className="absolute inset-0 z-0" style={{ backgroundColor: 'rgba(255,197,9,0.4)' }} />}
                {agentMoveFlash === sq && <div className="absolute inset-0 z-10" style={{ animation: 'agentFlash 400ms ease-out forwards' }} />}
                
                {/* Legal move indicators */}
                {isLegal && !isCap && <div className="absolute w-[25%] h-[25%] rounded-full bg-[#e63946]/60 z-0" />}
                {isLegal && isCap && <div className="absolute inset-0 border-[6px] border-[#e63946]/60 opacity-80 z-0" />}

                {/* Coordinates */}
                {showCoordinates && col === 0 && (
                  <span className={`absolute top-0.5 left-1 text-[10px] sm:text-xs font-bold z-0 ${isLight(row, col) ? 'text-black/50' : 'text-white/60'}`}>
                    {rank}
                  </span>
                )}
                {showCoordinates && row === 7 && (
                  <span className={`absolute bottom-0.5 right-1 text-[10px] sm:text-xs font-bold z-0 ${isLight(row, col) ? 'text-black/50' : 'text-white/60'}`}>
                    {file}
                  </span>
                )}
              </div>
            );
          })
        )}
        </div>
        
        {/* Animated Pieces Layer */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <AnimatePresence>
            {pieces.map((piece) => {
              if (piece.captured) return null;
              
              const fileIndex = files.indexOf(piece.square[0]);
              const rankIndex = ranks.indexOf(piece.square[1]);
              const isSelected = selectedSquare === piece.square;
              const isLastPlaced = lastMove && (typeof lastMove === 'string' ? lastMove.substring(2, 4) : lastMove.to) === piece.square;
              
              // Calculate entrance delay based on rank (staggered entrance)
              const entranceDelay = (rankIndex * 0.05) + (fileIndex * 0.02);
              
              let animationClass = '';
              
              if (isSelected) {
                animationClass = 'animate-[pieceLift_200ms_cubic-bezier(0.2,0,0,1)_forwards]';
              } else if (isLastPlaced) {
                animationClass = 'animate-[pieceDrop_150ms_cubic-bezier(0.2,0,0,1)_forwards]';
              }

              return (
                <motion.div
                  key={piece.id}
                  initial={(!moveHistory || moveHistory.length === 0) ? { y: -20, opacity: 0 } : false}
                  animate={{ 
                    x: `${fileIndex * 100}%`, 
                    y: `${rankIndex * 100}%`,
                    opacity: 1
                  }}
                  exit={{ scale: 0.5, opacity: 0, filter: 'drop-shadow(0 0 10px rgba(230,57,70,0.8))' }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 350, 
                    damping: 25,
                    opacity: { duration: 0.2 },
                    delay: (!moveHistory || moveHistory.length === 0) ? entranceDelay : 0
                  }}
                  className="absolute top-0 left-0 w-[12.5%] h-[12.5%] flex items-center justify-center z-10 will-change-transform"
                >
                  <div className={`w-full h-full flex items-center justify-center ${animationClass}`}>
                    {renderPiece(piece)}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Top Overlays Layer (Above Pieces) */}
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 pointer-events-none z-20">
          {ranks.map((rank, row) =>
            files.map((file, col) => {
              const sq = file + rank;
              const piece = chess.get(sq);
              const isCheck = isKingInCheck(sq, piece);
              
              if (!isCheck) return <div key={sq} />;
              
              return (
                <div key={sq} className="relative w-full h-full">
                  <div className="absolute inset-0" style={{ borderRadius: '50%', background: 'radial-gradient(circle, rgba(230,57,70,0.6) 0%, rgba(230,57,70,0.3) 40%, transparent 70%)', animation: 'checkPulse 1s ease-in-out infinite' }} />
                </div>
              );
            })
          )}
        </div>

        {promotionMove && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-[var(--color-bg-surface)] p-4 rounded-xl flex gap-4 border border-[var(--color-border-subtle)] shadow-2xl">
              {['q', 'r', 'b', 'n'].map(p => (
                <button 
                  key={p} 
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(promotionMove.from, promotionMove.to, p);
                    setPromotionMove(null);
                    setSelectedSquare(null);
                    setLegalMoves([]);
                  }}
                  className="w-14 h-14 sm:w-20 sm:h-20 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] rounded-lg flex items-center justify-center border border-[var(--color-border-subtle)] hover:border-[var(--color-red-primary)] transition-all transform hover:scale-105"
                >
                  {renderPiece({ type: p, color: chess.turn() })}
                </button>
              ))}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPromotionMove(null);
                }}
                className="w-14 h-14 sm:w-20 sm:h-20 bg-[var(--color-red-primary)]/10 hover:bg-[var(--color-red-primary)]/20 text-[var(--color-red-primary)] rounded-lg flex items-center justify-center text-xl font-bold border border-[var(--color-red-primary)]/30 transition-all"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
