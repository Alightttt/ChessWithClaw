import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';

const BOARD_THEMES = {
  green:  { light: '#EEEED2', dark: '#769656' },
  brown:  { light: '#F0D9B5', dark: '#B58863' },
  slate:  { light: '#DEE3E6', dark: '#4C7B9B' },
  navy:   { light: '#C8D8E8', dark: '#5B84A8' },
  red:    { light: '#EDD5B3', dark: '#C45A41' },
  forest: { light: '#F5F5F0', dark: '#2E6B34' },
};

export default function ChessBoard({
  fen,
  turn,
  legalMoves = [],
  lastMove = null,
  inCheck = false,
  checkedKingSquare = null,
  boardTheme = 'green',
  pieceStyle = 'standard',
  playerColor = 'w',
  gameStatus = 'waiting',
  onMove,
  disabled = false,
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const lastAppliedMoveRef = useRef(null);

  const theme = BOARD_THEMES[boardTheme] || BOARD_THEMES.green;
  const orientation = playerColor === 'b' ? 'black' : 'white';

  // Build legal move map: from square → [to squares]
  const legalMoveMap = useMemo(() => {
    const map = {};
    (legalMoves || []).forEach(move => {
      const from = move.slice(0, 2);
      const to   = move.slice(2, 4);
      if (!map[from]) map[from] = [];
      map[from].push(to);
    });
    return map;
  }, [legalMoves]);

  // Custom square styles: last move, legal dots, check glow
  const customSquareStyles = {};

  // Last move highlight
  if (lastMove) {
    const lastMoveStyle = { backgroundColor: 'rgba(255, 215, 0, 0.45)' };
    if (lastMove.from) customSquareStyles[lastMove.from] = lastMoveStyle;
    if (lastMove.to)   customSquareStyles[lastMove.to]   = lastMoveStyle;
  }

  // Legal move dots for selected square
  if (selectedSquare && legalMoveMap[selectedSquare]) {
    customSquareStyles[selectedSquare] = {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    };
    legalMoveMap[selectedSquare].forEach(sq => {
      customSquareStyles[sq] = {
        background:
          'radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 27%)',
        cursor: 'pointer',
      };
    });
  }

  // Check glow on king square
  if (inCheck && checkedKingSquare) {
    customSquareStyles[checkedKingSquare] = {
      background:
        'radial-gradient(ellipse at center, rgba(220,30,30,0.85) 0%, rgba(220,30,30,0.4) 40%, transparent 70%)',
    };
  }

  const handleSquareClick = useCallback((square) => {
    if (disabled || gameStatus !== 'active' || turn !== playerColor) return;

    // If a square is already selected
    if (selectedSquare) {
      const moves = legalMoveMap[selectedSquare] || [];
      if (moves.includes(square)) {
        // Valid move — execute it
        const moveStr = selectedSquare + square;
        // Handle pawn promotion
        const isPromotion =
          fen.includes('P') &&
          selectedSquare[1] === '7' && square[1] === '8' ||
          fen.includes('p') &&
          selectedSquare[1] === '2' && square[1] === '1';
        onMove?.(selectedSquare, square, isPromotion ? 'q' : undefined);
        setSelectedSquare(null);
        setOptionSquares({});
        return;
      }
    }

    // Select a new piece if it's ours
    if (legalMoveMap[square]) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  }, [selectedSquare, legalMoveMap, disabled, gameStatus, turn, playerColor, fen, onMove]);

  const handlePieceDrop = useCallback((sourceSquare, targetSquare) => {
    if (disabled || gameStatus !== 'active' || turn !== playerColor) return false;
    const moves = legalMoveMap[sourceSquare] || [];
    if (!moves.includes(targetSquare)) return false;
    onMove?.(sourceSquare, targetSquare);
    setSelectedSquare(null);
    return true;
  }, [legalMoveMap, disabled, gameStatus, turn, playerColor, onMove]);

  return (
    <div style={{ width: '100%', userSelect: 'none' }}>
      <Chessboard
        id="cwc-board"
        position={fen || 'start'}
        onSquareClick={handleSquareClick}
        onPieceDrop={handlePieceDrop}
        boardOrientation={orientation}
        customSquareStyles={customSquareStyles}
        customLightSquareStyle={{ backgroundColor: theme.light }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        animationDuration={180}
        arePiecesDraggable={
          gameStatus === 'active' && turn === playerColor && !disabled
        }
        boardStyle={{
          borderRadius: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}
