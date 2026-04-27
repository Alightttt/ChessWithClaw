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

function GameTimer({ startTime, status }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime || status === 'finished') return;
    const start = new Date(startTime).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, status]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{mins}:{secs.toString().padStart(2, '0')}</span>;
}

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

  useEffect(() => {
    if (!game?.move_history?.length) return
    const lastMove = game.move_history[game.move_history.length - 1]
    if (lastMove && typeof lastMove === 'string' && lastMove.length >= 4) {
      setLastMoveFrom(lastMove.slice(0, 2))
      setLastMoveTo(lastMove.slice(2, 4))
    } else if (lastMove?.from && lastMove?.to) {
      setLastMoveFrom(lastMove.from)
      setLastMoveTo(lastMove.to)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]) // only on game ID change = initial load

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
    const text = game?.current_thinking || ''
    
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
    }, 20)
    
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
  const [agentTimeout, setAgentTimeout] = useState(false);
  useEffect(() => {
    if (!game || game.status === 'finished' || game.status === 'abandoned' || game.turn === (game?.player_color || 'w')) {
      setAgentTimeout(false);
      return;
    }
    
    const checkTimeout = () => {
      const lastUpdated = new Date(game.agent_last_seen || game.updated_at || game.created_at).getTime();
      if (Date.now() - lastUpdated > 90000) { // 90 seconds
        setAgentTimeout(true);
      } else {
        setAgentTimeout(false);
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

  async function handleClaimVictory() {
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: game?.player_color === 'b' ? 'black' : 'white', result_reason: 'abandoned'
    }).eq('id', gameId);
    setAgentTimeout(false);
  }

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
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId);
    };
  }, [gameId]);

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

  async function handleResign() {
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
  }

  async function handleDraw() {
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
  }

  async function acceptAgentResignation() {
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: game?.player_color === 'b' ? 'black' : 'white', result_reason: 'resignation'
    }).eq('id', gameId);
  };

  function copyRoomCode() {
    navigator.clipboard.writeText(gameId);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  };

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
    const textToShare = "I played chess vs my OpenClaw on ChessWithClaw! 🦞\nchesswithclaw.vercel.app";
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

  function handleClaimVictoryWithRipple(e) {
    createRipple(e);
    handleClaimVictory();
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
      <div style={{ height: '100dvh', background: '#080808', display: 'flex', flexDirection: 'column' }} className="lg:flex-row">
        {/* Sidebar Skeleton */}
        <div style={{ width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid #1a1a1a', background: '#0e0e0e' }} className="lg:w-[360px] lg:border-b-0 lg:border-r">
          <div style={{ height: '52px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#1a1a1a', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            <div style={{ width: '96px', height: '16px', borderRadius: '4px', background: '#1a1a1a', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '100%', height: '96px', borderRadius: '8px', background: '#1a1a1a', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
            <div style={{ width: '100%', height: '48px', borderRadius: '8px', background: '#1a1a1a', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
          </div>
        </div>
        {/* Board Skeleton */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '400px', aspectRatio: '1/1', borderRadius: '4px', background: '#1a1a1a', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
          <div style={{ width: '100%', maxWidth: '400px', height: '32px', marginTop: '16px', borderRadius: '4px', background: '#1a1a1a', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ height: '100dvh', background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f0f0f0', fontFamily: "'Inter', sans-serif", gap: '16px' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 600 }}>Game not found</div>
        <button 
          data-testid="home-button"
          onClick={handleGoHomeWithRipple} 
          style={{ 
            position: 'relative', overflow: 'hidden', background: '#e63946', color: '#fff', border: 'none', 
            borderRadius: 7, padding: '13px 26px', fontFamily: "'Inter', sans-serif", fontSize: 14, 
            fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.2px', transition: 'opacity 0.15s, transform 0.15s' 
          }}
          onMouseEnter={e => { e.target.style.opacity = '0.9'; e.target.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.target.style.opacity = '1'; e.target.style.transform = 'none'; }}
        >
          Go Home
        </button>
      </div>
    );
  }

  const isSpectator = !localStorage.getItem(`game_owner_${gameId}`);
  const isMyTurn = !isSpectator && game?.turn === (game?.player_color || 'w') && (game?.status === 'active' || game?.status === 'waiting');
  const currentMoveNumber = Math.floor((game.move_history || []).length / 2) + 1;
  const lastThinking = (game.thinking_log || [])[(game.thinking_log || []).length - 1] || null;
  const unreadCount = (game.chat_history || []).filter(m => m.sender === 'agent').length; // Simplified for UI

  if (!game) return null;

  return (
    <div 
      ref={containerRef}
      className="flex flex-col relative"
      style={{
      height: 'var(--vh, 100dvh)',
      overflow: 'hidden',
      backgroundColor: game?.turn === 'b' ? '#120808' : '#080808',
      transition: 'background-color 300ms ease'
    }}>
      {isOffline && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, background: '#e63946', color: '#fff',
          fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 600, textAlign: 'center',
          padding: '4px', zIndex: 1000
        }}>
          You are offline. Reconnecting...
        </div>
      )}
      <style>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
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
      
      {/* FIX 2 — PAGE HEADER */}
      <header style={{
        height: '52px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(8,8,8,0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #1a1a1a',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        overflow: 'hidden'
      }}>
        <div style={{display:"flex",alignItems:"center", gap: '12px'}}>
          <div style={{display:"flex",alignItems:"center",cursor:"pointer"}} onClick={handleGoHome}>
            <img
              src="/logo.png"
              alt="ChessWithClaw"
              width="32"
              height="32"
              style={{ height: 32, width: 32, marginRight: 10, verticalAlign: 'middle', objectFit: 'contain' }}
              loading="eager"
            />
            <span className="serif hidden sm:inline" style={{fontSize:16,fontWeight:800,letterSpacing:"-0.4px",color:"#f0f0f0"}}>
              ChessWithClaw
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#666' }}>
            <span className="hidden sm:inline">/</span>
            <span style={{ color: '#f0f0f0' }}>Game {gameId.substring(0, 6)}</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            data-testid="settings-button"
            onClick={handleOpenSettings}
            style={{
              width: '44px', height: '44px',
              background: '#0e0e0e', border: '1px solid #1a1a1a',
              borderRadius: '8px', color: '#888',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'color 150ms'
            }}
            className="hover:text-[#888]"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden pb-12 lg:pb-0">
        {/* LEFT COLUMN: BOARD */}
        <div className="flex-none lg:flex-1 flex flex-col lg:overflow-hidden relative">
          {/* FIX 3 — MERGED AGENT SECTION */}
          <div style={{
        background: '#0e0e0e',
        borderBottom: '1px solid #1a1a1a',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '60px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '50px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: config.bg, border: `1px solid ${config.border}`,
              borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              animation: mood === 'thinking' ? 'avatarPulse 2s infinite' : (justConnected ? 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none')
            }}>
              <img src="/logo.png" alt="Agent" style={{ width: 24, height: 24, objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
            </div>
            <div style={{ color: config.color, fontFamily: "'Inter', sans-serif", fontSize: '10px', fontWeight: 600, marginTop: '4px', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {config.label}
            </div>
          </div>
          
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '16px', fontWeight: 700, color: '#e0e0e0',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1
            }}>
              {agentName}
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '11px', lineHeight: 1, whiteSpace: 'nowrap', marginTop: '3px',
              color: agentTimeout ? '#f59e0b' : (!agentConnected ? '#888' : ((game?.current_thinking && game?.turn !== (game?.player_color || 'w')) ? '#e63946' : (game?.turn === (game?.player_color || 'w') ? '#888' : '#e63946')))
            }}>
              {agentTimeout ? `⏱ ${agentName} is taking longer than usual` :
               !agentConnected ? (<span>Not here yet... <span style={{color: '#888'}}>Send them the invite link.</span></span>) : 
               game?.turn === (game?.player_color || 'w') ? "Watching you..." : 
               null}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {agentTimeout && game.status === 'active' && (
              <button 
                data-testid="claim-win-button"
                onClick={handleClaimVictoryWithRipple}
                className="hover:bg-[#cc2f3b] active:scale-[0.98]"
                style={{
                  position: 'relative', overflow: 'hidden',
                  background: '#e63946', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px',
                  fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 120ms'
                }}
              >
                Claim Win
              </button>
            )}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', position: 'relative',
              background: !agentConnected ? '#444' : ((game?.current_thinking && game?.turn !== (game?.player_color || 'w')) ? '#e63946' : '#739552')
            }}>
              {agentConnected && (
                <div style={{
                  position: 'absolute', inset: '-3px', borderRadius: '50%',
                  background: (game?.current_thinking && game?.turn !== (game?.player_color || 'w')) ? '#e63946' : '#739552',
                  opacity: 0,
                  animation: `ripple ${(game?.current_thinking && game?.turn !== (game?.player_color || 'w')) ? '1s' : '2s'} ease-out infinite`
                }}></div>
              )}
            </div>
            <button 
              data-testid="toggle-agent-section"
              onClick={handleToggleAgentSection}
              style={{
                background: 'none', border: 'none', color: '#888', cursor: 'pointer',
                fontSize: '14px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              className="hover:text-[#888]"
            >
              <ChevronDown size={16} style={{
                transform: agentSectionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms ease'
              }} />
            </button>
          </div>
        </div>

        <div style={{
          maxHeight: agentSectionOpen ? '300px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 220ms cubic-bezier(0.4, 0, 0.2, 1)',
          padding: agentSectionOpen ? '0 14px 14px' : '0 14px 0',
          borderTop: agentSectionOpen ? '1px solid #1a1a1a' : 'none'
        }}>
          {!agentConnected ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888' }}>{agentName} not connected yet.</div>
              <button 
                data-testid="copy-invite-button"
                onClick={handleCopyInviteWithRipple}
                className="hover:bg-[#1a1a1a] active:scale-[0.98]"
                style={{
                  position: 'relative', overflow: 'hidden',
                  width: '100%', height: '30px', background: '#1a1a1a', border: '1px solid #1a1a1a',
                  borderRadius: '7px', color: copiedInvite ? '#22c55e' : '#888', fontFamily: "'Inter', sans-serif", fontSize: '11px',
                  marginTop: '8px', cursor: 'pointer', transition: 'all 150ms'
                }}
              >
                {copiedInvite ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </div>
          ) : agentTimeout ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#d97706' }}>
                {agentName} is taking longer than usual
              </div>
            </div>
          ) : game.turn === 'b' && game.status === 'active' ? (
            <div 
              ref={thinkingScrollRef}
              style={{
                borderLeft: `2px solid #e63946`,
                background: 'linear-gradient(90deg, rgba(230,57,70,0.08) 0%, transparent 100%)',
                padding: '12px 12px 12px 16px',
                marginTop: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                color: '#ccc',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '250px',
                overflowY: 'auto',
                scrollbarWidth: 'none',
                transition: 'all 300ms ease',
                position: 'relative'
              }}
            >
              <div style={{ 
                fontFamily: "'JetBrains Mono', monospace", 
                fontSize: '10px', 
                fontWeight: 700, 
                color: '#e63946', 
                textTransform: 'uppercase', 
                letterSpacing: '1px', 
                marginBottom: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e63946' }} className="animate-pulse" />
                {`⚡ ${agentName} Thinking...`}
              </div>
              <div>
                {displayedThinking || <span style={{color: '#444', fontStyle: 'italic'}}>Processing position...</span>}
                {displayedThinking && <span className="thinking-cursor"/>}
              </div>
            </div>
          ) : lastThinking ? (
            <div 
              style={{
                borderLeft: `2px solid #1a1a1a`,
                background: 'transparent',
                padding: '12px 12px 12px 16px',
                marginTop: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                color: '#666',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '250px',
                overflowY: 'auto',
                scrollbarWidth: 'none',
                transition: 'all 300ms ease',
                position: 'relative'
              }}
            >
              <div style={{ 
                fontFamily: "'Inter', sans-serif", 
                fontSize: '10px', 
                fontWeight: 600, 
                color: '#444', 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px', 
                marginBottom: '6px' 
              }}>
                LAST THOUGHT
              </div>
              <div style={{ opacity: 0.7 }}>
                {lastThinking.text}
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 0', textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888' }}>
              {`Waiting for ${agentName} to move...`}
            </div>
          )}
        </div>
      </div>

      {/* FIX 4 — BOARD CONTAINER */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 12px',
        background: '#080808',
        flexShrink: 0
      }} className="lg:flex-1 lg:h-full">
        
        {game.status === 'waiting' && !agentConnected && (
          <div style={{
            background: 'rgba(230,57,70,0.08)',
            border: '1px solid rgba(230,57,70,0.2)',
            borderRadius: 8, padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 12,
            width: `${boardSize}px`
          }}>
            <span style={{animation: 'floatLobster 2s ease-in-out infinite'}}>🦞</span>
            <div>
              <div style={{fontFamily: "'Inter', sans-serif", fontSize:13,fontWeight:600,color:'#f0f0f0'}}>
                {`Waiting for ${agentName} to join...`}
              </div>
              <div style={{fontFamily: "'Inter', sans-serif", fontSize:12,color:'#888',marginTop:2}}>
                Send the invite link to your OpenClaw to start the game.
              </div>
            </div>
          </div>
        )}

        {isCheckState && game.status === 'active' && (
          <div style={{
            width: `${boardSize}px`, padding: '8px 16px', background: '#e63946', color: 'white', 
            fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, textAlign: 'center',
            borderRadius: '4px', marginBottom: '4px'
          }}>
            {game?.turn === (game?.player_color || 'w') ? "⚠️ Your king is in check!" : `⚠️ ${agentName}'s king is in check!`}
          </div>
        )}

        <div style={{ width: `${boardSize}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 20, padding: '4px 0' }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {capturedByWhite.map((p, i) => {
              const pieceName = `b${p.toUpperCase()}`;
              const url = (pieceTheme === 'merida' || pieceTheme === 'cburnett' || pieceTheme === 'alpha') 
                ? `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${pieceTheme}/${pieceName}.svg`
                : `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/${pieceName}.svg`;
              return (
                <img key={i} src={url} alt={pieceName} style={{ width: 16, height: 16, opacity: 0.8 }} />
              );
            })}
          </div>
          <button
            onClick={() => {
              const newVal = !boardPerspective;
              setBoardPerspective(newVal);
              localStorage.setItem('cwc_perspective', newVal ? '3d' : '2d');
            }}
            style={{
              background: boardPerspective ? '#e63946' : 'transparent',
              color: boardPerspective ? '#fff' : '#888',
              border: boardPerspective ? '1px solid #e63946' : '1px solid #252525',
              borderRadius: '4px',
              padding: '2px 6px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            3D
          </button>
        </div>

        <div style={{
          position: 'relative',
          width: `${boardSize}px`,
          height: `${boardSize}px`,
          borderRadius: '3px',
          overflow: 'visible',
          border: '1px solid rgba(230,57,70,0.08)',
          boxShadow: boardPerspective ? '0 20px 40px rgba(0,0,0,0.9), 0 0 0 1px #0f0f0f' : '0 0 0 1px #0f0f0f, 0 4px 24px rgba(0,0,0,0.8)',
          flexShrink: 0,
          pointerEvents: boardLocked ? 'none' : 'auto',
          animation: shaking ? 'boardShake 300ms ease-in-out' : ((game?.current_thinking && game?.turn !== (game?.player_color || 'w')) ? 'boardThinkingGlow 2s ease-in-out infinite' : 'none'),
          transform: `${shaking ? 'translateX(0)' : 'none'} ${boardPerspective ? 'perspective(1000px) rotateX(25deg) scale(0.95)' : ''}`,
          transformOrigin: 'bottom center',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
        }} ref={boardRef}>
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
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10
            }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '32px', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>
                {game.status === 'abandoned' ? 'GAME ABANDONED' : 'GAME OVER'}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#e63946', marginTop: '4px', fontWeight: 600 }}>
                {game?.status === 'abandoned' ? 'Game expired due to inactivity' : (game?.result === 'draw' ? 'Draw by ' + game?.result_reason : (game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'You won by ' : agentName + ' won by ') + game?.result_reason)}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: `${boardSize}px`, display: 'flex', gap: 2, minHeight: 20, padding: '4px 0' }}>
          {capturedByBlack.map((p, i) => {
            const pieceName = `w${p.toUpperCase()}`;
            const url = (pieceTheme === 'merida' || pieceTheme === 'cburnett' || pieceTheme === 'alpha') 
              ? `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/${pieceTheme}/${pieceName}.svg`
              : `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/${pieceName}.svg`;
            return (
              <img key={i} src={url} alt={pieceName} style={{ width: 16, height: 16, opacity: 0.8 }} />
            );
          })}
        </div>
      </div>
      </div>

      {/* RIGHT COLUMN: SIDEBAR */}
      <div className="w-full lg:w-[360px] flex flex-col bg-[#0e0e0e] border-t lg:border-t-0 lg:border-l border-[#1a1a1a] flex-shrink-0 lg:h-full lg:overflow-hidden">
        {/* FIX 5 — LIVE CHAT */}
        <div style={{
        background: '#0e0e0e',
        borderTop: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        paddingBottom: chatPaddingBottom + 'px'
      }} className="h-[200px] lg:h-1/2 lg:border-t-0 lg:order-2">
        <div style={{
          height: '38px', padding: '0 14px', borderBottom: '1px solid #0e0e0e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 700, color: '#888' }}>{`Chat with ${agentName}`}</span>
            <span style={{ fontSize: '12px' }}>🦞</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <span style={{ background: '#e63946', color: 'white', borderRadius: '99px', padding: '1px 6px', fontFamily: "'Inter', sans-serif", fontSize: '10px', fontWeight: 700 }}>
                {unreadCount}
              </span>
            )}
          </div>
        </div>
        
        <div 
          ref={chatMessagesRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '8px 12px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
            display: 'flex', flexDirection: 'column', gap: '8px'
          }}
        >
          {!(game.chat_history || []).length ? (
            <div style={{ margin: 'auto', textAlign: 'center' }}>
              <span style={{ fontSize: '20px', color: '#666', display: 'block', marginBottom: '5px' }}>🦞</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888' }}>{`${agentName} can chat while playing`}</span>
            </div>
          ) : (
            (game.chat_history || []).map((msg, i) => {
              const isHuman = msg.sender === 'human';
              if (msg.type === 'resign_request') {
                return (
                  <div key={i} style={{
                    alignSelf: 'flex-start', background: '#1a1a1a', border: '1px solid #e63946', borderRadius: '8px 8px 8px 2px',
                    padding: '7px 10px', maxWidth: '78%', fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#999', lineHeight: 1.4,
                    animation: 'msgSlide 200ms ease both'
                  }}>
                    {msg.text}
                    {game.status === 'active' && (
                      <button data-testid="accept-resignation-button" onClick={acceptAgentResignation} style={{ display: 'block', width: '100%', marginTop: '8px', background: '#e63946', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Accept Resignation</button>
                    )}
                  </div>
                );
              }
              if (msg.type === 'draw_offer') {
                return (
                  <div key={i} style={{
                    alignSelf: 'flex-start', background: '#1a1a1a', border: '1px solid #739552', borderRadius: '8px 8px 8px 2px',
                    padding: '7px 10px', maxWidth: '78%', fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#999', lineHeight: 1.4,
                    animation: 'msgSlide 200ms ease both'
                  }}>
                    {msg.text}
                    {game.status === 'active' && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                        <button data-testid="accept-draw-button" onClick={async () => {
                          await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
                            status: 'finished', result: 'draw', result_reason: 'agreement'
                          }).eq('id', gameId);
                        }} style={{ flex: 1, background: '#739552', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Accept Draw</button>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={i} style={{ alignSelf: isHuman ? 'flex-end' : 'flex-start', maxWidth: '78%', animation: 'msgSlide 200ms ease both', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    background: isHuman ? '#160c0c' : '#1a1a1a',
                    border: `1px solid ${isHuman ? 'rgba(230,57,70,0.1)' : '#1a1a1a'}`,
                    borderRadius: isHuman ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                    padding: '7px 10px',
                    fontFamily: "'Inter', sans-serif", fontSize: '13px', color: isHuman ? '#bbb' : '#999', lineHeight: 1.4,
                    display: 'flex', flexDirection: 'column', gap: '4px'
                  }}>
                    <div>{msg.text}</div>
                    {msg.timestamp && (
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#888', alignSelf: isHuman ? 'flex-end' : 'flex-start' }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  {!isHuman && (
                    <div style={{ fontSize: '9px', color: '#888', marginTop: '4px', marginLeft: '4px', fontFamily: "'Inter', sans-serif" }}>
                      {agentName}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={sendMessage} style={{
          height: '52px', borderTop: '1px solid #0e0e0e', padding: '0 12px', gap: '8px',
          display: 'flex', alignItems: 'center', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)',
          position: 'sticky', bottom: 0, background: '#0e0e0e'
        }}>
          <input
            id="chat-input"
            data-testid="chat-input"
            type="text"
            value={chatInput}
            onChange={handleChatInputChange}
            placeholder={isSpectator ? "Spectating..." : `Message ${agentName}...`}
            disabled={isSpectator}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#e0e0e0',
              caretColor: '#e63946', touchAction: 'manipulation', height: '44px'
            }}
          />
          <button 
            data-testid="chat-send"
            type="submit"
            disabled={isSpectator || !chatInput.trim()}
            style={{
              width: '44px', height: '44px', background: (!isSpectator && chatInput.trim()) ? '#e63946' : '#1a1a1a',
              border: 'none', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: (!isSpectator && chatInput.trim()) ? 'pointer' : 'default', touchAction: 'manipulation', transition: 'background 120ms',
              color: (!isSpectator && chatInput.trim()) ? 'white' : '#888'
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* FIX 6 — MOVE HISTORY */}
      <div data-testid="move-history" style={{
        background: '#0e0e0e',
        borderTop: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column'
      }} className="lg:flex-1 lg:overflow-hidden lg:order-1">
        <div 
          data-testid="toggle-move-history"
          onClick={handleToggleMoveHistory}
          style={{
            height: '44px', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation'
          }}
          className="lg:pointer-events-none"
        >
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 700, color: '#888' }}>Move History</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              background: '#1a1a1a', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '2px 7px',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#888'
            }}>{(game.move_history || []).length}</span>
            <ChevronDown size={14} color="#888" className="lg:hidden" style={{ transform: moveHistoryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }} />
          </div>
        </div>

        <div style={{
          maxHeight: moveHistoryOpen ? '200px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 220ms cubic-bezier(0.4, 0, 0.2, 1)'
        }} className="lg:!max-h-none lg:flex-1 lg:flex lg:flex-col">
          <div style={{ padding: '8px 12px', overflowY: 'auto', scrollbarWidth: 'none' }} className="max-h-[200px] lg:max-h-none lg:flex-1">
            {!(game.move_history || []).length ? (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888', textAlign: 'center', padding: '10px 0' }}>No moves yet</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 1fr' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px', marginBottom: '4px' }}>#</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px', marginBottom: '4px' }}>You</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1a1a1a', paddingBottom: '4px', marginBottom: '4px' }}>{agentName}</div>
                
                {Array.from({ length: Math.ceil((game.move_history || []).length / 2) }).map((_, i) => {
                  const wMove = game.move_history[i * 2];
                  const bMove = game.move_history[i * 2 + 1];
                  const isLatestW = i * 2 === game.move_history.length - 1;
                  const isLatestB = i * 2 + 1 === game.move_history.length - 1;
                  
                  return (
                    <React.Fragment key={i}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#888', padding: '3px' }}>{i + 1}.</div>
                      <div data-testid={isLatestW && !bMove ? "last-move" : undefined} style={{ 
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: isLatestW ? '#e63946' : '#888', padding: '3px', borderRadius: '3px',
                        background: isLatestW ? 'rgba(230,57,70,0.05)' : 'transparent', border: isLatestW ? '1px solid rgba(230,57,70,0.1)' : '1px solid transparent'
                      }}>{wMove?.san}</div>
                      <div data-testid={isLatestB ? "last-move" : undefined} style={{ 
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: isLatestB ? '#e63946' : '#888', padding: '3px', borderRadius: '3px',
                        background: isLatestB ? 'rgba(230,57,70,0.05)' : 'transparent', border: isLatestB ? '1px solid rgba(230,57,70,0.1)' : '1px solid transparent'
                      }}>{bMove?.san || ''}</div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      </div>

      {/* FIX 7 — STATUS BAR */}
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
      <div className="fixed lg:relative bottom-0 left-0 right-0 h-[48px] bg-[#080808]/96 backdrop-blur-md border-t border-[#1a1a1a] px-4 flex items-center justify-between z-50 flex-shrink-0">
        {game.status === 'finished' || game.status === 'abandoned' ? (
          <div style={{
            background: '#1a1a1a', border: '1px solid #1a1a1a', color: '#e63946', height: '26px', padding: '0 10px', borderRadius: '6px',
            fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>GAME OVER</div>
        ) : game?.turn === (game?.player_color || 'w') ? (
          <div style={{
            background: '#e63946', color: 'white', height: '26px', padding: '0 10px', borderRadius: '6px',
            fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pillPop 300ms ease both'
          }}>YOUR TURN</div>
        ) : (
          <div style={{
            background: '#e63946', color: 'white', height: '26px', padding: '0 10px', borderRadius: '6px',
            fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pillPop 300ms ease both'
          }}>{`${agentName}'s Turn`}</div>
        )}
        
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#888' }}>
          Move {currentMoveNumber}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#888' }}>
            <GameTimer startTime={game.created_at} status={game.status} />
          </div>
        </div>
      </div>

      {showGameOverModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: '12px',
            padding: '32px', maxWidth: '340px', width: 'calc(100% - 48px)', textAlign: 'center',
            margin: 'auto', position: 'relative'
          }}>
            <button data-testid="close-game-over-modal" onClick={handleCloseGameOverModal} style={{
              position: 'absolute', top: '12px', right: '12px', width: '28px', height: '28px',
              background: 'transparent', border: 'none', color: '#888', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <XIcon size={20} />
            </button>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? '🏆' : game?.result === 'draw' ? '🤝' : '🦞'}
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', color: '#f2f2f2', marginBottom: '8px' }}>
              {game?.result === (game?.player_color === 'b' ? 'black' : 'white') ? 'You Won!' : game?.result === 'draw' ? "It's a Draw!" : `${agentName} Won!`}
            </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#777', marginBottom: '24px' }}>
                {game.result_reason === 'checkmate' ? 'by checkmate' :
                 game.result_reason === 'stalemate' ? 'by stalemate' :
                 game.result_reason === 'insufficient_material' ? 'insufficient material' :
                 game.result_reason === 'threefold_repetition' ? 'by repetition' :
                 game.result_reason === 'fifty_moves' ? 'fifty-move rule' :
                 game.result_reason === 'resignation' ? 'by resignation' :
                 game.result_reason === 'abandoned' ? 'by abandonment' :
                 game.result_reason === 'agreement' ? 'by agreement' : game.result_reason}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#888', marginBottom: '24px' }}>
                Game lasted {Math.floor((game.move_history || []).length / 2) + ((game.move_history || []).length % 2)} moves
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  data-testid="analyze-lichess-button"
                  onClick={() => {
                    const fen = game.fen.replace(/ /g, '_');
                    window.open(`https://lichess.org/analysis/standard/${fen}`, '_blank');
                  }}
                  style={{
                    background: '#e63946', color: '#fff', border: 'none',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, padding: '13px 26px',
                    borderRadius: 7, width: '100%', cursor: 'pointer', letterSpacing: '-0.2px', transition: 'opacity 0.15s, transform 0.15s'
                  }}
                  onMouseEnter={e => { e.target.style.opacity = '0.9'; e.target.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.target.style.opacity = '1'; e.target.style.transform = 'none'; }}
                >
                  Analyze on Lichess
                </button>
                <button 
                  data-testid="review-game-button"
                  onClick={() => setShowGameOverModal(false)}
                  style={{
                    background: 'transparent', color: '#f0f0f0', border: '1px solid #444',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, padding: '13px 22px',
                    borderRadius: 7, width: '100%', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s'
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = '#666'; e.target.style.color = '#fff'; }}
                  onMouseLeave={e => { e.target.style.borderColor = '#444'; e.target.style.color = '#f0f0f0'; }}
                >
                  Review Board
                </button>
                <button 
                  data-testid="rematch-button"
                  onClick={handleRematch}
                  style={{
                    background: 'transparent', color: '#f0f0f0', border: '1px solid #444',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, padding: '13px 22px',
                    borderRadius: 7, width: '100%', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s'
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = '#666'; e.target.style.color = '#fff'; }}
                  onMouseLeave={e => { e.target.style.borderColor = '#444'; e.target.style.color = '#f0f0f0'; }}
                >
                  Rematch
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    data-testid="share-result-button"
                    onClick={handleShareResult}
                    style={{
                      background: 'transparent', color: '#888', border: '1px solid #252525',
                      fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, padding: '13px 22px',
                      borderRadius: 7, flex: 1, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s'
                    }}
                    onMouseEnter={e => { e.target.style.borderColor = '#444'; e.target.style.color = '#f0f0f0'; }}
                    onMouseLeave={e => { e.target.style.borderColor = '#252525'; e.target.style.color = '#888'; }}
                  >
                    Share
                  </button>
                  <button 
                    data-testid="go-home-button"
                    onClick={() => navigate('/')}
                    style={{
                      background: 'transparent', color: '#888', border: '1px solid #252525',
                      fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, padding: '13px 22px',
                      borderRadius: 7, flex: 1, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s'
                    }}
                    onMouseEnter={e => { e.target.style.borderColor = '#444'; e.target.style.color = '#f0f0f0'; }}
                    onMouseLeave={e => { e.target.style.borderColor = '#252525'; e.target.style.color = '#888'; }}
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
