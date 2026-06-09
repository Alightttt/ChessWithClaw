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
  const unifiedSyncRef = useRef(null);
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
  const [chatMessages, setChatMessages] = useState(() => Array.isArray(game?.chat_history) ? game.chat_history.slice() : []);
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
    
    // Persistent thought message in chat
    setChatMessages(prev => {
      const exists = prev.find(m => m.type === 'thought' && m.text === text.trim());
      if (exists) return prev;
      return [...prev, {
        id: 'thought-' + Date.now(),
        type: 'thought',
        role: 'agent',
        sender: 'agent',
        text: text.trim(),
        timestamp: new Date().toISOString()
      }];
    });

    thoughtTimerRef.current = setTimeout(() => {
      setThoughtDisplay(prev => ({ ...prev, visible: false }));
    }, 4000);
  }, [setChatMessages]);
  
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

  const isOpenClawTurn = useMemo(() => {
    if (!game || !boardFen || !boardFen.includes(' ')) return false;
    const turn = boardFen.split(' ')[1];
    const agentColor = game.player_color === 'w' ? 'b' : 'w';
    return turn === agentColor;
  }, [game, boardFen]);

  const legalMovesArray = useMemo(() => {
    try {
      if (!boardFen || !boardFen.includes(' ')) return [];
      const chess = new Chess(boardFen);
      return chess.moves({ verbose: true });
    } catch (e) {
      return [];
    }
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
      if (baseAvatar === '🦞') return '🦞';
      return baseAvatar;
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
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      allIntervalsRef.current.forEach(clearInterval);
      allIntervalsRef.current.push(_intId);
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
            const dbIds = new Set(data.chat_history.map(m => String(m.id)));
            const optimistic = prev.chat_history.filter(m => String(m.id).startsWith('opt-') && !dbIds.has(String(m.id)));
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

        if (Array.isArray(data?.chat_history)) {
          setChatMessages(data.chat_history.slice(-50));
        }

        if (data.last_move?.from && data.last_move?.to) {
          setLastMoveHighlight({ 
            from: data.last_move.from, 
            to: data.last_move.to 
          });
        }

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

    const [viewState, setViewState] = useState({ isMobile: false, isDesktop: false });
  useEffect(() => {
    const handleResize = () => {
      setViewState({
        isMobile: window.innerWidth <= 600,
        isDesktop: window.innerWidth >= 900
      });
    };
    handleResize(); // Initialize correctly on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { isMobile, isDesktop } = viewState;
  const ANIM_DURATION = isMobile ? '0.28s' : '0.2s';
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
  }, []); 

  const sendReaction = async (msgId, emoji) => {
    setActivePickerMsgId(null);
    setGame(prev => {
      const updated = (prev?.chat_history || []).map((msg, idx) => {
        const id = msg.id || `cwc-msg-${idx}`;
        if (id !== msgId) return msg;
        const reactions = { ...(msg.reactions || {}) };
        const current = reactions[emoji] || [];
        const hasIt = current.includes('human');
        if (hasIt) {
          const newArr = current.filter(r => r !== 'human');
          if (newArr.length === 0) delete reactions[emoji];
          else reactions[emoji] = newArr;
        } else {
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
    localStorage.removeItem('chesswithclaw_active_game')
    setGame(null)
    setVisibleThought('')
    setLastMoveHighlight(null)
    setArrivedSquare(null)
    setLastMoveTo(null)
    setShowGameOver(false)
    connectedToastShown.current = false
    navigate('/')
  }

  const computeMaterial = useCallback((fen) => {
    if (!fen) return null;
    try {
      let chess;
      try {
        chess = new Chess(fen);
      } catch(e) {
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
  
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      let maxH, maxW;
      if (vw >= 1024) {
        const usedHeight = 52 + 64 + 100;
        maxH = vh - usedHeight;
        maxW = vw - 360 - 64;
      } else {
        const usedHeight = 52 + 100 + 48 + 44 + 44 + 24;
        maxH = vh - usedHeight;
        maxW = vw - 24;
      }
      const availableWidth = maxW - 24;
      setBoardSize(Math.max(280, Math.min(availableWidth, maxH, 800)));
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    calc();
    const observer = new ResizeObserver(() => { calc(); });
    if (containerRef.current) { observer.observe(containerRef.current); }
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', calc); }
    return () => {
      observer.disconnect();
      if (window.visualViewport) { window.visualViewport.removeEventListener('resize', calc); }
    };
  }, []);

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
      const timer = setTimeout(() => { setShowCommentary(false); }, 8000);
      return () => clearTimeout(timer);
    }
  }, [game?.last_commentary, game?.move_history?.length]);

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
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc1.type = 'sine'; osc1.frequency.setValueAtTime(320, ctx.currentTime);
          osc2.type = 'triangle'; osc2.frequency.setValueAtTime(150, ctx.currentTime);
          let noiseBuffer;
          try {
            const bufferSize = ctx.sampleRate * 0.008;
            noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
          } catch (e) {}
          const noiseNode = ctx.createBufferSource();
          const noiseGain = ctx.createGain();
          if (noiseBuffer) {
            noiseNode.buffer = noiseBuffer; noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.008);
            noiseNode.connect(noiseGain); noiseGain.connect(ctx.destination);
          }
          gainNode.gain.setValueAtTime(0.45, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc1.connect(gainNode); osc2.connect(gainNode); gainNode.connect(ctx.destination);
          osc1.start(); osc2.start(); if (noiseBuffer) noiseNode.start();
          osc1.stop(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.15);
        },
        capture: () => {
          const playThud = (time, freq, decay, vol) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(vol, time); gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(time); osc.stop(time + decay + 0.05);
          };
          const t = ctx.currentTime; playThud(t, 380, 0.04, 0.4); playThud(t + 0.035, 180, 0.13, 0.45);
          try {
            const bufferSize = ctx.sampleRate * 0.012; const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) { data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005)); }
            const noiseNode = ctx.createBufferSource(); noiseNode.buffer = noiseBuffer;
            const noiseGain = ctx.createGain(); noiseGain.gain.setValueAtTime(0.12, t);
            noiseNode.connect(noiseGain); noiseGain.connect(ctx.destination); noiseNode.start(t);
          } catch (e) {}
        },
        check: () => {
          const frequencies = [780, 1150, 1500];
          frequencies.forEach((freq, idx) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.14 - (idx * 0.03), ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(); osc.stop(ctx.currentTime + 0.4);
          });
        },
        gameStart: () => {
          [330, 440, 550, 660, 880].forEach((freq, i) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.06);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.06 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.35);
            osc.start(ctx.currentTime + i * 0.06); osc.stop(ctx.currentTime + i * 0.06 + 0.4);
          });
        },
        gameEnd: () => {
          [440, 330, 220].forEach((freq, i) => {
            const osc = ctx.createOscillator(); const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
            osc.start(ctx.currentTime + i * 0.12); osc.stop(ctx.currentTime + i * 0.12 + 0.6);
          });
        },
        connect: () => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.start(); osc.stop(ctx.currentTime + 0.3);
        },
        chat: () => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
          osc.frequency.value = 660; gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.start(); osc.stop(ctx.currentTime + 0.12);
        },
      };
      if (soundEnabled && sounds[resolvedType]) { sounds[resolvedType](); }
      setTimeout(() => ctx.close(), 1000);
    } catch (e) {}
  }, [soundEnabled]);

  useEffect(() => {
    if (!game) return;
    prevMoveCountRef.current = (game.move_history || []).length;
    prevStatusRef.current = game.status;
  }, [game]);

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

  

  useEffect(() => {
    if (game?.status === 'finished' || game?.status === 'abandoned') {
      localStorage.removeItem('chesswithclaw_active_game');
      setShowGameOver(true);
      if (game?.result === (game?.player_color === 'b' ? 'black' : 'white')) {
        setTimeout(() => { toast.success('Achievement Unlocked: Bot Slayer! 🏆'); }, 1500);
      }
    }
  }, [game?.status, game?.result, game?.player_color, toast]);

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
          setGame(prev => ({ ...prev, ...fresh }));
          if (fresh.status === 'finished' || fresh.status === 'abandoned') { setShowGameOver(true); }
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
    if (game.status === 'finished' || game.status === 'abandoned') { document.title = 'ChessWithClaw'; }
    else if (game.turn === (game?.player_color || 'w')) { document.title = '♟ Your Turn — ChessWithClaw'; }
    else { document.title = `⚡ ${agentName} Thinking...`; }
  }, [game]);

  useEffect(() => {
    if (game?.agent_connected) { connectedToastShown.current = true; }
  }, [game?.id]);

  useEffect(() => {
    if (game && prevAgentConnected.current === false && game.agent_connected === true && connectedToastShown.current === false) {
      const toastKey = `cwc_connected_${gameId}`;
      if (!sessionStorage.getItem(toastKey)) { toast.success(`${agentName} has arrived!`); sessionStorage.setItem(toastKey, '1'); }
      setJustConnected(true); setTimeout(() => setJustConnected(false), 1000); connectedToastShown.current = true;
    }
    if (game) { prevAgentConnected.current = game.agent_connected; }
  }, [game, toast, agentName, gameId]);
  
  const handleRealtimeUpdate = useCallback((payload) => {
    const newData = payload.new || payload;
    setGame(prev => {
      if (!prev) return prev;
      if (newData.move_history && prev.move_history && newData.move_history.length < prev.move_history.length) { return prev; }
      if (newData.board_theme) {
        const newTheme = newData.board_theme;
        if (newTheme !== boardTheme) { setBoardTheme(newTheme); localStorage.setItem('cwc_board_theme', newTheme); }
      }
      if (newData.piece_style) {
        const newPiece = newData.piece_style;
        if (newPiece !== pieceStyle) { setPieceStyle(newPiece); localStorage.setItem('cwc_piece_style', newPiece); }
      }
      if (Array.isArray(newData.move_history)) { setMoveHistory(newData.move_history); }
      if (Array.isArray(newData.chat_history)) { setChatMessages(newData.chat_history); }
      if (newData.companion_thought && newData.companion_thought !== '' && newData.companion_thought !== prevThoughtValRef.current) {
        prevThoughtValRef.current = newData.companion_thought; setCompanionThought(newData.companion_thought); showThought(newData.companion_thought);
      }
      if (movePendingRef.current && newData.fen === lastMoveFenRef.current) {
        movePendingRef.current = false; lastMoveFenRef.current = null; lastProcessedFenRef.current = newData.fen; return { ...prev, ...newData };
      }
      if (newData.fen && newData.fen === lastProcessedFenRef.current) { return { ...prev, ...newData }; }
      movePendingRef.current = false; lastMoveFenRef.current = null;
      const prevFen = boardFenRef.current; const newFen = newData.fen;
      if (newFen && newFen !== prevFen) {
        applyBoardFen(newFen); lastProcessedFenRef.current = newFen; if (newData.last_move) { setBoardLastMove(newData.last_move); }
        const playerColor = prev.player_color || 'w';
        if (!!newData.last_move && (newData.turn === playerColor)) {
          const isCapture = !!newData.last_move?.captured || (newData.last_move?.san && newData.last_move.san.includes('x')) || (typeof newData.last_move === 'string' && newData.last_move.includes('x'));
          const isCheck = Boolean(newData.in_check);
          setTimeout(() => { if (isCheck) { playSound('check'); } else if (isCapture) { playSound('capture'); } else { playSound('move'); } }, 50);
        }
      }
      return { ...prev, ...newData };
    });
  }, [playSound, applyBoardFen, boardTheme, pieceStyle, setMoveHistory, showThought]);

  useEffect(() => {
    if (!gameId) { setNotFound(true); setLoading(false); return; }
    loadGameData();
    const handleBeforeUnload = () => { getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId); };
    const handleVisibility = () => { if (document.visibilityState === 'visible') { lastKnownFenRef.current = null; loadGameData(); } };
    window.addEventListener('beforeunload', handleBeforeUnload); document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload); document.removeEventListener('visibilitychange', handleVisibility);
      try { getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId); } catch(e) {}
    };
  }, [gameId, loadGameData]);

  useEffect(() => {
    if (!gameId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel('game-' + gameId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: 'id=eq.' + gameId }, (payload) => handleRealtimeUpdate(payload.new || payload))
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [gameId, handleRealtimeUpdate]);

  

  
  const runUnifiedSync = useCallback(async () => {
    if (!gameId || !isTabActive) return;
    try {
      const res = await fetch(`/api/state?gameId=${gameId}`);
      if (!res.ok) return;
      const fresh = await res.json();
      if (!fresh || movePendingRef.current) return;
      
      setGame(prev => {
        if (!prev) return prev;
        if (fresh.status !== prev.status || fresh.turn !== prev.turn || fresh.fen !== prev.fen) {
           if (fresh.fen && fresh.fen !== lastProcessedFenRef.current) {
             lastProcessedFenRef.current = fresh.fen;
             applyBoardFen(fresh.fen);
           }
           if (fresh.last_move) setBoardLastMove(fresh.last_move);
           return { ...prev, ...fresh };
        }
        return prev;
      });
    } catch (e) {}
  }, [gameId, isTabActive, applyBoardFen]);

  
  useEffect(() => {
    if (!gameId || !isTabActive) return;
    if (unifiedSyncRef.current) clearInterval(unifiedSyncRef.current);

    const isWaitingForOpponent = game?.turn !== (game?.player_color || 'w') && (game?.status === 'active' || game?.status === 'waiting');
    const intervalMs = isWaitingForOpponent ? 2000 : 5000;

    unifiedSyncRef.current = setInterval(() => {
      runUnifiedSync();
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || '' },
        body: JSON.stringify({ id: gameId, role: 'human' })
      }).catch(() => {});
    }, intervalMs);

    return () => {
      if (unifiedSyncRef.current) {
        clearInterval(unifiedSyncRef.current);
        unifiedSyncRef.current = null;
      }
    };
  }, [gameId, isTabActive, game?.turn, game?.status, game?.player_color, runUnifiedSync]);

  const handleResign = useCallback(async () => {
    if (!confirmResign) { setConfirmResign(true); setTimeout(() => setConfirmResign(false), 3000); return; }
    const victimResult = game?.player_color === 'b' ? 'white' : 'black';
    setGame(prev => ({ ...prev, status: 'finished', result: victimResult, result_reason: 'resignation' }));
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ status: 'finished', result: victimResult, result_reason: 'resignation' }).eq('id', gameId);
    setShowSettings(false); setConfirmResign(false);
  }, [confirmResign, game?.player_color, gameId]);

  const handleDraw = useCallback(async () => {
    if (!confirmDraw) { setConfirmDraw(true); setTimeout(() => setConfirmDraw(false), 3000); return; }
    setGame(prev => ({ ...prev, status: 'finished', result: 'draw', result_reason: 'agreement' }));
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ status: 'finished', result: 'draw', result_reason: 'agreement' }).eq('id', gameId);
    setShowSettings(false); setConfirmDraw(false);
  }, [confirmDraw, gameId]);

  const handlePlayerMove = useCallback(async (from, to, promotion) => {
    if (!game || game.turn !== (game?.player_color || 'w') || (game.status !== 'active' && game.status !== 'waiting')) return;
    if (!agentConnected) { toast('Waiting for agent to connect...'); return; }
    if (boardLocked || submittingRef.current) return;
    if (!localStorage.getItem(`game_owner_${gameId}`)) { toast.error('You are not the creator of this game.'); return; }
    submittingRef.current = true; setBoardLocked(true);
    const moveStr = from + to + (promotion || '');
    let newFen = boardFen; let isCapture = false;
    try {
      const tempChess = new Chess(boardFen); const result = tempChess.move({ from, to, promotion: promotion || 'q' });
      if (result) { newFen = tempChess.fen(); isCapture = result.captured || result.san?.includes('x'); }
    } catch (e) { submittingRef.current = false; setBoardLocked(false); return; }
    movePendingRef.current = true; lastMoveFenRef.current = newFen;
    const prevBoardFen = boardFen; const prevBoardLastMove = boardLastMove;
    applyBoardFen(newFen); lastProcessedFenRef.current = newFen; setBoardLastMove({ from, to });
    playSound(isCapture ? 'capture' : 'move');
    try {
      const res = await fetch('/api/move', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || '' }, body: JSON.stringify({ id: gameId, move: moveStr, isHumanMove: true }) });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})); applyBoardFen(prevBoardFen); lastProcessedFenRef.current = prevBoardFen; setBoardLastMove(prevBoardLastMove); movePendingRef.current = false;
        if (errData.code === 'WAITING_FOR_AGENT') { toast(`Waiting for ${agentName} to join...`, { icon: <LobsterEmoji /> }); }
        else { toast.error(errData.error || 'Failed to submit move'); }
      } else {
        const result = await res.json().catch(() => ({}));
        if (result && result.game) { setGame(prev => ({ ...prev, ...result.game })); applyBoardFen(result.game.fen); lastProcessedFenRef.current = result.game.fen; setBoardLastMove(result.game.last_move); movePendingRef.current = false; }
      }
    } catch (e) { applyBoardFen(prevBoardFen); lastProcessedFenRef.current = prevBoardFen; setBoardLastMove(prevBoardLastMove); movePendingRef.current = false; } finally { submittingRef.current = false; setBoardLocked(false); }
  }, [game, boardLocked, gameId, toast, playSound, boardFen, boardLastMove, applyBoardFen, agentConnected, agentName]);

  const sendMessage = async (e) => {
    e?.preventDefault(); const msgText = chatInput.trim(); if (!msgText) return; setChatInput('');
    const optimisticMsg = { id: `opt-${Date.now()}`, role: 'human', sender: 'human', message: msgText, text: msgText, timestamp: new Date().toISOString(), reactions: {} };
    setLocalMessages(prev => [...prev, optimisticMsg]);
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || '' }, body: JSON.stringify({ gameId: gameId, game_id: gameId, text: msgText, sender: 'human', role: 'human' }) }).catch(() => {});
  };

  async function acceptAgentResignation() {
    const winnerResult = game?.player_color === 'b' ? 'black' : 'white';
    setGame(prev => ({ ...prev, status: 'finished', result: winnerResult, result_reason: 'resignation' }));
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ status: 'finished', result: winnerResult, result_reason: 'resignation' }).eq('id', gameId);
  }

  function handleGoHome() { if (game?.status === 'active') { setShowLeaveWarning(true); } else { navigate('/'); } }
  function handleOpenSettings() { setShowSettings(true) }
  function handleGoHomeWithRipple(e) { createRipple(e); handleGoHome(); }
  function handleChatInputChange(e) {
    setChatInput(e.target.value); setIsUserTyping(true);
    if (!userSentTypingRef.current) {
      userSentTypingRef.current = true;
      fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || '' }, body: JSON.stringify({ gameId, game_id: gameId, action: 'typing', typing: true, sender: 'human', role: 'human' }) }).catch(() => {});
    }
    if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
    userTypingTimerRef.current = setTimeout(() => {
      setIsUserTyping(false); userSentTypingRef.current = false;
      fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || '' }, body: JSON.stringify({ gameId, game_id: gameId, action: 'typing', typing: false, sender: 'human', role: 'human' }) }).catch(() => {});
    }, 2000);
  }

  const renderMoveWithPiece = (move, isWhiteMove) => {
    if (!move || !move.san) return '';
    let pieceChar = 'P'; const san = move.san;
    if (move.piece) { pieceChar = move.piece.toUpperCase(); }
    else if (san.startsWith('K') || san.includes('O-O')) { pieceChar = 'K'; }
    else if (san.startsWith('Q')) { pieceChar = 'Q'; }
    else if (san.startsWith('R')) { pieceChar = 'R'; }
    else if (san.startsWith('B')) { pieceChar = 'B'; }
    else if (san.startsWith('N')) { pieceChar = 'N'; }
    const componentKey = (isWhiteMove ? 'w' : 'b') + pieceChar; const Component = Pieces[componentKey] || Pieces[isWhiteMove ? 'wP' : 'bP'];
    let displayText = san; if (['K', 'Q', 'R', 'B', 'N'].includes(san[0])) { displayText = san.substring(1); }
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '16px', height: '16px', flexShrink: 0, opacity: 0.9 }}> <Component pieceStyle={pieceStyle} /> </div>
        <span style={{ color: '#f2f2f2', fontWeight: 500 }}>{displayText}</span>
      </div>
    );
  };

  const getAgentMood = () => {
    if (!game || game.status === 'waiting') return 'idle'
    const agentColor = game?.player_color === 'w' ? 'b' : 'w'; if (game.turn === agentColor) return 'thinking'
    const mat = game.material_balance || computeMaterial(game.fen); if (!mat) return 'neutral'
    if (mat.advantage === agentColor) return 'winning'; if (mat.advantage === (game?.player_color || 'w')) return 'losing'
    return 'neutral'
  }

  const { whiteCaptured, blackCaptured } = getCapturedPieces(boardFen);
  const balance = getMaterialBalance(boardFen);
  const mood = getAgentMood(); const config = moodConfig[mood];
  const isSpectator = !localStorage.getItem(`game_owner_${gameId}`);
  const isMyTurn = !isSpectator && game?.turn === (game?.player_color || 'w') && (game?.status === 'active' || game?.status === 'waiting');

  const moveHistoryItems = useMemo(() => {
    return (game?.move_history || []).map((move, i) => ({ ...move, index: i }));
  }, [game?.move_history]);

  function getMaterialBalance(fen) {
    const board = fen.split(' ')[0]; const values = { p: 1, n: 3, b: 3, r: 5, q: 9 }; let white = 0, black = 0;
    for (const ch of board) { const lower = ch.toLowerCase(); if (values[lower]) { if (ch === ch.toUpperCase()) white += values[lower]; else black += values[lower]; } }
    return white - black;
  }

  function getCapturedPieces(fen) {
    const start = { p:8, n:2, b:2, r:2, q:1 }; const board = (fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR').split(' ')[0];
    const cur = {P:0,N:0,B:0,R:0,Q:0,p:0,n:0,b:0,r:0,q:0}; for (const ch of board) { if (cur[ch] !== undefined) cur[ch]++; }
    const byCaptured = []; const wCaptured = [];
    ['p','n','b','r','q'].forEach(p => { const gone = start[p] - cur[p]; for (let i = 0; i < gone; i++) byCaptured.push(p); });
    ['P','N','B','R','Q'].forEach(p => { const gone = start[p.toLowerCase()] - cur[p]; for (let i = 0; i < gone; i++) wCaptured.push(p); });
    return { whiteCaptured: wCaptured, blackCaptured: byCaptured };
  }

  const renderChatMessages = () => {
    const msgs = normalizedMessages;
    return (
      <div style={{ paddingBottom: '10px' }}>
        {msgs.map((msg, index) => {
          const isAgent = msg.role === 'agent' || msg.sender === 'agent' || (msg.role !== 'human' && msg.sender !== 'human');
          const isNew = index >= seenMsgCountRef.current;
          const prevMsg = msgs[index - 1]; const isFirstInGroup = !prevMsg || prevMsg.role !== msg.role;
         if (msg.type === "thought") {
            return (
              <div key={msg.id} style={{ alignSelf: "center", margin: "8px 0", padding: "6px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "4px", maxWidth: "90%" }}>
                <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#666", marginBottom: "2px", textAlign: "center" }}>SYSTEM_THOUGHT_CAPTURE</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontStyle: "italic", textAlign: "center", lineHeight: 1.4 }}>{msg.text}</div>
              </div>
            );
          }
          if (msg.type === 'resign_request') {
            return (
              <div key={msg.id} style={{ alignSelf: 'flex-start', background: '#161616', border: '1px solid #222', color: 'rgba(242,242,242,0.85)', borderRadius: '10px 10px 10px 3px', padding: '7px 12px', maxWidth: '75%', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.5 }}>
                {msg.text || msg.message || msg.content}
                {game.status === 'active' && (
                  <button onClick={acceptAgentResignation} className="block w-full mt-2 text-white border-none rounded py-2 font-sans text-xs font-bold cursor-pointer active:scale-95 transition-all design-btn-primary">Accept Resignation</button>
                )}
              </div>
            );
          }
          if (msg.type === 'draw_offer') {
            return (
              <div key={msg.id} style={{ alignSelf: 'flex-start', background: '#161616', border: '1px solid #222', color: 'rgba(242,242,242,0.85)', borderRadius: '10px 10px 10px 3px', padding: '7px 12px', maxWidth: '75%', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.5 }}>
                {msg.text || msg.message || msg.content}
                {game.status === 'active' && (
                  <button onClick={async () => {
                    setGame(prev => ({ ...prev, status: 'finished', result: 'draw', result_reason: 'agreement' }));
                    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ status: 'finished', result: 'draw', result_reason: 'agreement' }).eq('id', gameId);
                  }} className="block w-full mt-2 text-white border-none rounded py-2 font-sans text-xs font-bold cursor-pointer active:scale-95 transition-all design-btn-success">Accept Draw</button>
                )}
              </div>
            );
          }
          const myReaction = Object.entries(msg.reactions || {}).find(([emoji, reactors]) => reactors && reactors.includes('human'));
          const agentReaction = Object.entries(msg.reactions || {}).find(([emoji, reactors]) => reactors && reactors.includes('agent'));
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isAgent ? 'flex-start' : 'flex-end', marginBottom: '2px', paddingBottom: (myReaction || agentReaction) ? '18px' : '4px', position: 'relative', animation: isNew ? 'msgIn 0.2s ease-out' : 'none' }}>
              {isAgent && isFirstInGroup && ( <span style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', marginBottom: '3px', marginLeft: '4px', fontFamily: 'Inter, sans-serif' }}> {agentName} </span> )}
              <div onTouchStart={() => handleMsgTouchStart(msg.id)} onTouchEnd={handleMsgTouchEnd} onTouchMove={handleMsgTouchMove} onContextMenu={(e) => { if (isAgent) { e.preventDefault(); e.stopPropagation(); setActivePickerMsgId(msg.id); } }}
                style={{ background: isAgent ? 'rgba(255,255,255,0.04)' : 'rgba(230,57,70,0.12)', color: '#f2f2f2', borderRadius: isAgent ? '2px 10px 10px 10px' : '10px 10px 2px 10px', padding: '10px 14px', fontSize: '13px', lineHeight: '1.5', fontFamily: 'Inter, sans-serif', fontWeight: 400, border: isAgent ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(230,57,70,0.2)', maxWidth: '78%', wordBreak: 'break-word', position: 'relative', cursor: isAgent ? 'pointer' : 'default', userSelect: 'text', WebkitUserSelect: 'text' }}>
                {msg.message || msg.text || msg.content || ''}
              </div>
              {(myReaction || agentReaction) && (
                <div style={{ position: 'absolute', bottom: '2px', [isAgent ? 'left' : 'right']: '8px', display: 'flex', gap: '2px' }}>
                  {myReaction && ( <span style={{ fontSize: '14px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '100px', padding: '1px 6px', animation: 'reactionPop 0.3s ease-out', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); sendReaction(msg.id, myReaction[0]); }} > {myReaction[0]} </span> )}
                  {agentReaction && agentReaction[0] !== myReaction?.[0] && ( <span style={{ fontSize: '14px', background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '100px', padding: '1px 6px' }}> {agentReaction[0]} </span> )}
                </div>
              )}
              {isAgent && activePickerMsgId === msg.id && (
                <div style={{ display: 'flex', gap: '4px', background: '#1c1c1c', border: '1px solid #2a2a2a', borderRadius: '100px', padding: '8px 12px', marginTop: '6px', alignSelf: 'flex-start', animation: 'pickerIn 0.15s ease-out' }} onClick={e => e.stopPropagation()} >
                  {['❤️', '😂', '🔥', '😮', '😅', '👏'].map(emoji => ( <button key={emoji} onClick={() => sendReaction(msg.id, emoji)} style={{background:'none',border:'none',cursor:'pointer', fontSize:'20px',padding:'2px',lineHeight:1}}> {emoji} </button> ))}
                </div>
              )}
            </div>
          );
        })}
        {(game?.agent_typing) && (
          <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 12px',opacity:0.6}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#f2f2f2',animation:'typingDot 1s infinite 0s'}}/> <div style={{width:6,height:6,borderRadius:'50%',background:'#f2f2f2',animation:'typingDot 1s infinite 0.2s'}}/> <div style={{width:6,height:6,borderRadius:'50%',background:'#f2f2f2',animation:'typingDot 1s infinite 0.4s'}}/>
            <span style={{fontSize:11,color:'rgba(242,242,242,0.4)',marginLeft:4,fontFamily:'Inter'}}>{agentName} is typing...</span>
          </div>
        )}
        {(isUserTyping) && (
          <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 12px',opacity:0.6,justifyContent:'flex-end'}}>
            <span style={{fontSize:11,color:'rgba(242,242,242,0.4)',marginRight:4,fontFamily:'Inter'}}>You are typing...</span>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#e63946',animation:'typingDot 1s infinite 0s'}}/> <div style={{width:6,height:6,borderRadius:'50%',background:'#e63946',animation:'typingDot 1s infinite 0.2s'}}/> <div style={{width:6,height:6,borderRadius:'50%',background:'#e63946',animation:'typingDot 1s infinite 0.4s'}}/>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={`relative text-white font-sans selection:bg-red-500/30 transition-colors duration-700 box-border scrollbar-none`} style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: isOpenClawTurn ? 'radial-gradient(ellipse at 50% 0%, rgba(230,57,70,0.07) 0%, transparent 70%)' : 'transparent', transition: 'background 0.8s ease', position: 'relative' }} >
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.9); } }
        @keyframes typingDot { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes clawPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.12); opacity: 0.85; } }
        @keyframes msgIn { from { opacity:0; transform:translateY(8px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes reactionPop { 0% { transform:scale(0); } 60% { transform:scale(1.3); } 100% { transform:scale(1); } }
        @keyframes pickerIn { from { opacity:0; transform:scale(0.8) translateY(4px); } to { opacity:1; transform:scale(1) translateY(0); } }
      `}</style>
      
      <header style={{ height: isDesktop ? '52px' : '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #111111', background: '#0a0a0a', zIndex: 50, position: 'sticky', top: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={handleGoHome} className="active:scale-95">
          <img src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" alt="ChessWithClaw Logo" draggable={false} style={{ width: '150px', height: 'auto', pointerEvents: 'none', filter: 'drop-shadow(0 2px 10px rgba(230,57,70,0.15))' }} />
        </div>
        <button onClick={handleOpenSettings} className="text-neutral-400 hover:text-white transition-all active:scale-95" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} >
          <Settings size={20} />
        </button>
      </header>

      {isDesktop ? (
        <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100dvh - 52px)', overflow: 'hidden', gap: '0' }}>
          <div style={{ width: 'min(58%, calc(100dvh - 52px))', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '16px 8px 16px 16px', gap: '8px', overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#111111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', boxShadow: isOpenClawTurn ? '0 0 35px rgba(230,57,70,0.08)' : 'none', transition: 'box-shadow 0.7s ease' }}>
              <span style={{ fontSize: '22px', fontFamily: 'serif', userSelect: 'none' }}>{moodEmoji}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f2f2f2' }}>{agentName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ ...dotStyle, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: agentPresence === 'connected' ? '#22c55e' : agentPresence === 'reconnecting' ? '#f59e0b' : '#777777' }}>
                      {agentPresence === 'connected' ? 'ONLINE' : agentPresence === 'reconnecting' ? 'RECONNECTING' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ opacity: thoughtDisplay.visible ? 1 : 0, transition: 'opacity 0.4s', fontStyle: 'italic', fontSize: 13, color: 'rgba(242,242,242,0.6)', maxWidth: 180, textAlign: 'right' }}> {thoughtDisplay.text ? `"${thoughtDisplay.text}"` : ''} </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
              <div style={{ width: '100%', height: '100%', maxWidth: 'min(100%, calc(100dvh - 52px - 48px - 48px - 48px))', aspectRatio: '1/1', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <ChessBoard boardSize={boardSize} fen={boardFen} onMove={handlePlayerMove} playerColor={game?.player_color || 'w'} lastMove={boardLastMove} checkedSquare={checkedSquare} legalMoves={legalMovesArray} pieceStyle={pieceStyle} boardTheme={boardTheme} />
              </div>
            </div>
            <div style={infoContainerStyle}> <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, marginRight: 10, animation: dotAnimation }} /> {infoState.label} </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #111111', background: '#050505' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ height: '44px', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #111111', background: '#0a0a0a' }}> <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(242,242,242,0.4)', textTransform: 'uppercase' }}>Live Chat</span> </div>
              <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}> {renderChatMessages()} </div>
              <form onSubmit={sendMessage} style={{ padding: '12px', background: '#0a0a0a', borderTop: '1px solid #111111', display: 'flex', gap: '8px' }}>
                <input id="chat-input" value={chatInput} onChange={handleChatInputChange} placeholder="Type a message..." style={{ flex: 1, background: '#111111', border: '1px solid #222', borderRadius: '8px', padding: '8px 12px', color: '#f2f2f2', fontSize: '14px', outline: 'none' }} />
                <button type="submit" style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}> <Send size={18} /> </button>
              </form>
            </div>
            <div style={{ height: '180px', display: 'flex', flexDirection: 'column', borderTop: '1px solid #111111', background: '#0a0a0a' }}>
              <div style={{ height: '40px', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #111111' }}> <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: 'rgba(242,242,242,0.3)', textTransform: 'uppercase' }}>Move History</span> </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                  {(Array.isArray(moveHistoryItems) ? moveHistoryItems.slice() : []).map((move, i) => (
                    <div key={i} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', background: '#111111', padding: '4px 8px', borderRadius: '4px' }}>
                      <span style={{ color: 'rgba(242,242,242,0.3)', width: '18px' }}>{Math.floor(i/2) + 1}{i%2 === 0 ? '.' : '...'}</span>
                      {renderMoveWithPiece(move, i % 2 === 0)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: '#0a0a0a', borderBottom: '1px solid #111111' }}>
            <span style={{ fontSize: '20px' }}>{moodEmoji}</span>
            <div style={{ flex: 1 }}> <span style={{ fontSize: '14px', fontWeight: 700 }}>{agentName}</span> </div>
            <div style={{ ...dotStyle }} />
          </div>
          <div style={{ flexShrink: 0, padding: '10px', display: 'flex', justifyContent: 'center', background: '#050505' }}>
            <div style={{ width: boardSize, height: boardSize, position: 'relative' }}>
              <ChessBoard boardSize={boardSize} fen={boardFen} onMove={handlePlayerMove} playerColor={game?.player_color || 'w'} lastMove={boardLastMove} checkedSquare={checkedSquare} legalMoves={legalMovesArray} pieceStyle={pieceStyle} boardTheme={boardTheme} />
            </div>
          </div>
          <div style={{ height: '80px', overflowX: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', background: '#0a0a0a', borderBottom: '1px solid #111111' }}>
            {(Array.isArray(moveHistoryItems) ? moveHistoryItems.slice() : []).map((move, i) => (
              <div key={i} style={{ flexShrink: 0, background: '#111111', border: '1px solid #222', borderRadius: '6px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(242,242,242,0.3)' }}>{Math.floor(i/2) + 1}{i%2 === 0 ? '.' : '...'}</span>
                {renderMoveWithPiece(move, i % 2 === 0)}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#000' }}>
            <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', fontMono: 'monospace', fontSize: '12px' }}> {renderChatMessages()} </div>
            <form onSubmit={sendMessage} style={{ padding: '8px', background: '#0a0a0a', borderTop: '1px solid #111111', display: 'flex', gap: '8px', paddingBottom: chatPaddingBottom > 0 ? chatPaddingBottom + 8 : 8 }}>
              <input id="chat-input" value={chatInput} onChange={handleChatInputChange} placeholder="Type..." style={{ flex: 1, background: '#111111', border: '1px solid #222', borderRadius: '20px', padding: '8px 16px', color: '#f2f2f2', fontSize: '14px', outline: 'none' }} />
              <button type="submit" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#e63946', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}> <Send size={16} /> </button>
            </form>
          </div>
        </div>
      )}

      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="SYSTEM_CONFIGURATION" className="!bg-black !border-red-600/50 !rounded-none" >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'monospace' }}>
          <section>
            <label style={{ color: '#e63946', fontSize: '10px', letterSpacing: '0.2em', display: 'block', marginBottom: '8px' }}>BOARD_THEME</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {['green', 'blue', 'dark', 'wood'].map(theme => (
                <button key={theme} onClick={() => setBoardTheme(theme)} style={{ padding: '8px', border: boardTheme === theme ? '1px solid #e63946' : '1px solid #222', background: boardTheme === theme ? 'rgba(230,57,70,0.1)' : 'transparent', color: '#fff', textTransform: 'uppercase', fontSize: '12px' }}> {theme} </button>
              ))}
            </div>
          </section>
          <section>
            <label style={{ color: '#e63946', fontSize: '10px', letterSpacing: '0.2em', display: 'block', marginBottom: '8px' }}>PIECE_SET</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {['neo', 'standard', 'classic'].map(style => (
                <button key={style} onClick={() => setPieceStyle(style)} style={{ padding: '8px', border: pieceStyle === style ? '1px solid #e63946' : '1px solid #222', background: pieceStyle === style ? 'rgba(230,57,70,0.1)' : 'transparent', color: '#fff', textTransform: 'uppercase', fontSize: '12px' }}> {style} </button>
              ))}
            </div>
          </section>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid #222', background: 'transparent', color: '#fff', fontSize: '12px', textTransform: 'uppercase' }}> <span>Audio Output</span> <span style={{ color: soundEnabled ? '#e63946' : '#444' }}>{soundEnabled ? '[ENABLED]' : '[MUTED]'}</span> </button>
            <button onClick={() => setThoughtLanguage(thoughtLanguage === 'english' ? 'claw' : 'english')} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid #222', background: 'transparent', color: '#fff', fontSize: '12px', textTransform: 'uppercase' }}> <span>Neural Language</span> <span style={{ color: '#e63946' }}>[{thoughtLanguage}]</span> </button>
          </section>
          <section style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #222' }}>
            <Button variant="danger" className="w-full !bg-red-950/20 !border-red-600/50 !text-red-500 !rounded-none" onClick={handleResign} > {confirmResign ? 'CONFIRM_TERMINATION?' : 'ABANDON_MISSION (RESIGN)'} </Button>
          </section>
        </div>
      </Modal>

      {showGameOver && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0a0a0a', border: '1px solid #e63946', width: '100%', maxWidth: '400px', padding: '32px', textAlign: 'center', animation: 'gameOverIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#f2f2f2', marginBottom: '8px', letterSpacing: '0.05em' }}>GAME_TERMINATED</h2>
            <p style={{ color: 'rgba(242,242,242,0.5)', fontSize: '14px', marginBottom: '24px', textTransform: 'uppercase' }}>{game?.result_reason || 'Unknown conclusion'}</p>
            <div style={{ fontSize: '14px', color: '#e63946', fontWeight: 700, marginBottom: '32px', padding: '12px', background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.2)' }}>
              {game?.result === 'draw' ? 'STALEMATE_DETECTED' : game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'VICTORY_ACHIEVED' : 'DEFEAT_RECORDED'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Button variant="primary" className="!rounded-none h-12" onClick={handleRematch}>NEW_CHALLENGE</Button>
              <button onClick={() => setShowGameOver(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(242,242,242,0.4)', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer', padding: '8px' }}>View Final Board</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const moodConfig = {
  idle: { label: 'Waiting...', color: '#555555' },
  thinking: { label: 'Thinking...', color: '#e63946' },
  winning: { label: 'Feeling good', color: '#739552' },
  losing: { label: 'Fighting back', color: '#c9b458' },
  neutral: { label: 'Equal game', color: '#888888' }
};
