'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Settings, X as XIcon, Pause, Play, Flag, Share2, Volume2, VolumeX, Download, ChevronDown, Copy, Check, Send, Twitter } from 'lucide-react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import { supabase, getSupabaseWithToken } from '../lib/supabase';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import StatusDot from '../components/ui/StatusDot';
import Divider from '../components/ui/Divider';
import Badge from '../components/ui/Badge';
import { useRipple } from '../hooks/useRipple';

const LobsterEmoji = () => <span style={{fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle:'normal'}}>🦞</span>;


export default function Game() {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

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

  const getMoodEmoji = useMemo(() => {
    if (!game || game.status !== 'active') return '🦞';
    
    const adv = game.material_balance?.advantage;
    const whiteMat = game.material_balance?.white || 0;
    const blackMat = game.material_balance?.black || 0;
    const diff = blackMat - whiteMat;
    
    if (game.in_check && game.turn === 'b') return '😤'; // agent in check
    if (diff >= 5) return '😈';  // agent winning significantly
    if (diff <= -5) return '😰'; // agent losing significantly
    return '🦞'; // default — not 🤔
  }, [game]);

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
      .cwc-msg-new { animation-play-state: running !important; -webkit-animation-play-state: running !important; }
      @media (prefers-reduced-motion: reduce) {
         .cwc-msg-new { animation-play-state: running !important; -webkit-animation-play-state: running !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const agentName = localStorage.getItem('cwc_agent_display_name') || game?.agent_name || 'Your OpenClaw';
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

  const getCapturedPieces = (fenString) => {
    const start = { w:{p:8,r:2,n:2,b:2,q:1}, b:{p:8,r:2,n:2,b:2,q:1} };
    const fen = fenString || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
    const pos = fen.split(' ')[0];
    const cur = { w:{p:0,r:0,n:0,b:0,q:0}, b:{p:0,r:0,n:0,b:0,q:0} };
    for (const c of pos) {
      if(c==='P')cur.w.p++;else if(c==='R')cur.w.r++;else if(c==='N')cur.w.n++;
      else if(c==='B')cur.w.b++;else if(c==='Q')cur.w.q++;
      else if(c==='p')cur.b.p++;else if(c==='r')cur.b.r++;else if(c==='n')cur.b.n++;
      else if(c==='b')cur.b.b++;else if(c==='q')cur.b.q++;
    }
    const byWhite={},byBlack={};
    for(const t of['p','r','n','b','q']){
      const w=start.b[t]-cur.b[t];if(w>0)byWhite[t]=w;
      const b=start.w[t]-cur.w[t];if(b>0)byBlack[t.toUpperCase()]=b;
    }
    return{byWhite,byBlack};
  };
  const PIECE_SYMBOLS = { P:'♙', R:'♖', N:'♘', B:'♗', Q:'♕', p:'♟', r:'♜', n:'♞', b:'♝', q:'♛' };
  const [notFound, setNotFound] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [agentSectionOpen, setAgentSectionOpen] = useState(false);
  const [moveHistoryOpen, setMoveHistoryOpen] = useState(false);
  
  const [boardSize, setBoardSize] = useState(320);
  const [boardTheme, setBoardTheme] = useState(
    localStorage.getItem('cwc_board_theme') || localStorage.getItem('cwc_theme') || 'green'
  );
  const [pieceTheme, setPieceTheme] = useState(() => {
    try {
      const cached = localStorage.getItem('cwc_active_game');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.gameId === gameId && parsed.piece_style) {
          return parsed.piece_style;
        }
      }
    } catch (e) {}
    return localStorage.getItem('cwc_pieces') || 'neo';
  });
  const [thoughtLanguage, setThoughtLanguage] = useState('english');

  const prevDbPieceStyleRef = useRef(game?.piece_style || null);

  useEffect(() => {
    if (game?.piece_style) {
      if (prevDbPieceStyleRef.current === null) {
        prevDbPieceStyleRef.current = game.piece_style;
        setPieceTheme(game.piece_style);
        localStorage.setItem('cwc_pieces', game.piece_style);
      } else if (game.piece_style !== prevDbPieceStyleRef.current) {
        setPieceTheme(game.piece_style);
        localStorage.setItem('cwc_pieces', game.piece_style);
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

  const [optimisticLastMove, setOptimisticLastMove] = useState(null);

  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 900);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [lastMoveTo, setLastMoveTo] = useState(null);
  const [agentConnected, setAgentConnected] = useState(false);

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
    const serverTexts = new Set((game?.chat_history || []).map(m => m.text || m.message || m.content));
    const combined = [
      ...(game?.chat_history || []),
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
  }, [game?.chat_history, localMessages]);

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
    setAgentConnected(false)
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
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const sounds = {
        move:       { freq: 440, type: 'square', duration: 0.08, vol: 0.15 },
        capture:    { freq: 200, type: 'sawtooth', duration: 0.15, vol: 0.2 },
        check:      { freq: 660, type: 'square', duration: 0.2, vol: 0.25 },
        gameStart:  { freq: 520, type: 'sine', duration: 0.3, vol: 0.2 },
        gameEnd:    { freq: 330, type: 'sine', duration: 0.5, vol: 0.2 },
        chat:       { freq: 880, type: 'sine', duration: 0.06, vol: 0.1 },
        connect:    { freq: 600, type: 'sine', duration: 0.25, vol: 0.15 },
      };
      
      let resolvedType = type;
      if (type === 'start') resolvedType = 'gameStart';
      else if (type === 'end' || type === 'checkmate' || type === 'agentCheckmate' || type === 'agentEnd') resolvedType = 'gameEnd';
      else if (type === 'agentCheck' || type === 'check') resolvedType = 'check';
      else if (type === 'agentCapture' || type === 'capture') resolvedType = 'capture';
      else if (type === 'agentMove' || type === 'move') resolvedType = 'move';
      
      const s = sounds[resolvedType] || sounds.move;
      osc.frequency.setValueAtTime(s.freq, ctx.currentTime);
      osc.type = s.type;
      gain.gain.setValueAtTime(s.vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + s.duration);
    } catch (e) {}
  }, [soundEnabled]);

  useEffect(() => {
    if (!game) return;
    const currentMoveCount = (game.move_history || []).length;
    if (currentMoveCount > prevMoveCountRef.current) {
      const runSoundLogic = () => {
        let chess;
        try {
          chess = new Chess();
        } catch(e) {
          chess = null;
        }
        if (chess && game.move_history && game.move_history.length > 0) {
          game.move_history.forEach(m => {
            try { chess.move(m.san); } catch (e) {}
          });
        } else if (chess && game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
          chess.load(game.fen);
        }
        if (chess) {
          const lastMove = game.move_history[currentMoveCount - 1];
          const isAgent = lastMove?.color === 'b';
          const isMate = chess.in_checkmate ? chess.in_checkmate() : chess.isCheckmate ? chess.isCheckmate() : false;
          const isCh = chess.in_check ? chess.in_check() : chess.isCheck ? chess.isCheck() : false;
          
          if (isMate) {
            playSound(isAgent ? 'agentCheckmate' : 'checkmate');
          } else if (isCh) {
            playSound(isAgent ? 'agentCheck' : 'check');
          } else if (lastMove && lastMove.san && lastMove.san.includes('x')) {
            playSound(isAgent ? 'agentCapture' : 'capture');
          } else {
            playSound(isAgent ? 'agentMove' : 'move');
          }
        }
      };
      runSoundLogic();
    }
    
    if (game.status === 'finished' && prevStatusRef.current !== 'finished') {
      const isAgentWinner = game.result === (game?.player_color === 'b' ? 'white' : 'black');
      playSound(isAgentWinner ? 'agentEnd' : 'end');
    }
    
    if (game.status === 'active' && prevStatusRef.current === 'waiting') {
      playSound('start');
    }
    
    if (game.current_thinking && !prevStatusRef.current_thinking) {
      playSound('agentThinking');
    }
    
    prevMoveCountRef.current = currentMoveCount;
    prevStatusRef.current = game.status;
    prevStatusRef.current_thinking = game.current_thinking;
  }, [game, playSound]);

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

    const prevChat = prevChatHistoryRef.current;
    const prevAgentMsgs = prevChat.filter(m => m.role === 'agent' || m.sender === 'agent' || (m.role !== 'human' && m.sender !== 'human'));
    const currentAgentMsgs = currentChat.filter(m => m.role === 'agent' || m.sender === 'agent' || (m.role !== 'human' && m.sender !== 'human'));
    
    if (currentAgentMsgs.length > prevAgentMsgs.length) {
      if (soundEnabled) playSound('chat');
    }
    
    prevChatHistoryRef.current = currentChat;
  }, [game?.chat_history, soundEnabled, playSound]);

  const agentTimeoutRef = useRef(null);
  useEffect(() => {
    agentTimeoutRef.current = setInterval(() => {
      if (!game?.agent_last_seen) return;
      const lastSeen = new Date(game.agent_last_seen);
      const secondsAgo = (Date.now() - lastSeen) / 1000;
      setAgentDisconnected(secondsAgo > 90);
    }, 15000);
    return () => clearInterval(agentTimeoutRef.current);
  }, [game?.agent_last_seen]);

  // Heartbeat & Idle Chat
  useEffect(() => {
    if (!game || game.status === 'finished' || game.status === 'abandoned' || game.turn === (game?.player_color || 'w')) {
      return;
    }
    
    const heartbeatInterval = setInterval(() => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({ id: gameId, role: 'human' })
      }).catch(() => {});
      
      // Poll game state if it's the agent's turn to catch missed real-time events
      if (game?.turn !== (game?.player_color || 'w') && game?.status === 'active') {
        supabase.from('games').select('turn, move_history').eq('id', gameId).single().then(({ data }) => {
          if (data && data.turn === (game?.player_color || 'w')) {
            // Agent made a move but we missed the event, trigger a full reload
            document.dispatchEvent(new Event('visibilitychange'));
          }
        });
      }
    }, 15000);

    const idleChatInterval = setInterval(() => {
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

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(idleChatInterval);
    };
  }, [game, game?.turn, game?.status, game?.agent_last_seen, game?.updated_at, game?.created_at, gameId]);

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
    if (game?.status === 'finished' || game?.status === 'abandoned') {
      if (gameOverPollingRef.current) {
        clearInterval(gameOverPollingRef.current);
        gameOverPollingRef.current = null;
      }
      return;
    }
    
    gameOverPollingRef.current = setInterval(async () => {
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
        gameOverPollingRef.current = null;
      }
    };
  }, [game?.status, gameId, game?.fen]);

  useEffect(() => {
    if (!game) return;
    const agentName = localStorage.getItem('cwc_agent_display_name') || game?.agent_name || 'Your OpenClaw';
    if (game.status === 'finished' || game.status === 'abandoned') {
      document.title = 'ChessWithClaw';
    } else if (game.turn === (game?.player_color || 'w')) {
      document.title = '♟ Your Turn — ChessWithClaw';
    } else {
      document.title = `⚡ ${agentName} Thinking...`;
    }
  }, [game]);

  // Auto-resignation timer
  useEffect(() => {
    if (!game || game.status !== 'active') return;
    const interval = setInterval(async () => {
      const isHumanTurn = game.turn === (game.player_color || 'w');
      const maxTimeMs = 15 * 60 * 1000; // 15 minutes
      const lastMoveTs = game.move_history?.length > 0 
        ? new Date(game.move_history[game.move_history.length - 1].created_at).getTime()
        : new Date(game.created_at).getTime();
        
      if (Date.now() - lastMoveTs > maxTimeMs) {
        // Current turn exceeded auto-resign timer
        if (!isHumanTurn) {
           await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`))
            .from('games')
            .update({
              status: 'abandoned',
              result: game.player_color || 'w',
              result_reason: 'abandoned'
            })
            .eq('id', gameId);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [game, gameId]);

  useEffect(() => {
    if (game?.agent_connected) {
      setAgentConnected(true);
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
      if (soundEnabled) playSound('connect');
      setJustConnected(true);
      setTimeout(() => setJustConnected(false), 1000);
      connectedToastShown.current = true;
    }
    if (game) {
      prevAgentConnected.current = game.agent_connected;
    }
  }, [game, toast, agentName, gameId, soundEnabled, playSound]);
  
  useEffect(() => {
    if (!gameId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const loadAndSubscribe = async () => {
      // Clean up existing subscription first
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Always load fresh state from API when (re)subscribing
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
              const optimistic = prev.chat_history.filter(m => String(m.id).startsWith('opt-') && !dbTexts.has(m.text || m.message || m.content));
              updated.chat_history = [...data.chat_history, ...optimistic];
            }
            return updated;
          });
          setOptimisticFen(null);
          
          if (data.companion_thought && data.companion_thought.trim() !== '') {
             prevThoughtValRef.current = data.companion_thought;
             setVisibleThought(data.companion_thought);
          }
        } else if (res.status === 404) {
          setNotFound(true);
        }
      } catch (e) {}
      setLoading(false);

      // Create new subscription
      const channel = supabase
        .channel(`cwc-game-${gameId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${gameId}`
          },
          (payload) => {
            const newData = payload.new;
            if (!newData) return;

            if (newData.status === 'finished' || newData.status === 'abandoned') {
              setShowGameOver(true);
            }

            if (newData.companion_thought && newData.companion_thought !== prevThoughtValRef.current && newData.companion_thought.trim() !== '') {
              prevThoughtValRef.current = newData.companion_thought;
              setVisibleThought(newData.companion_thought);
            }

            // Detect if this is an agent move arriving
            // Agent is Black ('b'). After agent moves, turn becomes 'w'
            const fenChanged = newData.fen &&
              newData.fen !== prevFenRef.current;
            const isAgentMoveLanding = fenChanged &&
              newData.turn === 'w' &&
              optimisticFenRef.current === null;

            if (isAgentMoveLanding) {
              // This is a real agent move - show animation + sound
              const toSquare = newData.last_move?.to ||
                newData.last_move?.to_square;
              if (toSquare) {
                setArrivedSquare(toSquare);
                setTimeout(() => setArrivedSquare(null), 600);
              }
              // Play appropriate sound
              if (newData.in_check) {
                playSound('check');
              } else if (newData.last_move && (newData.last_move.captured || newData.last_move.san?.includes('x'))) {
                playSound('capture');
              } else {
                playSound('move');
              }
            }

            // Update FEN ref
            if (newData.fen) {
              prevFenRef.current = newData.fen;
              lastKnownFenRef.current = newData.fen;
            }

            // Clear optimistic state
            setOptimisticFen(null);
            submittingRef.current = false;
            setBoardLocked(false);

            
            // Update last move highlight and flash arrived square
            if (fenChanged) {
              const agentMoveTo = newData.last_move?.to || newData.last_move?.to_square;
              setLastMoveHighlight({
                from: newData.last_move?.from || newData.last_move?.from_square,
                to: agentMoveTo
              });
              if (agentMoveTo) {
                setArrivedSquare(agentMoveTo);
                setTimeout(() => setArrivedSquare(null), 700);
              }
            }

            // Fetch fresh state to get moves from separate table
            fetch(`/api/state?gameId=${gameId}`).then(res => res.json()).then(freshData => {
              setGame(prev => {
                const { board_theme, piece_style, ...safeNewData } = newData;
                const updated = { ...prev, ...safeNewData };
                if (freshData.move_history) updated.move_history = freshData.move_history;
                if (freshData.chat_history) {
                  const dbTexts = new Set(freshData.chat_history.map(m => m.text || m.message || m.content));
                  const optimistic = (prev.chat_history || []).filter(m => String(m.id).startsWith('opt-') && !dbTexts.has(m.text || m.message || m.content));
                  updated.chat_history = [...freshData.chat_history, ...optimistic];
                }
                return updated;
              });
            }).catch(() => {
              setGame(prev => {
                const { board_theme, piece_style, ...safeNewData } = newData;
                const updated = { ...prev, ...safeNewData };
                return updated;
              });
            });
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Wait 3 seconds then reconnect
            setTimeout(() => loadAndSubscribe(), 3000);
          }
        });

      channelRef.current = channel;
    };

    loadAndSubscribe();
    
    const handleBeforeUnload = () => {
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastKnownFenRef.current = null;
        loadAndSubscribe();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
      try { getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId); } catch(e) {}
    };
  }, [gameId, playSound]);

  // Start fallback polling when it's agent's turn
  useEffect(() => {
    if (game?.turn !== 'b' || game?.status !== 'active') {
      if (fallbackRef.current) clearInterval(fallbackRef.current);
      return;
    }
    
    fallbackRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/state?gameId=${gameId}`);
        if (!res.ok) return;
        const fresh = await res.json();
        // Only update if FEN actually changed
        if (fresh.fen !== lastKnownFenRef.current) {
          lastKnownFenRef.current = fresh.fen;
          setGame(prev => {
            const { board_theme, piece_style, ...safeFresh } = fresh;
            return { ...prev, ...safeFresh };
          });
        }
        if (fresh.status === 'finished' || fresh.status === 'abandoned') {
          setShowGameOver(true);
        }
      } catch (e) {}
    }, 1000);
    
    return () => {
      if (fallbackRef.current) clearInterval(fallbackRef.current);
    };
  }, [game?.turn, game?.status, gameId]);

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

  const makeMove = useCallback(async (from, to, promotion) => {
    if (!game || game.turn !== (game?.player_color || 'w') || (game.status !== 'active' && game.status !== 'waiting')) return;
    if (boardLocked || submittingRef.current) return;
    
    const agentName = localStorage.getItem('cwc_agent_display_name') || game?.agent_name || 'Your OpenClaw';
    
    if (!localStorage.getItem(`game_owner_${gameId}`)) {
      toast.error('You are not the creator of this game.');
      return;
    }

    submittingRef.current = true;
    setBoardLocked(true);
    let chess;
    try {
      chess = new Chess();
    } catch(e) {
      chess = null;
    }
    if (chess && game.move_history && game.move_history.length > 0) {
      game.move_history.forEach(m => {
        try { chess.move(typeof m === 'string' ? m : (m.san || m)); } catch (e) {}
      });
    } else if (chess && game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      chess.load(game.fen);
    }
    
    try {
      const moveObj = promotion ? { from, to, promotion } : { from, to };
      const move = chess ? chess.move(moveObj) : null;
      if (!move) {
        submittingRef.current = false;
        setBoardLocked(false);
        setOptimisticFen(null);
        setOptimisticLastMove(null);
        return;
      }
      
      const newFen = chess.fen();
      setOptimisticFen(newFen);
      setOptimisticLastMove({ from, to });
      setLastMoveHighlight({ from, to });
      
      if (soundEnabled) {
        if (move.captured) {
          playSound('capture');
        } else {
          playSound('move');
        }
        if (chess.in_check && chess.in_check()) {
          setTimeout(() => {
            playSound('check');
          }, 150);
        }
      }

      const prevFen = game.fen;
      const gameIdValue = gameId;

      fetch('/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({
          id: gameIdValue,
          move: from + to + (promotion || ''),
          isHumanMove: true
        })
      })
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setOptimisticFen(prevFen);
          setOptimisticLastMove(null);
          
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
          submittingRef.current = false;
          setBoardLocked(false);
        }
        // Backup timeout in case Realtime fails to sync
        setTimeout(() => {
          if (submittingRef.current) {
            submittingRef.current = false;
            setBoardLocked(false);
          }
        }, 1500);
      })
      .catch((err) => {
        setOptimisticFen(prevFen);
        setOptimisticLastMove(null);
        toast.error('Network error or failed to submit');
        submittingRef.current = false;
        setBoardLocked(false);
      });
      
    } catch (e) {
      toast.error(e.message || 'Illegal move or failed to submit');
      submittingRef.current = false;
      setBoardLocked(false);
      setOptimisticFen(null);
      setOptimisticLastMove(null);
    }
  }, [game, boardLocked, gameId, toast, soundEnabled, playSound]);

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
      chat_history: [...(prev?.chat_history || []), optimisticMsg]
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

  const [capturedPieces, setCapturedPieces] = useState({ capturedByWhite: [], capturedByBlack: [] });

  useEffect(() => {
    let chess;
    try {
      chess = new Chess();
    } catch(e) {
      return;
    }
    
    const capturedW = [];
    const capturedB = [];
    
    for (const move of game?.move_history || []) {
      try {
        const result = chess.move(move);
        if (result?.captured) {
          if (result.color === 'w') {
            capturedW.push(result.captured);
          } else {
            capturedB.push(result.captured);
          }
        }
      } catch(e) {
        // ignore
      }
    }
    setCapturedPieces({ capturedByWhite: capturedW, capturedByBlack: capturedB });
  }, [game?.move_history]);

  const { capturedByWhite, capturedByBlack } = capturedPieces;

  const blackPieceMap = { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛' } // black pieces (captured by white)
  const whitePieceMap = { p:'♙', n:'♘', b:'♗', r:'♖', q:'♕' } // white pieces (captured by black)

  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const getScore = (pieces) => pieces.reduce((sum, p) => sum + (pieceValues[p] || 0), 0);
  const whiteScore = getScore(capturedByWhite); // White captured black pieces
  const blackScore = getScore(capturedByBlack); // Black captured white pieces

  const youCaptured = game?.player_color === 'w' ? capturedByWhite : capturedByBlack;
  const agentCaptured = game?.player_color === 'w' ? capturedByBlack : capturedByWhite;
  
  const youAdvantage = game?.player_color === 'w' ? (whiteScore - blackScore) : (blackScore - whiteScore);
  const agentAdvantage = game?.player_color === 'w' ? (blackScore - whiteScore) : (whiteScore - blackScore);

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

  const legalMoves = useMemo(() => {
    try {
      const chess = new Chess(game?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      return chess.moves({ verbose: true });
    } catch { return []; }
  }, [game?.fen]);

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
            <div style={{ flexShrink: 0, height: '48px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '12px', boxShadow: isOpenClawTurn ? '0 0 35px rgba(230,57,70,0.08)' : 'none', transition: 'box-shadow 0.7s ease' }}>
              <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #1a0000, #2a0606)', border: `2px solid ${isOpenClawTurn ? 'rgba(230,57,70,0.8)' : 'rgba(230,57,70,0.3)'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, animation: agentJustConnected ? 'agentArrive 0.8s ease-out forwards' : (isOpenClawTurn ? 'clawPulse 1.8s ease-in-out infinite' : 'none'), opacity: agentJustConnected ? 0 : 1 }}>
                <span style={{
                  fontSize: '28px',
                  transition: 'all 0.5s ease',
                  fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'
                }}>
                  {getMoodEmoji}
                </span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: visibleThought ? '2px' : '0' }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{agentName}</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: agentConnected ? '#22c55e' : '#444444', boxShadow: agentConnected ? '0 0 6px rgba(34,197,94,0.4)' : 'none', flexShrink: 0, ...(agentJustConnected ? { background: '#39d353', width: '10px', height: '10px', transition: 'all 0.3s' } : {}) }} />
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
                      wordBreak: 'break-word'
                    }}>
                      {visibleThought}
                    </div>
                  )}
                </div>
                
                {(!game?.agent_connected && game?.status !== 'finished' && game?.status !== 'abandoned') && (
                  <div style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
                    Game starts when your OpenClaw joins
                  </div>
                )}
                {agentDisconnected && game?.agent_connected && (
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
                    
                    {game?.in_check && game.status === 'active' && (
                      <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(230,57,70,0.95)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '6px', padding: '4px 10px', color: '#ffffff', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 700, textAlign: 'center', zIndex: 30, boxShadow: '0 4px 10px rgba(0,0,0,0.5)', pointerEvents: 'none', letterSpacing: '0.05em' }}>
                        ⚠️ CHECK!
                      </div>
                    )}

                    <div style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: isOpenClawTurn ? '0 0 40px rgba(230,57,70,0.14), 0 0 80px rgba(230,57,70,0.08)' : '0 4px 20px rgba(0,0,0,0.6)', width: '100%', height: '100%', position: 'relative', transition: 'box-shadow 0.8s ease' }}>
                      <div style={{ pointerEvents: game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned' ? 'auto' : 'none', opacity: game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned' ? 1 : 0.7, height: '100%', width: '100%' }}>
                        <ChessBoard 
                          fen={optimisticFen || game.fen} 
                          onMove={makeMove} 
                          isMyTurn={isMyTurn} 
                          lastMove={lastMoveHighlight || optimisticLastMove || (game.move_history || [])[(game.move_history || [])?.length - 1] || null} 
                          arrivedSquare={arrivedSquare} 
                          moveHistory={game.move_history || []}
                          boardTheme={boardTheme}
                          pieceTheme={pieceTheme}
                          playerColor={game?.player_color || 'w'}
                          onIllegalMove={handleIllegalMove}
                          onCapture={handleCapture}
                        />
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
              
              {(youCaptured.length > 0 || youAdvantage > 0) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '14px', color: 'white', background: '#161616', padding: '4px 8px', borderRadius: '6px', border: '1px solid #222' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {youCaptured.map((p, i) => (
                      <span key={i} style={{ marginLeft: i > 0 ? '-3px' : '0', color: 'rgba(255,255,255,0.75)' }}>
                        {game?.player_color === 'w' ? blackPieceMap[p] : whitePieceMap[p]}
                      </span>
                    ))}
                  </div>
                  {youAdvantage > 0 && <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 'bold' }}>+{youAdvantage}</span>}
                </div>
              )}
            </div>
            
          </div>

          {/* RIGHT DESKTOP COLUMN */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 16px 8px', gap: '10px', overflow: 'hidden', minWidth: 0 }}>
            

        {/* D) CHAT SECTION */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d0d0d', borderRadius: '12px', border: '1px solid #1a1a1a', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ flexShrink: 0, padding: '10px 12px', fontFamily: "'Inter', sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(242,242,242,0.3)' }}>
            CHAT WITH {agentName.toUpperCase()}
          </div>
          <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '6px' }} className="scrollbar-none scroll-smooth">
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
            style={{ padding: '6px 12px', borderTop: '1px solid #111', display: 'flex', alignItems: 'center', gap: '8px', height: '44px', boxSizing: 'border-box' }}
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
        <div style={{ flexShrink: 0, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '8px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 40 }}>
          {game?.status === 'waiting' || !agentConnected ? (
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'rgba(242,242,242,0.4)', background: '#111', padding: '4px 12px', borderRadius: '6px', border: '1px solid #1a1a1a' }}>
              WAITING FOR AGENT
            </span>
          ) : (
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', color: game?.turn === (game?.player_color || 'w') ? 'white' : 'rgba(242,242,242,0.3)', background: game?.turn === (game?.player_color || 'w') ? '#e63946' : '#161616', padding: '4px 12px', borderRadius: '6px', border: game?.turn !== (game?.player_color || 'w') ? '1px solid #222' : 'none' }}>
              {game?.turn === (game?.player_color || 'w') ? 'YOUR TURN' : 'WAITING'}
            </span>
          )}
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'rgba(242,242,242,0.25)' }}>
            Move {game?.move_history?.length ? Math.floor(game.move_history.length / 2) + 1 : 1}
          </span>
          {!agentConnected && (
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'rgba(242,242,242,0.2)' }}>
              {agentName} not here
            </span>
          )}
        </div>
        
      </div>
    </div>
  ) : (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }} className="scrollbar-none">
            
        
        {/* A) AGENT CARD */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#0e0e0e', borderBottom: '1px solid #111', boxShadow: isOpenClawTurn ? '0 0 30px rgba(230,57,70,0.06)' : 'none', transition: 'box-shadow 0.7s ease' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #1a0000, #2a0606)', border: '2px solid rgba(230,57,70,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0, animation: agentJustConnected ? 'agentArrive 0.8s ease-out forwards' : (isOpenClawTurn ? 'clawPulse 1.8s ease-in-out infinite' : 'none'), opacity: agentJustConnected ? 0 : 1 }}>
            <span style={{
              fontSize: '28px',
              transition: 'all 0.5s ease',
              fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif'
            }}>
              {getMoodEmoji}
            </span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: visibleThought ? '2px' : '0' }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{agentName}</span>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: agentConnected ? '#22c55e' : '#444444', boxShadow: agentConnected ? '0 0 6px rgba(34,197,94,0.4)' : 'none', flexShrink: 0, ...(agentJustConnected ? { background: '#39d353', width: '10px', height: '10px', transition: 'all 0.3s' } : {}) }} />
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
                  wordBreak: 'break-word'
                }}>
                  {visibleThought}
                </div>
              )}
            </div>
            
            {(!game?.agent_connected && game?.status !== 'finished' && game?.status !== 'abandoned') && (
              <div style={{ fontSize: '11px', color: 'rgba(242,242,242,0.35)', fontFamily: 'Inter, sans-serif', marginTop: '2px' }}>
                Game starts when your OpenClaw joins
              </div>
            )}
            {agentDisconnected && game?.agent_connected && (
               <div style={{ fontSize: '12px', color: '#888', marginTop: '2px', fontFamily: "'Inter', sans-serif" }}>⚠️ OpenClaw seems idle...</div>
            )}
          </div>
        </div>

        {/* B) CHESS BOARD */}
        <div style={{ width: '100%', flexShrink: 0, position: 'relative', padding: '12px', boxSizing: 'border-box' }}>
          <div style={{display:'flex',gap:2,padding:'4px 8px',minHeight:20,flexWrap:'wrap',alignItems:'center'}}>
            {Object.entries(getCapturedPieces(game?.fen).byBlack).flatMap(([t,n])=>
              Array.from({length:n}).map((_,i)=>(
                <span key={t+i} style={{fontSize:13,color:'rgba(242,242,242,0.45)',lineHeight:1}}>{PIECE_SYMBOLS[t]}</span>
              ))
            )}
          </div>
          {game?.in_check && game.status === 'active' && (
            <div 
              style={{ background: 'rgba(230,57,70,0.15)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '8px', padding: '6px 12px', marginBottom: '8px', color: '#e63946', fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, textAlign: 'center' }}
            >
              ⚠️ Check!
            </div>
          )}
          <div style={{ borderRadius: '4px', overflow: 'hidden', boxShadow: isOpenClawTurn ? '0 0 40px rgba(230,57,70,0.12), 0 0 80px rgba(230,57,70,0.06)' : '0 2px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4)', width: '100%', position: 'relative', transition: 'box-shadow 0.8s ease' }}>
          <div style={{ pointerEvents: game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned' ? 'auto' : 'none', opacity: game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned' ? 1 : 0.7 }}>
          <ChessBoard 
            fen={optimisticFen || game.fen} 
            showCoordinates={false}
            onMove={makeMove} 
            isMyTurn={isMyTurn} 
            lastMove={lastMoveHighlight || optimisticLastMove || (game.move_history || [])[(game.move_history || [])?.length - 1] || null} arrivedSquare={arrivedSquare} 
            moveHistory={game.move_history || []}
            boardTheme={boardTheme}
            pieceTheme={pieceTheme}
            playerColor={game?.player_color || 'w'}
            onIllegalMove={handleIllegalMove}
            onCapture={handleCapture}
          />
          </div>
          </div>
          <div style={{display:'flex',gap:2,padding:'4px 8px',minHeight:20,flexWrap:'wrap',alignItems:'center'}}>
            {Object.entries(getCapturedPieces(game?.fen).byWhite).flatMap(([t,n])=>
              Array.from({length:n}).map((_,i)=>(
                <span key={t+i} style={{fontSize:13,color:'rgba(242,242,242,0.45)',lineHeight:1}}>{PIECE_SYMBOLS[t]}</span>
              ))
            )}
          </div>
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
        <div style={{ flex: 1, minHeight: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '0', borderTop: '1px solid #111111', background: '#0a0a0a' }}>
          <div style={{ flexShrink: 0, padding: '10px 12px', fontFamily: "'Inter', sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(242,242,242,0.3)' }}>
            CHAT WITH {agentName.toUpperCase()}
          </div>
          <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '120px', maxHeight: '40vh' }} className="scrollbar-none scroll-smooth">
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
            style={{ padding: '6px 12px 8px', borderTop: '1px solid #111', display: 'flex', alignItems: 'center', gap: '8px', height: '46px', boxSizing: 'border-box', position: 'sticky', bottom: 0, background: '#0a0a0a', zIndex: 10 }}
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
      <div style={{ flexShrink: 0, height: '48px', background: '#0a0a0a', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 40, position: 'sticky', bottom: 0 }}>
        {game?.status === 'waiting' || !agentConnected ? (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'rgba(242,242,242,0.4)', background: '#111', padding: '4px 12px', borderRadius: '6px', border: '1px solid #1a1a1a' }}>
            WAITING FOR AGENT
          </span>
        ) : (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', color: game?.turn === (game?.player_color || 'w') ? 'white' : 'rgba(242,242,242,0.3)', background: game?.turn === (game?.player_color || 'w') ? '#e63946' : '#161616', padding: '4px 12px', borderRadius: '6px', border: game?.turn !== (game?.player_color || 'w') ? '1px solid #222' : 'none' }}>
            {game?.turn === (game?.player_color || 'w') ? 'YOUR TURN' : 'WAITING'}
          </span>
        )}
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'rgba(242,242,242,0.25)' }}>
          Move {game?.move_history?.length ? Math.floor(game.move_history.length / 2) + 1 : 1}
        </span>
        {!agentConnected && (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'rgba(242,242,242,0.2)' }}>
            {agentName} not here
          </span>
        )}
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

      {showGameOver && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(5, 5, 5, 0.9)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '28px',
            padding: '36px 32px',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(0,0,0,0.5)',
            position: 'relative',
            overflow: 'hidden',
          }} className="animate-in fade-in zoom-in-95 duration-300">
            {/* Elegant top-down light streak corresponding to match status */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '180px',
              height: '3px',
              background: game?.result === (game?.player_color === 'b' ? 'black' : 'white') 
                ? 'linear-gradient(90deg, transparent, #ffd166, transparent)' 
                : game?.result === 'draw' 
                  ? 'linear-gradient(90deg, transparent, #a1a1aa, transparent)' 
                  : 'linear-gradient(90deg, transparent, #e63946, transparent)'
            }} />

            {/* Glowing avatar sphere representing result */}
            <div style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              margin: '0 auto 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '44px',
              background: game?.result === (game?.player_color === 'b' ? 'black' : 'white')
                ? 'radial-gradient(circle, rgba(255,209,102,0.15) 0%, rgba(255,209,102,0.02) 70%)'
                : game?.result === 'draw'
                  ? 'radial-gradient(circle, rgba(161,161,170,0.15) 0%, rgba(161,161,170,0.02) 70%)'
                  : 'radial-gradient(circle, rgba(230,57,70,0.15) 0%, rgba(230,57,70,0.02) 70%)',
              border: game?.result === (game?.player_color === 'b' ? 'black' : 'white')
                ? '1px dashed rgba(255,209,102,0.3)'
                : game?.result === 'draw'
                  ? '1px dashed rgba(161,161,170,0.3)'
                  : '1px dashed rgba(230,57,70,0.3)',
              boxShadow: game?.result === (game?.player_color === 'b' ? 'black' : 'white')
                ? '0 0 30px rgba(255,209,102,0.1)'
                : game?.result === 'draw'
                  ? '0 0 30px rgba(161,161,170,0.1)'
                  : '0 0 30px rgba(230,57,70,0.1)'
            }}>
              {game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? '🏆' : game?.result === 'draw' ? '🤝' : '💀'}
            </div>

            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '32px',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              marginBottom: '6px',
              lineHeight: 1.12
            }}>
              {game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'Victory!' : game?.result === 'draw' ? 'Draw Game' : 'Defeat'}
            </h2>

            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: game?.result === (game?.player_color === 'b' ? 'black' : 'white') 
                ? '#ffd166' 
                : game?.result === 'draw' 
                  ? '#a1a1aa' 
                  : '#e63946',
              marginBottom: '16px'
            }}>
              {game?.result === (game?.player_color === 'b' ? 'black' : 'white') 
                ? 'You defeated OpenClaw' 
                : game?.result === 'draw' 
                  ? 'Mutual standoff' 
                  : `Bested by ${agentName}`}
            </div>

            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '14.5px',
              color: 'rgba(255, 255, 255, 0.6)',
              lineHeight: 1.5,
              marginBottom: '28px',
              padding: '0 8px'
            }}>
              {game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? "Magnificent! You demonstrated pristine chess mastery and out-calculated OpenClaw from start to finish." :
               game?.result === 'draw' ? "An absolute masterclass of strategy. Both players defended courageously to force a theoretical draw." :
               `${agentName} breached the defensive structure to secure the victory. Setup another match to mount your retaliation.`}
            </p>

            {/* Statistics recap grid dashboard style */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '32px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              textAlign: 'left'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif", fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Opponent
                </div>
                <div style={{ fontSize: '14px', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🤖 {agentName}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif", fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Moves Made
                </div>
                <div style={{ fontSize: '14px', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
                  ⚡ {Math.floor((game.move_history || []).length / 2) + ((game.move_history || []).length % 2)} moves
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif", fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Played As
                </div>
                <div style={{ fontSize: '14px', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {game?.player_color === 'w' ? (
                    <>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', border: '1px solid currentColor' }} /> White
                    </>
                  ) : (
                    <>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#000', border: '1px solid rgba(255,255,255,0.4)' }} /> Black
                    </>
                  )}
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif", fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Game Outcome
                </div>
                <div style={{ fontSize: '14px', color: '#fff', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
                  🎌 {game?.result === 'draw' ? 'Draw' : game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'Victory' : 'Defeat'}
                </div>
              </div>
            </div>

            {/* Elegant control block with high quality, responsive visual feedback */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowGameOver(false);
                  navigate('/');
                }}
                style={{
                  background: 'linear-gradient(135deg, #e63946 0%, #c12935 100%)',
                  color: '#fff',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: '15px',
                  padding: '14px 28px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, background 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 15px rgba(230, 57, 70, 0.3)'
                }}
                className="hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              >
                Play New Match
              </button>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}>
                <button
                  onClick={handleShareResult}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.8)',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: '14px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                  }}
                  className="active:scale-[0.96]"
                >
                  <Share2 size={16} /> Share Result
                </button>

                <button
                  onClick={() => setShowGameOver(false)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.8)',
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: '14px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                  }}
                  className="active:scale-[0.96]"
                >
                  <XIcon size={16} /> Review Board
                </button>
              </div>
            </div>
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
                  { id: 'neo', label: 'Neo', icon: <img src="https://raw.githubusercontent.com/GiorgioMegrelli/chess.com-boards-and-pieces/master/pieces/neo/wn.png" width="24" height="24" alt="neo" /> },
                  { id: 'tournament', label: 'Tournament', icon: <img src="https://raw.githubusercontent.com/GiorgioMegrelli/chess.com-boards-and-pieces/master/pieces/tournament/wn.png" width="24" height="24" alt="tournament" /> },
                  { id: 'ocean', label: 'Ocean', icon: <img src="https://raw.githubusercontent.com/GiorgioMegrelli/chess.com-boards-and-pieces/master/pieces/ocean/wn.png" width="24" height="24" alt="ocean" /> }
                ].map(piece => (
                  <button
                    data-testid={`piece-button-${piece.id}`}
                    key={piece.id}
                    onClick={() => {
                      setPieceTheme(piece.id);
                      localStorage.setItem('cwc_pieces', piece.id);
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
                      border: pieceTheme === piece.id ? '1px solid #e63946' : '1px solid #1a1a1a',
                      background: pieceTheme === piece.id ? 'rgba(230,57,70,0.1)' : '#111',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <div style={{ width: '24px', height: '24px' }}>{piece.icon}</div>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: pieceTheme === piece.id ? '#fff' : '#888' }}>{piece.label}</span>
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
