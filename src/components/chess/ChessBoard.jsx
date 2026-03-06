'use client';

import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';

export default function ChessBoard({ fen, onMove, isMyTurn, lastMove, showCoordinates = true, interactive = true, boardTheme = 'classic', pieceTheme = 'unicode' }) {
  const [chess, setChess] = useState(new Chess(fen));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [promotionMove, setPromotionMove] = useState(null);

  useEffect(() => {
    setChess(new Chess(fen));
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionMove(null);
  }, [fen]);

  const pieceMap = {
    wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
    bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
  };

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const handleSquareClick = (row, col) => {
    if (!interactive || !isMyTurn) return;

    const square = files[col] + ranks[row];
    const piece = chess.get(square);

    if (!selectedSquare) {
      if (piece && piece.color === 'w') {
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
      } else if (piece && piece.color === 'w') {
        setSelectedSquare(square);
        setLegalMoves(chess.moves({ square, verbose: true }));
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    }
  };

  const isLight = (row, col) => (row + col) % 2 === 0;
  
  const isLastMoveSquare = (sq) => {
    if (!lastMove) return false;
    // lastMove could be a string like 'e2e4' or object {from: 'e2', to: 'e4'}
    if (typeof lastMove === 'string') {
        return sq === lastMove.substring(0, 2) || sq === lastMove.substring(2, 4);
    }
    return lastMove.from === sq || lastMove.to === sq || lastMove.uci?.includes(sq);
  };
  
  const isLegalDestination = (sq) => legalMoves.some(m => m.to === sq);
  const isCapture = (sq) => legalMoves.some(m => m.to === sq && m.captured);
  const isKingInCheck = (sq, piece) => piece && piece.type === 'k' && piece.color === chess.turn() && chess.inCheck();

  const themes = {
    classic: { light: '#ebecd0', dark: '#c62828' },
    green: { light: '#ebecd0', dark: '#739552' },
    blue: { light: '#ebecd0', dark: '#8ca2ad' },
    purple: { light: '#ebecd0', dark: '#6f5c7f' },
    monochrome: { light: '#e0e0e0', dark: '#a0a0a0' },
  };

  const currentTheme = themes[boardTheme] || themes.classic;

  const renderPiece = (piece) => {
    if (!piece) return null;
    if (pieceTheme === 'unicode') {
      return (
        <span
          className="relative z-10 drop-shadow-md"
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
      const url = `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${pieceTheme}/${pieceName}.svg`;
      return <img src={url} alt={pieceName} className="relative z-10 w-[80%] h-[80%] drop-shadow-md pointer-events-none" />;
    }
  };

  return (
    <div className={`flex flex-col select-none w-full ${!interactive || !isMyTurn ? 'opacity-90' : 'opacity-100'}`}>
      <div className="relative w-full aspect-square border-2 border-[#333]">
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
                onClick={() => handleSquareClick(row, col)}
                className="relative w-full h-full flex items-center justify-center text-[9vw] sm:text-5xl cursor-pointer"
                style={{ backgroundColor: isLight(row, col) ? currentTheme.light : currentTheme.dark }}
              >
                {/* Overlays */}
                {isSelected && <div className="absolute inset-0 bg-black opacity-20 z-0" />}
                {!isSelected && isLast && <div className="absolute inset-0 bg-yellow-400 opacity-40 z-0" />}
                {isCheck && <div className="absolute inset-0 bg-red-600 opacity-50 animate-pulse z-0" />}
                {isLegal && !isCap && <div className="absolute w-4 h-4 rounded-full bg-black opacity-20 z-0" />}
                {isLegal && isCap && <div className="absolute inset-0 border-4 border-black opacity-20 z-0" />}

                {/* Piece */}
                {renderPiece(piece)}

                {/* Coordinates (if showCoordinates is false, show small in corner) */}
                {!showCoordinates && (
                  <span className="absolute bottom-0.5 right-0.5 text-[8px] text-gray-800 opacity-50 z-0">
                    {sq}
                  </span>
                )}
              </div>
            );
          })
        )}
        </div>
        {promotionMove && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-[#262421] p-4 rounded-lg flex gap-4 border border-[#403d39] shadow-2xl">
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
                  className="w-12 h-12 sm:w-16 sm:h-16 bg-[#312e2b] hover:bg-[#403d39] rounded flex items-center justify-center text-4xl sm:text-5xl border border-[#403d39] hover:border-[#c62828] transition-colors"
                >
                  {renderPiece({ type: p, color: chess.turn() })}
                </button>
              ))}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPromotionMove(null);
                }}
                className="w-12 h-12 sm:w-16 sm:h-16 bg-[#c62828]/20 hover:bg-[#c62828]/40 text-[#ef5350] rounded flex items-center justify-center text-lg font-bold border border-[#c62828]/50 transition-colors"
              >
                X
              </button>
            </div>
          </div>
        )}
      </div>
      {showCoordinates && (
        <div className="flex w-full h-4 sm:h-6 bg-[#262421]">
          {files.map(file => (
            <div key={file} className="flex-1 flex items-center justify-center text-[8px] sm:text-xs text-[#c3c3c2] font-sans font-bold">
              {file}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
