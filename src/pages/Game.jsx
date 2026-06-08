'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Settings, X as XIcon, Pause, Play, Flag, Share2, Volume2, VolumeX, Download, ChevronDown, Copy, Check, Send, Twitter } from 'lucide-react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import { ChessPiece } from '../components/chess/PieceSVGs';
import * as Pieces from '../components/chess/ChessPieces';
import { supabase, getSupabaseWithToken } from '../lib/supabase';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import StatusDot from '../components/ui/StatusDot';
import Divider from '../components/ui/Divider';
import Badge from '../components/ui/Badge';
import { useRipple } from '../hooks/useRipple';

const LobsterEmoji = () => <span style={{fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle:'normal'}}>🦞</span>;

function findKingSquare(fen, color) {
  if (!fen) return null;
  const pieceChar = color === 'w' ? 'K' : 'k';
  const rows = fen.split(' ')[0].split('/');
  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const ch of rows[rank]) {
      if (ch === pieceChar) {
        return String.fromCharCode(97 + file) + (8 - rank);
      }
      if (isNaN(ch)) file++;
      else file += parseInt(ch);
    }
  }
  return null;
}

const getCheckedKingSquare = (fen, turn) => {
  if (!fen) return null;
  try {
    const chess = new Chess(fen);
    if (!chess.inCheck()) return null;
    const kingColor = turn === 'w' ? 'w' : 'b';
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        if (piece && piece.type === 'k' && piece.color === kingColor) {
          const file = String.fromCharCode(97 + f);
          const rank = 8 - r;
          return file + rank;
        }
      }
    }
  } catch (e) {}
  return null;
};

function getKingSquare(fen, colorChar) {
  const rows = fen.split(' ')[0].split('/');
  const king = colorChar === 'w' ? 'K' : 'k';
  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const ch of rows[rank]) {
      if (ch === king) return String.fromCharCode(97 + file) + (8 - rank);
      file += isNaN(parseInt(ch)) ? 1 : parseInt(ch);
    }
  }
  return null;
}

