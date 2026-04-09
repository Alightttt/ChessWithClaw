'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js/dist/cjs/chess.js';
import { useToast } from '../contexts/ToastContext';
import { Settings, X, Pause, Play, Flag, Share2, Volume2, VolumeX, Download, ChevronDown, Copy, Check, Send, Twitter } from 'lucide-react';
import html2canvas from 'html2canvas';
import ChessBoard from '../components/chess/ChessBoard';
import { supabase, getSupabaseWithToken } from '../lib/supabase';
import { Button, Card, Modal, StatusDot, Divider, Badge, SoundToggle } from '../components/ui';
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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [agentSectionOpen, setAgentSectionOpen] = useState(false);
  const [moveHistoryOpen, setMoveHistoryOpen] = useState(false);
  
  const [boardSize, setBoardSize] = useState(320);
  const [boardTheme, setBoardTheme] = useState(() => localStorage.getItem('cwc_theme') || 'green');
  const [pieceTheme, setPieceTheme] = useState(() => localStorage.getItem('cwc_pieces') || 'merida');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [boardLocked, setBoardLocked] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [displayedThinking, setDisplayedThinking] = useState('');
  const createRipple = useRipple();
  
  const submittingRef = useRef(false);
  const audioCtxRef = useRef(null);
  const prevMoveCountRef = useRef(0);
  const prevStatusRef = useRef('waiting');
  const prevAgentConnected = useRef(false);
  const boardRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const thinkingScrollRef = useRef(null);
  const channelRef = useRef(null);
  const containerRef = useRef(null);

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
    if (thinkingScrollRef.current && game?.current_thinking) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
    }
  }, [game?.current_thinking, displayedThinking]);

  // Typewriter effect for thinking
  useEffect(() => {
    if (!game) return;

    if (game.turn === (game.player_color || 'w')) {
      setDisplayedThinking('');
      return;
    }

    const targetText = game.current_thinking || '';
    
    setDisplayedThinking(prev => {
      if (targetText === prev) return prev;
      if (targetText.length < prev.length) return targetText;
      return prev;
    });

    const interval = setInterval(() => {
      setDisplayedThinking(prev => {
        if (prev.length < targetText.length) {
          return targetText.slice(0, prev.length + 1);
        }
        clearInterval(interval);
        return prev;
      });
    }, 15);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.current_thinking, game?.turn, game?.player_color]);

  // Sound Effects
  const playSound = useMemo(() => (type) => {
    if (!soundEnabled) return;
    const urls = {
      move: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-piece-slide-2070.mp3',
      capture: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-piece-capture-2071.mp3',
      check: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-check-2072.mp3',
      checkmate: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-checkmate-2073.mp3',
      start: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-game-start-2074.mp3',
      end: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-game-end-2075.mp3',
      illegal: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-illegal-move-2076.mp3',
      agentThinking: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-agent-thinking-2077.mp3',
      agentMove: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-agent-move-2078.mp3',
      agentCapture: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-agent-capture-2079.mp3',
      agentCheck: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-agent-check-2080.mp3',
      agentCheckmate: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-agent-checkmate-2081.mp3',
      agentEnd: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-agent-game-end-2082.mp3',
      agentIllegal: 'https://assets.mixkit.co/sfx/preview/mixkit-chess-agent-illegal-move-2083.mp3'
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
      const chess = new Chess();
      if (game.move_history && game.move_history.length > 0) {
        game.move_history.forEach(m => {
          try { chess.move(m.san); } catch (e) {}
        });
      } else if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
        chess.load(game.fen);
      }
      const lastMove = game.move_history[currentMoveCount - 1];
      
      const isAgent = lastMove?.color === 'b';
      
      if (chess.isCheckmate()) {
        playSound(isAgent ? 'agentCheckmate' : 'checkmate');
      } else if (chess.isCheck()) {
        playSound(isAgent ? 'agentCheck' : 'check');
      } else if (lastMove && lastMove.san.includes('x')) {
        playSound(isAgent ? 'agentCapture' : 'capture');
      } else {
        playSound(isAgent ? 'agentMove' : 'move');
      }
    }
    
    if (game.status === 'finished' && prevStatusRef.current !== 'finished') {
      const isAgentWinner = game.result === (game.player_color === 'w' ? 'black' : 'white');
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
    if (!game || game.status === 'finished' || game.status === 'abandoned' || game.turn === (game.player_color || 'w')) {
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
    }, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(heartbeatInterval);
    };
  }, [game, game?.turn, game?.status, game?.agent_last_seen, game?.updated_at, game?.created_at, gameId]);

  const handleClaimVictory = useCallback(async () => {
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: game?.player_color === 'b' ? 'black' : 'white', result_reason: 'abandoned'
    }).eq('id', gameId);
    setAgentTimeout(false);
  }, [gameId, game?.player_color]);

  useEffect(() => {
    if (!game) return;
    const agentName = game?.agent_name || 'Your OpenClaw';
    if (game.status === 'finished' || game.status === 'abandoned') {
      document.title = 'Game Over | ChessWithClaw';
    } else if (game.turn === (game.player_color || 'w')) {
      document.title = 'Your Turn | ChessWithClaw';
    } else {
      document.title = `⚡ ${agentName} Thinking... | ChessWithClaw`;
    }
  }, [game]);

  useEffect(() => {
    if (game && prevAgentConnected.current === false && game.agent_connected === true) {
      toast.success(`${game.agent_name || 'Your OpenClaw'} has arrived!`);
      setJustConnected(true);
      setTimeout(() => setJustConnected(false), 1000);
    }
    if (game) {
      prevAgentConnected.current = game.agent_connected;
    }
  }, [game, toast]);
  
  useEffect(() => {
    if (!gameId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const loadGame = async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error || !data) {
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
        } else if (movesData && movesData.length === 0) {
          data.move_history = [];
        }

        // Fetch chat history from the new table
        const { data: chatData, error: chatError } = await supabase.from('chat_messages').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
        if (chatError) {
          console.warn('Could not fetch from chat_messages, falling back to games.chat_history', chatError);
        } else if (chatData) {
          const mappedChatData = chatData.map(msg => ({
            ...msg,
            text: msg.message,
            timestamp: new Date(msg.created_at).getTime()
          }));
          // Use the longer array in case chat_messages insert failed but games update succeeded
          if (mappedChatData.length >= (data.chat_history || []).length) {
            data.chat_history = mappedChatData;
          }
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

        setGame(data);
        if (data.status === 'finished' || data.status === 'abandoned') setShowGameOverModal(true);
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

    const connectChannel = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
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
        if (payload.new.status === 'finished' || payload.new.status === 'abandoned') setShowGameOverModal(true);
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
          // Sort by timestamp to ensure correct order
          newMoveHistory.sort((a, b) => a.timestamp - b.timestamp);
          return { ...prev, move_history: newMoveHistory };
        });
        submittingRef.current = false;
        setBoardLocked(false);
      });

      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `game_id=eq.${gameId}` }, (payload) => {
        setGame(prev => {
          if (!prev) return prev;
          const newMsg = {
            ...payload.new,
            text: payload.new.message,
            timestamp: new Date(payload.new.created_at).getTime()
          };
          // Check if message already exists to prevent duplicates
          if ((prev.chat_history || []).some(m => m.id === newMsg.id || (m.timestamp === newMsg.timestamp && m.text === newMsg.text))) {
            return prev;
          }
          return { ...prev, chat_history: [...(prev.chat_history || []), newMsg] };
        });
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
    };

    connectChannel();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        connectChannel();
        supabase.from('games').select('*').eq('id', gameId).single()
          .then(({ data }) => { if (data) setGame(prev => ({ ...prev, ...data })) });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleBeforeUnload = () => {
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId);
    };
  }, [gameId]);

  const makeMove = async (from, to, promotion) => {
    if (!game || game.turn !== (game.player_color || 'w') || (game.status !== 'active' && game.status !== 'waiting')) return;
    if (boardLocked || submittingRef.current) return;
    
    if (!localStorage.getItem(`game_owner_${gameId}`)) {
      toast.error('You are not the creator of this game.');
      return;
    }

    submittingRef.current = true;
    setBoardLocked(true);
    const chess = new Chess();
    if (game.move_history && game.move_history.length > 0) {
      game.move_history.forEach(m => {
        try { chess.move(typeof m === 'string' ? m : (m.san || m)); } catch (e) {}
      });
    } else if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      chess.load(game.fen);
    }
    try {
      const moveObj = promotion ? { from, to, promotion } : { from, to };
      const move = chess.move(moveObj);
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
          toast('Waiting for your OpenClaw to join...', {
            icon: '🦞',
            style: { background: '#0e0e0e', border: '1px solid rgba(230,57,70,0.3)', color: '#f0f0f0' }
          });
          return;
        } else if (errData.code === 'TURN_CONFLICT') {
          throw new Error('TURN_CONFLICT');
        }
        throw new Error(errData.error || 'Failed to submit move');
      }
    } catch (e) {
      if (e.message === 'WAITING_FOR_AGENT') {
        toast('Waiting for your OpenClaw to join...', {
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

  const handleResign = async () => {
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
  };

  const handleDraw = async () => {
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
  };

  const acceptAgentResignation = async () => {
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: game?.player_color === 'b' ? 'black' : 'white', result_reason: 'resignation'
    }).eq('id', gameId);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(gameId);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  };

  const copyInvite = useCallback(() => {
    const url = `${window.location.origin}/Agent?id=${gameId}${agentToken ? `&token=${agentToken}` : ''}`;
    navigator.clipboard.writeText(url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  }, [gameId, agentToken]);

  const agentName = game?.agent_name || 'Your OpenClaw';

  const handleGoHome = useCallback(() => navigate('/'), [navigate]);
  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleToggleAgentSection = useCallback(() => setAgentSectionOpen(prev => !prev), []);
  const handleToggleMoveHistory = useCallback(() => setMoveHistoryOpen(prev => !prev), []);
  const handleCloseGameOverModal = useCallback(() => setShowGameOverModal(false), []);
  const handleShareResult = useCallback(async (e) => {
    const textToShare = `I played chess vs my OpenClaw on ChessWithClaw! ${window.location.origin}`;
    const btn = e.currentTarget;
    const oldText = btn.innerText;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'ChessWithClaw',
          text: textToShare,
        });
      } else {
        await navigator.clipboard.writeText(textToShare);
        btn.innerText = 'Copied! ✓';
        setTimeout(() => btn.innerText = oldText, 2000);
      }
    } catch (err) {
      // User cancelled share or clipboard failed
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
  }, []);

  const handleLogoError = useCallback((e) => {
    e.target.style.display = 'none';
  }, []);

  const handleGoHomeWithRipple = useCallback((e) => {
    createRipple(e);
    handleGoHome();
  }, [createRipple, handleGoHome]);

  const handleClaimVictoryWithRipple = useCallback((e) => {
    createRipple(e);
    handleClaimVictory();
  }, [createRipple, handleClaimVictory]);

  const handleCopyInviteWithRipple = useCallback((e) => {
    createRipple(e);
    copyInvite();
  }, [createRipple, copyInvite]);

  const handleChatInputChange = useCallback((e) => {
    setChatInput(e.target.value);
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100dvh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: "'Inter', sans-serif" }}>
        Loading game...
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ height: '100dvh', background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f0f0f0', fontFamily: "'Inter', sans-serif", gap: '16px' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 600 }}>Game not found</div>
        <button 
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
  const isMyTurn = !isSpectator && game.turn === (game.player_color || 'w') && (game.status === 'active' || game.status === 'waiting');
  const currentMoveNumber = Math.floor((game.move_history || []).length / 2) + 1;
  const lastThinking = (game.thinking_log || [])[(game.thinking_log || []).length - 1] || null;
  const unreadCount = (game.chat_history || []).filter(m => m.sender === 'agent').length; // Simplified for UI

  return (
    <div 
      ref={containerRef}
      className="flex flex-col"
      style={{
      height: 'var(--vh, 100dvh)',
      overflow: 'hidden',
      backgroundColor: game?.turn === 'b' ? '#120808' : '#080808',
      transition: 'background-color 300ms ease'
    }}>
      
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
        <div style={{display:"flex",alignItems:"center",cursor:"pointer"}} onClick={handleGoHome}>
          <img
            src="/logo.png"
            alt="ChessWithClaw"
            style={{ height: 24, width: 'auto', marginRight: 8, verticalAlign: 'middle' }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <span className="serif" style={{fontSize:14,fontWeight:700,letterSpacing:"-0.3px",color:"#f0f0f0"}}>
            ChessWithClaw
          </span>
        </div>
        
        <div style={{
          background: '#0e0e0e',
          border: '1px solid #1a1a1a',
          borderRadius: '8px',
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            color: '#888',
            whiteSpace: 'nowrap'
          }}>#{gameId.slice(0, 6).toUpperCase()}</span>
          <button onClick={copyRoomCode} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#888' }}>
            {copiedRoom ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SoundToggle soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
          <button 
            onClick={handleOpenSettings}
            style={{
              width: '34px', height: '34px',
              background: '#0e0e0e', border: '1px solid #1a1a1a',
              borderRadius: '8px', color: '#888',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'color 150ms'
            }}
            className="hover:text-[#888]"
          >
            <Settings size={18} />
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
          height: '52px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '32px', height: '32px',
            background: '#1a1a1a', border: '1px solid #1a1a1a',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
            animation: justConnected ? 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
          }}>
            🦞
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
              color: agentTimeout ? '#f59e0b' : (!game.agent_connected ? '#888' : ((game.current_thinking && game.turn !== (game.player_color || 'w')) ? '#e63946' : (game.turn === (game.player_color || 'w') ? '#888' : '#e63946')))
            }}>
              {agentTimeout ? "⏱ Your OpenClaw is taking longer than usual" :
               !game.agent_connected ? (<span>Not here yet... <span style={{color: '#888'}}>Send them the invite link.</span></span>) : 
               game.turn === (game.player_color || 'w') ? "Watching you..." : 
               (<span>Thinking<span className="animate-pulse">...</span></span>)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <SoundToggle soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
            {agentTimeout && game.status === 'active' && (
              <button 
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
              background: agentTimeout ? '#f59e0b' : (!game.agent_connected ? '#1a1a1a' : ((game.current_thinking && game.turn !== (game.player_color || 'w')) ? '#e63946' : '#22c55e'))
            }}>
              {game.agent_connected && (
                <div style={{
                  position: 'absolute', inset: '-3px', borderRadius: '50%',
                  background: agentTimeout ? '#f59e0b' : ((game.current_thinking && game.turn !== (game.player_color || 'w')) ? '#e63946' : '#22c55e'),
                  opacity: 0,
                  animation: `ripple ${(game.current_thinking && game.turn !== (game.player_color || 'w')) ? '1s' : '2s'} ease-out infinite`
                }}></div>
              )}
            </div>
            <button 
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
          {!game.agent_connected ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888' }}>{agentName} not connected yet.</div>
              <button 
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
                Your OpenClaw is taking longer than usual
              </div>
            </div>
          ) : !game.current_thinking && !lastThinking ? (
            <div style={{ padding: '12px 0', textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888' }}>
              Waiting for {agentName} to move...
            </div>
          ) : (
            <div 
              ref={thinkingScrollRef}
              style={{
                borderLeft: `2px solid ${(game.current_thinking && game.turn !== (game.player_color || 'w')) ? '#e63946' : '#1a1a1a'}`,
                background: (game.current_thinking && game.turn !== (game.player_color || 'w')) ? 'linear-gradient(90deg, rgba(230,57,70,0.08) 0%, transparent 100%)' : 'transparent',
                padding: '12px 12px 12px 16px',
                marginTop: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: (game.current_thinking && game.turn !== (game.player_color || 'w')) ? '13px' : '11px',
                color: (game.current_thinking && game.turn !== (game.player_color || 'w')) ? '#e0e0e0' : '#666',
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
              {(game.current_thinking && game.turn !== (game.player_color || 'w')) && (
                <div style={{ 
                  fontFamily: "'Inter', sans-serif", 
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
                  {agentName.toUpperCase()} IS THINKING
                </div>
              )}
              {(!game.current_thinking || game.turn === (game.player_color || 'w')) && lastThinking && (
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
              )}
              <div style={{ opacity: (game.current_thinking && game.turn !== (game.player_color || 'w')) ? 1 : 0.7 }}>
                {(game.current_thinking && game.turn !== (game.player_color || 'w')) ? displayedThinking : lastThinking?.text}
                {game.current_thinking && game.turn !== (game.player_color || 'w') && (
                  <span style={{ 
                    animation: 'blink 1s step-end infinite', 
                    display: 'inline-block', 
                    width: '6px', 
                    height: '13px', 
                    background: '#e63946', 
                    marginLeft: '4px', 
                    verticalAlign: 'middle',
                    position: 'relative',
                    top: '-1px'
                  }} />
                )}
              </div>
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
        
        {game.status === 'waiting' && !game.agent_connected && (
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
                Waiting for {agentName} to join...
              </div>
              <div style={{fontFamily: "'Inter', sans-serif", fontSize:12,color:'#888',marginTop:2}}>
                Send the invite link to your OpenClaw to start the game.
              </div>
            </div>
          </div>
        )}

        {(() => {
          const chess = new Chess(game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
          if (chess.isCheck() && game.status === 'active') {
            return (
              <div style={{
                width: `${boardSize}px`, padding: '8px 16px', background: '#e63946', color: 'white', 
                fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 600, textAlign: 'center',
                borderRadius: '4px', marginBottom: '4px'
              }}>
                {game.turn === (game.player_color || 'w') ? "⚠️ Your king is in check!" : `⚠️ ${agentName}'s king is in check!`}
              </div>
            );
          }
          return null;
        })()}

        <div style={{
          position: 'relative',
          width: `${boardSize}px`,
          height: `${boardSize}px`,
          borderRadius: '3px',
          overflow: 'visible',
          border: '1px solid rgba(230,57,70,0.08)',
          boxShadow: '0 0 0 1px #0f0f0f, 0 4px 24px rgba(0,0,0,0.8)',
          flexShrink: 0,
          pointerEvents: boardLocked ? 'none' : 'auto',
          animation: shaking ? 'boardShake 300ms ease-in-out' : ((game.current_thinking && game.turn !== (game.player_color || 'w')) ? 'boardThinkingGlow 2s ease-in-out infinite' : 'none')
        }} ref={boardRef}>
          <ChessBoard 
            fen={game.fen} 
            onMove={makeMove} 
            isMyTurn={isMyTurn} 
            lastMove={(game.move_history || [])[(game.move_history || []).length - 1] || null} 
            moveHistory={game.move_history || []}
            boardTheme={boardTheme}
            pieceTheme={pieceTheme}
            playerColor={game.player_color || 'w'}
            onIllegalMove={() => {
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
                {game.status === 'abandoned' ? 'Game expired due to inactivity' : (game.result === 'draw' ? 'Draw by ' + game.result_reason : (game.result === (game.player_color === 'w' ? 'white' : 'black') ? 'You won by ' : agentName + ' won by ') + game.result_reason)}
              </div>
            </div>
          )}
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
        flexShrink: 0
      }} className="h-[200px] lg:h-1/2 lg:border-t-0 lg:order-2">
        <div style={{
          height: '38px', padding: '0 14px', borderBottom: '1px solid #0e0e0e',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 700, color: '#888' }}>Chat with {agentName}</span>
            <span style={{ fontSize: '12px' }}>🦞</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SoundToggle soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
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
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888' }}>{agentName} can chat while playing</span>
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
                      <button onClick={acceptAgentResignation} style={{ display: 'block', width: '100%', marginTop: '8px', background: '#e63946', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Accept Resignation</button>
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
                        <button onClick={async () => {
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
          height: '44px', borderTop: '1px solid #0e0e0e', padding: '0 12px', gap: '8px',
          display: 'flex', alignItems: 'center', flexShrink: 0
        }}>
          <input
            type="text"
            value={chatInput}
            onChange={handleChatInputChange}
            placeholder={isSpectator ? "Spectating..." : `Message ${agentName}...`}
            disabled={isSpectator}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#e0e0e0',
              caretColor: '#e63946', touchAction: 'manipulation'
            }}
          />
          <button 
            type="submit"
            disabled={isSpectator || !chatInput.trim()}
            style={{
              width: '30px', height: '30px', background: (!isSpectator && chatInput.trim()) ? '#e63946' : '#1a1a1a',
              border: 'none', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: (!isSpectator && chatInput.trim()) ? 'pointer' : 'default', touchAction: 'manipulation', transition: 'background 120ms',
              color: (!isSpectator && chatInput.trim()) ? 'white' : '#888'
            }}
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* FIX 6 — MOVE HISTORY */}
      <div style={{
        background: '#0e0e0e',
        borderTop: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column'
      }} className="lg:flex-1 lg:overflow-hidden lg:order-1">
        <div 
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
                      <div style={{ 
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: isLatestW ? '#e63946' : '#888', padding: '3px', borderRadius: '3px',
                        background: isLatestW ? 'rgba(230,57,70,0.05)' : 'transparent', border: isLatestW ? '1px solid rgba(230,57,70,0.1)' : '1px solid transparent'
                      }}>{wMove?.san}</div>
                      <div style={{ 
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
      <div className="fixed lg:relative bottom-0 left-0 right-0 h-[48px] bg-[#080808]/96 backdrop-blur-md border-t border-[#1a1a1a] px-4 flex items-center justify-between z-50 flex-shrink-0">
        {game.status === 'finished' || game.status === 'abandoned' ? (
          <div style={{
            background: '#1a1a1a', border: '1px solid #1a1a1a', color: '#e63946', height: '26px', padding: '0 10px', borderRadius: '6px',
            fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>GAME OVER</div>
        ) : game.turn === (game.player_color || 'w') ? (
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
          <SoundToggle soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#888' }}>
            <GameTimer startTime={game.created_at} status={game.status} />
          </div>
        </div>
      </div>

      {showGameOverModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: '12px',
            padding: '32px 24px', maxWidth: '360px', width: 'calc(100% - 48px)', textAlign: 'center',
            position: 'relative'
          }}>
            <button onClick={handleCloseGameOverModal} style={{
              position: 'absolute', top: '12px', right: '12px', width: '28px', height: '28px',
              background: 'transparent', border: 'none', color: '#888', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <X size={20} />
            </button>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {game.result === (game.player_color === 'w' ? 'white' : 'black') ? '🏆' : game.result === 'draw' ? '🤝' : '🦞'}
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', color: '#f2f2f2', marginBottom: '8px' }}>
              {game.result === (game.player_color === 'w' ? 'white' : 'black') ? 'You Won!' : game.result === 'draw' ? "It's a Draw!" : `${agentName} Won!`}
            </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#999', marginBottom: '24px' }}>
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
                  onClick={handleGoHome}
                  style={{
                    background: '#e63946', color: '#fff', border: 'none',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, padding: '13px 26px',
                    borderRadius: 7, width: '100%', cursor: 'pointer', letterSpacing: '-0.2px', transition: 'opacity 0.15s, transform 0.15s'
                  }}
                  onMouseEnter={e => { e.target.style.opacity = '0.9'; e.target.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.target.style.opacity = '1'; e.target.style.transform = 'none'; }}
                >
                  Rematch
                </button>
                <button 
                  onClick={handleShareResult}
                  style={{
                    background: 'transparent', color: '#888', border: '1px solid #252525',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, padding: '13px 22px',
                    borderRadius: 7, width: '100%', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s'
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = '#444'; e.target.style.color = '#f0f0f0'; }}
                  onMouseLeave={e => { e.target.style.borderColor = '#252525'; e.target.style.color = '#888'; }}
                >
                  Share Result
                </button>
                <button 
                  onClick={handleGoHome}
                  style={{
                    background: 'transparent', color: '#888', border: 'none',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 500, padding: '13px 22px',
                    borderRadius: 7, width: '100%', cursor: 'pointer', transition: 'color 0.15s'
                  }}
                  onMouseEnter={e => { e.target.style.color = '#f0f0f0'; }}
                  onMouseLeave={e => { e.target.style.color = '#888'; }}
                >
                  Go Home
                </button>
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
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-md transition-colors ${soundEnabled ? 'bg-[var(--color-red-primary)] text-white' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)]'}`}
              >
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
            </div>
          </div>
          <Divider />
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] tracking-wider uppercase">Game Controls</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleDraw}
                disabled={game?.status === 'finished' || game?.status === 'abandoned'}
                variant="secondary"
                className={confirmDraw ? 'bg-yellow-600/20 text-yellow-500 border-yellow-600/50 hover:bg-yellow-600/30' : ''}
              >
                {confirmDraw ? 'Confirm Draw?' : 'Offer Draw'}
              </Button>
              <Button 
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
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        input::placeholder { color: #888; }
      `}} />
    </div>
  );
}
