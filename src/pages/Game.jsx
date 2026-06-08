import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useInView } from 'react-intersection-observer';
import { setCookie, getCookie } from '../utils/cookieUtils';

const Game = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('start');
  const [moveFrom, setMoveFrom] = useState('');
  const [rightClickedSquares, setRightClickedSquares] = useState({});
  const [moveSquares, setMoveSquares] = useState({});
  const [optionSquares, setOptionSquares] = useState({});
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isTabActive, setIsTabActive] = useState(true);
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleVisibilityChange = () => setIsTabActive(!document.hidden);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const getKingSquare = (fen, color) => {
    if (!fen) return null;
    const parts = fen.split(' ');
    const board = parts[0];
    const rows = board.split('/');
    const kingChar = color === 'w' ? 'K' : 'k';

    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const char of rows[r]) {
        if (isNaN(char)) {
          if (char === kingChar) {
            return String.fromCharCode(97 + c) + (8 - r);
          }
          c++;
        } else {
          c += parseInt(char);
        }
      }
    }
    return null;
  };

  const onDrop = (sourceSquare, targetSquare) => {
    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (move === null) return false;
    return true;
  };

  const makeAMove = useCallback((move) => {
    try {
      const result = game.move(move);
      setFen(game.fen());
      return result;
    } catch (e) {
      return null;
    }
  }, [game]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if (id) {
      setGameId(id);
      const cookieName = `game_owner_${id}`;
      // Logic for game ownership or session management
    }
  }, [location.search]);

  return (
    <div className="game-container">
      <div className="board-wrapper">
        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          boardOrientation="white"
        />
      </div>
      <div className="status-panel">
        <p>Game ID: {gameId}</p>
        <p>Status: {isOnline ? 'Online' : 'Offline'}</p>
        {isBotThinking && <p>Bot is thinking...</p>}
      </div>
    </div>
  );
};

export default Game;
