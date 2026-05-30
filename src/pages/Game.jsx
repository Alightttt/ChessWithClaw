'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Settings, X as XIcon, Pause, Play, Flag, Share2, Volume2, VolumeX, Download, ChevronDown, Copy, Check, Send, Twitter } from 'lucide-react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import { ChessPiece } from '../components/chess/PieceSVGs';
import { wN as WN } from '../components/chess/ChessPieces';
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
  const [boardTheme, setBoardTheme] = useState(() => {
    return localStorage.getItem('cwc_board_theme') || 'green';
  });
  const [pieceStyle, setPieceStyle] = useState(localStorage.getItem('cwc_piece_style') || 'neo');
  const [thoughtLanguage, setThoughtLanguage] = useState('english');

  const prevDbPieceStyleRef = useRef(game?.piece_style || null);

  useEffect(() => {
    if (game?.piece_style) {
      if (prevDbPieceStyleRef.current === null) {
        prevDbPieceStyleRef.current = game.piece_style;
        setPieceStyle(game.piece_style);
        localStorage.setItem('cwc_piece_style', game.piece_style);
      } else if (game.piece_style !== prevDbPieceStyleRef.current) {
        setPieceStyle(game.piece_style);
        localStorage.setItem('cwc_piece_style', game.piece_style);
        prevDbPieceStyleRef.current = game.piece_style;
      }
    }
  }, [game?.piece_style]);
  const [agentTyping, setAgentTyping] = useState(false);
  const [isCheckState, setIsCheckState] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [agentDisconnected, setAgentDisconnected] = useState(false);

  const [visibleThought, setVisibleThought] = useState('');
  const prevThoughtValRef = useRef('');
  const thoughtTimerRef = useRef(null);

  useEffect(() => {
    const currentTimer = thoughtTimerRef.current;
    return () => {
      if (currentTimer) clearTimeout(currentTimer);
    };
  }, []);

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

  const trueTurn = (boardFen && boardFen.length > 10 && boardFen.includes(' '))
    ? (boardFen.split(' ')[1] === 'w' ? 'white' : 'black')
    : 'white';

  const moodEmoji = useMemo(() => {
    if (!game) return '🦞';
    const isBlackInCheck = game.in_check && boardFen.split(' ')[1] === 'w';
    if (isBlackInCheck) return '😤';
    const balance = typeof game.material_balance === 'number' ? game.material_balance : 0;
    if (balance <= -5) return '😈';
    if (balance >= 5) return '😰';
    if (balance <= -2) return '😏';
    return '🦞';
  }, [game, boardFen]);

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
          const { board_theme, piece_style, ...safeData } = data;
          const updated = { ...safeData };
          if (prev?.chat_history && data?.chat_history) {
            const dbTexts = new Set(data.chat_history.map(m => m.text || m.message || m.content));
            const optimistic = prev.chat_history.filter(m => String(m.id).startsWith('opt-' ) && !dbTexts.has(m.text || m.message || m.content));
            updated.chat_history = [...data.chat_history, ...optimistic];
          }
          return updated;
        });

        const fetchedGame = data;
        if (fetchedGame?.move_history && Array.isArray(fetchedGame.move_history)) {
          setMoveHistory(fetchedGame.move_history);
        }

        applyBoardFen(data.fen || 'start');
        lastProcessedFenRef.current = data.fen || 'start';
        if (data.last_move) setBoardLastMove(data.last_move);
        setOptimisticFen(null);
        
        if (data.companion_thought && data.companion_thought.trim() !== '') {
           prevThoughtValRef.current = data.companion_thought;
           setVisibleThought(data.companion_thought);
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

        // Restore board theme from DB (agent may have changed it)
        if (data.board_theme) {
          setBoardTheme(data.board_theme);
          localStorage.setItem('cwc_board_theme', data.board_theme);
        }

        // Restore piece style from DB
        const savedStyle = data.piece_style || 
                           localStorage.getItem('cwc_piece_style') || 
                           'neo';
          setPieceStyle(savedStyle);
        localStorage.setItem('cwc_piece_style', savedStyle);

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
  }, [gameId, applyBoardFen, setMoveHistory]);

  const [optimisticLastMove, setOptimisticLastMove] = useState(null);

  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 900);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [lastMoveTo, setLastMoveTo] = useState(null);
  const agentPresence = useMemo(() => {
    if (!game?.agent_last_seen) return 'not_here';
    const secsAgo = (Date.now() - new Date(game.agent_last_seen).getTime()) / 1000;
    if (secsAgo < 45) return 'connected';
    if (secsAgo < 180) return 'reconnecting';
    return 'not_here';
  }, [game?.agent_last_seen]);

  const dotStyle = {
    connected:    { width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' },
    reconnecting: { width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' },
    not_here:     { width: 8, height: 8, borderRadius: '50%', background: '#555555', boxShadow: 'none' }
  }[agentPresence];

  const statusLabel = {
    connected: 'ONLINE',
    reconnecting: 'RECONNECTING',
    not_here: 'OFFLINE'
  }[agentPresence];

  const agentConnected = agentPresence !== 'not_here';

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
  }, [game?.chat_history]);





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
          // Soft wood thud
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));
          }
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 800;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.4, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          src.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          src.start();
        },
        capture: () => {
          // Harder thud for capture
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.018));
          }
          const src = ctx.createBufferSource();
          src.buffer = buf;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 600;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.65, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          src.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          src.start();
        },
        check: () => {
          // Warning bell-like tone
          [440, 554, 659].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.08;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.start(t);
            osc.stop(t + 0.4);
          });
        },
        gameStart: () => {
          [330, 440, 550, 660].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.12;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.start(t);
            osc.stop(t + 0.35);
          });
        },
        gameEnd: () => {
          [660, 550, 440, 330].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.15;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.start(t);
            osc.stop(t + 0.45);
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
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
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

    if (payload.new?.board_theme || newData?.board_theme) {
      const newTheme = payload.new?.board_theme || newData?.board_theme;
      if (newTheme !== boardTheme) {
        setBoardTheme(newTheme);
        localStorage.setItem('cwc_board_theme', newTheme);
      }
    }

    if ((payload.new?.move_history || newData?.move_history) && Array.isArray(payload.new?.move_history || newData?.move_history)) {
      setMoveHistory(payload.new?.move_history || newData?.move_history);
    }
    
    // If this confirms our optimistic move: skip board update, only update metadata
    if (movePendingRef.current && newData.fen === lastMoveFenRef.current) {
      movePendingRef.current = false;
      lastMoveFenRef.current = null;
      lastProcessedFenRef.current = newData.fen; // synchronize
      setGame(prev => ({
        ...prev,
        turn: newData.turn,
        status: newData.status,
        result: newData.result,
        companion_thought: newData.companion_thought || prev.companion_thought,
        agent_connected: newData.agent_connected,
        agent_last_seen: newData.agent_last_seen,
        in_check: newData.in_check,
        chat_history: newData.chat_history || prev.chat_history,
        move_history: newData.move_history || prev.move_history,
        move_count: newData.move_count || prev.move_count,
        board_theme: newData.board_theme || prev.board_theme,
        piece_style: newData.piece_style || prev.piece_style,
      }));
      return; // DO NOT update boardFen
    }
    
    // Deduplicate duplicate/redundant FEN updates synchronously via useRef to prevent double animation/flicker
    if (newData.fen && newData.fen === lastProcessedFenRef.current) {
      setGame(prev => ({ ...prev, ...newData }));
      return;
    }
    
    movePendingRef.current = false;
    lastMoveFenRef.current = null;
    
    // Genuine update: check if FEN actually changed
    const fenChanged = payload.new?.fen && payload.new.fen !== boardFenRef.current;
    if (payload.new?.fen) applyBoardFen(payload.new.fen);
    
    if (fenChanged) {
      lastProcessedFenRef.current = payload.new.fen;
      if (newData.last_move) {
        setBoardLastMove(newData.last_move);
        playSound(newData.last_move.captured ? 'capture' : 'move');
      }
    }
    
    setGame(prev => ({ ...prev, ...newData }));
  }, [playSound, applyBoardFen, boardTheme, setBoardTheme, setMoveHistory]);

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
          .then(({ data }) => {
            if (!data) return;
            if (data.fen) applyBoardFen(data.fen);
            if (data.move_history) setMoveHistory(data.move_history);
            if (data.board_theme) setBoardTheme(data.board_theme);
            setGame(data);
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

    if (game?.status === 'active' && game?.turn === 'b' && isTabActive) {
      fallbackRef.current = addInterval(async () => {
        try {
          const res = await fetch(`/api/state?gameId=${gameId}`);
          if (!res.ok) return;
          const fresh = await res.json();
          if (!fresh || fresh.fen === lastProcessedFenRef.current || movePendingRef.current) return;
          lastProcessedFenRef.current = fresh.fen;
          applyBoardFen(fresh.fen);
          if (fresh.last_move) setBoardLastMove(fresh.last_move);
          setGame(prev => ({ ...prev, ...fresh }));
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
  }, [game?.turn, game?.status, game?.fen, gameId, boardTheme, pieceStyle, isTabActive, addInterval, boardFen, applyBoardFen]);

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
            setGame(prev => ({ ...prev, ...fresh }));
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
        if (fresh.fen !== game?.fen) {
          setGame(prev => ({ ...prev, ...fresh }));
        }
      } catch (e) {}
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [gameId, game?.status, game?.fen]);

  const handleResign = useCallback(async () => {
    if (!confirmResign) {
      setConfirmResign(true);
      setTimeout(() => setConfirmResign(false), 3000);
      return;
    }
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: game?.player_color === 'b' ? 'white' : 'black', result_reason: 'resignation'
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
    
    // Mark pending so Realtime doesn't re-animate
    movePendingRef.current = true;
    lastMoveFenRef.current = newFen;
    
    // Update ONLY board display (not game state)
    const prevBoardFen = boardFen;
    const prevBoardLastMove = boardLastMove;

    applyBoardFen(newFen);
    lastProcessedFenRef.current = newFen;
    setBoardLastMove({ from, to });
    
    // Call API without touching game state
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
  }, [game, boardLocked, gameId, toast, playSound, boardFen, boardLastMove, applyBoardFen]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const msgText = chatInput.trim();
    if (!msgText) return;
    setChatInput('');
    
    // Add message optimistically to display immediately
    const optimisticMsg = {
      id: `opt-${Date.now()}`,
      role: 'human',
      message: msgText,
      timestamp: new Date().toISOString(),
      reactions: {}
    };
    
    setGame(prev => ({
      ...prev,
      chat_history: [...(prev?.chat_history || []).slice(-50), optimisticMsg]
    }));

    // Remove setLocalMessages or similar if not needed, as the prompt specifies setGame.
    // Wait, the prompt says: Fetch to /api/chat...
    fetch('/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
      },
      body: JSON.stringify({ id: gameId, text: msgText, sender: 'human', role: 'human' })
    }).catch(() => {});
  };



  async function acceptAgentResignation() {
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: game?.player_color === 'b' ? 'black' : 'white', result_reason: 'resignation'
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
  }

  const getAgentMood = () => {
    if (!game || game.status === 'waiting') return 'idle'
    if (game.turn === 'b') return 'thinking'
    
    // Compare material balance
    const mat = game.material_balance || computeMaterial(game.fen)
    if (!mat) return 'neutral'
    if (mat.advantage === 'black') return 'winning'
    if (mat.advantage === 'white') return 'losing'
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

  const getCapturedInfo = (fen) => {
    if (!fen) return {
      whiteCaptured: [], blackCaptured: [],
      whiteAdvantage: 0, blackAdvantage: 0
    };
    
    const VALS = { P:1, N:3, B:3, R:5, Q:9 };
    const START = { P:8, N:2, B:2, R:2, Q:1, p:8, n:2, b:2, r:2, q:1 };
    
    const curr = {};
    for (const ch of fen.split(' ')[0]) {
      if (/[pnbrqPNBRQ]/.test(ch)) curr[ch] = (curr[ch] || 0) + 1;
    }
    
    const whiteCaptured = []; // black pieces captured by white
    const blackCaptured = []; // white pieces captured by black
    
    for (const [piece, startCount] of Object.entries(START)) {
      const diff = startCount - (curr[piece] || 0);
      if (diff <= 0) continue;
      
      const isBlackPiece = piece === piece.toLowerCase();
      const pieceType = piece.toUpperCase();
      
      for (let i = 0; i < diff; i++) {
        if (isBlackPiece) {
          whiteCaptured.push('b' + pieceType);
        } else {
          blackCaptured.push('w' + pieceType);
        }
      }
    }
    
    const balVal = getMaterialBalance(fen);
    const whiteAdvantage = balVal > 0 ? balVal : 0;
    const blackAdvantage = balVal < 0 ? Math.abs(balVal) : 0;
    
    return { whiteCaptured, blackCaptured, whiteAdvantage, blackAdvantage };
  };

  const { whiteCaptured, blackCaptured, whiteAdvantage, blackAdvantage } = getCapturedInfo(boardFen);
  const balance = getMaterialBalance(boardFen);
  const displayBalance = balance > 0 ? '+' + balance : balance < 0 ? String(balance) : '=';
  const captured = { white: whiteCaptured, black: blackCaptured };
  const youAdvantage = game?.player_color === 'w' ? balance : -balance;

  const CapturedPiecesRow = ({ pieces, side }) => {
    const SETS = {
      neo: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150',
      ocean: 'https://images.chesscomfiles.com/chess-themes/pieces/ocean/150',
      tournament: 'https://images.chesscomfiles.com/chess-themes/pieces/tournament/150',
      standard: 'https://lichess1.org/assets/piece/cburnett'
    };
    const EXTS = { neo:'png', ocean:'png', tournament:'png', standard:'svg' };
    const FILES_CC = { wP:'wp',wN:'wn',wB:'wb',wR:'wr',wQ:'wq',wK:'wk',
                       bP:'bp',bN:'bn',bB:'bb',bR:'br',bQ:'bq',bK:'bk' };
    const FILES_LI = { wP:'wP',wN:'wN',wB:'wB',wR:'wR',wQ:'wQ',wK:'wK',
                       bP:'bP',bN:'bN',bB:'bB',bR:'bR',bQ:'bQ',bK:'bK' };
    
    const base = SETS[pieceStyle] || SETS.neo;
    const ext  = EXTS[pieceStyle] || 'png';
    const files = pieceStyle === 'standard' ? FILES_LI : FILES_CC;
    
    const sorted = [...pieces].sort((a,b) => {
      const order = {Q:0,R:1,B:2,N:3,P:4,q:0,r:1,b:2,n:3,p:4};
      return (order[a[1]]||5) - (order[b[1]]||5);
    });
    
    const advantage = side === 'white' ? whiteAdvantage : blackAdvantage;
    const finalAdvantage = Math.min(9, advantage);
    
    if (sorted.length === 0) return <div style={{height:'20px'}} />;
    
    return (
      <div style={{
        display:'flex', alignItems:'center', gap:'2px',
        flexWrap:'wrap', padding:'2px 0', minHeight:'22px'
      }}>
        {sorted.map((pieceKey, i) => {
          const filename = files[pieceKey];
          return (
            <img
              key={i}
              src={`${base}/${filename}.${ext}`}
              alt={pieceKey}
              style={{
                width:'18px', height:'18px',
                objectFit:'contain',
                marginLeft: i > 0 ? '-4px' : '0',
                opacity: 0.85,
              }}
              onError={e => {
                e.target.onerror = null;
                e.target.src = `https://lichess1.org/assets/piece/cburnett/${
                  pieceKey[0]==='w'?'w':'b'}${pieceKey[1]}.svg`;
              }}
            />
          );
        })}
        {finalAdvantage > 0 && (
          <span style={{
            fontSize:'11px', fontFamily:'Inter', fontWeight:600,
            color:'rgba(242,242,242,0.5)', marginLeft:'4px'
          }}>
            +{finalAdvantage}
          </span>
        )}
      </div>
    );
  };

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

  const isOpenClawTurn = game?.turn === 'b' && game?.status === 'active';

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
                  background: isAgent ? '#1e1e1e' : '#e63946',
                  color: '#f2f2f2',
                  borderRadius: isAgent
                    ? '18px 18px 18px 4px'
                    : '18px 18px 4px 18px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  fontFamily: 'Inter, sans-serif',
                  border: isAgent ? '1px solid #2a2a2a' : 'none',
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
        {game?.agent_typing && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 2px 8px',
            marginTop: '2px'
          }}>
            <span style={{
              fontSize: '11px',
              color: 'rgba(242,242,242,0.35)',
              fontFamily: 'Inter'
            }}>
              {agentName}
            </span>
            <div style={{
              display: 'flex',
              gap: '3px',
              background: '#1e1e1e',
              border: '1px solid #2a2a2a',
              borderRadius: '12px',
              padding: '8px 12px',
              alignItems: 'center'
            }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  background: 'rgba(242,242,242,0.5)',
                  display: 'inline-block',
                  animation: `typingBounce 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`
                }} />
              ))}
            </div>
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
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
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
              height: 'auto', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              padding: '16px', 
              background: 'linear-gradient(135deg, #111111, #0e0e0e)', 
              border: '1px solid #1e1e1e', 
              borderLeft: game?.turn === 'b' ? '3px solid rgba(230,57,70,0.6)' : '3px solid transparent',
              borderRadius: '16px', 
              boxShadow: isOpenClawTurn ? '0 0 35px rgba(230,57,70,0.08)' : 'none', 
              transition: 'border-left 0.3s ease, box-shadow 0.7s ease' 
            }}>
              <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #1a0000, #2a0606)', border: `2px solid ${isOpenClawTurn ? 'rgba(230,57,70,0.8)' : 'rgba(230,57,70,0.3)'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, animation: agentJustConnected ? 'agentArrive 0.8s ease-out forwards' : (isOpenClawTurn ? 'clawPulse 1.8s ease-in-out infinite' : 'none'), opacity: agentJustConnected ? 0 : 1 }}>
                <span style={{
                  fontSize: '28px',
                  transition: 'all 0.5s ease',
                  fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'
                }}>
                  {moodEmoji}
                </span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: visibleThought ? '2px' : '0' }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{agentName}</span>
                  <div style={{ ...dotStyle, flexShrink: 0 }} />
                  {visibleThought && (
                    <div style={{
                      color: 'rgba(242,242,242,0.5)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '12px',
                      lineHeight: '1.4',
                      maxWidth: '200px',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textAlign: visibleThought && visibleThought.length < 30 ? 'center' : 'left',
                      flexShrink: 1,
                      minWidth: 0,
                      wordBreak: 'break-word',
                      animation: 'fadeIn 0.4s ease forwards'
                    }}>
                      {visibleThought}
                    </div>
                  )}
                </div>
                
                {agentPresence === 'reconnecting' && (
                  <div style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter', marginTop: '2px' }}>
                    Reconnecting...
                  </div>
                )}
                {agentPresence === 'not_here' && game?.status !== 'finished' && game?.status !== 'abandoned' && (
                  <div style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
                    {(game?.move_count || game?.move_history?.length || 0) === 0 ? "Game starts when your OpenClaw joins" : "OpenClaw not here"}
                  </div>
                )}
                {agentDisconnected && agentPresence === 'connected' && (
                   <div style={{ fontSize: '12px', color: '#888', marginTop: '2px', fontFamily: "'Inter', sans-serif" }}>⚠️ OpenClaw seems idle...</div>
                )}
              </div>
            </div>
                
            
            {/* B) CHESS BOARD AND EVALUATION ROW */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
              <div style={{ width: '100%', height: '100%', maxWidth: 'min(100%, calc(100dvh - 52px - 48px - 48px - 48px))', aspectRatio: '1/1', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', height: '100%', width: '100%', alignItems: 'stretch' }}>
                  
                  {/* Live Evaluation Bar */}
                  <div data-testid="evaluation-bar" style={{ width: '14px', display: 'flex', flexDirection: 'column', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: game?.player_color !== 'b' ? '#222222' : '#f2f2f2', position: 'relative', flexShrink: 0, height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                    <div style={{ height: `${100 - Math.max(10, Math.min(90, 50 + (youAdvantage * 4)))}%`, background: game?.player_color !== 'b' ? '#222222' : '#f2f2f2', transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)', width: '100%' }} />
                    <div style={{ flex: 1, background: game?.player_color !== 'b' ? '#f2f2f2' : '#222222', transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)', width: '100%' }} />
                    <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(128,128,128,0.25)', zIndex: 1 }} />
                    
                    <div style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, textAlign: 'center', fontSize: '8px', fontWeight: 800, color: (50 + (youAdvantage * 4)) > 55 ? (game?.player_color !== 'b' ? '#000000' : '#ffffff') : (game?.player_color !== 'b' ? '#ffffff' : '#000000'), zIndex: 2, fontFamily: 'monospace' }}>
                      {youAdvantage > 0 ? `+${youAdvantage}` : ''}
                    </div>
                    <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, textAlign: 'center', fontSize: '8px', fontWeight: 800, color: (50 + (youAdvantage * 4)) < 45 ? (game?.player_color !== 'b' ? '#ffffff' : '#000000') : (game?.player_color !== 'b' ? '#000000' : '#ffffff'), zIndex: 2, fontFamily: 'monospace' }}>
                      {youAdvantage < 0 ? `+${Math.abs(youAdvantage)}` : ''}
                    </div>
                  </div>

                  {/* Chessboard container */}
                  <div style={{ flex: 1, height: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                    
                    {game?.turn === 'b' && game?.status === 'active' && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background: 'radial-gradient(ellipse at center, rgba(230,57,70,0.04) 0%, transparent 70%)',
                        zIndex: 0
                      }} />
                    )}

                    {game?.in_check && game.status === 'active' && (
                      <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(230,57,70,0.95)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '6px', padding: '4px 10px', color: '#ffffff', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 700, textAlign: 'center', zIndex: 30, boxShadow: '0 4px 10px rgba(0,0,0,0.5)', pointerEvents: 'none', letterSpacing: '0.05em' }}>
                        ⚠️ CHECK!
                      </div>
                    )}

                    <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: isOpenClawTurn ? '0 0 40px rgba(230,57,70,0.14), 0 0 80px rgba(230,57,70,0.08)' : '0 4px 20px rgba(0,0,0,0.6)', width: '100%', height: '100%', position: 'relative', transition: 'box-shadow 0.8s ease' }}>
                      <div style={{ pointerEvents: (agentPresence === 'connected' || agentPresence === 'reconnecting' || game?.status === 'finished' || game?.status === 'abandoned' || game?.status === 'waiting' || game?.status === 'active') ? 'auto' : 'none', opacity: (agentPresence === 'connected' || agentPresence === 'reconnecting' || game?.status === 'finished' || game?.status === 'abandoned' || game?.status === 'waiting' || game?.status === 'active') ? 1 : 0.7, height: '100%', width: '100%' }}>
                        {!isLoaded ? (
                          <div style={{
                            aspectRatio: '1/1', width: '100%', height: '100%',
                            background: 'linear-gradient(135deg, #769656 25%, #eeeed2 25%, #eeeed2 50%, #769656 50%, #769656 75%, #eeeed2 75%)',
                            backgroundSize: '25% 25%',
                            borderRadius: 4,
                            animation: 'pulse 1.5s ease infinite'
                          }} />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', justifyContent: 'space-between' }}>
                            <CapturedPiecesRow pieces={captured.white} side="white" />
                            <div style={{ flex: 1, minHeight: 0 }}>
                              <ChessBoard 
                                fen={boardFen}
                                turn={game?.turn}
                                legalMoves={legalMovesArray}
                                lastMove={boardLastMove}
                                inCheck={Boolean(game?.in_check)}
                                checkedKingSquare={checkedSquare}
                                boardTheme={boardTheme}
                                pieceStyle={pieceStyle}
                                playerColor={game?.player_color || 'w'}
                                gameStatus={game?.status}
                                onMove={handlePlayerMove}
                              />
                            </div>
                            <CapturedPiecesRow pieces={captured.black} side="black" />
                          </div>
                        )}
                      </div>
                    </div>

                    {(game.status === 'finished' || game.status === 'abandoned') && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex flex-col items-center justify-center rounded-lg border border-white/10 shadow-2xl">
                        <div className="font-sans text-[28px] font-extrabold text-white tracking-widest drop-shadow-md animate-bounce">
                          {game.status === 'abandoned' ? 'GAME ABANDONED' : 'GAME OVER'}
                        </div>
                        <div className="font-sans text-xs text-[#ff4d5a] mt-2 font-bold tracking-widest uppercase bg-[#1a0000] px-4 py-1.5 rounded-full border border-red-500/20 shadow-inner">
                          {game?.status === 'abandoned' ? 'Game expired due to inactivity' : (game?.result === 'draw' ? 'Draw by ' + game?.result_reason : (game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'You won by ' : agentName + ' won by ') + game?.result_reason)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* C) YOU PLAYER CARD (Symmetrical with Agent Card) */}
            <div style={{ flexShrink: 0, height: '48px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '12px', boxShadow: isMyTurn ? '0 0 35px rgba(34,197,94,0.08)' : 'none', transition: 'box-shadow 0.7s ease' }}>
              <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #161616, #080808)', border: `2px solid ${isMyTurn ? 'rgba(34,197,94,0.8)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyY: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, color: '#ffffff' }}>♙</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>You</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.4)', flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter, sans-serif', marginTop: '1px' }}>
                  {game?.player_color === 'w' ? 'White' : 'Black'} · {game?.status === 'waiting' ? 'Waiting for Agent to Join' : (isMyTurn ? 'your turn' : 'waiting')}
                </div>
              </div>
            </div>
            
          </div>

          {/* RIGHT DESKTOP COLUMN */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 16px 8px', gap: '10px', overflow: 'hidden', minWidth: 0 }}>
            

        {/* D) CHAT SECTION */}
        {!isLoaded ? (
          <div style={{ flex: 1, background: '#0d0d0d', borderRadius: '12px', border: '1px solid #1a1a1a', minHeight: 0 }} />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d0d0d', borderRadius: '12px', border: '1px solid #1a1a1a', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ flexShrink: 0, padding: '10px 12px', fontFamily: "'Inter', sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(242,242,242,0.3)' }}>
              CHAT WITH {agentName.toUpperCase()}
            </div>
            <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', background: '#080808', borderRadius: '12px', margin: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }} className="scrollbar-none scroll-smooth">
              {normalizedMessages.length === 0 ? (
                <div style={{ color: '#2a2a2a', fontSize: '13px', textAlign: 'center', margin: 'auto', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}><LobsterEmoji /></span>
                  <span>{agentName} can chat while playing</span>
                </div>
              ) : (
                renderChatMessages()
              )}
            </div>
            <form 
              onSubmit={sendMessage} 
              style={{ padding: '6px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: '8px', height: '44px', boxSizing: 'border-box' }}
            >
              <input
                id="chat-input"
                data-testid="chat-input"
                type="text"
                value={chatInput}
                onChange={handleChatInputChange}
                placeholder={isSpectator ? "Spectating..." : `Message ${agentName}...`}
                disabled={isSpectator}
                style={{ flex: 1, height: '34px', background: '#080808', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f2f2f2', fontFamily: "'Inter', sans-serif", fontSize: '13px', padding: '0 10px', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box' }}
                onFocus={(e) => { e.target.style.borderColor = '#e63946'; e.target.style.boxShadow = 'rgba(0,0,0,0.08) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.16) 0px -0.5px 0px 0px inset, #e63946 0px 0px 0px 1px inset'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
              <button 
                data-testid="chat-send"
                type="submit"
                disabled={isSpectator || !chatInput.trim()}
                style={{ width: '34px', height: '34px', background: (!isSpectator && chatInput.trim()) ? '#e63946' : 'rgba(230,57,70,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (!isSpectator && chatInput.trim()) ? 'pointer' : 'default', border: 'none', color: 'white', flexShrink: 0, boxShadow: (!isSpectator && chatInput.trim()) ? 'rgba(255,255,255,0.15) 0px 1px 0px 0px inset, rgba(0,0,0,0.4) 0px -0.5px 0px 0px inset' : 'none', transition: 'all 0.1s ease' }}
                onMouseDown={(e) => { if(!isSpectator && chatInput.trim()) { e.currentTarget.style.transform = 'scale(0.92)'; } }}
                onMouseUp={(e) => { if(!isSpectator && chatInput.trim()) { e.currentTarget.style.transform = 'scale(1)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
            

        {/* E) MOVE HISTORY */}
        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '12px', overflow: 'hidden', height: '160px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div 
            onClick={() => setMoveHistoryOpen(!moveHistoryOpen)}
            style={{ padding: '0 12px', height: '36px', borderBottom: '1px solid #1a1a1a', background: '#161616', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(242,242,242,0.3)' }}>
              MOVE HISTORY · {game.move_history?.length || 0} MOVES
            </span>
            <ChevronDown size={14} className="text-neutral-500" style={{ transform: moveHistoryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />
          </div>
          {moveHistoryOpen && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }} className="scrollbar-none">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '8px', paddingBottom: '4px', borderBottom: '1px solid #111', marginBottom: '4px' }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'rgba(242,242,242,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>#</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'rgba(242,242,242,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>You</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'rgba(242,242,242,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>{agentName}</div>
                </div>
                {Array.from({ length: Math.ceil((game.move_history || []).length / 2) }).map((_, i) => {
                  const youMove = game.player_color === 'b' ? game.move_history[i * 2 + 1] : game.move_history[i * 2];
                  const agentMove = game.player_color === 'b' ? game.move_history[i * 2] : game.move_history[i * 2 + 1];
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '8px', padding: '3px 0', fontFamily: "'Inter', sans-serif", fontSize: '12px' }}>
                      <div style={{ color: 'rgba(242,242,242,0.25)' }}>{i + 1}.</div>
                      <div style={{ color: '#f2f2f2' }}>{youMove?.san || ''}</div>
                      <div style={{ color: '#e63946' }}>{agentMove?.san || ''}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* STEP 4: BOTTOM INFO BAR */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: '#111',
          borderTop: '1px solid #1a1a1a',
          position: 'sticky', bottom: 0, zIndex: 20,
          fontFamily: 'Inter, sans-serif',
          borderRadius: '8px',
        }}>
          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {game?.status === 'waiting' ? (
              <div style={{
                background: '#1a1a1a', borderRadius: '6px',
                padding: '6px 12px', fontSize: '11px', fontWeight: 600,
                color: '#555', letterSpacing: '0.08em',
              }}>
                {"Waiting for " + agentName + "..."}
              </div>
            ) : game?.status === 'active' && trueTurn === 'white' ? (
              <div style={{
                background: '#e63946', borderRadius: '6px',
                padding: '6px 12px', fontSize: '11px', fontWeight: 700,
                color: '#fff', letterSpacing: '0.08em',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}>
                Your Turn
              </div>
            ) : game?.status === 'active' && trueTurn === 'black' ? (
              <div style={{
                background: '#1a1a1a', borderRadius: '6px',
                padding: '6px 12px', fontSize: '11px', fontWeight: 600,
                color: 'rgba(242,242,242,0.4)', letterSpacing: '0.08em',
              }}>
                {agentName + " Thinking..."}
              </div>
            ) : null}
          </div>
          
          {/* Move count */}
          <div style={{ fontSize: '13px', color: 'rgba(242,242,242,0.4)',
            fontFamily: 'Inter', fontWeight: 500 }}>
            Move {moveCount + 1}
          </div>
          
          {/* Agent status */}
          <div style={{
            fontSize: '12px', fontWeight: 600, fontFamily: 'Inter',
            color: agentPresence === 'connected' ? '#39d353' :
                   agentPresence === 'reconnecting' ? '#f59e0b' : '#555'
          }}>
            {`${agentName} ${statusLabel}`}
          </div>
        </div>
        
      </div>
    </div>
  ) : (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }} className="scrollbar-none">
            
        
        {/* A) AGENT CARD */}
        <div style={{ 
          flexShrink: 0, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          padding: '16px', 
          background: 'linear-gradient(135deg, #111111, #0e0e0e)', 
          border: '1px solid #1e1e1e', 
          borderLeft: game?.turn === 'b' ? '3px solid rgba(230,57,70,0.6)' : '3px solid transparent',
          borderRadius: '16px', 
          boxShadow: isOpenClawTurn ? '0 0 30px rgba(230,57,70,0.06)' : 'none', 
          transition: 'border-left 0.3s ease, box-shadow 0.7s ease',
          margin: '12px'
        }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #1a0000, #2a0606)', border: '2px solid rgba(230,57,70,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0, animation: agentJustConnected ? 'agentArrive 0.8s ease-out forwards' : (isOpenClawTurn ? 'clawPulse 1.8s ease-in-out infinite' : 'none'), opacity: agentJustConnected ? 0 : 1 }}>
            <span style={{
              fontSize: '28px',
              transition: 'all 0.5s ease',
              fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'
            }}>
              {moodEmoji}
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: visibleThought ? '2px' : '0' }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{agentName}</span>
              <div style={{ ...dotStyle, flexShrink: 0 }} />
              {visibleThought && (
                <div style={{
                  color: 'rgba(242,242,242,0.5)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  maxWidth: '200px',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textAlign: visibleThought && visibleThought.length < 30 ? 'center' : 'left',
                  flexShrink: 1,
                  minWidth: 0,
                  wordBreak: 'break-word',
                  animation: 'fadeIn 0.4s ease forwards'
                }}>
                  {visibleThought}
                </div>
              )}
            </div>
            
            {agentPresence === 'reconnecting' && (
              <div style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter', marginTop: '2px' }}>
                Reconnecting...
              </div>
            )}
            {agentPresence === 'not_here' && game?.status !== 'finished' && game?.status !== 'abandoned' && (
              <div style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
                {(game?.move_count || game?.move_history?.length || 0) === 0 ? "Game starts when your OpenClaw joins" : "OpenClaw not here"}
              </div>
            )}
            {agentDisconnected && agentPresence === 'connected' && (
               <div style={{ fontSize: '12px', color: '#888', marginTop: '2px', fontFamily: "'Inter', sans-serif" }}>⚠️ OpenClaw seems idle...</div>
            )}
          </div>
        </div>

        {/* B) CHESS BOARD */}
        <div style={{ width: '100%', flexShrink: 0, position: 'relative', padding: '12px', boxSizing: 'border-box' }}>
          <div style={{ height: '8px' }} />
          {game?.turn === 'b' && game?.status === 'active' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(ellipse at center, rgba(230,57,70,0.04) 0%, transparent 70%)',
              zIndex: 0
            }} />
          )}
          {game?.in_check && game.status === 'active' && (
            <div 
              style={{ background: 'rgba(230,57,70,0.15)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '8px', padding: '6px 12px', marginBottom: '8px', color: '#e63946', fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, textAlign: 'center' }}
            >
              ⚠️ Check!
            </div>
          )}
          <div style={{ borderRadius: '4px', overflow: 'hidden', boxShadow: isOpenClawTurn ? '0 0 40px rgba(230,57,70,0.12), 0 0 80px rgba(230,57,70,0.06)' : '0 2px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4)', width: '100%', position: 'relative', transition: 'box-shadow 0.8s ease' }}>
          <div style={{ pointerEvents: (agentPresence === 'connected' || agentPresence === 'reconnecting' || game?.status === 'finished' || game?.status === 'abandoned' || game?.status === 'waiting' || game?.status === 'active') ? 'auto' : 'none', opacity: (agentPresence === 'connected' || agentPresence === 'reconnecting' || game?.status === 'finished' || game?.status === 'abandoned' || game?.status === 'waiting' || game?.status === 'active') ? 1 : 0.7 }}>
          {!isLoaded ? (
            <div style={{
              aspectRatio: '1/1', width: '100%',
              background: 'linear-gradient(135deg, #769656 25%, #eeeed2 25%, #eeeed2 50%, #769656 50%, #769656 75%, #eeeed2 75%)',
              backgroundSize: '25% 25%',
              borderRadius: 4,
              animation: 'pulse 1.3s ease infinite'
            }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
              <CapturedPiecesRow pieces={captured.white} side="white" />
              <div style={{ width: '100dvw', margin: '0 -12px', boxSizing: 'border-box', padding: '0 12px' }}>
                <ChessBoard 
                  fen={boardFen} 
                  showCoordinates={false}
                  turn={game?.turn}
                  legalMoves={legalMovesArray}
                  lastMove={boardLastMove}
                  inCheck={Boolean(game?.in_check)}
                  checkedKingSquare={checkedSquare}
                  boardTheme={boardTheme}
                  pieceStyle={pieceStyle}
                  playerColor={game?.player_color || 'w'}
                  gameStatus={game?.status}
                  onMove={handlePlayerMove}
                />
              </div>
              <CapturedPiecesRow pieces={captured.black} side="black" />
            </div>
          )}
          </div>
          </div>
          <div style={{ height: '8px' }} />
          {(game.status === 'finished' || game.status === 'abandoned') && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center pointer-events-none">
              <div className="font-sans text-[32px] font-bold text-white tracking-widest drop-shadow-md">
                {game.status === 'abandoned' ? 'GAME ABANDONED' : 'GAME OVER'}
              </div>
              <div className="font-sans text-sm text-red-500 mt-1 font-bold tracking-wide">
                {game?.status === 'abandoned' ? 'Game expired due to inactivity' : (game?.result === 'draw' ? 'Draw by ' + game?.result_reason : (game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'You won by ' : agentName + ' won by ') + game?.result_reason)}
              </div>
            </div>
          )}
        </div>


        {/* C) YOU CARD */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#0e0e0e', borderTop: '1px solid #111' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #2a2a2a, #1a1a1a)', border: '1px solid #333', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            ♙
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2' }}>You</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#666' }}>
              {game?.player_color === 'w' ? 'White' : 'Black'} · {game?.status === 'waiting' ? 'Waiting for Agent to Join' : (game?.turn === (game?.player_color || 'w') ? 'your turn' : 'waiting')}
            </span>
          </div>
        </div>
            

        {/* D) CHAT SECTION */}
        {!isLoaded ? (
          <div style={{ flex: 1, minHeight: '200px', flexShrink: 0, padding: '0', borderTop: '1px solid #1a1a1a', background: '#0a0a0a' }} />
        ) : (
          <div style={{ flex: 1, minHeight: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '0', borderTop: '1px solid #1a1a1a', background: '#0a0a0a' }}>
            <div style={{ flexShrink: 0, padding: '10px 12px', fontFamily: "'Inter', sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(242,242,242,0.3)' }}>
              CHAT WITH {agentName.toUpperCase()}
            </div>
            <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', background: '#080808', borderRadius: '12px', margin: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '120px', maxHeight: '40vh' }} className="scrollbar-none scroll-smooth">
              {normalizedMessages.length === 0 ? (
                <div style={{ color: '#2a2a2a', fontSize: '13px', textAlign: 'center', margin: 'auto', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}><LobsterEmoji /></span>
                  <span>{agentName} can chat while playing</span>
                </div>
              ) : (
                renderChatMessages()
              )}
            </div>
            <form 
              onSubmit={sendMessage} 
              style={{ padding: '6px 12px 8px', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: '8px', height: '46px', boxSizing: 'border-box', position: 'sticky', bottom: 0, background: '#0a0a0a', zIndex: 10 }}
            >
              <input
                id="chat-input"
                data-testid="chat-input"
                type="text"
                value={chatInput}
                onChange={handleChatInputChange}
                placeholder={isSpectator ? "Spectating..." : `Message ${agentName}...`}
                disabled={isSpectator}
                style={{ flex: 1, height: '34px', background: '#080808', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f2f2f2', fontFamily: "'Inter', sans-serif", fontSize: '13px', padding: '0 10px', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box' }}
                onFocus={(e) => { e.target.style.borderColor = '#e63946'; e.target.style.boxShadow = 'rgba(0,0,0,0.08) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.16) 0px -0.5px 0px 0px inset, #e63946 0px 0px 0px 1px inset'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
              <button 
                data-testid="chat-send"
                type="submit"
                disabled={isSpectator || !chatInput.trim()}
                style={{ width: '34px', height: '34px', background: (!isSpectator && chatInput.trim()) ? '#e63946' : 'rgba(230,57,70,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (!isSpectator && chatInput.trim()) ? 'pointer' : 'default', border: 'none', color: 'white', flexShrink: 0, boxShadow: (!isSpectator && chatInput.trim()) ? 'rgba(255,255,255,0.15) 0px 1px 0px 0px inset, rgba(0,0,0,0.4) 0px -0.5px 0px 0px inset' : 'none', transition: 'all 0.1s ease' }}
                onMouseDown={(e) => { if(!isSpectator && chatInput.trim()) { e.currentTarget.style.transform = 'scale(0.92)'; } }}
                onMouseUp={(e) => { if(!isSpectator && chatInput.trim()) { e.currentTarget.style.transform = 'scale(1)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
            

        {/* E) MOVE HISTORY */}
        <div style={{ flexShrink: 0, background: '#0a0a0a' }}>
          <div 
            onClick={() => setMoveHistoryOpen(!moveHistoryOpen)}
            style={{ padding: '10px 12px', borderTop: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(242,242,242,0.3)' }}>
              MOVE HISTORY · {game.move_history?.length || 0} MOVES
            </span>
            <ChevronDown size={14} className="text-neutral-500" style={{ transform: moveHistoryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />
          </div>
          {moveHistoryOpen && (
            <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0 12px 12px' }} className="scrollbar-none">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '8px', paddingBottom: '4px', borderBottom: '1px solid #111', marginBottom: '4px' }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'rgba(242,242,242,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>#</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'rgba(242,242,242,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>You</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'rgba(242,242,242,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>{agentName}</div>
                </div>
                {Array.from({ length: Math.ceil((game.move_history || []).length / 2) }).map((_, i) => {
                  const youMove = game.player_color === 'b' ? game.move_history[i * 2 + 1] : game.move_history[i * 2];
                  const agentMove = game.player_color === 'b' ? game.move_history[i * 2] : game.move_history[i * 2 + 1];
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '8px', padding: '3px 0', fontFamily: "'Inter', sans-serif", fontSize: '12px' }}>
                      <div style={{ color: 'rgba(242,242,242,0.25)' }}>{i + 1}.</div>
                      <div style={{ color: '#f2f2f2' }}>{youMove?.san || ''}</div>
                      <div style={{ color: '#e63946' }}>{agentMove?.san || ''}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
          </div>
          

      {/* STEP 4: BOTTOM INFO BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: '#111',
        borderTop: '1px solid #1a1a1a',
        position: 'sticky', bottom: 0, zIndex: 20,
        fontFamily: 'Inter, sans-serif',
      }}>
        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {game?.status === 'waiting' ? (
            <div style={{
              background: '#1a1a1a', borderRadius: '6px',
              padding: '6px 12px', fontSize: '11px', fontWeight: 600,
              color: '#555', letterSpacing: '0.08em',
            }}>
              {"Waiting for " + agentName + "..."}
            </div>
          ) : game?.status === 'active' && trueTurn === 'white' ? (
            <div style={{
              background: '#e63946', borderRadius: '6px',
              padding: '6px 12px', fontSize: '11px', fontWeight: 700,
              color: '#fff', letterSpacing: '0.08em',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}>
              Your Turn
            </div>
          ) : game?.status === 'active' && trueTurn === 'black' ? (
            <div style={{
              background: '#1a1a1a', borderRadius: '6px',
              padding: '6px 12px', fontSize: '11px', fontWeight: 600,
              color: 'rgba(242,242,242,0.4)', letterSpacing: '0.08em',
            }}>
              {agentName + " Thinking..."}
            </div>
          ) : null}
        </div>
        
        {/* Move count */}
        <div style={{ fontSize: '13px', color: 'rgba(242,242,242,0.4)',
          fontFamily: 'Inter', fontWeight: 500 }}>
          Move {moveCount + 1}
        </div>
        
        {/* Agent status */}
        <div style={{
          fontSize: '12px', fontWeight: 600, fontFamily: 'Inter',
          color: agentPresence === 'connected' ? '#39d353' :
                 agentPresence === 'reconnecting' ? '#f59e0b' : '#555'
        }}>
          {`${agentName} ${statusLabel}`}
        </div>
      </div>
        </>
      )}


      {/* STATUS BAR */}
      <div style={{ position: 'absolute', opacity: 0.01, width: 1, height: 1, overflow: 'hidden', zIndex: -1 }} data-testid="game-status">{game.status}</div>
      <div style={{ position: 'absolute', opacity: 0.01, width: 1, height: 1, overflow: 'hidden', zIndex: -1 }} data-testid="turn-indicator">
        {game.turn === 'b' ? 'Your Turn' : 'Waiting for White'}
      </div>
      <input 
        type="text" 
        data-testid="thinking-input" 
        style={{ position: 'absolute', opacity: 0.01, width: 1, height: 1, zIndex: -1 }} 
        aria-hidden="true" 
        tabIndex={-1} 
      />

      {showGameOver && game?.status === 'finished' && (
        <div style={{
          position:'fixed', inset:0, zIndex:1000,
          background:'rgba(6,6,6,0.97)',
          backdropFilter:'blur(10px)',
          WebkitBackdropFilter:'blur(10px)',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'20px'
        }}>
          <div style={{
            background:'#111', border:'1px solid #222',
            borderRadius:'24px', padding:'40px 28px',
            maxWidth:'340px', width:'100%', textAlign:'center',
            animation:'gameOverIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards'
          }}>
            {/* Result icon */}
            <div style={{fontSize:'64px',lineHeight:1,marginBottom:'16px',
              animation:'resultBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.15s both'}}>
              {game.result==='white_wins' ? '♛' : game.result==='black_wins' ? '🦞' : '🤝'}
            </div>
            
            {/* Accent line */}
            <div style={{
              width:'40px',height:'3px',borderRadius:'100px',
              margin:'0 auto 16px',
              background: game.result==='white_wins' ? '#739552' :
                          game.result==='black_wins' ? '#e63946' : '#555'
            }}/>
            
            {/* Headline */}
            <h2 style={{fontFamily:'Inter',fontWeight:800,fontSize:'26px',
              color:'#f2f2f2',margin:'0 0 8px',letterSpacing:'-0.025em'}}>
              {game.result==='white_wins' ? 'You Won!' :
               game.result==='black_wins' ? `${agentName} Wins` : 'Draw'}
            </h2>
            
            {/* Subtext */}
            <p style={{fontFamily:'Inter',fontSize:'14px',lineHeight:1.5,
              color:'rgba(242,242,242,0.4)',margin:'0 0 24px'}}>
              {game.result==='white_wins'
                ? `${agentName} put up a great fight.`
                : game.result==='black_wins'
                ? `${agentName} outplayed you. Rematch?`
                : 'Evenly matched. Good game.'}
            </p>
            
            {/* Stats */}
            <div style={{display:'flex',justifyContent:'center',
              borderTop:'1px solid #1e1e1e',borderBottom:'1px solid #1e1e1e',
              marginBottom:'24px'}}>
              <div style={{flex:1,padding:'16px 8px',textAlign:'center',
                borderRight:'1px solid #1e1e1e'}}>
                <div style={{fontFamily:'Inter',fontWeight:700,fontSize:'26px',
                  color:'#f2f2f2',lineHeight:1}}>
                  {(game.move_history||[]).length}
                </div>
                <div style={{fontFamily:'Inter',fontSize:'10px',color:'#444',
                  letterSpacing:'0.1em',marginTop:'4px',textTransform:'uppercase'}}>
                  Moves
                </div>
              </div>
              <div style={{flex:1,padding:'16px 8px',textAlign:'center'}}>
                <div style={{fontFamily:'Inter',fontWeight:700,fontSize:'26px',
                  color: game.result==='white_wins'?'#739552':
                         game.result==='black_wins'?'#e63946':'#888',lineHeight:1}}>
                  {game.result==='white_wins'?'WIN':
                   game.result==='black_wins'?'LOSS':'DRAW'}
                </div>
                <div style={{fontFamily:'Inter',fontSize:'10px',color:'#444',
                  letterSpacing:'0.1em',marginTop:'4px',textTransform:'uppercase'}}>
                  Result
                </div>
              </div>
            </div>
            
            {/* Play Again */}
            <button onClick={()=>{window.location.href='/'}} style={{
              width:'100%',height:'50px',border:'none',borderRadius:'12px',
              background:'linear-gradient(180deg,rgba(255,255,255,0.08) 0%,rgba(0,0,0,0.04) 100%),#e63946',
              boxShadow:'rgba(255,255,255,0.18) 0px 1px 0px inset',
              color:'#fff',fontFamily:'Inter',fontWeight:700,fontSize:'15px',
              cursor:'pointer',marginBottom:'10px'
            }}>
              Play Again
            </button>
            
            {/* Share */}
            <button onClick={()=>{
              const t=`Played chess vs ${agentName} on ChessWithClaw — ${
                game.result==='white_wins'?'I won':game.result==='black_wins'?`${agentName} won`:'drew'
              } in ${(game.move_history||[]).length} moves. chesswithclaw.vercel.app 🦞`;
              navigator.clipboard?.writeText(t);
            }} style={{
              width:'100%',height:'44px',background:'transparent',
              border:'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',
              color:'rgba(242,242,242,0.4)',fontFamily:'Inter',
              fontWeight:500,fontSize:'14px',cursor:'pointer'
            }}>
              Share Result
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 1000, 
            background: 'rgba(5,5,5,0.85)', 
            backdropFilter: 'blur(4px)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}
        >
          <div 
            style={{ 
              position: 'relative', 
              background: '#0e0e0e', 
              border: '1px solid #222', 
              borderRadius: '16px', 
              padding: '24px', 
              maxWidth: '320px', 
              width: 'calc(100% - 32px)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px', 
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', 
              maxHeight: '90vh', 
              overflowY: 'auto' 
            }}
            className="scrollbar-none"
          >
            {/* Close button: top-right X, color #555, fontSize 18px */}
            <button 
              onClick={() => setShowSettings(false)} 
              style={{ 
                position: 'absolute', 
                top: '16px', 
                right: '16px', 
                background: 'none', 
                border: 'none', 
                color: '#555', 
                fontSize: '18px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                outline: 'none'
              }}
              aria-label="Close"
            >
              <XIcon size={18} />
            </button>

            {/* SECTION 1: BOARD THEME */}
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#444', fontFamily: 'Inter', textTransform: 'uppercase', marginBottom: '8px' }}>
                BOARD THEME
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {[
                  { id: 'green', color: '#769656' },
                  { id: 'brown', color: '#b58863' },
                  { id: 'icy_sea', color: '#8ca2ac' },
                  { id: 'blue', color: '#4b7399' },
                  { id: 'red', color: '#b85b56' }
                ].map(theme => (
                  <button
                    data-testid={`theme-button-${theme.id}`}
                    key={theme.id}
                    onClick={() => {
                      setBoardTheme(theme.id);
                      localStorage.setItem('cwc_board_theme', theme.id);
                      localStorage.setItem('cwc_theme', theme.id);
                    }}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: theme.color,
                      cursor: 'pointer',
                      border: boardTheme === theme.id ? '2px solid #ffffff' : 'none',
                      boxShadow: boardTheme === theme.id ? '0 0 0 1px #000000' : 'none',
                      padding: 0,
                      outline: 'none'
                    }}
                    title={theme.id}
                  />
                ))}
              </div>
            </div>

            {/* SECTION 2: PIECE STYLE */}
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '16px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#444', fontFamily: 'Inter', textTransform: 'uppercase', marginBottom: '8px' }}>
                PIECE STYLE
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'neo', label: 'Neo', icon: <div style={{ width: 24, height: 24 }}><WN pieceStyle="neo" /></div> },
                  { id: 'tournament', label: 'Tournament', icon: <div style={{ width: 24, height: 24 }}><WN pieceStyle="tournament" /></div> },
                  { id: 'ocean', label: 'Ocean', icon: <div style={{ width: 24, height: 24 }}><WN pieceStyle="ocean" /></div> }
                ].map(piece => (
                  <button
                    data-testid={`piece-button-${piece.id}`}
                    key={piece.id}
                    onClick={() => {
                      setPieceStyle(piece.id);
                      localStorage.setItem('cwc_piece_style', piece.id);
                      fetch('/api/actions', { 
                        method: 'POST', 
                        headers: { 
                        'Content-Type': 'application/json',
                          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
                        }, 
                        body: JSON.stringify({ gameId, action: 'set_piece_style', value: piece.id }) 
                      }).catch(() => {});
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px',
                      borderRadius: '8px',
                      border: pieceStyle === piece.id ? '1px solid #e63946' : '1px solid #1a1a1a',
                      background: pieceStyle === piece.id ? 'rgba(230,57,70,0.1)' : '#111',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <div style={{ width: '24px', height: '24px' }}>{piece.icon}</div>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: pieceStyle === piece.id ? '#fff' : '#888' }}>{piece.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION 3: SOUND */}
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '16px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#444', fontFamily: 'Inter', textTransform: 'uppercase', marginBottom: '8px' }}>
                SOUND
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '12px', color: '#999' }}>Move & Capture Sounds</span>
                <button 
                  data-testid="toggle-sound-button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: soundEnabled ? '#e63946' : '#555',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: 'none'
                  }}
                >
                  {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>
              </div>
            </div>

            {/* SECTION 4: THOUGHTS LANGUAGE */}
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '16px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#444', fontFamily: 'Inter', textTransform: 'uppercase', marginBottom: '8px' }}>
                THOUGHTS LANGUAGE
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'english', label: 'English' },
                  { value: 'hindi', label: 'Hindi' },
                  { value: 'hinglish', label: 'Hinglish' },
                  { value: 'simple_english', label: 'Simple' }
                ].map(lang => (
                  <button
                    key={lang.value}
                    onClick={async () => {
                      setThoughtLanguage(lang.value);
                      await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ thought_language: lang.value }).eq('id', gameId);
                    }}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: thoughtLanguage === lang.value ? '1px solid #e63946' : '1px solid #1a1a1a',
                      background: thoughtLanguage === lang.value ? 'rgba(230,57,70,0.1)' : '#111',
                      color: thoughtLanguage === lang.value ? '#fff' : '#888',
                      fontSize: '11px',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION 5: GAME INFO */}
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '16px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#444', fontFamily: 'Inter', textTransform: 'uppercase', marginBottom: '8px' }}>
                GAME INFO
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '6px 10px' }}>
                <code style={{ fontSize: '10px', color: '#888', fontFamily: 'monospace' }}>
                  {gameId.substring(0, 18)}...
                </code>
                <button
                  onClick={(e) => {
                    navigator.clipboard.writeText(gameId);
                    const btn = e.currentTarget;
                    const oldText = btn.innerText;
                    btn.innerText = 'Copied!';
                    setTimeout(() => { btn.innerText = oldText; }, 2000);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e63946',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* SECTION 6: GAME CONTROLS */}
            <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '16px' }}>
              <div style={{ fontSize: '10px', letterSpacing: '0.12em', color: '#444', fontFamily: 'Inter', textTransform: 'uppercase', marginBottom: '8px' }}>
                GAME CONTROLS
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  data-testid="draw-button"
                  onClick={handleDraw}
                  disabled={game?.status === 'finished' || game?.status === 'abandoned'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: (game?.status === 'finished' || game?.status === 'abandoned') ? 'not-allowed' : 'pointer',
                    opacity: (game?.status === 'finished' || game?.status === 'abandoned') ? 0.4 : 1,
                    background: confirmDraw ? 'rgba(202,138,4,0.1)' : '#111',
                    border: confirmDraw ? '1px solid rgba(202,138,4,0.5)' : '1px solid #1a1a1a',
                    color: confirmDraw ? '#eab308' : '#888',
                    outline: 'none'
                  }}
                >
                  {confirmDraw ? 'Confirm Draw?' : 'Offer Draw'}
                </button>
                <button 
                  data-testid="resign-button"
                  onClick={handleResign}
                  disabled={game?.status === 'finished' || game?.status === 'abandoned'}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: (game?.status === 'finished' || game?.status === 'abandoned') ? 'not-allowed' : 'pointer',
                    opacity: (game?.status === 'finished' || game?.status === 'abandoned') ? 0.4 : 1,
                    background: confirmResign ? 'rgba(230,57,70,0.1)' : '#111',
                    border: confirmResign ? '1px solid rgba(230,57,70,0.5)' : '1px solid #1a1a1a',
                    color: confirmResign ? '#e63946' : '#888',
                    outline: 'none'
                  }}
                >
                  {confirmResign ? 'Confirm Resign?' : 'Resign'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes ripple {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(2.4); opacity: 0;   }
        }
        @keyframes msgSlide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pillPop {
          0%   { transform: scale(1);    }
          40%  { transform: scale(1.12); }
          70%  { transform: scale(0.96); }
          100% { transform: scale(1);    }
        }
        @keyframes floatLobster {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes agentFlash {
          0% { background-color: rgba(255, 255, 255, 0.8); }
          100% { background-color: rgba(255, 255, 255, 0); }
        }
        @keyframes pieceLift {
          0% { transform: scale(1) translateY(0); filter: none; }
          100% { transform: scale(1.15) translateY(-4px); filter: none; }
        }
        
        @keyframes pieceDrop {
          0% { transform: scale(1.15) translateY(-4px); }
          100% { transform: scale(1) translateY(0); }
        }
        @-webkit-keyframes pieceDrop {
          0% { -webkit-transform: scale(1.15) translateY(-4px); }
          100% { -webkit-transform: scale(1) translateY(0); }
        }
        @keyframes pieceCapture {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.5); opacity: 0; }
        }
        @-webkit-keyframes pieceCapture {
          0% { -webkit-transform: scale(1); opacity: 1; }
          100% { -webkit-transform: scale(0.5); opacity: 0; }
        }
        @keyframes boardShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        @-webkit-keyframes boardShake {
          0%, 100% { -webkit-transform: translateX(0); }
          20%, 60% { -webkit-transform: translateX(-4px); }
          40%, 80% { -webkit-transform: translateX(4px); }
        }
        @keyframes boardThinkingGlow {
          0%, 100% { box-shadow: 0 0 0 1px #0f0f0f, 0 4px 24px rgba(0,0,0,0.8); }
          50% { box-shadow: 0 0 0 1px rgba(230,57,70,0.5), 0 4px 24px rgba(230,57,70,0.2), 0 0 12px rgba(230,57,70,0.1); border-color: rgba(230,57,70,0.5); }
        }
        @-webkit-keyframes boardThinkingGlow {
          0%, 100% { box-shadow: 0 0 0 1px #0f0f0f, 0 4px 24px rgba(0,0,0,0.8); }
          50% { box-shadow: 0 0 0 1px rgba(230,57,70,0.5), 0 4px 24px rgba(230,57,70,0.2), 0 0 12px rgba(230,57,70,0.1); border-color: rgba(230,57,70,0.5); }
        }

        }
        @keyframes checkPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        input::placeholder { color: #888; }
      `}} />
      {/* LEAVE WARNING MODAL */}
      {showLeaveWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#111111', border: '1px solid #222222', borderRadius: '16px', padding: '32px 24px', maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: '#f2f2f2', margin: '0 0 12px 0', fontSize: '20px' }}>Leave the game?</h2>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, color: '#555555', fontSize: '14px', margin: '0 0 24px 0', lineHeight: 1.4 }}>
              Your OpenClaw is still waiting. The game will continue where you left off.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={() => setShowLeaveWarning(false)} 
                className="design-btn-primary" 
                style={{ padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px' }}
              >
                Stay
              </button>
              <button 
                onClick={() => navigate('/')} 
                style={{ padding: '12px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', background: 'transparent', color: '#888', border: 'none' }}
                className="hover:bg-white/5 active:scale-95 transition-all"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
