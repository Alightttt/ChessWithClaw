'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Settings, X as XIcon, Pause, Play, Flag, Share2, Volume2, VolumeX, Download, ChevronDown, Copy, Check, Send, Twitter } from 'lucide-react';
import ChessBoard from '../components/chess/ChessBoard';
import { supabase, getSupabaseWithToken } from '../lib/supabase';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import StatusDot from '../components/ui/StatusDot';
import Divider from '../components/ui/Divider';
import Badge from '../components/ui/Badge';
import { useRipple } from '../hooks/useRipple';

export default function Game() {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const agentToken = location.state?.agentToken;
  
  const [game, setGame] = useState(null);
  const agentName = game?.agent_name || 'Your OpenClaw';
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [agentSectionOpen, setAgentSectionOpen] = useState(false);
  const [moveHistoryOpen, setMoveHistoryOpen] = useState(false);
  
  const [boardSize, setBoardSize] = useState(320);
  const [boardTheme, setBoardTheme] = useState(() => localStorage.getItem('cwc_theme') || 'green');
  const [pieceTheme, setPieceTheme] = useState(() => localStorage.getItem('cwc_pieces') || 'merida');
  const [boardPerspective, setBoardPerspective] = useState(() => localStorage.getItem('cwc_perspective') === '3d');
  const [isCheckState, setIsCheckState] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const checkCheck = () => {
      if (typeof window.Chess !== 'function') return;
      try {
        const chess = new window.Chess(game?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
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
  const [boardLocked, setBoardLocked] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [showCommentary, setShowCommentary] = useState(false);
  const [lastMoveFrom, setLastMoveFrom] = useState(null);
  const [lastMoveTo, setLastMoveTo] = useState(null);
  const [agentConnected, setAgentConnected] = useState(false);
  const [displayedThinking, setDisplayedThinking] = useState('');
  const [chatPaddingBottom, setChatPaddingBottom] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const createRipple = useRipple();

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
    setDisplayedThinking('')
    setLastMoveFrom(null)
    setLastMoveTo(null)
    setShowGameOverModal(false)
    connectedToastShown.current = false
    prevThinkingRef.current = ''
    
    // Step 3: Navigate to home to create fresh game
    // Do NOT try to navigate to /created/:id from here
    // Let user click "Challenge Your OpenClaw" fresh
    navigate('/')
  }

  const computeMaterial = useCallback((fen) => {
    if (!fen) return null;
    if (typeof window.Chess !== 'function') return null;
    try {
      let chess;
      try {
        chess = new window.Chess(fen);
      } catch(e) {
        console.error('Invalid FEN:', fen);
        chess = new window.Chess();
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
  const thinkingScrollRef = useRef(null);
  const channelRef = useRef(null);
  const containerRef = useRef(null);
  const prevThinkingRef = useRef('');



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

  // Auto-scroll thinking
  useEffect(() => {
    if (thinkingScrollRef.current && displayedThinking) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
    }
  }, [displayedThinking]);

  const typerRef = useRef(null)

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
    let baseText = game?.current_thinking || ''
    if (baseText.length > 120) baseText = baseText.substring(0, 120) + '...'
    const text = baseText
    
    if (!text || text === prevThinkingRef.current) return
    prevThinkingRef.current = text
    
    if (typerRef.current) {
      clearInterval(typerRef.current)
      typerRef.current = null
    }
    
    setDisplayedThinking('')
    let i = 0
    
    typerRef.current = setInterval(() => {
      i++
      setDisplayedThinking(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(typerRef.current)
        typerRef.current = null
      }
    }, 30)
    
    return () => {
      if (typerRef.current) {
        clearInterval(typerRef.current)
        typerRef.current = null
      }
    }
  }, [game?.current_thinking])

  useEffect(() => {
    if (game?.turn === (game?.player_color || 'w')) {
      setDisplayedThinking('')
      prevThinkingRef.current = ''
      if (typerRef.current) clearInterval(typerRef.current)
    }
  }, [game?.turn, game?.player_color])

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
  const playSound = useMemo(() => (type) => {
    if (!soundEnabled) return;
    const urls = {
      move: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.ogg',
      capture: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Capture.ogg',
      check: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Check.ogg',
      checkmate: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg',
      start: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/GenericNotify.ogg',
      end: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Victory.ogg',
      illegal: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Error.ogg',
      agentThinking: '',
      agentMove: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Move.ogg',
      agentCapture: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Capture.ogg',
      agentCheck: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Check.ogg',
      agentCheckmate: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Defeat.ogg',
      agentEnd: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Defeat.ogg',
      agentIllegal: 'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/Error.ogg'
    };
    if (urls[type]) {
      const audio = new Audio(urls[type]);
      audio.play().catch(e => console.error("Error playing sound", e));
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (!game) return;
    const currentMoveCount = (game.move_history || []).length;
    if (currentMoveCount > prevMoveCountRef.current) {
      const runSoundLogic = () => {
        if (typeof window.Chess !== 'function') return;
        let chess;
        try {
          chess = new window.Chess();
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

  // Agent Timeout Check
  const [agentWarning, setAgentWarning] = useState(false);
  useEffect(() => {
    if (!game || game.status === 'finished' || game.status === 'abandoned' || game.turn === (game?.player_color || 'w')) {
      setAgentWarning(false);
      return;
    }
    
    const checkTimeout = () => {
      const lastUpdated = new Date(game.agent_last_seen || game.updated_at || game.created_at).getTime();
      if (Date.now() - lastUpdated > 90000) { // 90 seconds
        setAgentWarning(true);
      } else {
        setAgentWarning(false);
      }
    };
    
    checkTimeout();
    const interval = setInterval(checkTimeout, 5000);

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

    return () => {
      clearInterval(interval);
      clearInterval(heartbeatInterval);
    };
  }, [game, game?.turn, game?.status, game?.agent_last_seen, game?.updated_at, game?.created_at, gameId]);

  useEffect(() => {
    if (game?.status === 'finished' || game?.status === 'abandoned') {
      localStorage.removeItem('chesswithclaw_active_game');
      setTimeout(() => setShowGameOverModal(true), 600);
      
      if (game?.result === (game?.player_color === 'b' ? 'black' : 'white')) {
        setTimeout(() => {
          toast.success('Achievement Unlocked: Bot Slayer! 🏆');
        }, 1500);
      }
    }
  }, [game?.status, game?.result, game?.player_color, toast]);

  useEffect(() => {
    if (!game) return;
    const agentName = game?.agent_name || 'Your OpenClaw';
    if (game.status === 'finished' || game.status === 'abandoned') {
      document.title = 'Game Over | ChessWithClaw';
    } else if (game.turn === (game?.player_color || 'w')) {
      document.title = 'Your Turn | ChessWithClaw';
    } else {
      document.title = `⚡ ${agentName} Thinking... | ChessWithClaw`;
    }
  }, [game]);

  useEffect(() => {
    if (game?.agent_connected) {
      setAgentConnected(true);
      connectedToastShown.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  useEffect(() => {
    if (game && prevAgentConnected.current === false && game.agent_connected === true && connectedToastShown.current === false) {
      toast.success(`${agentName} has arrived!`);
      setJustConnected(true);
      setTimeout(() => setJustConnected(false), 1000);
      connectedToastShown.current = true;
    }
    if (game) {
      prevAgentConnected.current = game.agent_connected;
    }
  }, [game, toast, agentName]);
  
  useEffect(() => {
    if (!gameId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const loadGame = async (retries = 3) => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error || !data) {
        if (retries > 0) {
          setTimeout(() => loadGame(retries - 1), 500);
          return;
        }
        setNotFound(true);
      } else {
        // Fetch move history from the new table
        const { data: movesData, error: movesError } = await supabase.from('moves').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
        if (movesError) {
          console.warn('Could not fetch from moves, falling back to games.move_history', movesError);
        } else if (movesData && movesData.length > 0) {
          data.move_history = movesData.map(m => ({
            ...m,
            from: m.from_square || m.from,
            to: m.to_square || m.to,
            uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || ''),
            san: m.san
          }));
        }

        // Fetch thinking log from the new table
        const { data: thoughtsData, error: thoughtsError } = await supabase.from('agent_thoughts').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
        if (thoughtsError) {
          console.warn('Could not fetch from agent_thoughts, falling back to games.thinking_log', thoughtsError);
        } else if (thoughtsData && thoughtsData.length > 0) {
          data.thinking_log = thoughtsData.map(thought => ({
            ...thought,
            text: thought.thought,
            moveNumber: thought.move_number,
            timestamp: new Date(thought.created_at).getTime()
          }));
        } else if (thoughtsData && thoughtsData.length === 0) {
          data.thinking_log = [];
        }

        // Fetch chat history
        const { data: chatData, error: chatError } = await supabase.from('chat_messages').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
        if (chatError) {
          console.warn('Could not fetch from chat_messages, falling back to games.chat_history', chatError);
        } else if (chatData && chatData.length > 0) {
          data.chat_history = chatData;
        } else if (chatData && chatData.length === 0) {
          data.chat_history = [];
        }

        if (typeof data.move_history === 'string') {
          try { data.move_history = JSON.parse(data.move_history); } catch(e) {}
        }
        if (data.move_history && data.move_history.length > 0) {
          const lastMove = data.move_history[data.move_history.length - 1];
          if (lastMove && typeof lastMove === 'string' && lastMove.length >= 4) {
            setLastMoveFrom(lastMove.slice(0, 2));
            setLastMoveTo(lastMove.slice(2, 4));
          } else if (lastMove?.from && lastMove?.to) {
            setLastMoveFrom(lastMove.from);
            setLastMoveTo(lastMove.to);
          }
        }
        
        if (data.agent_connected) {
          connectedToastShown.current = true;
        }

        setGame(data);
        fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
          },
          body: JSON.stringify({ id: gameId, role: 'human' })
        }).catch(() => {});
      }
      setLoading(false);
    };

    loadGame();

    const channel = supabase.channel(`game-${gameId}`);
    channelRef.current = channel;

    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
      setGame(prev => {
        if (!prev) return payload.new;
        const updatedGame = { ...prev, ...payload.new };
        // Preserve arrays that are no longer in the games table, but allow updates if games table has more items (fallback mode)
        updatedGame.move_history = (payload.new.move_history && payload.new.move_history.length > (prev.move_history || []).length) ? payload.new.move_history : (prev.move_history || []);
        updatedGame.chat_history = (payload.new.chat_history && payload.new.chat_history.length > (prev.chat_history || []).length) ? payload.new.chat_history : (prev.chat_history || []);
        updatedGame.thinking_log = (payload.new.thinking_log && payload.new.thinking_log.length > (prev.thinking_log || []).length) ? payload.new.thinking_log : (prev.thinking_log || []);
        
        if (payload.new.agent_connected && !prev.agent_connected) {
          setAgentConnected(true);
        }
        
        if (!payload.new.agent_connected && prev.agent_connected) {
          setAgentConnected(false);
        }

        return updatedGame;
      });
      submittingRef.current = false;
      setBoardLocked(false);
      if (!payload.new.human_connected) {
        fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
          },
          body: JSON.stringify({ id: gameId, role: 'human' })
        }).catch(() => {});
      }
    });

    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moves', filter: `game_id=eq.${gameId}` }, (payload) => {
      setGame(prev => {
        if (!prev) return prev;
        const newMove = {
          ...payload.new,
          from: payload.new.from_square || payload.new.from,
          to: payload.new.to_square || payload.new.to,
          uci: (payload.new.from_square || payload.new.from) + (payload.new.to_square || payload.new.to) + (payload.new.promotion || '')
        };
        const newMoveHistory = [...(prev.move_history || [])];
        newMoveHistory.push(newMove);
        // Sort by created_at to ensure correct order
        newMoveHistory.sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : (a.timestamp || 0);
          const timeB = b.created_at ? new Date(b.created_at).getTime() : (b.timestamp || 0);
          return timeA - timeB;
        });
        
        const updates = { move_history: newMoveHistory };
        if (payload.new.fen_after) {
          updates.fen = payload.new.fen_after;
          updates.turn = payload.new.fen_after.split(' ')[1];
        }
        
        return { ...prev, ...updates };
      });
      submittingRef.current = false;
      setBoardLocked(false);
    });

    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_thoughts', filter: `game_id=eq.${gameId}` }, (payload) => {
      setGame(prev => {
        if (!prev) return prev;
        const newThought = {
          ...payload.new,
          text: payload.new.thought,
          moveNumber: payload.new.move_number,
          timestamp: new Date(payload.new.created_at).getTime()
        };
        const newThinkingLog = [...(prev.thinking_log || []), newThought];
        newThinkingLog.sort((a, b) => a.timestamp - b.timestamp);
        return { ...prev, thinking_log: newThinkingLog };
      });
    });

    channel.on('broadcast', { event: 'thinking' }, (payload) => {
      setGame(prev => {
        if (!prev) return prev;
        return { ...prev, current_thinking: payload.payload.text };
      });
    });

    channel.subscribe();

    const handleBeforeUnload = () => {
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId);
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadGame();
        channel.subscribe(); // Re-subscribe if it was dropped
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId);
    };
  }, [gameId]);

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

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const { data } = await supabase
          .from('games').select('*').eq('id', gameId).single();
        if (data) {
          // Fetch move history
          const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
          if (movesData && movesData.length > 0) {
            data.move_history = movesData.map(m => ({
              ...m,
              from: m.from_square || m.from,
              to: m.to_square || m.to,
              uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || ''),
              san: m.san
            }));
          }

          // Fetch thinking log
          const { data: thoughtsData } = await supabase.from('agent_thoughts').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
          if (thoughtsData && thoughtsData.length > 0) {
            data.thinking_log = thoughtsData.map(thought => ({
              ...thought,
              text: thought.thought,
              moveNumber: thought.move_number,
              timestamp: new Date(thought.created_at).getTime()
            }));
          } else {
            data.thinking_log = [];
          }

          // Fetch chat history
          const { data: chatData } = await supabase.from('chat_messages').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
          if (chatData && chatData.length > 0) {
            data.chat_history = chatData;
          } else {
            data.chat_history = [];
          }

          setGame(data);
        }
        
        if (channelRef.current && channelRef.current.state !== 'joined') {
          channelRef.current.subscribe();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [gameId]);

  const makeMove = async (from, to, promotion) => {
    if (!game || game.turn !== (game?.player_color || 'w') || (game.status !== 'active' && game.status !== 'waiting')) return;
    if (boardLocked || submittingRef.current) return;
    
    const agentName = game?.agent_name || 'Your OpenClaw';
    
    if (!localStorage.getItem(`game_owner_${gameId}`)) {
      toast.error('You are not the creator of this game.');
      return;
    }

    submittingRef.current = true;
    setBoardLocked(true);
    if (typeof window.Chess !== 'function') {
      submittingRef.current = false;
      setBoardLocked(false);
      return;
    }
    let chess;
    try {
      chess = new window.Chess();
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
        return;
      }

      const response = await fetch('/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`)
        },
        body: JSON.stringify({
          id: gameId,
          move: from + to + (promotion || '')
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        submittingRef.current = false;
        setBoardLocked(false);
        if (errData.code === 'WAITING_FOR_AGENT') {
          toast(`Waiting for ${agentName} to join...`, {
            icon: '🦞',
            style: { background: '#0e0e0e', border: '1px solid rgba(230,57,70,0.3)', color: '#f0f0f0' }
          });
          return;
        } else if (errData.code === 'TURN_CONFLICT') {
          throw new Error('TURN_CONFLICT');
        }
        throw new Error(errData.error || 'Failed to submit move');
      }
      
      // Safety timeout to unlock board if realtime events are missed
      setTimeout(() => {
        if (submittingRef.current) {
          submittingRef.current = false;
          setBoardLocked(false);
        }
      }, 3000);
      
    } catch (e) {
      if (e.message === 'WAITING_FOR_AGENT') {
        toast(`Waiting for ${agentName} to join...`, {
          icon: '🦞',
          style: { background: '#0e0e0e', border: '1px solid rgba(230,57,70,0.3)', color: '#f0f0f0' }
        });
      } else if (e.message === 'TURN_CONFLICT') {
        toast.error('Move already processed');
      } else {
        toast.error(e.message || 'Illegal move or failed to submit');
      }
      submittingRef.current = false;
      setBoardLocked(false);
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    
    const text = chatInput;
    setChatInput('');
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`)
        },
        body: JSON.stringify({ id: gameId, text, sender: 'human' })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.error || 'Failed to send message', {
          style: { background: '#0e0e0e', border: '1px solid rgba(230,57,70,0.3)', color: '#f0f0f0' }
        });
        throw new Error('Failed to send message');
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    }
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

  function handleGoHome() { navigate('/') }
  function handleOpenSettings() { setShowSettings(true) }
  function handleToggleAgentSection() { setAgentSectionOpen(prev => !prev) }
  function handleToggleMoveHistory() { setMoveHistoryOpen(prev => !prev) }
  function handleCloseGameOverModal() { setShowGameOverModal(false) }
  async function handleShareResult(e) {
    const textToShare = `I played chess vs ${agentName} on ChessWithClaw! 🦞\nchesswithclaw.vercel.app`;
    const btn = e.currentTarget;
    const oldText = btn.innerText;

    try {
      if (navigator.share) {
        await navigator.share({
          text: textToShare,
        });
      } else {
        await navigator.clipboard.writeText(textToShare);
        btn.innerText = 'Copied! ✓';
        setTimeout(() => btn.innerText = oldText, 2000);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(textToShare);
          btn.innerText = 'Copied! ✓';
          setTimeout(() => btn.innerText = oldText, 2000);
        } catch (clipboardErr) {
          console.error('Failed to share or copy:', clipboardErr);
        }
      }
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
    if (typeof window.Chess !== 'function') return;
    let chess;
    try {
      chess = new window.Chess();
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

  const mood = getAgentMood()
  const config = moodConfig[mood]

  if (loading) {
    return (
      <div className="flex flex-col relative min-h-screen bg-black text-white selection:bg-red-500/30">
        <header className="h-16 sticky top-0 z-50 glass border-b border-white/5 py-3 px-4 lg:px-8 flex flex-col shrink-0 bg-black/80 backdrop-blur-xl">
        </header>

        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden pb-12 lg:pb-0">
          <div className="flex-none lg:flex-1 flex flex-col lg:overflow-hidden relative z-10">
            <div className="h-[60px] border-b border-white/5 flex items-center px-4 gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse shrink-0" />
              <div className="flex-1 flex gap-2 flex-col">
                 <div className="w-24 h-4 rounded px-2 bg-white/5 animate-pulse" />
                 <div className="w-32 h-3 rounded px-2 bg-white/5 animate-pulse" />
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
              <div className="w-full max-w-[400px] aspect-square rounded-md bg-white/5 animate-pulse border border-white/5" />
            </div>
          </div>

          <div className="w-full lg:w-[360px] shrink-0 flex flex-col bg-black/60 backdrop-blur-md border-t lg:border-t-0 lg:border-l border-white/5 relative z-10 transition-all">
            <div className="lg:h-1/2 flex flex-col shrink-0 lg:border-t-0 lg:order-2 bg-black/40 border-t border-white/5 relative z-10 p-4">
               <div className="w-full h-24 rounded-lg bg-white/5 animate-pulse border border-white/5" />
            </div>
            <div className="flex flex-col bg-[#111] border-t border-white/5 lg:flex-1 lg:overflow-hidden lg:order-1 relative z-10 w-full p-4 mb-12 lg:mb-0">
               <div className="w-full h-12 rounded-lg bg-white/5 animate-pulse border border-white/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white selection:bg-red-500/30 p-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] blur-[120px] rounded-full pointer-events-none bg-red-500/10 transition-colors duration-1000" />
        <div className="relative z-10 flex flex-col items-center gap-6 glass border-white/10 p-12 rounded-2xl max-w-md text-center glow-anim">
          <div className="text-5xl drop-shadow-md">🦞</div>
          <div className="font-serif text-3xl font-bold tracking-wide">Game not found</div>
          <div className="text-neutral-400 text-sm font-sans">
            It looks like this game doesn&apos;t exist anymore or you have the wrong link.
          </div>
          <button 
            data-testid="home-button"
            onClick={handleGoHomeWithRipple} 
            className="mt-2 bg-red-600 text-white font-semibold flex items-center justify-center py-3 px-8 rounded-xl w-full transition-all active:scale-95 hover:bg-red-500"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const isSpectator = !localStorage.getItem(`game_owner_${gameId}`);
  const isMyTurn = !isSpectator && game?.turn === (game?.player_color || 'w') && (game?.status === 'active' || game?.status === 'waiting');
  const currentMoveNumber = Math.floor((game.move_history || []).length / 2) + 1;
  const lastThinking = (game.thinking_log || [])[(game.thinking_log || []).length - 1] || null;
  const unreadCount = (game.chat_history || []).filter(m => m.sender === 'agent').length; // Simplified for UI
  const isAgentThinking = (game?.turn === 'b' && game?.status === 'active');

  if (!game) return null;

  return (
    <div 
      ref={containerRef}
      className={`relative text-white font-sans selection:bg-red-500/30 transition-colors duration-500 box-border`}
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: isAgentThinking ? 'rgba(12,4,4,1)' : '#0a0a0a',
        transition: 'background 0.6s ease',
        boxSizing: 'border-box'
      }}
    >
      {/* Background Glow */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 ${game?.turn === 'b' ? 'bg-red-500/20' : 'bg-red-500/5'}`} />

      {isOffline && (
        <div className="absolute top-0 inset-x-0 bg-red-600 text-white font-semibold text-xs text-center py-1 z-[1000] shadow-[0_0_15px_rgba(220,38,38,0.5)]">
          You are offline. Reconnecting...
        </div>
      )}
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes gentlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes pulseThinking {
          from { opacity: 1; }
          to { opacity: 0.4; }
        }
        .thinking-cursor {
          display: inline-block;
          width: 2px;
          height: 14px;
          background: #e63946;
          margin-left: 2px;
          vertical-align: middle;
          animation: cursorBlink 1s step-end infinite;
        }
      `}</style>
      
      {/* PAGE HEADER */}
      <header style={{ height: '48px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', boxSizing: 'border-box' }}>
        <div className="flex items-center cursor-pointer active:scale-95 transition-transform" onClick={handleGoHome} style={{ gap: '8px' }}>
          <img
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo.png"
            alt="ChessWithClaw"
            width="32"
            height="32"
            loading="eager"
            style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }}
          />
          <span style={{ fontFamily: "'Playfair Display', serif" }} className="font-bold tracking-tight text-base text-white">
            ChessWithClaw
          </span>
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

      {/* AGENT SECTION */}
      <div 
        style={{
          flexShrink: 0,
          height: '72px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#0e0e0e',
          border: '1px solid #1a1a1a',
          borderRadius: '12px',
          margin: '0 12px 0 12px',
          boxSizing: 'border-box',
          boxShadow: isAgentThinking ? '0 0 32px rgba(230,57,70,0.08)' : 'none',
          transition: 'box-shadow 0.6s ease'
        }}
        className="relative z-10"
      >
        <div style={{ background: 'linear-gradient(135deg, #1a0000, #2a0606)', border: '2px solid rgba(230,57,70,0.6)', borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }} className={`shrink-0 ${mood === 'thinking' ? 'animate-pulse' : ''} ${justConnected ? 'animate-[gentlePulse_2s_ease-in-out_infinite]' : ''}`}>
          🦞
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '15px', fontWeight: 600, color: '#f2f2f2' }} className="whitespace-nowrap overflow-hidden text-ellipsis leading-none">{agentName}</span>
            <div 
              style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: agentConnected ? '#22c55e' : '#444444',
                boxShadow: agentConnected ? '0 0 6px rgba(34,197,94,0.4)' : 'none'
              }}
            />
          </div>
          <div className="mt-1 flex items-center gap-2 overflow-hidden">
            {agentWarning ? <span className="text-[#e63946] text-[11px] font-sans leading-none">{agentName} seems to be away</span> :
             !agentConnected ? <span className="text-neutral-500 text-[11px] font-sans leading-none">Not connected</span> : 
             game?.turn === (game?.player_color || 'w') ? <span className="text-neutral-500 text-[11px] font-sans leading-none">Watching you...</span> : 
             game?.current_thinking ? (
               <div className="flex items-center gap-2 min-w-0" style={{ flexWrap: 'nowrap' }}>
                 <span 
                   style={{
                     background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.2)', color: '#e63946',
                     fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', borderRadius: '4px', padding: '2px 6px',
                     animation: 'pulseThinking 1.2s infinite alternate',
                     display: 'inline-block', flexShrink: 0,
                     fontFamily: "'Inter', sans-serif"
                   }}
                 >
                   THINKING...
                 </span>
                 <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'rgba(230,57,70,0.8)' }} className="whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0">
                   {displayedThinking || game.current_thinking}
                 </span>
               </div>
             ) : <span className="text-neutral-500 text-[11px] font-sans leading-none">Waiting for {agentName} to start thinking...</span>}
          </div>
        </div>
        
        {/* Collapse chevron logic would require state, but we'll adapt later if needed. */}
        <ChevronDown size={20} className="text-[#444444] shrink-0" style={{ transform: 'rotate(0deg)', transition: 'transform 0.25s ease' }} />
      </div>

      {/* BOARD CONTAINER */}
      <div style={{ width: '100%', maxWidth: '100vw', margin: '0 auto', flexShrink: 0, padding: '0', zIndex: 10, boxSizing: 'border-box' }}>
        
        {isCheckState && game.status === 'active' && (
          <div 
            className="px-4 py-2 bg-red-600/90 text-white font-sans text-xs font-bold text-center rounded-md mb-2 shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-500 backdrop-blur-md animate-pulse"
            style={{ width: '100%' }}
          >
            {game?.turn === (game?.player_color || 'w') ? "⚠️ Your king is in check!" : `⚠️ ${agentName}'s king is in check!`}
          </div>
        )}

        <div className="flex justify-between items-center min-h-[20px] py-1" style={{ width: '100%' }}>
          <div className="flex gap-0.5">
            {capturedByWhite.map((p, i) => {
              const pieceName = `b${p.toUpperCase()}`;
              const url = (pieceTheme === 'merida' || pieceTheme === 'cburnett' || pieceTheme === 'alpha') 
                ? `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${pieceTheme}/${pieceName}.svg`
                : `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/${pieceName}.svg`;
              return (
                <img key={i} src={url} alt={pieceName} className="w-4 h-4 opacity-80" />
              );
            })}
          </div>
          <button
            onClick={() => {
              const newVal = !boardPerspective;
              setBoardPerspective(newVal);
              localStorage.setItem('cwc_perspective', newVal ? '3d' : '2d');
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider transition-all border ${boardPerspective ? 'bg-red-600 text-white border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 'bg-transparent text-neutral-500 border-white/10 hover:border-white/20 hover:text-neutral-300'}`}
          >
            3D
          </button>
        </div>

        <div 
          ref={boardRef}
          className={`relative rounded-md shrink-0 transition-all duration-300 ${boardLocked ? 'pointer-events-none' : 'pointer-events-auto'} ${shaking ? 'animate-board-shake' : ''}`}
          style={{
            width: '100%',
            maxWidth: '600px',
            margin: '0 auto',
            boxSizing: 'border-box',
            overflow: 'hidden',
            aspectRatio: '1/1',
            padding: '0',
            border: isAgentThinking ? '1px solid rgba(230,57,70,0.1)' : '1px solid #1e1e1e',
            borderRadius: '8px',
            maxHeight: 'calc(100dvh - 48px - 72px - 180px - 44px)',
            transform: `${shaking ? 'translateX(0)' : 'none'} ${boardPerspective ? 'perspective(1000px) rotateX(25deg) scale(0.95)' : ''}`,
            transformOrigin: 'bottom center',
            boxShadow: isAgentThinking 
               ? '0 8px 48px rgba(230,57,70,0.06)'
               : '0 8px 48px rgba(0,0,0,0.6)',
            transition: 'all 0.6s ease'
          }}
        >
          <ChessBoard 
            fen={game.fen} 
            onMove={makeMove} 
            isMyTurn={isMyTurn} 
            lastMove={(game.move_history || [])[(game.move_history || []).length - 1] || null} 
            moveHistory={game.move_history || []}
            boardTheme={boardTheme}
            pieceTheme={pieceTheme}
            playerColor={game?.player_color || 'w'}
            onIllegalMove={() => {
              setShaking(true);
              setTimeout(() => setShaking(false), 300);
            }}
            onCapture={() => {
              setShaking(true);
              setTimeout(() => setShaking(false), 300);
            }}
          />
          {(game.status === 'finished' || game.status === 'abandoned') && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-md pointer-events-none">
              <div className="font-serif text-[32px] font-bold text-white tracking-widest drop-shadow-md">
                {game.status === 'abandoned' ? 'GAME ABANDONED' : 'GAME OVER'}
              </div>
              <div className="font-sans text-sm text-red-500 mt-1 font-bold tracking-wide">
                {game?.status === 'abandoned' ? 'Game expired due to inactivity' : (game?.result === 'draw' ? 'Draw by ' + game?.result_reason : (game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'You won by ' : agentName + ' won by ') + game?.result_reason)}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-0.5 min-h-[20px] py-1" style={{ width: '100%' }}>
          {capturedByBlack.map((p, i) => {
            const pieceName = `w${p.toUpperCase()}`;
            const url = (pieceTheme === 'merida' || pieceTheme === 'cburnett' || pieceTheme === 'alpha') 
              ? `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${pieceTheme}/${pieceName}.svg`
              : `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/${pieceName}.svg`;
            return (
              <img key={i} src={url} alt={pieceName} className="w-4 h-4 opacity-80" />
            );
          })}
        </div>
      </div>

      {/* LIVE CHAT */}
      <div 
        style={{
          flexShrink: 0,
          height: '180px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          zIndex: 10,
          background: '#0a0a0a',
          borderTop: '1px solid #1a1a1a'
        }}
      >
        <div style={{ padding: '8px 16px 0', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(242,242,242,0.3)' }}>
          CHAT WITH {agentName.toUpperCase()}
        </div>
        <div 
          ref={chatMessagesRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
          className="scrollbar-none scroll-smooth"
        >
          {!(game.chat_history || []).length ? (
            <div style={{ color: '#2a2a2a', fontSize: '13px', textAlign: 'center', marginTop: 'auto', marginBottom: 'auto', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '24px' }}>🦞</span>
              <span>{agentName} can chat while playing</span>
            </div>
          ) : (
            (game.chat_history || []).map((msg, i) => {
              const isHuman = msg.sender === 'human';
              
              if (msg.type === 'resign_request') {
                return (
                  <div key={i} style={{ alignSelf: 'flex-start', background: '#161616', border: '1px solid #222222', color: '#e0e0e0', borderRadius: '12px 12px 12px 4px', padding: '8px 14px', maxWidth: '75%', fontSize: '14px', fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }} className="animate-fade-up">
                    {msg.text}
                    {game.status === 'active' && (
                      <button data-testid="accept-resignation-button" onClick={acceptAgentResignation} className="block w-full mt-2 bg-red-600 text-white border-none rounded-md py-1.5 font-sans text-xs font-bold cursor-pointer hover:bg-red-500 active:scale-95 transition-all">Accept Resignation</button>
                    )}
                    <div style={{ fontSize: '10px', color: '#333333', fontFamily: "'Inter', sans-serif", marginTop: '2px' }}>
                      System MSG
                    </div>
                  </div>
                );
              }
              if (msg.type === 'draw_offer') {
                return (
                  <div key={i} style={{ alignSelf: 'flex-start', background: '#161616', border: '1px solid #222222', color: '#e0e0e0', borderRadius: '12px 12px 12px 4px', padding: '8px 14px', maxWidth: '75%', fontSize: '14px', fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }} className="animate-fade-up">
                    {msg.text}
                    {game.status === 'active' && (
                      <button data-testid="accept-draw-button" onClick={async () => {
                        await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
                          status: 'finished', result: 'draw', result_reason: 'agreement'
                        }).eq('id', gameId);
                      }} className="block w-full mt-2 bg-green-600 text-white border-none rounded-md py-1.5 font-sans text-xs font-bold cursor-pointer hover:bg-green-500 active:scale-95 transition-all">Accept Draw</button>
                    )}
                    <div style={{ fontSize: '10px', color: '#333333', fontFamily: "'Inter', sans-serif", marginTop: '2px' }}>
                      System MSG
                    </div>
                  </div>
                );
              }

              return (
                <div 
                  key={i} 
                  style={{
                    alignSelf: isHuman ? 'flex-end' : 'flex-start',
                    background: isHuman ? 'linear-gradient(135deg, #e63946, #c62a35)' : '#161616',
                    border: isHuman ? 'none' : '1px solid #222222',
                    color: isHuman ? '#ffffff' : 'rgba(242,242,242,0.85)',
                    borderRadius: isHuman ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    padding: '8px 14px',
                    maxWidth: '75%',
                    fontSize: '14px',
                    fontFamily: "'Inter', sans-serif",
                    lineHeight: 1.5,
                    boxShadow: isHuman ? '0 2px 8px rgba(230,57,70,0.2)' : 'none'
                  }}
                  className="animate-fade-up"
                >
                  <div>{msg.text}</div>
                  <div style={{ fontSize: '10px', color: isHuman ? 'rgba(255,255,255,0.7)' : '#333333', fontFamily: "'Inter', sans-serif", marginTop: '2px' }}>
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now'}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form 
          onSubmit={sendMessage} 
          style={{
            flexShrink: 0,
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 12px',
            background: '#0a0a0a',
            borderTop: '1px solid #1a1a1a',
            boxSizing: 'border-box'
          }}
        >
          <input
            id="chat-input"
            data-testid="chat-input"
            type="text"
            value={chatInput}
            onChange={handleChatInputChange}
            placeholder={isSpectator ? "Spectating..." : `Message ${agentName}...`}
            disabled={isSpectator}
            style={{ 
              flex: 1,
              height: '36px',
              background: '#0e0e0e',
              border: '1px solid #222222',
              borderRadius: '8px',
              color: '#f2f2f2',
              fontSize: '14px',
              padding: '0 12px',
              fontFamily: "'Inter', sans-serif",
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onFocus={(e) => { e.target.style.borderColor = '#e63946'; e.target.style.boxShadow = '0 0 0 2px rgba(230,57,70,0.12)'; }}
            onBlur={(e) => { e.target.style.borderColor = '#222222'; e.target.style.boxShadow = 'none'; }}
          />
          <button 
            data-testid="chat-send"
            type="submit"
            disabled={isSpectator || !chatInput.trim()}
            style={{
              width: '36px',
              height: '36px',
              background: (!isSpectator && chatInput.trim()) ? '#e63946' : 'rgba(230,57,70,0.5)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (!isSpectator && chatInput.trim()) ? 'pointer' : 'default',
              border: 'none',
              color: 'white',
              transition: 'all 0.15s ease'
            }}
            className={(!isSpectator && chatInput.trim()) ? "hover:bg-[#c62a35] active:scale-95 shadow-[0_2px_8px_rgba(230,57,70,0.4)]" : ""}
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* GAME INFOBAR & MOVE HISTORY (Mobile Desktop unified) */}
      <div 
        className="flex flex-col bg-[#050505] border-t border-[#1a1a1a] flex-1 min-h-0 shrink-0"
        style={{ zIndex: 10, flexShrink: 0 }}
      >
        <div 
          onClick={() => setMoveHistoryOpen(!moveHistoryOpen)}
          className="flex justify-between items-center px-4 cursor-pointer"
          style={{ height: '44px', flexShrink: 0 }}
        >
          <div className="flex items-center gap-3">
            {game?.status === 'waiting' && !agentConnected ? (
              <span style={{ background: '#1a1a1a', color: 'rgba(242,242,242,0.3)', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '11px', letterSpacing: '0.1em', borderRadius: '6px', padding: '4px 12px', transition: 'all 0.3s ease' }}>
                WAITING
              </span>
            ) : game?.status === 'finished' || game?.status === 'abandoned' ? (
              <span style={{ background: 'rgba(230,57,70,0.1)', color: '#e63946', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '11px', letterSpacing: '0.1em', borderRadius: '6px', padding: '4px 12px', transition: 'all 0.3s ease' }}>
                GAME OVER
              </span>
            ) : game?.turn === (game?.player_color || 'w') ? (
              <span style={{ background: '#e63946', color: 'white', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '11px', letterSpacing: '0.1em', borderRadius: '6px', padding: '4px 12px', transition: 'all 0.3s ease' }}>
                YOUR TURN
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span style={{ background: '#1a1a1a', color: 'rgba(242,242,242,0.3)', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '11px', letterSpacing: '0.1em', borderRadius: '6px', padding: '4px 12px', transition: 'all 0.3s ease' }}>
                  WAITING
                </span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'rgba(242,242,242,0.25)' }}>
                  Waiting for {agentName}...
                </span>
              </div>
            )}
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: 'rgba(242,242,242,0.3)' }}>
              Move {currentMoveNumber}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(242,242,242,0.35)' }}>
              {moveHistoryOpen ? 'MOVE HISTORY · ' + ((game.move_history || []).length) + ' MOVES' : 'MOVE HISTORY · ' + ((game.move_history || []).length) + ' MOVES'}
            </span>
            <ChevronDown size={16} className={`text-neutral-500 transition-transform duration-300 ${moveHistoryOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        <div className={`overflow-y-auto scrollbar-none bg-[#0a0a0a] transition-all duration-300 ${moveHistoryOpen ? 'opacity-100 py-1 px-1' : 'opacity-0 h-0 hidden'}`} style={{ maxHeight: '150px' }}>
          <div className="py-2 px-3">
            {!(game.move_history || []).length ? (
              <div className="font-sans text-xs text-neutral-500 text-center py-4 flex flex-col items-center gap-1">
                <span className="text-lg opacity-40">🦞</span>
                No moves yet
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-[28px_1fr_1fr] gap-x-2 gap-y-1 mb-2">
                  <div className="font-sans text-[9px] text-neutral-500 uppercase tracking-widest border-b border-[#1a1a1a] pb-1 mb-1">#</div>
                  <div className="font-sans text-[9px] text-neutral-500 uppercase tracking-widest border-b border-[#1a1a1a] pb-1 mb-1">You</div>
                  <div className="font-sans text-[9px] text-neutral-500 uppercase tracking-widest border-b border-[#1a1a1a] pb-1 mb-1">{agentName}</div>
                </div>
                {Array.from({ length: Math.ceil((game.move_history || []).length / 2) }).map((_, i) => {
                  const wMove = game.move_history[i * 2];
                  const bMove = game.move_history[i * 2 + 1];
                  const isLatestW = i * 2 === game.move_history.length - 1;
                  const isLatestB = i * 2 + 1 === game.move_history.length - 1;
                  return (
                    <div key={i} className="grid grid-cols-[28px_1fr_1fr] gap-x-2 items-center py-1 px-1 rounded transition-colors group hover:bg-[#141414] cursor-default border border-transparent">
                      <div style={{ color: 'rgba(242,242,242,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>{i + 1}.</div>
                      <div className={`py-1 px-1.5 rounded transition-all flex items-center h-6 ${isLatestW ? 'bg-red-500/10 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.15)] text-[#e63946]' : 'border-transparent'}`} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: isLatestW ? '#e63946' : '#f2f2f2' }}>
                        {wMove?.san}
                      </div>
                      <div className={`py-1 px-1.5 rounded transition-all flex items-center h-6 ${isLatestB ? 'bg-red-500/10 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.15)] text-[#e63946]' : 'border-transparent'}`} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: isLatestB ? '#e63946' : (bMove ? '#f2f2f2' : 'transparent') }}>
                        {bMove?.san || ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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

      {showGameOverModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-[340px] w-full text-center relative shadow-[0_0_40px_rgba(220,38,38,0.15)] glow-anim backdrop-blur-md">
            <button data-testid="close-game-over-modal" onClick={handleCloseGameOverModal} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10">
              <XIcon size={18} />
            </button>
            <div className="text-5xl mb-4 drop-shadow-md">
              {game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? '🏆' : game?.result === 'draw' ? '🤝' : '🦞'}
            </div>
            <div className="font-serif text-3xl text-white mb-2 font-bold tracking-wide">
              {game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'You Won!' : game?.result === 'draw' ? "It's a Draw!" : `${agentName} Won!`}
            </div>
              <div className="font-sans text-sm text-neutral-400 mb-6 font-medium">
                {game.result_reason === 'checkmate' ? 'by checkmate' :
                 game.result_reason === 'stalemate' ? 'by stalemate' :
                 game.result_reason === 'insufficient_material' ? 'insufficient material' :
                 game.result_reason === 'threefold_repetition' ? 'by repetition' :
                 game.result_reason === 'fifty_moves' ? 'fifty-move rule' :
                 game.result_reason === 'resignation' ? 'by resignation' :
                 game.result_reason === 'abandoned' ? 'by abandonment' :
                 game.result_reason === 'agreement' ? 'by agreement' : game.result_reason}
              </div>
              <div className="font-sans text-xs text-neutral-500 mb-8 border-t border-white/5 pt-4">
                Game lasted {Math.floor((game.move_history || []).length / 2) + ((game.move_history || []).length % 2)} moves
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  data-testid="analyze-lichess-button"
                  onClick={() => {
                    const fen = game.fen.replace(/ /g, '_');
                    window.open(`https://lichess.org/analysis/standard/${fen}`, '_blank');
                  }}
                  className="bg-red-600 text-white font-semibold flex items-center justify-center py-3.5 rounded-xl w-full transition-all active:scale-95 hover:bg-red-500 shadow-[0_0_20px_-5px_rgba(239,68,68,0.4)]"
                >
                  Analyze on Lichess
                </button>
                <button 
                  data-testid="review-game-button"
                  onClick={() => setShowGameOverModal(false)}
                  className="bg-white/5 text-white border border-white/10 font-semibold py-3.5 rounded-xl w-full transition-all hover:bg-white/10 active:scale-95"
                >
                  Review Board
                </button>
                <button 
                  data-testid="rematch-button"
                  onClick={handleRematch}
                  className="bg-transparent text-neutral-300 hover:text-white font-medium py-2 w-full transition-colors underline decoration-white/20 underline-offset-4 hover:decoration-white/50 text-sm"
                >
                  Rematch
                </button>
                <div className="flex gap-3 mt-2">
                  <button 
                    data-testid="share-result-button"
                    onClick={handleShareResult}
                    className="flex-1 bg-white/5 text-neutral-400 hover:text-white border border-white/5 hover:border-white/20 font-medium py-2.5 rounded-lg transition-all text-sm"
                  >
                    Share
                  </button>
                  <button 
                    data-testid="go-home-button"
                    onClick={() => navigate('/')}
                    className="flex-1 bg-white/5 text-neutral-400 hover:text-white border border-white/5 hover:border-white/20 font-medium py-2.5 rounded-lg transition-all text-sm"
                  >
                    Home
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL (Untouched) */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Settings" size="md">
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] tracking-wider uppercase">Preferences</h3>
            <div className="space-y-2">
              <label className="text-sm text-[var(--color-text-secondary)]">Board Theme</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'green', colors: ['#f0d9b5', '#739552'] },
                  { id: 'brown', colors: ['#f0d9b5', '#b58863'] },
                  { id: 'slate', colors: ['#8ca2ad', '#4f6f7e'] },
                  { id: 'navy', colors: ['#9db2c2', '#445b73'] }
                ].map(theme => (
                  <button
                    data-testid={`theme-button-${theme.id}`}
                    key={theme.id}
                    onClick={() => {
                      setBoardTheme(theme.id);
                      localStorage.setItem('cwc_theme', theme.id);
                    }}
                    className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${boardTheme === theme.id ? 'border-[var(--color-red-primary)]' : 'border-transparent hover:border-[var(--color-border-default)]'}`}
                    title={theme.id}
                  >
                    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                      <div style={{ backgroundColor: theme.colors[0] }}></div>
                      <div style={{ backgroundColor: theme.colors[1] }}></div>
                      <div style={{ backgroundColor: theme.colors[1] }}></div>
                      <div style={{ backgroundColor: theme.colors[0] }}></div>
                    </div>
                    {boardTheme === theme.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Check size={16} className="text-white drop-shadow-md" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[var(--color-text-secondary)]">Piece Style</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'merida', label: 'Merida', icon: '♘' },
                  { id: 'cburnett', label: 'Standard', icon: '♞' },
                  { id: 'alpha', label: 'Alpha', icon: '♙' },
                  { id: 'unicode', label: 'Classic', icon: '♚' }
                ].map(piece => (
                  <button
                    data-testid={`piece-button-${piece.id}`}
                    key={piece.id}
                    onClick={() => {
                      setPieceTheme(piece.id);
                      localStorage.setItem('cwc_pieces', piece.id);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-md border transition-all ${pieceTheme === piece.id ? 'bg-[var(--color-red-primary)]/10 border-[var(--color-red-primary)] text-white' : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)] hover:text-white'}`}
                  >
                    <span className="text-2xl leading-none">{piece.icon}</span>
                    <span className="text-sm font-medium">{piece.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Sound Effects</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Play sounds for moves and captures</p>
              </div>
              <button 
                data-testid="toggle-sound-button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-md transition-colors ${soundEnabled ? 'bg-[var(--color-red-primary)] text-white' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]'}`}
              >
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
            </div>
          </div>
          <Divider />
          <div>
            <label>Game ID</label>
            <code style={{fontSize:11,color:'#888'}}>{gameId}</code>
          </div>
          <Divider />
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] tracking-wider uppercase">Game Controls</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                data-testid="draw-button"
                onClick={handleDraw}
                disabled={game?.status === 'finished' || game?.status === 'abandoned'}
                variant="secondary"
                className={confirmDraw ? 'bg-yellow-600/20 text-yellow-500 border-yellow-600/50 hover:bg-yellow-600/30' : ''}
              >
                {confirmDraw ? 'Confirm Draw?' : 'Offer Draw'}
              </Button>
              <Button 
                data-testid="resign-button"
                onClick={handleResign}
                disabled={game?.status === 'finished' || game?.status === 'abandoned'}
                variant="danger"
                className={confirmResign ? 'animate-pulse' : ''}
                leftIcon={!confirmResign && <Flag size={16} />}
              >
                {confirmResign ? 'Confirm Resign?' : 'Resign'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,400;1,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
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
          0% { transform: scale(1) translateY(0); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
          100% { transform: scale(1.15) translateY(-4px); filter: drop-shadow(0 8px 12px rgba(0,0,0,0.4)); }
        }
        @keyframes pieceDrop {
          0% { transform: scale(1.15) translateY(-4px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes pieceCapture {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.5); opacity: 0; }
        }
        @keyframes boardShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        @keyframes agentMoveFlash {
          0% { background-color: rgba(230, 57, 70, 0.6); }
          100% { background-color: rgba(255, 213, 79, 0.3); }
        }
        @keyframes pieceEntrance {
          0% { opacity: 0; transform: scale(0.8) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes boardThinkingGlow {
          0%, 100% { box-shadow: 0 0 0 1px #0f0f0f, 0 4px 24px rgba(0,0,0,0.8); }
          50% { box-shadow: 0 0 0 1px #0f0f0f, 0 4px 24px rgba(230,57,70,0.2), 0 0 12px rgba(230,57,70,0.1); }
        }
        @keyframes checkPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        input::placeholder { color: #888; }
      `}} />
    </div>
  );
}