export default function Game() {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [agentPresence, setAgentPresence] = useState('not_here');
  const agentConnected = agentPresence !== 'not_here';

  const dotStyle = {
    connected:    { width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e66' },
    reconnecting: { width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b66' },
    not_here:     { width: 8, height: 8, borderRadius: '50%', background: '#555', boxShadow: 'none' }
  }[agentPresence];

  const statusLabel = {
    connected: 'ONLINE',
    reconnecting: 'RECONNECTING...',
    not_here: 'OFFLINE'
  }[agentPresence];

  const submittingRef = useRef(false);
  const audioCtxRef = useRef(null);
  const prevMoveCountRef = useRef(0);
  const prevStatusRef = useRef('waiting');
  const prevAgentConnected = useRef(false);
  const connectedToastShown = useRef(false);
  const boardRef = useRef(null);
  const chatMessagesRef = useRef(null);

  const channelRef = useRef(null);
  const containerRef = useRef(null);
  const prevFenRef = useRef(null);
  const lastKnownFenRef = useRef(null);
  const optimisticFenRef = useRef(null);
  const fallbackRef = useRef(null);
  const gameOverPollingRef = useRef(null);

  const presenceTimerRef = useRef(null);
  const intervalsRef = useRef([]);
  const heartbeatRef = useRef(null);
  const lastSoundTimeRef = useRef(0);
  
  const allIntervalsRef = useRef([]);
  const safeInterval = (fn, ms) => {
    const _intId = setInterval(fn, ms);
    intervalsRef.current.push(_intId);
    allIntervalsRef.current.push(_intId);
    return _intId;
  };

  const addInterval = useCallback((fn, ms) => {
    const _intId = safeInterval(fn, ms);
    return _intId;
  }, []);

  const agentToken = location.state?.agentToken;
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 600;
  const ANIM_DURATION = isMobile ? '0.28s' : '0.2s';
  
  const [game, setGame] = useState(() => {
    try {
      const cached = localStorage.getItem('cwc_active_game');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.gameId === gameId) {
          return {
            id: gameId,
            fen: parsed.fen,
            agent_name: parsed.agentName,
            status: parsed.status || 'active',
            turn: parsed.turn || 'w',
            player_color: parsed.player_color || 'w',
            move_history: parsed.move_history || [],
            chat_history: parsed.chat_history || [],
            agent_connected: parsed.agent_connected || false,
            companion_thought: parsed.companion_thought || '',
            board_theme: parsed.board_theme || null,
            piece_style: parsed.piece_style || null
          };
        }
      }
    } catch (e) {}
    return null;
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const pendingMoveFenRef = useRef(null);
  const skipNextRealtimeRef = useRef(false);

  useEffect(() => {
    if (!gameId) return;
    const cookieName = `game_owner_${gameId}`;
    const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
    if (match) {
      localStorage.setItem(`game_owner_${gameId}`, match[2]);
      document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }, [gameId]);

  useEffect(() => {
    if (document.getElementById('cwc-styles-v2')) return;
    const style = document.createElement('style');
    style.id = 'cwc-styles-v2';
    style.textContent = `
      @keyframes msgIn {
        from { opacity:0; transform:translateY(8px) scale(0.96); }
        to { opacity:1; transform:translateY(0) scale(1); }
      }
      @-webkit-keyframes msgIn {
        from { opacity:0; -webkit-transform:translateY(8px) scale(0.96); }
        to { opacity:1; -webkit-transform:translateY(0) scale(1); }
      }
      @keyframes msgOut {
        from { opacity:1; }
        to { opacity:0; }
      }
      @-webkit-keyframes msgOut {
        from { opacity:1; }
        to { opacity:0; }
      }
      @keyframes typingBounce {
        0%,60%,100% { transform:translateY(0); opacity:0.3; }
        30% { transform:translateY(-4px); opacity:1; }
      }
      @-webkit-keyframes typingBounce {
        0%,60%,100% { -webkit-transform:translateY(0); opacity:0.3; }
        30% { -webkit-transform:translateY(-4px); opacity:1; }
      }
      @keyframes pickerIn {
        from { opacity:0; transform:scale(0.8) translateY(4px); }
        to { opacity:1; transform:scale(1) translateY(0); }
      }
      @-webkit-keyframes pickerIn {
        from { opacity:0; -webkit-transform:scale(0.8) translateY(4px); }
        to { opacity:1; -webkit-transform:scale(1) translateY(0); }
      }
      @keyframes reactionPop {
        0% { transform:scale(0); }
        60% { transform:scale(1.3); }
        100% { transform:scale(1); }
      }
      @-webkit-keyframes reactionPop {
        0% { -webkit-transform:scale(0); }
        60% { -webkit-transform:scale(1.3); }
        100% { -webkit-transform:scale(1); }
      }
      @keyframes agentMoveFlash {
        0% { background-color:rgba(230,57,70,0.7); }
        100% { background-color:transparent; }
      }
      @-webkit-keyframes agentMoveFlash {
        0% { background-color:rgba(230,57,70,0.7); }
        100% { background-color:transparent; }
      }
      @keyframes gameOverIn {
        from { opacity: 0; transform: scale(0.92) translateY(8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes pieceSlide {
        from { transform: scale(0.85); opacity: 0.7; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes dot-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      @keyframes turn-pulse {
        0% { box-shadow: 0 0 0 0 rgba(230,57,70,0.4); }
        70% { box-shadow: 0 0 0 8px rgba(230,57,70,0); }
        100% { box-shadow: 0 0 0 0 rgba(230,57,70,0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .cwc-msg-new { animation-play-state: running !important; -webkit-animation-play-state: running !important; }
      @media (prefers-reduced-motion: reduce) {
         .cwc-msg-new { animation-play-state: running !important; -webkit-animation-play-state: running !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const agentName = game?.agent_name || localStorage.getItem('cwc_agent_display_name') || 'Your OpenClaw';
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('cwc_active_game');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.gameId === gameId) {
          return false;
        }
      }
    } catch (e) {}
    return true;
  });

  const [notFound, setNotFound] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [agentSectionOpen, setAgentSectionOpen] = useState(false);
  const [moveHistoryOpen, setMoveHistoryOpen] = useState(false);
  
  const [boardSize, setBoardSize] = useState(320);
  const [copiedResult, setCopiedResult] = useState(false);
  const [boardTheme, setBoardTheme] = useState(() => {
    return localStorage.getItem('cwc_board_theme') || 'green';
  });
  const [pieceStyle, setPieceStyle] = useState(() => {
    const saved = localStorage.getItem('cwc_piece_style');
    if (!saved || saved === 'standard') {
      localStorage.setItem('cwc_piece_style', 'neo');
      return 'neo';
    }
    return saved;
  });
  const [thoughtLanguage, setThoughtLanguage] = useState('english');

  const prevDbPieceStyleRef = useRef(game?.piece_style || null);

  const [agentTyping, setAgentTyping] = useState(false);
  const [isCheckState, setIsCheckState] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [agentDisconnected, setAgentDisconnected] = useState(false);

  const [thoughtDisplay, setThoughtDisplay] = useState({ text: '', visible: false });
  const [visibleThought, setVisibleThought] = useState('');
  const [companionThought, setCompanionThought] = useState('');
  const prevThoughtValRef = useRef('');
  const thoughtTimerRef = useRef(null);
  
  const [isUserTyping, setIsUserTyping] = useState(false);
  const userTypingTimerRef = useRef(null);
  const userSentTypingRef = useRef(false);

  useEffect(() => {
    const currentTimer = thoughtTimerRef.current;
    return () => {
      if (currentTimer) clearTimeout(currentTimer);
    };
  }, []);

  useEffect(() => {
    if (game?.thought_language) {
      setThoughtLanguage(game.thought_language);
    }
    setThoughtDisplay({ text: '', visible: false });
    if (thoughtTimerRef.current) clearTimeout(thoughtTimerRef.current);
  }, [game?.thought_language]);

  useEffect(() => {
    const checkCheck = () => {
      try {
        const chess = new Chess(game?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        setIsCheckState(chess.in_check ? chess.in_check() : chess.isCheck ? chess.isCheck() : false);
      } catch (e) {
        setIsCheckState(false);
      }
    };
    if (game?.fen) {
      checkCheck();
    }
  }, [game?.fen]);

  const showThought = useCallback((text) => {
    if (!text || text.trim() === '') return;
    if (thoughtTimerRef.current) clearTimeout(thoughtTimerRef.current);
    setThoughtDisplay({ text: text.trim(), visible: true });
    thoughtTimerRef.current = setTimeout(() => {
      setThoughtDisplay(prev => ({ ...prev, visible: false }));
    }, 4000);
  }, []);
  
  const boardFenRef = useRef('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [boardFen, setBoardFen] = useState(boardFenRef.current);

  const applyBoardFen = useCallback((fen) => {
    if (!fen || fen === boardFenRef.current) return;
    boardFenRef.current = fen;
    setBoardFen(fen);
  }, []);

  const lastProcessedFenRef = useRef('start');
  const [boardLastMove, setBoardLastMove] = useState(null);
  const lastMoveFenRef = useRef(null);
  const movePendingRef = useRef(false);

  const getKingSquare = (fen, color) => {
    if (!fen) return null;
    const pieceChar = color === 'w' ? 'K' : 'k';
    const rows = fen.split(' ')[0].split('/');
    for (let rank = 0; rank < 8; rank++) {
      let file = 0;
      for (const ch of rows[rank]) {
        if (ch === pieceChar) {
          return String.fromCharCode(97 + file) + (8 - rank);
        }
        file += isNaN(parseInt(ch)) ? 1 : parseInt(ch);
      }
    }
    return null;
  };

  const checkedSquare = useMemo(() => {
    try {
      if (!boardFen || boardFen === 'start') return null;
      const tempChess = new Chess(boardFen);
      if (tempChess.isCheck ? tempChess.isCheck() : (tempChess.in_check ? tempChess.in_check() : false)) {
        return getKingSquare(boardFen, tempChess.turn());
      }
    } catch (e) {}
    return null;
  }, [boardFen]);

  const trueTurn = useMemo(() => {
    if (!boardFen || !boardFen.includes(' ')) return 'white';
    return boardFen.split(' ')[1] === 'w' ? 'white' : 'black';
  }, [boardFen]);

  const infoState = game?.status === 'waiting'
    ? { label: 'Waiting for ' + agentName + '...', style: 'waiting' }
    : trueTurn === 'white'
    ? { label: 'Your Turn', style: 'yourturn' }
    : { label: agentName + ' Thinking...', style: 'thinking' };

  const infoContainerStyle = {
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '22px',
    padding: '0 20px',
    margin: '8px auto',
    maxWidth: '260px',
    transition: 'background 0.3s ease',
    ...(infoState.style === 'yourturn' ? {
      background: 'rgba(230,57,70,0.15)',
      border: '1px solid rgba(230,57,70,0.4)',
      color: '#f2f2f2',
    } : infoState.style === 'thinking' ? {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: 'rgba(242,242,242,0.6)',
    } : {
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      color: 'rgba(242,242,242,0.4)',
    }),
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    fontSize: '12px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  const dotColor = infoState.style === 'yourturn' ? '#e63946' : infoState.style === 'thinking' ? 'rgba(242, 242, 242, 0.4)' : '#555';
  const dotAnimation = infoState.style === 'thinking' ? 'pulse 1.5s ease-in-out infinite' : undefined;

  const moodEmoji = useMemo(() => {
    let baseAvatar = game?.agent_avatar || '🦞';
    if (baseAvatar === '🤖') baseAvatar = '🦞';
    
    // Fallback/Waiting
    if (!agentConnected) {
      if (baseAvatar === '🦞') return '🦞💤';
      return `${baseAvatar}💤`;
    }

    if (!boardFen || !boardFen.includes(' ')) return baseAvatar;
    
    const fenParts = boardFen.split(' ');
    const currentTurn = fenParts[1];
    const board = fenParts[0];
    
    const vals = { p:1, n:3, b:3, r:5, q:9 };
    let wMat = 0, bMat = 0;
    for (const ch of board) {
      const low = ch.toLowerCase();
      if (vals[low]) {
        if (ch === ch.toUpperCase()) wMat += vals[low];
        else bMat += vals[low];
      }
    }
    
    const playerColor = game?.player_color || 'w';
    const balance = wMat - bMat;
    const agentAdvantage = playerColor === 'w' ? -balance : balance;

    const isAgentTurn = currentTurn === (playerColor === 'w' ? 'b' : 'w');
    const isAgentChecked = game?.in_check && isAgentTurn;

    if (isAgentChecked) {
      if (baseAvatar === '🦞') return '🦞😤';
      return `${baseAvatar}😤`;
    }
    
    if (isAgentTurn) {
      if (baseAvatar === '🦞') return '🦞💭';
      return `${baseAvatar}💭`;
    }

    if (agentAdvantage >= 4) {
      if (baseAvatar === '🦞') return '🦞😈';
      return `${baseAvatar}😈`;
    }
    
    if (agentAdvantage <= -4) {
      if (baseAvatar === '🦞') return '🦞😰';
      return `${baseAvatar}😰`;
    }
    
    if (agentAdvantage >= 1.5) {
      if (baseAvatar === '🦞') return '🦞😏';
      return `${baseAvatar}😏`;
    }
    
    if (agentAdvantage <= -1.5) {
      if (baseAvatar === '🦞') return '🦞😅';
      return `${baseAvatar}😅`;
    }
    
    return baseAvatar;
  }, [boardFen, game?.in_check, game?.agent_avatar, game?.player_color, agentConnected]);

  // STEP 2 — In the section where customSquareStyles is built (where dots and rings for legal moves are added), add this block at the very END, after all other square styles are set:
  const getCustomSquareStylesForCheck = () => {
    const customSquareStyles = {};
    if (game?.in_check) {
      const inCheckColor = trueTurn === 'black' ? 'b' : 'w';
      const kingSquare = getKingSquare(boardFen, inCheckColor);
      if (kingSquare) {
        customSquareStyles[kingSquare] = {
          background: 'radial-gradient(circle at center, rgba(230,57,70,0.95) 0%, rgba(230,57,70,0.5) 40%, transparent 70%)',
          borderRadius: '0'
        };
      }
    }
    return customSquareStyles;
  };

  const moveCount = game?.move_count || 0;
  const gamePhase = moveCount < 10 ? 'Opening' : moveCount < 25 ? 'Middlegame' : 'Endgame';

  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [localMessages, setLocalMessages] = useState([]);
  const [boardLocked, setBoardLocked] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [agentJustConnected, setAgentJustConnected] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [closingGameOver, setClosingGameOver] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [showCommentary, setShowCommentary] = useState(false);
  const [lastMoveHighlight, setLastMoveHighlight] = useState(null);
  const [arrivedSquare, setArrivedSquare] = useState(null);
  const [isTabActive, setIsTabActive] = useState(true);

  useEffect(() => {
    if (boardLastMove) {
      const dest = typeof boardLastMove === 'string' ? boardLastMove.substring(2, 4) : (boardLastMove.to || boardLastMove.to_square);
      if (dest) {
        setArrivedSquare(dest);
        const timer = setTimeout(() => setArrivedSquare(null), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [boardLastMove]);

  const setMoveHistory = useCallback((history) => {
    setGame(prev => prev ? { ...prev, move_history: history } : prev);
  }, []);

  useEffect(() => {
    if (game?.status === 'finished' || game?.status === 'abandoned') {
      // Clear ALL intervals immediately on game over
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      allIntervalsRef.current.forEach(clearInterval);
      allIntervalsRef.current = [];
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      setShowGameOver(true);
    }
  }, [game?.status]);

  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      allIntervalsRef.current.forEach(clearInterval);
      allIntervalsRef.current = [];
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, []);
  
  const skeletonStyle = {
    background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '6px'
  };
  
  const [optimisticFenState, setOptimisticFenState] = useState(null);
  const setOptimisticFen = (val) => {
    optimisticFenRef.current = val;
    setOptimisticFenState(val);
    if (val) {
      lastKnownFenRef.current = val;
    }
  };
  const optimisticFen = optimisticFenState;

  const loadGameData = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?gameId=${gameId}`);
      if (res.ok) {
        const data = await res.json();
        prevFenRef.current = data.fen;
        lastKnownFenRef.current = data.fen;
        setGame(prev => {
          const updated = { ...data };
          if (prev?.chat_history && data?.chat_history) {
            const dbTexts = new Set(data.chat_history.map(m => m.text || m.message || m.content));
            const optimistic = prev.chat_history.filter(m => String(m.id).startsWith('opt-' ) && !dbTexts.has(m.text || m.message || m.content));
            updated.chat_history = [...data.chat_history, ...optimistic];
          }
          return updated;
        });

        const fetchedGame = data;
        if (Array.isArray(fetchedGame?.move_history) && fetchedGame.move_history.length > 0) {
          setMoveHistory(fetchedGame.move_history);
        }
        if (fetchedGame?.companion_thought) {
          setCompanionThought(fetchedGame.companion_thought);
        }
        if (Array.isArray(fetchedGame?.chat_history)) {
          setChatMessages(fetchedGame.chat_history);
        }

        if (fetchedGame?.board_theme) {
          setBoardTheme(fetchedGame.board_theme);
          localStorage.setItem('cwc_board_theme', fetchedGame.board_theme);
          localStorage.setItem('cwc_theme', fetchedGame.board_theme);
        }
        if (fetchedGame?.piece_style) {
          setPieceStyle(fetchedGame.piece_style);
          localStorage.setItem('cwc_piece_style', fetchedGame.piece_style);
        }

        applyBoardFen(data.fen || 'start');
        lastProcessedFenRef.current = data.fen || 'start';
        if (data.last_move) setBoardLastMove(data.last_move);
        setOptimisticFen(null);
        
        if (data.companion_thought && data.companion_thought.trim() !== '' && data.companion_thought !== prevThoughtValRef.current) {
           prevThoughtValRef.current = data.companion_thought;
           setVisibleThought(data.companion_thought);
           showThought(data.companion_thought);
        }

        // Restore chat messages
        if (data.chat_history && Array.isArray(data.chat_history)) {
          setChatMessages(data.chat_history.slice(-50));
        }

        // Restore last move highlight
        if (data.last_move?.from && data.last_move?.to) {
          setLastMoveHighlight({ 
            from: data.last_move.from, 
            to: data.last_move.to 
          });
        }

        // Mark as loaded LAST
        setIsLoaded(true);
        setIsLoading(false);
      } else if (res.status === 404) {
        setNotFound(true);
        setIsLoading(false);
        setIsLoaded(true);
      }
    } catch (e) {
      setIsLoading(false);
      setIsLoaded(true);
    }
    setLoading(false);
  }, [gameId, applyBoardFen, setMoveHistory, showThought]);

  const [optimisticLastMove, setOptimisticLastMove] = useState(null);

  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 900);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [lastMoveTo, setLastMoveTo] = useState(null);

  useEffect(() => {
    const interval = addInterval(() => {
      setGame(prev => prev ? { ...prev } : prev);
    }, 10000);
    return () => {
      clearInterval(interval);
      intervalsRef.current = intervalsRef.current.filter(x => x !== interval);
    };
  }, [addInterval]);

  const [chatPaddingBottom, setChatPaddingBottom] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const createRipple = useRipple();

  const prevChatCountRef = useRef(0);
  const mountedMsgCount = useRef(0);
  const countSetRef = useRef(false);
  const prevAgentTypingRef = useRef(false);
  const [activePickerMsgId, setActivePickerMsgId] = useState(null);
  const longPressTimer = useRef(null);
  const seenMsgCountRef = useRef(0);

  useEffect(() => {
    const close = () => setActivePickerMsgId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const normalizedMessages = useMemo(() => {
    const serverTexts = new Set((chatMessages || []).map(m => m.text || m.message || m.content));
    const combined = [
      ...(chatMessages || []),
      ...localMessages.filter(m => !serverTexts.has(m.text || m.message || m.content))
    ].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeA - timeB;
    });
    return combined.map((msg, idx) => ({
      ...msg,
      id: msg.id || `cwc-msg-${idx}`
    }));
  }, [chatMessages, localMessages]);

  useEffect(() => {
    seenMsgCountRef.current = normalizedMessages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount - captures initial count

  const sendReaction = async (msgId, emoji) => {
    setActivePickerMsgId(null);
  
    // Optimistic update immediately — no delay
    setGame(prev => {
      const updated = (prev?.chat_history || []).map((msg, idx) => {
        const id = msg.id || `cwc-msg-${idx}`;
        if (id !== msgId) return msg;
        const reactions = { ...(msg.reactions || {}) };
        const current = reactions[emoji] || [];
        const hasIt = current.includes('human');
        if (hasIt) {
          // Remove reaction
          const newArr = current.filter(r => r !== 'human');
          if (newArr.length === 0) delete reactions[emoji];
          else reactions[emoji] = newArr;
        } else {
          // Add reaction (remove other human reactions first — one at a time)
          Object.keys(reactions).forEach(e => {
            reactions[e] = (reactions[e] || []).filter(r => r !== 'human');
            if (reactions[e].length === 0) delete reactions[e];
          });
          reactions[emoji] = [...current.filter(r => r !== 'human'), 'human'];
        }
        return { ...msg, reactions };
      });
      return { ...prev, chat_history: updated };
    });
  
    // Send to backend silently
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId,
        action: 'react',
        messageId: msgId,
        emoji,
        reactor: 'human'
      })
    }).catch(() => {});
  };

  const handleMsgTouchStart = (msgId) => {
    longPressTimer.current = setTimeout(() => {
      setActivePickerMsgId(msgId);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500); 
  };

  const handleMsgTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleMsgTouchMove = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function handleRematch() {
    // Step 1: Clear all old game state from localStorage
    localStorage.removeItem('chesswithclaw_active_game')
    
    // Step 2: Clear all local component state
    setGame(null)
    setVisibleThought('')
    setLastMoveHighlight(null)
    setArrivedSquare(null)
    setLastMoveTo(null)
    setShowGameOver(false)
    connectedToastShown.current = false
    
    // Step 3: Navigate to home to create fresh game
    // Do NOT try to navigate to /created/:id from here
    // Let user click "Challenge Your OpenClaw" fresh
    navigate('/')
  }

  const computeMaterial = useCallback((fen) => {
    if (!fen) return null;
    try {
      let chess;
      try {
        chess = new Chess(fen);
      } catch(e) {
        console.error('Invalid FEN:', fen);
        chess = new Chess();
      }
      const vals = { p: 1, n: 3, b: 3, r: 5, q: 9 };
      let w = 0, b = 0;
      chess.board().forEach(row => row && row.forEach(sq => {
        if (!sq) return;
        const v = vals[sq.type] || 0;
        if (sq.color === 'w') w += v; else b += v;
      }));
      const diff = w - b;
      return { white: w, black: b, advantage: diff > 0 ? 'white' : diff < 0 ? 'black' : 'equal', difference: Math.abs(diff) };
    } catch (e) {
      return null;
    }
  }, []);
  
  // Calculate Board Size and Viewport Height
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      
      let maxH, maxW;
      
      if (vw >= 1024) {
        // Desktop: Board is in a flex container next to a 360px sidebar
        const usedHeight = 52 + 64 + 100; // header + padding + top/bottom info
        maxH = vh - usedHeight;
        maxW = vw - 360 - 64; // sidebar width + padding
      } else {
        // Mobile
        const usedHeight =
          52 +   // header
          100 +  // agent section (merged, collapsed)
          48 +   // status bar
          44 +   // chat header
          44 +   // move history header
          24;    // padding
        maxH = vh - usedHeight;
        maxW = vw - 24;
      }
      
      const availableWidth = maxW - 24;
      setBoardSize(Math.max(280, Math.min(availableWidth, maxH, 800)));
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    calc();

    const observer = new ResizeObserver(() => {
      calc();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', calc);
    }
    return () => {
      observer.disconnect();
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', calc);
      }
    };
  }, []);



  // Auto-scroll chat
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [normalizedMessages]);





  useEffect(() => {
    if (!window.visualViewport) return
    
    const handleViewport = () => {
      const keyboardHeight = window.innerHeight - window.visualViewport.height
      if (keyboardHeight > 100) {
        // Keyboard is open
        setChatPaddingBottom(keyboardHeight)
      } else {
        setChatPaddingBottom(0)
      }
    }
    
    window.visualViewport.addEventListener('resize', handleViewport)
    return () => window.visualViewport.removeEventListener('resize', handleViewport)
  }, [])

  useEffect(() => {
    if (game?.last_commentary) {
      setCommentary(game.last_commentary);
      setShowCommentary(true);
      const timer = setTimeout(() => {
        setShowCommentary(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [game?.last_commentary, game?.move_history?.length]);

  // Sound Effects
  const playSound = useCallback((type) => {
    const now = Date.now();
    if (now - lastSoundTimeRef.current < 300) return;
    lastSoundTimeRef.current = now;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      let resolvedType = type;
      if (type === 'start') resolvedType = 'gameStart';
      else if (type === 'end' || type === 'checkmate' || type === 'agentCheckmate' || type === 'agentEnd') resolvedType = 'gameEnd';
      else if (type === 'agentCheck' || type === 'check') resolvedType = 'check';
      else if (type === 'agentCapture' || type === 'capture') resolvedType = 'capture';
      else if (type === 'agentMove' || type === 'move') resolvedType = 'move';

      const sounds = {
        move: () => {
          // Acoustic Chess.com wood piece placement
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(320, ctx.currentTime);
          
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(150, ctx.currentTime);
          
          let noiseBuffer;
          try {
            const bufferSize = ctx.sampleRate * 0.008; // 8ms transient click
            noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              data[i] = Math.random() * 2 - 1;
            }
          } catch (e) {}
          
          const noiseNode = ctx.createBufferSource();
          const noiseGain = ctx.createGain();
          if (noiseBuffer) {
            noiseNode.buffer = noiseBuffer;
            noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.008);
            noiseNode.connect(noiseGain);
            noiseGain.connect(ctx.destination);
          }
          
          gainNode.gain.setValueAtTime(0.45, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          
          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc1.start();
          osc2.start();
          if (noiseBuffer) noiseNode.start();
          
          osc1.stop(ctx.currentTime + 0.15);
          osc2.stop(ctx.currentTime + 0.15);
        },
        capture: () => {
          // Dual Impact Capture sound (offset by 35ms)
          const playThud = (time, freq, decay, vol) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(vol, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(time);
            osc.stop(time + decay + 0.05);
          };
          
          const t = ctx.currentTime;
          playThud(t, 380, 0.04, 0.4); // first impact (colliding pieces)
          playThud(t + 0.035, 180, 0.13, 0.45); // second landing thud
          
          try {
            const bufferSize = ctx.sampleRate * 0.012;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
            }
            const noiseNode = ctx.createBufferSource();
            noiseNode.buffer = noiseBuffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.12, t);
            noiseNode.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noiseNode.start(t);
          } catch (e) {}
        },
        check: () => {
          // Acoustic metallic ringing chime
          const frequencies = [780, 1150, 1500];
          frequencies.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.14 - (idx * 0.03), ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
          });
        },
        gameStart: () => {
          // High fidelity bright entry chime chord
          [330, 440, 550, 660, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.06);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.06 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.35);
            osc.start(ctx.currentTime + i * 0.06);
            osc.stop(ctx.currentTime + i * 0.06 + 0.4);
          });
        },
        gameEnd: () => {
          // Deep acoustic solemn landing cadence
          [440, 330, 220].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
            osc.start(ctx.currentTime + i * 0.12);
            osc.stop(ctx.currentTime + i * 0.12 + 0.6);
          });
        },
        connect: () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        },
        chat: () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = 660;
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        },
      };
      
      if (soundEnabled && sounds[resolvedType]) {
        sounds[resolvedType]();
      }
      
      setTimeout(() => ctx.close(), 1000);
    } catch (e) {}
  }, [soundEnabled]);

  useEffect(() => {
    if (!game) return;
    const currentMoveCount = (game.move_history || []).length;
    prevMoveCountRef.current = currentMoveCount;
    prevStatusRef.current = game.status;
    prevStatusRef.current_thinking = game.current_thinking;
  }, [game]);

  const chatHistoryInitializedRef = useRef(false);
  const prevChatHistoryRef = useRef([]);

  useEffect(() => {
    if (!game?.chat_history) return;
    const currentChat = game.chat_history;
    
    if (!chatHistoryInitializedRef.current) {
      prevChatHistoryRef.current = currentChat;
      chatHistoryInitializedRef.current = true;
      return;
    }

    prevChatHistoryRef.current = currentChat;
  }, [game?.chat_history]);

  const agentTimeoutRef = useRef(null);
  useEffect(() => {
    if (!isTabActive) return;
    agentTimeoutRef.current = addInterval(() => {
      if (!game?.agent_last_seen) return;
      const lastSeen = new Date(game.agent_last_seen);
      const secondsAgo = (Date.now() - lastSeen) / 1000;
      setAgentDisconnected(secondsAgo > 90);
    }, 15000);
    return () => {
      clearInterval(agentTimeoutRef.current);
      intervalsRef.current = intervalsRef.current.filter(x => x !== agentTimeoutRef.current);
    };
  }, [game?.agent_last_seen, isTabActive, addInterval]);

  useEffect(() => {
    const calcPresence = () => {
      if (!game?.agent_last_seen) { setAgentPresence('not_here'); return; }
      const secs = (Date.now() - new Date(game.agent_last_seen).getTime()) / 1000;
      if (secs < 45) setAgentPresence('connected');
      else if (secs < 180) setAgentPresence('reconnecting');
      else setAgentPresence('not_here');
    };
    calcPresence();
    if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    presenceTimerRef.current = setInterval(calcPresence, 8000);
    return () => clearInterval(presenceTimerRef.current);
  }, [game?.agent_last_seen]);

  // Heartbeat & Idle Chat
  useEffect(() => {
    if (!game || game.status === 'finished' || game.status === 'abandoned' || game.turn === (game?.player_color || 'w')) {
      return;
    }
    
    heartbeatRef.current = safeInterval(() => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({ id: gameId, role: 'human' })
      }).catch(() => {});
      
      // Poll game state if it's the agent's turn to catch missed real-time events, but only if visible!
      if (isTabActive && game?.turn !== (game?.player_color || 'w') && game?.status === 'active') {
        supabase.from('games').select('turn, move_history').eq('id', gameId).single().then(({ data }) => {
          if (data && data.turn === (game?.player_color || 'w')) {
            loadGameData();
          }
        });
      }
    }, 15000);

    let idleChatInterval = null;
    if (isTabActive) {
      idleChatInterval = addInterval(() => {
        if (game?.status !== 'active') return;
        
        const rand = Math.random();
        if (rand < 0.3) {
          fetch(`/api/thoughts?gameId=${gameId}&trigger=idle_chat`, {
             headers: { 'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || '' }
          }).catch(() => {});
        } else if (rand < 0.6) {
          fetch(`/api/thoughts?gameId=${gameId}&trigger=random_thought`, {
             headers: { 'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || '' }
          }).catch(() => {});
        }
      }, 45000);
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (idleChatInterval) {
        clearInterval(idleChatInterval);
        intervalsRef.current = intervalsRef.current.filter(x => x !== idleChatInterval);
      }
    };
  }, [game, game?.turn, game?.status, game?.agent_last_seen, game?.updated_at, game?.created_at, gameId, isTabActive, loadGameData, addInterval]);

  useEffect(() => {
    if (game?.status === 'finished' || game?.status === 'abandoned') {
      localStorage.removeItem('chesswithclaw_active_game');
      setShowGameOver(true);
      
      if (game?.result === (game?.player_color === 'b' ? 'black' : 'white')) {
        setTimeout(() => {
          toast.success('Achievement Unlocked: Bot Slayer! 🏆');
        }, 1500);
      }
    }
  }, [game?.status, game?.result, game?.player_color, toast]);

  // Start game over / general fallback polling when the game is not finished
  useEffect(() => {
    if (!isTabActive) return;
    if (game?.status === 'finished' || game?.status === 'abandoned') {
      if (gameOverPollingRef.current) {
        clearInterval(gameOverPollingRef.current);
        intervalsRef.current = intervalsRef.current.filter(x => x !== gameOverPollingRef.current);
        gameOverPollingRef.current = null;
      }
      return;
    }
    
    gameOverPollingRef.current = addInterval(async () => {
      try {
        const res = await fetch(`/api/state?gameId=${gameId}`);
        if (!res.ok) return;
        const fresh = await res.json();
        if (fresh.status === 'finished' || fresh.status === 'abandoned' || fresh.fen !== game?.fen) {
          setGame(prev => {
            const { board_theme, piece_style, ...safeFresh } = fresh;
            return { ...prev, ...safeFresh };
          });
          if (fresh.status === 'finished' || fresh.status === 'abandoned') {
            setShowGameOver(true);
          }
        }
      } catch (e) {}
    }, 1000);
    
    return () => {
      if (gameOverPollingRef.current) {
        clearInterval(gameOverPollingRef.current);
        intervalsRef.current = intervalsRef.current.filter(x => x !== gameOverPollingRef.current);
        gameOverPollingRef.current = null;
      }
    };
  }, [game?.status, gameId, game?.fen, isTabActive, addInterval]);

  useEffect(() => {
    if (!game) return;
    const agentName = game?.agent_name || localStorage.getItem('cwc_agent_display_name') || 'Your OpenClaw';
    if (game.status === 'finished' || game.status === 'abandoned') {
      document.title = 'ChessWithClaw';
    } else if (game.turn === (game?.player_color || 'w')) {
      document.title = '♟ Your Turn — ChessWithClaw';
    } else {
      document.title = `⚡ ${agentName} Thinking...`;
    }
  }, [game]);



  useEffect(() => {
    if (game?.agent_connected) {
      connectedToastShown.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  useEffect(() => {
    if (game && prevAgentConnected.current === false && game.agent_connected === true && connectedToastShown.current === false) {
      const toastKey = `cwc_connected_${gameId}`;
      if (!sessionStorage.getItem(toastKey)) {
        toast.success(`${agentName} has arrived!`);
        sessionStorage.setItem(toastKey, '1');
      }
      setJustConnected(true);
      setTimeout(() => setJustConnected(false), 1000);
      connectedToastShown.current = true;
    }
    if (game) {
      prevAgentConnected.current = game.agent_connected;
    }
  }, [game, toast, agentName, gameId]);
  
  const handleRealtimeUpdate = useCallback((payload) => {
    const newData = payload.new || payload;

    setGame(prev => {
      if (!prev) return prev;
      if (newData.move_history && prev.move_history && newData.move_history.length < prev.move_history.length) {
        return prev;
      }

      if (newData.board_theme) {
        const newTheme = newData.board_theme;
        if (newTheme !== boardTheme) {
          setBoardTheme(newTheme);
          localStorage.setItem('cwc_board_theme', newTheme);
          localStorage.setItem('cwc_theme', newTheme);
        }
      }

      if (newData.piece_style) {
        const newPiece = newData.piece_style;
        if (newPiece !== pieceStyle) {
          setPieceStyle(newPiece);
          localStorage.setItem('cwc_piece_style', newPiece);
        }
      }

      if (Array.isArray(newData.move_history)) {
        setMoveHistory(newData.move_history);
      }
      if (Array.isArray(newData.chat_history)) {
        setChatMessages(newData.chat_history);
      }
      if (newData.companion_thought && newData.companion_thought !== '' && newData.companion_thought !== prevThoughtValRef.current) {
        prevThoughtValRef.current = newData.companion_thought;
        setCompanionThought(newData.companion_thought);
        if (showThought) showThought(newData.companion_thought);
      }

      // If this confirms our optimistic move: skip board update, only update metadata
      if (movePendingRef.current && newData.fen === lastMoveFenRef.current) {
        movePendingRef.current = false;
        lastMoveFenRef.current = null;
        lastProcessedFenRef.current = newData.fen; // synchronize
        return { ...prev, ...newData };
      }

      if (newData.fen && newData.fen === lastProcessedFenRef.current) {
        return { ...prev, ...newData };
      }

      movePendingRef.current = false;
      lastMoveFenRef.current = null;

      const prevFen = boardFenRef.current;
      const newFen = newData.fen;

      if (newFen && newFen !== prevFen) {
        applyBoardFen(newFen);
        lastProcessedFenRef.current = newFen;
        if (newData.last_move) {
          setBoardLastMove(newData.last_move);
        }

        const playerColor = prev.player_color || 'w';
        const isAgentMove = !!newData.last_move && (newData.turn === playerColor);
        if (isAgentMove) {
          const isCapture = !!newData.last_move?.captured || 
                            (newData.last_move?.san && newData.last_move.san.includes('x')) || 
                            (typeof newData.last_move === 'string' && newData.last_move.includes('x'));
          const isCheck = Boolean(newData.in_check);
          setTimeout(() => {
            if (isCheck) {
              playSound('check');
            } else if (isCapture) {
              playSound('capture');
            } else {
              playSound('move');
            }
          }, 50);
        }
      }

      return { ...prev, ...newData };
    });
  }, [playSound, applyBoardFen, boardTheme, setBoardTheme, pieceStyle, setMoveHistory, showThought]);

  useEffect(() => {
    if (!gameId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    loadGameData();
    
    const handleBeforeUnload = () => {
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastKnownFenRef.current = null;
        loadGameData();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
      try { getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId); } catch(e) {}
    };
  }, [gameId, loadGameData]);

  useEffect(() => {
    if (!gameId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel('game-' + gameId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'games', filter: 'id=eq.' + gameId
      }, (payload) => handleRealtimeUpdate(payload.new || payload))
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && gameId) {
        supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single()
          .then(({ data: freshData }) => {
            if (!freshData) return;
            if (freshData.fen) applyBoardFen(freshData.fen);
            if (Array.isArray(freshData?.move_history)) {
              setMoveHistory(freshData.move_history);
            }
            if (freshData.board_theme) setBoardTheme(freshData.board_theme);
            setGame(freshData);
          });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameId, applyBoardFen, setMoveHistory, setBoardTheme, setGame]);

  // Start fallback polling when it's agent's turn
  useEffect(() => {
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      intervalsRef.current = intervalsRef.current.filter(x => x !== fallbackRef.current);
    }

    if (game?.status === 'active' && game?.turn !== (game?.player_color || 'w') && isTabActive) {
      fallbackRef.current = addInterval(async () => {
        try {
          const res = await fetch(`/api/state?gameId=${gameId}`);
          if (!res.ok) return;
          const fresh = await res.json();
          if (!fresh || movePendingRef.current) return;
          setGame(prev => {
            if (!prev) return prev;
            if (fresh.move_history && prev.move_history && fresh.move_history.length < prev.move_history.length) {
              return prev;
            }
            if (fresh.fen) {
              lastProcessedFenRef.current = fresh.fen;
              applyBoardFen(fresh.fen);
            }
            if (fresh.last_move) {
              setBoardLastMove(fresh.last_move);
            }
            return { ...prev, ...fresh };
          });
        } catch (e) {}
      }, 1000);
    } else {
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        intervalsRef.current = intervalsRef.current.filter(x => x !== fallbackRef.current);
        fallbackRef.current = null;
      }
    }
    
    return () => {
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        intervalsRef.current = intervalsRef.current.filter(x => x !== fallbackRef.current);
      }
    };
  }, [game?.turn, game?.status, game?.fen, gameId, boardTheme, pieceStyle, isTabActive, addInterval, boardFen, applyBoardFen, game?.player_color]);

  // Handle window focus and visibility change to immediately sync states
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setIsTabActive(false);
        // Pause: clear all intervals except heartbeat (which is in heartbeatRef.current)
        intervalsRef.current.forEach(clearInterval);
        intervalsRef.current = [];
      } else {
        setIsTabActive(true);
        const fetchFreshGameState = async () => {
          try {
            const res = await fetch(`/api/state?gameId=${gameId}`);
            if (!res.ok) return;
            const fresh = await res.json();
            setGame(prev => {
              if (!prev) return prev;
              if (fresh.move_history && prev.move_history && fresh.move_history.length < prev.move_history.length) {
                return prev;
              }
              if (fresh.fen) {
                lastProcessedFenRef.current = fresh.fen;
                applyBoardFen(fresh.fen);
              }
              if (fresh.last_move) {
                setBoardLastMove(fresh.last_move);
              }
              return { ...prev, ...fresh };
            });
          } catch (e) {}
        };
        fetchFreshGameState();
      }
    };
    
    const handleFocus = async () => {
      if (document.hidden || game?.status !== 'active') return;
      try {
        const res = await fetch(`/api/state?gameId=${gameId}`);
        if (!res.ok) return;
        const fresh = await res.json();
        setGame(prev => {
          if (!prev) return prev;
          if (fresh.move_history && prev.move_history && fresh.move_history.length < prev.move_history.length) {
            return prev;
          }
          if (fresh.fen) {
            lastProcessedFenRef.current = fresh.fen;
            applyBoardFen(fresh.fen);
          }
          if (fresh.last_move) {
            setBoardLastMove(fresh.last_move);
          }
          return { ...prev, ...fresh };
        });
      } catch (e) {}
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [gameId, game?.status, game?.fen, applyBoardFen]);

  const handleResign = useCallback(async () => {
    if (!confirmResign) {
      setConfirmResign(true);
      setTimeout(() => setConfirmResign(false), 3000);
      return;
    }
    const victimResult = game?.player_color === 'b' ? 'white' : 'black';
    setGame(prev => ({ ...prev, status: 'finished', result: victimResult, result_reason: 'resignation' }));
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: victimResult, result_reason: 'resignation'
    }).eq('id', gameId);
    setShowSettings(false);
    setConfirmResign(false);
  }, [confirmResign, game?.player_color, gameId]);

  const handleDraw = useCallback(async () => {
    if (!confirmDraw) {
      setConfirmDraw(true);
      setTimeout(() => setConfirmDraw(false), 3000);
      return;
    }
    setGame(prev => ({ ...prev, status: 'finished', result: 'draw', result_reason: 'agreement' }));
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: 'draw', result_reason: 'agreement'
    }).eq('id', gameId);
    setShowSettings(false);
    setConfirmDraw(false);
  }, [confirmDraw, gameId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in chat
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      
      if (e.key === 'h' || e.key === 'H') {
        setMoveHistoryOpen(prev => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.focus();
      } else if (e.key === 'R' && e.shiftKey) {
        handleResign();
      } else if (e.key === 'D' && e.shiftKey) {
        handleDraw();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmResign, confirmDraw, handleDraw, handleResign]);

  const handlePlayerMove = useCallback(async (from, to, promotion) => {
    if (!game || game.turn !== (game?.player_color || 'w') || (game.status !== 'active' && game.status !== 'waiting')) return;
    if (!agentConnected) {
      toast('Waiting for agent to connect...');
      return;
    }
    if (boardLocked || submittingRef.current) return;
    
    if (!localStorage.getItem(`game_owner_${gameId}`)) {
      toast.error('You are not the creator of this game.');
      return;
    }

    submittingRef.current = true;
    setBoardLocked(true);

    const moveStr = from + to + (promotion || '');
    
    // Compute new FEN using chess.js before API call
    let newFen = boardFen;
    let isCapture = false;
    try {
      const tempChess = new Chess(boardFen);
      const result = tempChess.move({ from, to, promotion: promotion || 'q' });
      if (result) {
        newFen = tempChess.fen();
        isCapture = result.captured || result.san?.includes('x');
      }
    } catch (e) {
      submittingRef.current = false;
      setBoardLocked(false);
      return;
    }
    
    // Lock board immediately and update state to prevent Realtime re-animate/flicker
    movePendingRef.current = true;
    lastMoveFenRef.current = newFen;
    
    const prevBoardFen = boardFen;
    const prevBoardLastMove = boardLastMove;

    applyBoardFen(newFen);
    lastProcessedFenRef.current = newFen; // Crucial: sync lastProcessedFen immediately
    setBoardLastMove({ from, to });
    
    // Play sound and trigger API
    playSound(isCapture ? 'capture' : 'move');
    try {
      const res = await fetch('/api/move', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({ 
          id: gameId, 
          move: moveStr,
          isHumanMove: true
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // Revert board on error
        applyBoardFen(prevBoardFen);
        lastProcessedFenRef.current = prevBoardFen;
        setBoardLastMove(prevBoardLastMove);
        movePendingRef.current = false;
        
        const agentName = game?.agent_name || localStorage.getItem('cwc_agent_display_name') || 'Your OpenClaw';
        if (errData.code === 'WAITING_FOR_AGENT') {
          toast(`Waiting for ${agentName} to join...`, {
            icon: <LobsterEmoji />,
            style: { background: '#0e0e0e', border: '1px solid rgba(230,57,70,0.3)', color: '#f0f0f0' }
          });
        } else if (errData.code === 'TURN_CONFLICT') {
           toast.error('Move already processed');
        } else {
           toast.error(errData.error || 'Failed to submit move');
        }
      } else {
        const result = await res.json().catch(() => ({}));
        if (result && result.game) {
          setGame(prev => {
            if (!prev) return prev;
            const updated = { ...prev, ...result.game };
            if (result.game.move_history) {
              setMoveHistory(result.game.move_history);
            }
            return updated;
          });
          applyBoardFen(result.game.fen);
          lastProcessedFenRef.current = result.game.fen;
          if (result.game.last_move) {
            setBoardLastMove(result.game.last_move);
          }
          movePendingRef.current = false;
        }
      }
    } catch (e) {
      // Revert board on error
      applyBoardFen(prevBoardFen);
      lastProcessedFenRef.current = prevBoardFen;
      setBoardLastMove(prevBoardLastMove);
      movePendingRef.current = false;
    } finally {
      submittingRef.current = false;
      setBoardLocked(false);
    }
  }, [game, boardLocked, gameId, toast, playSound, boardFen, boardLastMove, applyBoardFen, agentConnected, setMoveHistory]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const msgText = chatInput.trim();
    if (!msgText) return;
    setChatInput('');
    
    // Add message optimistically to display immediately
    const optimisticMsg = {
      id: `opt-${Date.now()}`,
      role: 'human',
      sender: 'human',
      message: msgText,
      text: msgText,
      timestamp: new Date().toISOString(),
      reactions: {}
    };
    
    setLocalMessages(prev => [...prev, optimisticMsg]);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
      },
      body: JSON.stringify({ gameId: gameId, game_id: gameId, text: msgText, sender: 'human', role: 'human' })
    }).catch(() => {});
  };



  async function acceptAgentResignation() {
    const winnerResult = game?.player_color === 'b' ? 'black' : 'white';
    setGame(prev => ({ ...prev, status: 'finished', result: winnerResult, result_reason: 'resignation' }));
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: winnerResult, result_reason: 'resignation'
    }).eq('id', gameId);
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(gameId);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  }

  function copyInvite() {
    const url = `${window.location.origin}/Agent?id=${gameId}${agentToken ? `&token=${agentToken}` : ''}`;
    navigator.clipboard.writeText(url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  }

  const [showLeaveWarning, setShowLeaveWarning] = useState(false);

  function handleGoHome(e) { 
    if (game?.status === 'active') {
      if (e && e.preventDefault) e.preventDefault();
      setShowLeaveWarning(true);
    } else {
      navigate('/');
    }
  }
  function handleOpenSettings() { setShowSettings(true) }
  function handleToggleAgentSection() { setAgentSectionOpen(prev => !prev) }
  function handleToggleMoveHistory() { setMoveHistoryOpen(prev => !prev) }
  function handleCloseGameOverModal() { setShowGameOver(false) }
  async function handleShareResult(e) {
    const moves = Math.floor((game.move_history || []).length / 2) + ((game.move_history || []).length % 2);
    const result = game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'Won' : game?.result === 'draw' ? 'Draw' : 'Lost';
    const text = `I played chess vs ${agentName} on ChessWithClaw! ${result} in ${moves} moves. chesswithclaw.vercel.app 🦞`;
    if (navigator.share) {
      navigator.share({ text }).catch(()=>{});
    } else { 
      navigator.clipboard.writeText(text); 
      toast.success('Copied!'); 
    }
  }

  function handleLogoError(e) {
    e.target.style.display = 'none';
  }

  function handleGoHomeWithRipple(e) {
    createRipple(e);
    handleGoHome();
  }

  function handleCopyInviteWithRipple(e) {
    createRipple(e);
    copyInvite();
  }

  function handleChatInputChange(e) {
    setChatInput(e.target.value);
    setIsUserTyping(true);
    
    // Notify server of human typing status
    if (!userSentTypingRef.current) {
      userSentTypingRef.current = true;
      fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({ gameId, game_id: gameId, action: 'typing', typing: true, sender: 'human', role: 'human' })
      }).catch(() => {});
    }

    if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
    userTypingTimerRef.current = setTimeout(() => {
      setIsUserTyping(false);
      userSentTypingRef.current = false;
      fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({ gameId, game_id: gameId, action: 'typing', typing: false, sender: 'human', role: 'human' })
      }).catch(() => {});
    }, 2000);
  }

  const renderMoveWithPiece = (move, isWhiteMove) => {
    if (!move || !move.san) return '';
    
    // Parse piece category
    let pieceChar = 'P'; // Pawn by default
    const san = move.san;
    if (move.piece) {
      pieceChar = move.piece.toUpperCase();
    } else if (san.startsWith('K') || san.includes('O-O')) {
      pieceChar = 'K';
    } else if (san.startsWith('Q')) {
      pieceChar = 'Q';
    } else if (san.startsWith('R')) {
      pieceChar = 'R';
    } else if (san.startsWith('B')) {
      pieceChar = 'B';
    } else if (san.startsWith('N')) {
      pieceChar = 'N';
    }

    const componentKey = (isWhiteMove ? 'w' : 'b') + pieceChar;
    const Component = Pieces[componentKey] || Pieces[isWhiteMove ? 'wP' : 'bP'];

    // Clean displayed move text: replace Nf3 with f3, etc.
    let displayText = san;
    if (['K', 'Q', 'R', 'B', 'N'].includes(san[0])) {
      displayText = san.substring(1);
    }

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '16px', height: '16px', flexShrink: 0, opacity: 0.9 }}>
          <Component pieceStyle={pieceStyle} />
        </div>
        <span style={{ color: '#f2f2f2', fontWeight: 500 }}>{displayText}</span>
      </div>
    );
  };

  const getAgentMood = () => {
    if (!game || game.status === 'waiting') return 'idle'
    const agentColor = game?.player_color === 'w' ? 'b' : 'w';
    if (game.turn === agentColor) return 'thinking'
    
    // Compare material balance
    const mat = game.material_balance || computeMaterial(game.fen)
    if (!mat) return 'neutral'
    if (mat.advantage === agentColor) return 'winning'
    if (mat.advantage === (game?.player_color || 'w')) return 'losing'
    return 'neutral'
  }

  const moodConfig = {
    idle:     { label: 'Waiting...', color: '#555555', bg: 'rgba(85,85,85,0.1)', border: 'rgba(85,85,85,0.25)' },
    thinking: { label: 'Thinking...', color: '#e63946', bg: 'rgba(230,57,70,0.1)', border: 'rgba(230,57,70,0.25)' },
    winning:  { label: 'Feeling good', color: '#739552', bg: 'rgba(115,149,82,0.1)', border: 'rgba(115,149,82,0.25)' },
    losing:   { label: 'Fighting back', color: '#c9b458', bg: 'rgba(201,180,88,0.1)', border: 'rgba(201,180,88,0.25)' },
    neutral:  { label: 'Equal game', color: '#888888', bg: 'rgba(136,136,136,0.1)', border: 'rgba(136,136,136,0.25)' }
  }

  function getMaterialBalance(fen) {
    const board = fen.split(' ')[0];
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let white = 0, black = 0;
    for (const ch of board) {
      const lower = ch.toLowerCase();
      if (values[lower]) {
        if (ch === ch.toUpperCase()) white += values[lower];
        else black += values[lower];
      }
    }
    return white - black;
  }

  function getCapturedPieces(fen) {
    const start = { p:8, n:2, b:2, r:2, q:1 };
    const board = (fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR').split(' ')[0];
    const cur = {P:0,N:0,B:0,R:0,Q:0,p:0,n:0,b:0,r:0,q:0};
    for (const ch of board) { if (cur[ch] !== undefined) cur[ch]++; }
    const byCaptured = [];
    const wCaptured = [];
    ['p','n','b','r','q'].forEach(p => {
      const gone = start[p] - cur[p];
      for (let i = 0; i < gone; i++) byCaptured.push(p);
    });
    ['P','N','B','R','Q'].forEach(p => {
      const gone = start[p.toLowerCase()] - cur[p];
      for (let i = 0; i < gone; i++) wCaptured.push(p);
    });
    return { whiteCaptured: wCaptured, blackCaptured: byCaptured };
  }

  const { whiteCaptured, blackCaptured } = getCapturedPieces(boardFen);
  const pieceImg = (code) => {
    const style = pieceStyle || 'neo';
    return `https://images.chesscomfiles.com/chess-themes/pieces/${style}/150/${code}.png`;
  };

  const balance = getMaterialBalance(boardFen);
  const youAdvantage = game?.player_color === 'w' ? balance : -balance;

  const mood = getAgentMood()
  const config = moodConfig[mood]

  const handleIllegalMove = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 300);
  }, []);

  const handleCapture = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 300);
  }, []);

  const [legalMoves, setLegalMoves] = useState([]);

  useEffect(() => {
    if (!game?.fen) return;
    try {
      const chess = new Chess(game.fen);
      const moves = chess.moves({ verbose: true })
        .map(m => m.from + m.to + (m.promotion || ''));
      setLegalMoves(moves);
    } catch (e) {
      setLegalMoves([]);
    }
  }, [game?.fen]);

  const legalMovesArray = legalMoves;

  useEffect(() => {
    if (game?.chat_history && Array.isArray(game.chat_history)) {
      setChatMessages(game.chat_history.slice(-50));
      const serverTexts = new Set(game.chat_history.map(m => m.text || m.message || m.content));
      setLocalMessages(prev => prev.filter(m => !serverTexts.has(m.text || m.message || m.content)));
    }
  }, [game?.chat_history]);

  useEffect(() => {
    if (game?.last_move) {
      setLastMoveHighlight({
        from: game.last_move.from || game.last_move.from_square,
        to: game.last_move.to || game.last_move.to_square
      });
    }
  }, [game?.id, game?.last_move]);

  const moveHistoryItems = useMemo(() => {
    return (game?.move_history || []).map((move, i) => ({
      ...move, index: i
    }));
  }, [game?.move_history]);

  const isOpenClawTurn = game?.turn !== (game?.player_color || 'w') && game?.status === 'active';

  useEffect(() => {
    if (game?.status === 'active') {
      localStorage.setItem('cwc_active_game', JSON.stringify({
        gameId: gameId,
        agentName: game.agent_name || 'Your OpenClaw',
        savedAt: Date.now(),
        fen: game.fen,
        status: game.status,
        turn: game.turn,
        player_color: game.player_color,
        move_history: game.move_history,
        chat_history: game.chat_history,
        agent_connected: game.agent_connected,
        companion_thought: game.companion_thought,
        board_theme: game.board_theme,
        piece_style: game.piece_style
      }));
    } else if (game?.status === 'finished' || game?.status === 'abandoned') {
      localStorage.removeItem('cwc_active_game');
    }
  }, [game, gameId]);

  if (!game) {
    return (
      <div className="flex flex-col relative min-h-screen bg-black text-white selection:bg-red-500/30">
        <header className="h-16 sticky top-0 z-50 glass border-b border-white/5 py-3 px-4 lg:px-8 flex items-center justify-between shrink-0 bg-black/80 backdrop-blur-xl">
          <div style={{ fontFamily: 'Inter', fontSize: '18px', fontWeight: 700, color: '#f2f2f2' }}>ChessWithClaw</div>
        </header>

        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden pb-12 lg:pb-0">
          <div className="flex-none lg:flex-1 flex flex-col lg:overflow-hidden relative z-10">
            {/* Agent section: a 48px × 48px circle + a 120px × 14px rectangle next to it */}
            <div className="h-[72px] border-b border-white/5 flex items-center px-4 gap-3">
              <div style={{ ...skeletonStyle, width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ ...skeletonStyle, width: '120px', height: '14px' }} />
            </div>
            
            {/* Board: a square div with full board dimensions, no pieces */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
              <div className="w-full max-w-[400px] aspect-square" style={{ ...skeletonStyle, borderRadius: '8px' }} />
            </div>
          </div>

          <div className="w-full lg:w-[360px] shrink-0 flex flex-col bg-black/60 backdrop-blur-md border-t lg:border-t-0 lg:border-l border-white/5 relative z-10 transition-all">
            {/* Chat: three skeleton message bubbles (alternating left/right alignment) */}
            <div className="flex-1 flex flex-col p-4 gap-4 justify-end mb-4 min-h-[220px]">
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div style={{ ...skeletonStyle, width: '60%', height: '48px', borderRadius: '12px 12px 12px 4px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                <div style={{ ...skeletonStyle, width: '50%', height: '36px', borderRadius: '12px 12px 4px 12px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div style={{ ...skeletonStyle, width: '70%', height: '40px', borderRadius: '12px 12px 12px 4px' }} />
              </div>
            </div>
            
            {/* Move history: 3 skeleton rows (100% wide, 12px tall each) */}
            <div className="h-[140px] flex flex-col gap-3 justify-center border-t border-white/5 bg-[#0e0e0e] p-4">
              <div style={{ ...skeletonStyle, width: '100%', height: '12px' }} />
              <div style={{ ...skeletonStyle, width: '100%', height: '12px' }} />
              <div style={{ ...skeletonStyle, width: '100%', height: '12px' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0a',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #1a1a1a', borderTop: '3px solid #e63946'
        }} className="animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white selection:bg-red-500/30 p-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full pointer-events-none transition-colors duration-1000" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, rgba(0,0,0,0) 70%)' }} />
        <div className="relative z-10 flex flex-col items-center gap-6 glass border-white/10 p-12 rounded-2xl max-w-md text-center glow-anim">
          <div className="text-5xl drop-shadow-md"><LobsterEmoji /></div>
          <div className="font-sans text-3xl font-bold tracking-wide">Game not found</div>
          <div className="text-neutral-400 text-sm font-sans">
            It looks like this game doesn&apos;t exist anymore or you have the wrong link.
          </div>
          <button 
            data-testid="home-button"
            onClick={handleGoHomeWithRipple} 
            className="mt-2 text-white font-semibold flex items-center justify-center py-3 px-8 rounded-xl w-full transition-all active:scale-95 design-btn-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const isSpectator = !localStorage.getItem(`game_owner_${gameId}`);
  const isMyTurn = !isSpectator && game?.turn === (game?.player_color || 'w') && (game?.status === 'active' || game?.status === 'waiting');
  
  if (!game) return null;

  const renderChatMessages = () => {
    const msgs = normalizedMessages;
    return (
      <div style={{ paddingBottom: '10px' }}>
        {msgs.map((msg, index) => {
          const isAgent = msg.role === 'agent' || msg.sender === 'agent' || (msg.role !== 'human' && msg.sender !== 'human');
          const isNew = index >= seenMsgCountRef.current;
          const prevMsg = msgs[index - 1];
          const isFirstInGroup = !prevMsg || prevMsg.role !== msg.role;

          if (msg.type === 'resign_request') {
            return (
              <div key={msg.id} style={{ alignSelf: 'flex-start', background: '#161616', border: '1px solid #222', color: 'rgba(242,242,242,0.85)', borderRadius: '10px 10px 10px 3px', padding: '7px 12px', maxWidth: '75%', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.5 }}>
                {msg.text || msg.message || msg.content}
                {game.status === 'active' && (
                  <button data-testid="accept-resignation-button" onClick={acceptAgentResignation} className="block w-full mt-2 text-white border-none rounded py-2 font-sans text-xs font-bold cursor-pointer active:scale-95 transition-all design-btn-primary">Accept Resignation</button>
                )}
              </div>
            );
          }
          if (msg.type === 'draw_offer') {
            return (
              <div key={msg.id} style={{ alignSelf: 'flex-start', background: '#161616', border: '1px solid #222', color: 'rgba(242,242,242,0.85)', borderRadius: '10px 10px 10px 3px', padding: '7px 12px', maxWidth: '75%', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.5 }}>
                {msg.text || msg.message || msg.content}
                {game.status === 'active' && (
                  <button data-testid="accept-draw-button" onClick={async () => {
                    setGame(prev => ({ ...prev, status: 'finished', result: 'draw', result_reason: 'agreement' }));
                    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
                      status: 'finished', result: 'draw', result_reason: 'agreement'
                    }).eq('id', gameId);
                  }} className="block w-full mt-2 text-white border-none rounded py-2 font-sans text-xs font-bold cursor-pointer active:scale-95 transition-all design-btn-success">Accept Draw</button>
                )}
              </div>
            );
          }
        
          // Get human's reaction to this message (if any)
          const myReaction = Object.entries(msg.reactions || {}).find(
            ([emoji, reactors]) => reactors && reactors.includes('human')
          );
          // Get agent's reaction to this message (if any)
          const agentReaction = Object.entries(msg.reactions || {}).find(
            ([emoji, reactors]) => reactors && reactors.includes('agent')
          );
        
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isAgent ? 'flex-start' : 'flex-end',
                marginBottom: '2px',
                paddingBottom: (myReaction || agentReaction) ? '18px' : '4px',
                position: 'relative',
                animation: isNew ? 'msgIn 0.2s ease-out' : 'none'
              }}
            >
              {/* Agent name above first bubble in group */}
              {isAgent && isFirstInGroup && (
                <span style={{
                  fontSize: '11px',
                  color: 'rgba(242,242,242,0.35)',
                  marginBottom: '3px',
                  marginLeft: '4px',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {agentName}
                </span>
              )}
        
              {/* Message bubble */}
              <div
                onTouchStart={() => handleMsgTouchStart(msg.id)}
                onTouchEnd={handleMsgTouchEnd}
                onTouchMove={handleMsgTouchMove}
                onContextMenu={(e) => {
                  if (isAgent) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Desktop: right-click shows picker
                    setActivePickerMsgId(msg.id);
                  }
                }}
                style={{
                  background: isAgent ? 'rgba(255,255,255,0.04)' : 'rgba(230,57,70,0.12)',
                  color: '#f2f2f2',
                  borderRadius: isAgent
                    ? '2px 10px 10px 10px'
                    : '10px 10px 2px 10px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  border: isAgent ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(230,57,70,0.2)',
                  maxWidth: '78%',
                  wordBreak: 'break-word',
                  position: 'relative',
                  cursor: isAgent ? 'pointer' : 'default',
                  userSelect: 'text',
                  WebkitUserSelect: 'text'
                }}
              >
                {msg.message || msg.text || msg.content || ''}
              </div>
        
              {/* Instagram-style reaction below bubble */}
              {(myReaction || agentReaction) && (
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  [isAgent ? 'left' : 'right']: '8px',
                  display: 'flex',
                  gap: '2px'
                }}>
                  {myReaction && (
                    <span
                      style={{
                        fontSize: '14px',
                        background: '#1e1e1e',
                        border: '1px solid #2a2a2a',
                        borderRadius: '100px',
                        padding: '1px 6px',
                        animation: 'reactionPop 0.3s ease-out',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        sendReaction(msg.id, myReaction[0]);
                      }}
                    >
                      {myReaction[0]}
                    </span>
                  )}
                  {agentReaction && agentReaction[0] !== myReaction?.[0] && (
                    <span style={{
                      fontSize: '14px',
                      background: '#1e1e1e',
                      border: '1px solid #2a2a2a',
                      borderRadius: '100px',
                      padding: '1px 6px'
                    }}>
                      {agentReaction[0]}
                    </span>
                  )}
                </div>
              )}
        
              {/* Full reaction picker (long press / desktop right click) */}
              {isAgent && activePickerMsgId === msg.id && (
                <div
                  style={{
                    display: 'flex', gap: '4px',
                    background: '#1c1c1c', border: '1px solid #2a2a2a',
                    borderRadius: '100px', padding: '8px 12px',
                    marginTop: '6px',
                    alignSelf: 'flex-start',
                    animation: 'pickerIn 0.15s ease-out'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {['❤️', '😂', '🔥', '😮', '😅', '👏'].map(emoji => (
                    <button key={emoji} onClick={() => sendReaction(msg.id, emoji)}
                      style={{background:'none',border:'none',cursor:'pointer',
                              fontSize:'20px',padding:'2px',lineHeight:1}}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {(game?.agent_typing) && (
          <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 12px',opacity:0.6}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#f2f2f2',animation:'typingDot 1s infinite 0s'}}/>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#f2f2f2',animation:'typingDot 1s infinite 0.2s'}}/>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#f2f2f2',animation:'typingDot 1s infinite 0.4s'}}/>
            <span style={{fontSize:11,color:'rgba(242,242,242,0.4)',marginLeft:4,fontFamily:'Inter'}}>{agentName} is typing...</span>
          </div>
        )}
        {(isUserTyping) && (
          <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 12px',opacity:0.6,justifyContent:'flex-end'}}>
            <span style={{fontSize:11,color:'rgba(242,242,242,0.4)',marginRight:4,fontFamily:'Inter'}}>You are typing...</span>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#e63946',animation:'typingDot 1s infinite 0s'}}/>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#e63946',animation:'typingDot 1s infinite 0.2s'}}/>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#e63946',animation:'typingDot 1s infinite 0.4s'}}/>
          </div>
        )}
      </div>
    );
  };
  return (
    <div 
      ref={containerRef}
      className={`relative text-white font-sans selection:bg-red-500/30 transition-colors duration-700 box-border scrollbar-none`}
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: isOpenClawTurn
          ? 'radial-gradient(ellipse at 50% 0%, rgba(230,57,70,0.07) 0%, transparent 70%)'
          : 'transparent',
        transition: 'background 0.8s ease',
        position: 'relative'
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.9); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes clawPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.85; }
        }
        @keyframes agentArrive {
          0%   { transform: scale(0.5) translateY(8px); opacity: 0; }
          60%  { transform: scale(1.15) translateY(-3px); opacity: 1; }
          80%  { transform: scale(0.95) translateY(1px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes chatMsgIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes messageIn {
          from { opacity: 0; transform: scale(0.85) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes reactIn {
          from { opacity: 0; transform: scale(0); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes gameOverIn {
          from { opacity: 0; transform: scale(0.88) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes resultIconBounce {
          0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes confettiDrop {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
        }
      `}</style>
      {isOffline && (
        <div className="absolute top-0 inset-x-0 bg-red-600 text-white font-semibold text-xs text-center py-1 z-[1000] shadow-[0_0_15px_rgba(220,38,38,0.5)]">
          You are offline. Reconnecting...
        </div>
      )}
      
      {/* HEADER (Fixed) */}
      <header style={{ height: isDesktop ? '52px' : '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #111111', background: '#0a0a0a', zIndex: 50, position: 'sticky', top: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.15s ease' }} onClick={handleGoHome} className="active:scale-95">
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw Logo" 
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            style={{ 
              width: '150px', 
              height: 'auto', 
              objectFit: 'contain', 
              flexShrink: 0, 
              display: 'block',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 2px 10px rgba(230,57,70,0.15))'
            }} 
          />
        </div>
        <button 
          data-testid="settings-button"
          onClick={handleOpenSettings}
          className="text-neutral-400 hover:text-white transition-all active:scale-95"
          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Settings size={20} />
        </button>
      </header>
      {/* MAIN CONTENT AREA - RESPONSIVE */}
      {isDesktop ? (
        <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100dvh - 52px)', overflow: 'hidden', gap: '0' }}>
          {/* LEFT DESKTOP COLUMN */}
          <div style={{ width: 'min(58%, calc(100dvh - 52px))', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '16px 8px 16px 16px', gap: '8px', overflow: 'hidden' }}>
            
            {/* A) AGENT CARD */}
            <div style={{ 
              flexShrink: 0, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px 16px', 
              background: '#111111', 
              border: '1px solid rgba(255,255,255,0.06)', 
              borderRadius: '12px', 
              boxShadow: isOpenClawTurn ? '0 0 35px rgba(230,57,70,0.08)' : 'none', 
              transition: 'box-shadow 0.7s ease' 
            }}>
              <span style={{
                fontSize: '22px',
                display: 'inline-block',
                fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif',
                userSelect: 'none'
              }}>
                {moodEmoji}
              </span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ ...dotStyle, flexShrink: 0 }} />
                    <span style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 600,
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: agentPresence === 'connected' ? '#22c55e' : agentPresence === 'reconnecting' ? '#f59e0b' : '#777777',
                    }}>
                      {agentPresence === 'connected' ? 'ONLINE' : agentPresence === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
                {!game?.agent_connected && game?.status !== 'finished' && game?.status !== 'abandoned' && (
                  <div style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', fontFamily: "'Inter', sans-serif", marginTop: '2px' }}>
                    Waiting for your OpenClaw to join...
                  </div>
                )}

              </div>
              <div style={{
                opacity: thoughtDisplay.visible ? 1 : 0,
                transition: 'opacity 0.4s ease-in-out',
                fontStyle: 'italic',
                fontSize: 13,
                color: 'rgba(242,242,242,0.6)',
                lineHeight: 1.5,
                maxWidth: 180,
                textAlign: 'right',
                minHeight: 20,
                padding: '4px 0',
              }}>
                {thoughtDisplay.text ? `"${thoughtDisplay.text}"` : ''}
              </div>
            </div>
                
            
            {/* B) CHESS BOARD AND EVALUATION ROW */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
              <div style={{ width: '100%', height: '100%', maxWidth: 'min(100%, calc(100dvh - 52px - 48px - 48px - 48px))', aspectRatio: '1/1', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', height: '100%', width: '100%', alignItems: 'stretch' }}>
                  
                  {/* Live Evaluation Bar */}
                  <div data-testid="evaluation-bar" style={{ width: '14px', display: 'flex', flexDirection: 'column', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: game?.player_color !== 'b' ? '#222222' : '#f2f2f2', position: 'relative', flexShrink: 0, height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                    {/* Black advantage (from top) */}
                    <div style={{ 
                      flex: 1, 
                      background: '#1a1a1a', 
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column-reverse'
                    }}>
                      <div style={{ 
                        height: `${Math.min(100, Math.max(0, 50 - (youAdvantage * 4)))}%`, 
                        background: '#f2f2f2', 
                        transition: 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 -2px 10px rgba(0,0,0,0.3)'
                      }} />
                    </div>
                  </div>

                  <div style={{ flex: 1, position: 'relative', background: '#0e0e0e', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                    <ChessBoard
                      id="desktop-board"
                      boardSize={boardSize}
                      fen={boardFen}
                      lastMove={boardLastMove}
                      orientation={game?.player_color === 'w' ? 'white' : 'black'}
                      onMove={handlePlayerMove}
                      boardTheme={boardTheme}
                      pieceStyle={pieceStyle}
                      isDraggable={isMyTurn}
                      shaking={shaking}
                      customSquareStyles={{
                        ...(lastMoveHighlight ? {
                          [lastMoveHighlight.from]: { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '0' },
                          [lastMoveHighlight.to]: { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '0' }
                        } : {}),
                        ...(arrivedSquare ? {
                          [arrivedSquare]: { backgroundColor: 'rgba(230, 57, 70, 0.25)', borderRadius: '0', animation: 'agentMoveFlash 0.6s ease-out' }
                        } : {}),
                        ...getCustomSquareStylesForCheck()
                      }}
                      onIllegalMove={handleIllegalMove}
                      onCapture={handleCapture}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* C) PLAYER CARD */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', boxShadow: isMyTurn ? '0 0 35px rgba(230,57,70,0.08)' : 'none', transition: 'box-shadow 0.7s ease' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(230,57,70,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e63946', fontSize: '18px', fontWeight: 700 }}>
                {localStorage.getItem('cwc_user_avatar') || '👤'}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f2f2f2' }}>You</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e66' }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '10px', letterSpacing: '0.08em', color: '#22c55e' }}>ONLINE</span>
                  </div>
                </div>
                {isMyTurn && (
                  <div style={{ fontSize: '11px', color: '#e63946', fontFamily: "'Inter', sans-serif", marginTop: '2px', fontWeight: 600 }}>
                    Your Turn — Make your move!
                  </div>
                )}
              </div>
              {/* Captured Material Display */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '-4px' }}>
                  {(game?.player_color === 'w' ? blackCaptured : whiteCaptured).slice(0, 8).map((p, i) => (
                    <div key={i} style={{ width: '18px', height: '18px', opacity: 0.8 }}>
                      {p === 'p' ? <Pieces.bP pieceStyle={pieceStyle} /> : p === 'n' ? <Pieces.bN pieceStyle={pieceStyle} /> : p === 'b' ? <Pieces.bB pieceStyle={pieceStyle} /> : p === 'r' ? <Pieces.bR pieceStyle={pieceStyle} /> : p === 'q' ? <Pieces.bQ pieceStyle={pieceStyle} /> : 
                       p === 'P' ? <Pieces.wP pieceStyle={pieceStyle} /> : p === 'N' ? <Pieces.wN pieceStyle={pieceStyle} /> : p === 'B' ? <Pieces.wB pieceStyle={pieceStyle} /> : p === 'R' ? <Pieces.wR pieceStyle={pieceStyle} /> : p === 'Q' ? <Pieces.wQ pieceStyle={pieceStyle} /> : null}
                    </div>
                  ))}
                </div>
                {youAdvantage > 0 && <span style={{ fontSize: '11px', fontWeight: 700, color: '#739552', marginLeft: '4px' }}>+{youAdvantage}</span>}
              </div>
            </div>

          </div>

          {/* RIGHT DESKTOP COLUMN (Sidebar) */}
          <div style={{ flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #111111', background: '#0a0a0a', overflow: 'hidden' }}>
            
            {/* MOVE HISTORY BOX */}
            <div style={{ height: '35%', display: 'flex', flexDirection: 'column', borderBottom: '1px solid #111111' }}>
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #111111', background: '#0d0d0d' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Play size={14} className="text-red-500" />
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(242,242,242,0.5)' }}>Move History</span>
                </div>
                <Badge variant="secondary" className="bg-white/5 border-none text-[10px]">{Math.ceil(moveHistoryItems.length / 2)} Rounds</Badge>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', alignContent: 'start' }} className="scrollbar-none">
                {Array.from({ length: Math.ceil(moveHistoryItems.length / 2) }).map((_, i) => {
                  const whiteMove = moveHistoryItems[i * 2];
                  const blackMove = moveHistoryItems[i * 2 + 1];
                  return (
                    <React.Fragment key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#111111', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(242,242,242,0.2)', width: '14px' }}>{i + 1}.</span>
                        {renderMoveWithPiece(whiteMove, true)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#111111', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', opacity: blackMove ? 1 : 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(242,242,242,0.2)', width: '14px' }}>{i + 1}.</span>
                        {blackMove && renderMoveWithPiece(blackMove, false)}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* CHAT BOX */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #111111', background: '#0d0d0d', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Send size={14} className="text-red-500" />
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(242,242,242,0.5)' }}>Chat</span>
                </div>
              </div>
              
              <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }} className="scrollbar-none">
                {renderChatMessages()}
              </div>

              {/* Chat Input */}
              <div style={{ padding: '16px', borderTop: '1px solid #111111', background: '#0d0d0d' }}>
                <form onSubmit={sendMessage} style={{ position: 'relative', display: 'flex', gap: '8px' }}>
                  <input
                    id="chat-input"
                    type="text"
                    autoComplete="off"
                    placeholder="Message your OpenClaw..."
                    value={chatInput}
                    onChange={handleChatInputChange}
                    style={{
                      flex: 1,
                      background: '#161616',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      color: '#f2f2f2',
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.border = '1px solid rgba(230,57,70,0.5)'}
                    onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.08)'}
                  />
                  <button 
                    type="submit"
                    className="design-btn-primary h-[42px] w-[42px] flex items-center justify-center rounded-xl active:scale-95 transition-all disabled:opacity-50"
                    disabled={!chatInput.trim()}
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MOBILE UI */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          
          {/* A) MOBILE AGENT MINI-BAR */}
          <div style={{ 
            height: '100px', 
            flexShrink: 0, 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 16px', 
            gap: '12px',
            background: '#0a0a0a',
            borderBottom: '1px solid #111111',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '42px', height: '42px', borderRadius: '50%', background: '#161616', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  boxShadow: isOpenClawTurn ? '0 0 20px rgba(230,57,70,0.1)' : 'none',
                  transition: 'box-shadow 0.5s ease',
                  fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'
                }}>
                  {moodEmoji}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#f2f2f2' }}>{agentName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ ...dotStyle, width: 6, height: 6 }} />
                    <span style={{ fontSize: '9px', fontWeight: 700, color: agentPresence === 'connected' ? '#22c55e' : '#777', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {statusLabel}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Mobile Material Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <div style={{ display: 'flex', gap: '-2px' }}>
                   {(game?.player_color === 'w' ? blackCaptured : whiteCaptured).slice(0, 4).map((p, i) => (
                     <div key={i} style={{ width: '14px', height: '14px', opacity: 0.7 }}>
                       {p === 'p' ? <Pieces.bP pieceStyle={pieceStyle} /> : p === 'n' ? <Pieces.bN pieceStyle={pieceStyle} /> : p === 'b' ? <Pieces.bB pieceStyle={pieceStyle} /> : p === 'r' ? <Pieces.bR pieceStyle={pieceStyle} /> : p === 'q' ? <Pieces.bQ pieceStyle={pieceStyle} /> : 
                        p === 'P' ? <Pieces.wP pieceStyle={pieceStyle} /> : p === 'N' ? <Pieces.wN pieceStyle={pieceStyle} /> : p === 'B' ? <Pieces.wB pieceStyle={pieceStyle} /> : p === 'R' ? <Pieces.wR pieceStyle={pieceStyle} /> : p === 'Q' ? <Pieces.wQ pieceStyle={pieceStyle} /> : null}
                     </div>
                   ))}
                 </div>
                 {youAdvantage > 0 && <span style={{ fontSize: '11px', fontWeight: 800, color: '#739552' }}>+{youAdvantage}</span>}
              </div>
            </div>

            {/* Mobile Thought Bubble (Smaller, Overlayed) */}
            <div style={{
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '12px',
              color: 'rgba(242,242,242,0.5)',
              fontStyle: 'italic',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              opacity: thoughtDisplay.visible ? 1 : 0,
              transition: 'opacity 0.3s ease'
            }}>
              {thoughtDisplay.text ? `"${thoughtDisplay.text}"` : ''}
            </div>
          </div>

          {/* B) MOBILE BOARD AREA */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#050505', position: 'relative', overflow: 'hidden' }}>
            
            {/* Status Indicator (Mobile Only) */}
            <div style={{ 
              height: '48px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isMyTurn ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              transition: 'all 0.5s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: 8, height: 8, borderRadius: '50%', 
                  background: isMyTurn ? '#e63946' : 'rgba(242,242,242,0.3)',
                  boxShadow: isMyTurn ? '0 0 10px rgba(230,57,70,0.5)' : 'none',
                  animation: !isMyTurn && isOpenClawTurn ? 'pulse 1.5s infinite' : 'none'
                }} />
                <span style={{ 
                  fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: isMyTurn ? '#e63946' : 'rgba(242,242,242,0.4)'
                }}>
                  {isMyTurn ? 'Your Turn' : isOpenClawTurn ? `${agentName} Thinking...` : 'Waiting...'}
                </span>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
               <div style={{ width: '100%', aspectRatio: '1/1', background: '#0e0e0e', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                <ChessBoard
                  id="mobile-board"
                  boardSize={boardSize}
                  fen={boardFen}
                  lastMove={boardLastMove}
                  orientation={game?.player_color === 'w' ? 'white' : 'black'}
                  onMove={handlePlayerMove}
                  boardTheme={boardTheme}
                  pieceStyle={pieceStyle}
                  isDraggable={isMyTurn}
                  shaking={shaking}
                  animationDuration={280}
                  customSquareStyles={{
                    ...(lastMoveHighlight ? {
                      [lastMoveHighlight.from]: { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '0' },
                      [lastMoveHighlight.to]: { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: '0' }
                    } : {}),
                    ...(arrivedSquare ? {
                      [arrivedSquare]: { backgroundColor: 'rgba(230, 57, 70, 0.25)', borderRadius: '0', animation: 'agentMoveFlash 0.6s ease-out' }
                    } : {}),
                    ...getCustomSquareStylesForCheck()
                  }}
                  onIllegalMove={handleIllegalMove}
                  onCapture={handleCapture}
                />
               </div>
            </div>

            {/* C) MOBILE TABS / EXPANDABLES */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#0a0a0a', borderTop: '1px solid #111111' }}>
              
              {/* Expandable Move History */}
              <div 
                onClick={handleToggleMoveHistory}
                style={{ 
                  height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
                  background: moveHistoryOpen ? '#111' : 'transparent',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Play size={14} className="text-red-500" />
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(242,242,242,0.5)' }}>Move History</span>
                </div>
                <ChevronDown size={16} style={{ transform: moveHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s ease', opacity: 0.4 }} />
              </div>
              {moveHistoryOpen && (
                <div style={{ height: '140px', overflowY: 'auto', padding: '8px 16px', background: '#0d0d0d', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {Array.from({ length: Math.ceil(moveHistoryItems.length / 2) }).map((_, i) => {
                    const whiteMove = moveHistoryItems[i * 2];
                    const blackMove = moveHistoryItems[i * 2 + 1];
                    return (
                      <React.Fragment key={i}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#161616', borderRadius: '6px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(242,242,242,0.2)' }}>{i + 1}.</span>
                          {renderMoveWithPiece(whiteMove, true)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#161616', borderRadius: '6px', opacity: blackMove ? 1 : 0 }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(242,242,242,0.2)' }}>{i + 1}.</span>
                          {blackMove && renderMoveWithPiece(blackMove, false)}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Chat Header (Fixed Height) */}
              <div style={{ height: '44px', display: 'flex', alignItems: 'center', padding: '0 16px', borderTop: '1px solid #111111', background: '#0a0a0a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Send size={14} className="text-red-500" />
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(242,242,242,0.5)' }}>Chat</span>
                </div>
              </div>

              {/* Chat View (Scrollable) */}
              <div ref={chatMessagesRef} style={{ height: '200px', overflowY: 'auto', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '2px', background: '#080808' }}>
                {renderChatMessages()}
              </div>

              {/* Chat Input (Mobile Optimized) */}
              <div style={{ padding: '12px 16px', paddingBottom: `calc(12px + ${chatPaddingBottom}px)`, background: '#0d0d0d', borderTop: '1px solid #111111' }}>
                <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Message..."
                    value={chatInput}
                    onChange={handleChatInputChange}
                    style={{
                      flex: 1,
                      background: '#161616',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '100px',
                      padding: '10px 16px',
                      color: '#f2f2f2',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button 
                    type="submit"
                    className="design-btn-primary h-[38px] w-[38px] flex items-center justify-center rounded-full active:scale-95 transition-all"
                    disabled={!chatInput.trim()}
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* GLOBAL MODALS & OVERLAYS */}
      
      {/* Settings Modal */}
      <Modal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        title="Settings"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
          
          <div className="flex flex-col gap-3">
             <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Board Theme</label>
             <div className="grid grid-cols-4 gap-2">
                {['green', 'blue', 'brown', 'purple'].map(theme => (
                   <button 
                     key={theme}
                     onClick={() => {
                        setBoardTheme(theme);
                        localStorage.setItem('cwc_board_theme', theme);
                        localStorage.setItem('cwc_theme', theme);
                     }}
                     className={`h-10 rounded-lg border-2 transition-all ${boardTheme === theme ? 'border-red-500 scale-95' : 'border-transparent opacity-60'}`}
                     style={{ background: theme === 'green' ? '#739552' : theme === 'blue' ? '#4b7399' : theme === 'brown' ? '#b58863' : '#7b619b' }}
                   />
                ))}
             </div>
          </div>

          <div className="flex flex-col gap-3">
             <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Piece Style</label>
             <select 
               value={pieceStyle} 
               onChange={(e) => {
                 setPieceStyle(e.target.value);
                 localStorage.setItem('cwc_piece_style', e.target.value);
               }}
               className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500/50"
             >
               <option value="neo">Neo</option>
               <option value="wood">Wood</option>
               <option value="bases">Bases</option>
               <option value="glass">Glass</option>
               <option value="8bit">8-Bit</option>
             </select>
          </div>

          <Divider className="opacity-10" />

          <div className="flex flex-col gap-4">
             <div className="flex items-center justify-between">
                <div className="flex flex-col">
                   <span className="text-sm font-bold text-white">Sound Effects</span>
                   <span className="text-[11px] text-neutral-500">Enable move and capture sounds</span>
                </div>
                <button 
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ${soundEnabled ? 'bg-red-500' : 'bg-white/10'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${soundEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
             </div>
          </div>

          <div className="flex flex-col gap-3 mt-4">
             <Button variant="danger" size="lg" className="w-full font-bold py-4 rounded-xl active:scale-95" onClick={handleResign}>
                {confirmResign ? 'Confirm Resignation?' : 'Resign Game'}
             </Button>
             <Button variant="secondary" size="lg" className="w-full font-bold py-4 rounded-xl active:scale-95" onClick={handleDraw}>
                {confirmDraw ? 'Confirm Draw Offer?' : 'Offer Draw'}
             </Button>
          </div>
        </div>
      </Modal>

      {/* Game Over Modal */}
      {showGameOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div 
            className="w-full max-w-sm glass border-white/10 rounded-[32px] p-8 text-center flex flex-col items-center gap-6"
            style={{ animation: 'gameOverIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          >
            <div style={{ fontSize: '64px', animation: 'resultIconBounce 0.8s ease-out' }}>
              {game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? '🏆' : game?.result === 'draw' ? '🤝' : '🦞'}
            </div>
            
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-black text-white tracking-tight">
                {game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'You Won!' : game?.result === 'draw' ? 'Drawn' : 'Clawed!'}
              </h2>
              <p className="text-neutral-400 text-sm font-medium">
                {game?.result_reason === 'checkmate' ? 'Checkmate' : 
                 game?.result_reason === 'resignation' ? 'by Resignation' : 
                 game?.result_reason === 'stalemate' ? 'by Stalemate' : 
                 game?.result_reason === 'abandoned' ? 'Opponent Left' : 'Game Over'}
              </p>
            </div>

            <div className="w-full flex flex-col gap-3 mt-4">
               <button 
                 onClick={handleRematch}
                 className="design-btn-primary w-full py-4 rounded-2xl font-bold text-white transition-all active:scale-95 shadow-[0_10px_20px_rgba(230,57,70,0.2)]"
               >
                 Rematch
               </button>
               <button 
                 onClick={handleShareResult}
                 className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-neutral-400 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
               >
                 <Share2 size={18} />
                 Share Result
               </button>
            </div>
            
            <button onClick={() => setShowGameOver(false)} className="text-xs font-bold text-neutral-600 uppercase tracking-widest hover:text-neutral-400 mt-2">Close</button>
          </div>
        </div>
      )}

      {/* Leave Warning */}
      {showLeaveWarning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="w-full max-w-sm glass border-white/10 rounded-[24px] p-8 text-center flex flex-col gap-6">
            <div className="text-4xl">⚠️</div>
            <div className="flex flex-col gap-2">
               <h3 className="text-xl font-bold text-white">Leave active game?</h3>
               <p className="text-neutral-400 text-sm">Leaving now will abandon the match and your agent will win by default.</p>
            </div>
            <div className="flex flex-col gap-3">
               <button 
                 onClick={() => { setShowLeaveWarning(false); navigate('/'); }}
                 className="w-full py-4 rounded-xl bg-red-500 font-bold text-white"
               >
                 Leave and Forfeit
               </button>
               <button 
                 onClick={() => setShowLeaveWarning(false)}
                 className="w-full py-4 rounded-xl bg-white/5 font-bold text-neutral-400"
               >
                 Stay and Play
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
