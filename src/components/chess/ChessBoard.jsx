import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { PIECE_COMPONENTS } from './ChessPieces';

const BOARD_THEMES = {
  green:      { light: '#EEEED2', dark: '#769656' },
  brown:      { light: '#F0D9B5', dark: '#B58863' },
  slate:      { light: '#DEE3E6', dark: '#4C7B9B' },
  navy:       { light: '#C8D8E8', dark: '#5B84A8' },
  red:        { light: '#EDD5B3', dark: '#C45A41' },
  forest:     { light: '#F5F5F0', dark: '#2E6B34' },
  icy_sea:    { light: '#ECECD7', dark: '#8CA2AC' },
  blue:       { light: '#ECECD7', dark: '#4B7399' },
  tournament: { light: '#ECECD7', dark: '#4B7399' },
  dark_green: { light: '#EEEED2', dark: '#2E6B34' },
  'dark green': { light: '#EEEED2', dark: '#2E6B34' },
};

const PIECE_SETS = {
  neo: {
    base: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150',
    ext: 'png',
    files: { wP:'wp',wN:'wn',wB:'wb',wR:'wr',wQ:'wq',wK:'wk',
             bP:'bp',bN:'bn',bB:'bb',bR:'br',bQ:'bq',bK:'bk' }
  },
  ocean: {
    base: 'https://images.chesscomfiles.com/chess-themes/pieces/ocean/150',
    ext: 'png',
    files: { wP:'wp',wN:'wn',wB:'wb',wR:'wr',wQ:'wq',wK:'wk',
             bP:'bp',bN:'bn',bB:'bb',bR:'br',bQ:'bq',bK:'bk' }
  },
  tournament: {
    base: 'https://images.chesscomfiles.com/chess-themes/pieces/tournament/150',
    ext: 'png',
    files: { wP:'wp',wN:'wn',wB:'wb',wR:'wr',wQ:'wq',wK:'wk',
             bP:'bp',bN:'bn',bB:'bb',bR:'br',bQ:'bq',bK:'bk' }
  },
  standard: {
    base: 'https://lichess1.org/assets/piece/cburnett',
    ext: 'svg',
    files: { wP:'wP',wN:'wN',wB:'wB',wR:'wR',wQ:'wQ',wK:'wK',
             bP:'bP',bN:'bN',bB:'bB',bR:'bR',bQ:'bQ',bK:'bK' }
  }
};

const getPieceUrl = (pieceKey, style = 'neo') => {
  const set = PIECE_SETS[style] || PIECE_SETS.neo;
  const filename = set.files[pieceKey];
  return `${set.base}/${filename}.${set.ext}`;
};

export default function ChessBoard({
  fen,
  turn,
  legalMoves = [],
  lastMove = null,
  arrivedSquare = null,
  inCheck = false,
  checkedKingSquare = null,
  boardTheme = 'green',
  pieceStyle: pieceStyleProp,
  pieceTheme,
  playerColor = 'w',
  gameStatus = 'waiting',
  onMove,
  disabled = false,
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const lastAppliedMoveRef = useRef(null);
  const [promotionSquare, setPromotionSquare] = useState(null);
  const [promotionSource, setPromotionSource] = useState(null);

  const [pieceStyle, setPieceStyle] = useState(() => {
    // Initial fetch from local storage with fallback
    const saved = localStorage.getItem('cwc_piece_style');
    if (!saved || saved === 'standard') {
      localStorage.setItem('cwc_piece_style', 'neo');
      return 'neo';
    }
    return saved;
  });

  const theme = BOARD_THEMES[boardTheme] || BOARD_THEMES.green;
  const orientation = playerColor === 'b' ? 'black' : 'white';
  const rawPieceStyle = pieceTheme || pieceStyleProp || pieceStyle || 'neo';
  const activePieceStyle = rawPieceStyle === 'standard' ? 'neo' : rawPieceStyle;

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

  // Robust parsing of lastMove (string of 'e2e4', or object {from, to})
  const parsedLastMove = useMemo(() => {
    if (!lastMove) return null;
    if (typeof lastMove === 'string') {
      if (lastMove.length >= 4) {
        return { from: lastMove.slice(0, 2), to: lastMove.slice(2, 4) };
      }
      return null;
    }
    const from = lastMove.from || lastMove.from_square;
    const to = lastMove.to || lastMove.to_square;
    if (from && to) return { from, to };
    return null;
  }, [lastMove]);

  const customPiecesMap = useMemo(() => {
    const SETS = {
      neo:        'https://images.chesscomfiles.com/chess-themes/pieces/neo/150',
      ocean:      'https://images.chesscomfiles.com/chess-themes/pieces/ocean/150',
      tournament: 'https://images.chesscomfiles.com/chess-themes/pieces/tournament/150',
      standard:   'https://lichess1.org/assets/piece/cburnett',
    };
    const EXTS = { neo:'png', ocean:'png', tournament:'png', standard:'svg' };
    const FILES_CC = { wP:'wp',wN:'wn',wB:'wb',wR:'wr',wQ:'wq',wK:'wk',
                       bP:'bp',bN:'bn',bB:'bb',bR:'br',bQ:'bq',bK:'bk' };
    const FILES_LI = { wP:'wP',wN:'wN',wB:'wB',wR:'wR',wQ:'wQ',wK:'wK',
                       bP:'bP',bN:'bN',bB:'bB',bR:'bR',bQ:'bQ',bK:'bK' };
    
    const base = activePieceStyle === 'standard'
      ? 'https://lichess1.org/assets/piece/cburnett'
      : `https://images.chesscomfiles.com/chess-themes/pieces/${activePieceStyle}/150`;
    const ext  = EXTS[activePieceStyle] || 'png';
    const files = (activePieceStyle === 'standard') ? FILES_LI : FILES_CC;
    
    return Object.fromEntries(
      Object.entries(files).map(([key, filename]) => [
        key,
        ({ squareWidth }) => (
          <img
            src={`${base}/${filename}.${ext}`}
            alt={key}
            width={squareWidth}
            height={squareWidth}
            referrerPolicy="no-referrer"
            style={{ objectFit:'contain', display:'block', pointerEvents:'none' }}
            onError={e => {
              e.target.onerror = null;
              e.target.src = `https://lichess1.org/assets/piece/cburnett/${
                key[0]==='w'?'w':'b'}${key[1]}.svg`;
            }}
          />
        )
      ])
    );
  }, [activePieceStyle]);

  // Custom square styles: last move, legal dots, check glow
  const customSquareStyles = useMemo(() => {
    const styles = {};

    // Last move highlight
    if (parsedLastMove) {
      if (parsedLastMove.from) styles[parsedLastMove.from] = { backgroundColor: 'rgba(255, 255, 100, 0.35)' };
      if (parsedLastMove.to) styles[parsedLastMove.to] = { backgroundColor: 'rgba(255, 255, 100, 0.5)' };
    }

    // Legal move dots for selected square
    if (selectedSquare && legalMoveMap[selectedSquare]) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
      };
      legalMoveMap[selectedSquare].forEach(sq => {
        styles[sq] = {
          background:
            'radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 27%)',
          cursor: 'pointer',
        };
      });
    }

    // Check glow on king square
    if (checkedKingSquare) {
      styles[checkedKingSquare] = {
        boxShadow: 'inset 0 0 0 6px #ef4444, inset 0 0 20px #ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.45)',
        borderRadius: '50%',
      };
    }

    return styles;
  }, [selectedSquare, legalMoveMap, parsedLastMove, checkedKingSquare]);

  const handleSquareClick = useCallback((square) => {
    if (disabled || (gameStatus !== 'active' && gameStatus !== 'waiting') || turn !== playerColor) return;

    // If a square is already selected
    if (selectedSquare) {
      const moves = legalMoveMap[selectedSquare] || [];
      if (moves.includes(square)) {
        // Valid move — execute it
        const moveStr = selectedSquare + square;
        // Handle pawn promotion
        let isPromotion = false;
        try {
          const tempChess = new Chess(fen);
          const piece = tempChess.get(selectedSquare);
          if (piece && piece.type === 'p') {
            if ((piece.color === 'w' && square[1] === '8') || (piece.color === 'b' && square[1] === '1')) {
              isPromotion = true;
            }
          }
        } catch (e) {}
        
        if (isPromotion) {
          setPromotionSource(selectedSquare);
          setPromotionSquare(square);
          return;
        }

        onMove?.(selectedSquare, square);
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
    if (disabled || (gameStatus !== 'active' && gameStatus !== 'waiting') || turn !== playerColor) return false;
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
        promotionToSquare={promotionSquare}
        showPromotionDialog={!!promotionSquare}
        onPromotionPieceSelect={(piece) => {
          if (piece) {
            const promType = piece[1].toLowerCase();
            onMove?.(promotionSource, promotionSquare, promType);
          }
          setPromotionSquare(null);
          setPromotionSource(null);
          setSelectedSquare(null);
          return true;
        }}
        boardOrientation={orientation}
        customSquareStyles={customSquareStyles}
        customLightSquareStyle={{ backgroundColor: theme.light }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        animationDuration={300}
        arePiecesDraggable={false}
        customPieces={customPiecesMap}
        boardStyle={{
          borderRadius: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}
