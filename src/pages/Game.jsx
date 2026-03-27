'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js/dist/cjs/chess.js';
import { useToast } from '../contexts/ToastContext';
import { Settings, X, Pause, Play, Flag, Share2, Volume2, VolumeX, Download, ChevronDown, Copy, Check, Send, Twitter } from 'lucide-react';
import html2canvas from 'html2canvas';
import ChessBoard from '../components/chess/ChessBoard';
import { supabase, getSupabaseWithToken } from '../lib/supabase';
import { Button, Card, Modal, StatusDot, Divider, Badge } from '../components/ui';
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
  const [gameOver, setGameOver] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [agentSectionOpen, setAgentSectionOpen] = useState(false);
  const [moveHistoryOpen, setMoveHistoryOpen] = useState(false);
  
  const [boardSize, setBoardSize] = useState(320);
  const [boardTheme, setBoardTheme] = useState('green');
  const [pieceTheme, setPieceTheme] = useState('merida');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [agentTimedOut, setAgentTimedOut] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
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
  const agentTimerRef = useRef(null);
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
  }, [game?.current_thinking]);

  // Sound Effects
  const playSound = useMemo(() => (type) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      
      if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      } else if (type === 'capture') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        const bufferSize = ctx.sampleRate * 0.1;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.2, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        noise.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
        
        osc.start(now);
        osc.stop(now + 0.1);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
        noise.onended = () => {
          noise.disconnect();
          noiseGain.disconnect();
        };
      } else if (type === 'check') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      }
    } catch (e) {
      console.error("Audio error:", e);
    }
  }, [soundEnabled]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, []);

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
      if (chess.isCheck()) playSound('check');
      else if (lastMove && lastMove.san.includes('x')) playSound('capture');
      else playSound('move');
    }
    prevMoveCountRef.current = currentMoveCount;
    prevStatusRef.current = game.status;
  }, [game, playSound]);

  // Agent Timeout Check
  const [agentTimeout, setAgentTimeout] = useState(false);
  useEffect(() => {
    if (!game || game.status === 'finished' || game.status === 'abandoned' || game.turn === 'w') {
      setAgentTimeout(false);
      return;
    }
    
    const checkTimeout = () => {
      const lastUpdated = new Date(game.agent_last_seen || game.updated_at || game.created_at).getTime();
      if (Date.now() - lastUpdated > 120000) { // 2 minutes
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

  const handleClaimVictory = async () => {
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: 'white', result_reason: 'abandoned'
    }).eq('id', gameId);
    setAgentTimeout(false);
  };

  useEffect(() => {
    if (!game) return;
    
    // Clear existing timer
    if (agentTimerRef.current) {
      clearTimeout(agentTimerRef.current);
      agentTimerRef.current = null;
    }

    // If it's the agent's turn (black) and game is active
    if (game.turn === 'b' && game.status === 'active') {
      agentTimerRef.current = setTimeout(() => {
        setAgentTimedOut(true);
      }, 90000); // 90 seconds
    } else {
      setAgentTimedOut(false);
    }

    return () => {
      if (agentTimerRef.current) {
        clearTimeout(agentTimerRef.current);
      }
    };
  }, [game]);

  useEffect(() => {
    if (!game) return;
    const agentName = game?.agent_name || 'Your OpenClaw';
    if (game.status === 'finished' || game.status === 'abandoned') {
      document.title = 'Game Over | ChessWithClaw';
    } else if (game.turn === 'w') {
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
        const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', gameId).order('move_number', { ascending: true });
        data.move_history = (movesData || []).map(m => ({
          ...m,
          from: m.from_square || m.from,
          to: m.to_square || m.to,
          uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
        }));

        // Fetch chat history from the new table
        const { data: chatData } = await supabase.from('chat_messages').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
        data.chat_history = (chatData || []).map(msg => ({
          ...msg,
          text: msg.message,
          timestamp: new Date(msg.created_at).getTime()
        }));

        // Fetch thinking log from the new table
        const { data: thoughtsData } = await supabase.from('agent_thoughts').select('*').eq('game_id', gameId).order('created_at', { ascending: true });
        data.thinking_log = (thoughtsData || []).map(thought => ({
          ...thought,
          text: thought.thought,
          moveNumber: thought.move_number,
          timestamp: new Date(thought.created_at).getTime()
        }));

        setGame(data);
        if (data.status === 'finished' || data.status === 'abandoned') setGameOver(true);
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
          // Preserve arrays that are no longer in the games table
          updatedGame.move_history = prev.move_history || [];
          updatedGame.chat_history = prev.chat_history || [];
          updatedGame.thinking_log = prev.thinking_log || [];
          return updatedGame;
        });
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
        if (payload.new.status === 'finished' || payload.new.status === 'abandoned') setGameOver(true);
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
          const newMoveHistory = [...(prev.move_history || []), newMove];
          // Sort by move_number to ensure correct order
          newMoveHistory.sort((a, b) => a.move_number - b.move_number);
          return { ...prev, move_history: newMoveHistory };
        });
      });

      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `game_id=eq.${gameId}` }, (payload) => {
        setGame(prev => {
          if (!prev) return prev;
          const newMsg = {
            ...payload.new,
            text: payload.new.message,
            timestamp: new Date(payload.new.created_at).getTime()
          };
          const newChatHistory = [...(prev.chat_history || []), newMsg];
          newChatHistory.sort((a, b) => a.timestamp - b.timestamp);
          return { ...prev, chat_history: newChatHistory };
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
          // Clear current_thinking when a final thought is received
          return { ...prev, thinking_log: newThinkingLog, current_thinking: '' };
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
    if (!game || game.turn !== 'w' || game.status !== 'active' && game.status !== 'waiting') return;
    if (isMoving || submittingRef.current) return;
    
    if (!localStorage.getItem(`game_owner_${gameId}`)) {
      toast.error('You are not the creator of this game.');
      return;
    }

    submittingRef.current = true;
    setIsMoving(true);
    const chess = new Chess();
    if (game.move_history && game.move_history.length > 0) {
      game.move_history.forEach(m => {
        try { chess.move(m.san); } catch (e) {}
      });
    } else if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      chess.load(game.fen);
    }
    try {
      const moveObj = promotion ? { from, to, promotion } : { from, to };
      const move = chess.move(moveObj);
      if (!move) {
        submittingRef.current = false;
        setIsMoving(false);
        return;
      }

      const newMoveHistory = [...(game.move_history || []), {
        move_number: Math.floor((game.move_history || []).length / 2) + 1,
        color: 'w',
        from,
        to,
        san: move.san,
        uci: from + to + (promotion || ''),
        timestamp: Date.now()
      }];

      const updates = {
        fen: chess.fen(),
        turn: 'b',
        move_history: newMoveHistory,
        status: 'active',
        human_last_moved_at: new Date().toISOString()
      };

      if (chess.isCheckmate()) {
        updates.status = 'finished';
        updates.result = 'white';
        updates.result_reason = 'checkmate';
      } else if (chess.isStalemate()) {
        updates.status = 'finished';
        updates.result = 'draw';
        updates.result_reason = 'stalemate';
      } else if (chess.isDraw()) {
        updates.status = 'finished';
        updates.result = 'draw';
        updates.result_reason = 'draw';
      }

      const previousGame = { ...game };
      setGame(prev => ({ ...prev, ...updates }));
      
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
        setGame(previousGame);
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

      const responseData = await response.json();
      if (responseData.success && responseData.game) {
        setGame(prev => ({
          ...prev,
          ...responseData.game,
          // Preserve arrays that might not be in the minimal response
          chat_history: prev.chat_history || [],
          thinking_log: prev.thinking_log || []
        }));
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
    } finally {
      submittingRef.current = false;
      setIsMoving(false);
    }
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    
    const text = chatInput;
    setChatInput('');
    
    const previousGame = { ...game };
    const newMessage = { sender: 'human', text, timestamp: Date.now() };
    setGame(prev => ({ ...prev, chat_history: [...(prev.chat_history || []), newMessage] }));
    
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
        setGame(previousGame);
        throw new Error('Failed to send message');
      }
    } catch (e) {
      console.error('Failed to send message:', e);
      setGame(previousGame);
    }
  };

  const handleResign = async () => {
    if (!confirmResign) {
      setConfirmResign(true);
      setTimeout(() => setConfirmResign(false), 3000);
      return;
    }
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: 'black', result_reason: 'resignation'
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
      status: 'finished', result: 'white', result_reason: 'resignation'
    }).eq('id', gameId);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(gameId);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  };

  const copyInvite = () => {
    const url = `${window.location.origin}/Agent?id=${gameId}${agentToken ? `&token=${agentToken}` : ''}`;
    navigator.clipboard.writeText(url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  const agentName = game?.agent_name || 'Your OpenClaw';

  const handleGoHome = useCallback(() => navigate('/'), [navigate]);
  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleToggleAgentSection = useCallback(() => setAgentSectionOpen(prev => !prev), []);
  const handleToggleMoveHistory = useCallback(() => setMoveHistoryOpen(prev => !prev), []);
  const handleCloseGameOverModal = useCallback(() => setShowGameOverModal(false), []);
  const handleShareResult = useCallback((e) => {
    const moves = Math.floor((game?.move_history || []).length / 2) + ((game?.move_history || []).length % 2);
    const winner = game?.result === 'white' ? 'I won' : game?.result === 'black' ? `${agentName} won` : 'Draw';
    navigator.clipboard.writeText(`${winner} in ${moves} moves on ChessWithClaw 🦞 chesswithclaw.vercel.app`);
    const btn = e.currentTarget;
    const oldText = btn.innerText;
    btn.innerText = 'Copied! ✓';
    setTimeout(() => btn.innerText = oldText, 2000);
  }, [game?.move_history, game?.result, agentName]);

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

  const isMyTurn = game.turn === 'w' && (game.status === 'active' || game.status === 'waiting');
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
        <img 
          src="/logo.png" 
          alt="ChessWithClaw" 
          style={{ height: 24, width: 'auto', cursor: 'pointer', flexShrink: 0 }}
          onClick={handleGoHome}
          onError={handleLogoError}
        />
        
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
            {game.agent_avatar || '🦞'}
          </div>
          
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '16px', fontWeight: 700, color: '#e0e0e0',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1
            }}>
              {agentName.toUpperCase()}
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '11px', lineHeight: 1, whiteSpace: 'nowrap', marginTop: '3px',
              color: agentTimeout ? '#f59e0b' : (!game.agent_connected ? '#888' : (game.current_thinking ? '#e63946' : (game.turn === 'w' ? '#888' : '#e63946')))
            }}>
              {agentTimeout ? "⏱ " + agentName + " delayed" :
               !game.agent_connected ? (<span>Not here yet... <span style={{color: '#888'}}>Send them the invite link.</span></span>) : 
               game.turn === 'w' ? "Watching you..." : 
               (<span>Thinking<span className="animate-pulse">...</span></span>)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
              background: agentTimeout ? '#f59e0b' : (!game.agent_connected ? '#1a1a1a' : (game.current_thinking ? '#e63946' : '#22c55e'))
            }}>
              {game.agent_connected && (
                <div style={{
                  position: 'absolute', inset: '-3px', borderRadius: '50%',
                  background: agentTimeout ? '#f59e0b' : (game.current_thinking ? '#e63946' : '#22c55e'),
                  opacity: 0,
                  animation: `ripple ${game.current_thinking ? '1s' : '2s'} ease-out infinite`
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
          ) : agentTimedOut ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#d97706', marginBottom: '8px' }}>
                {agentName} seems delayed. They might have disconnected or crashed.
              </div>
              <button 
                onClick={handleCopyInviteWithRipple}
                className="hover:bg-[#1a1a1a] active:scale-[0.98]"
                style={{
                  position: 'relative', overflow: 'hidden',
                  width: '100%', height: '30px', background: '#1a1a1a', border: '1px solid #1a1a1a',
                  borderRadius: '7px', color: copiedInvite ? '#22c55e' : '#888', fontFamily: "'Inter', sans-serif", fontSize: '11px',
                  cursor: 'pointer', transition: 'all 150ms'
                }}
              >
                {copiedInvite ? 'Copied!' : `Copy ${agentName} Link`}
              </button>
            </div>
          ) : !game.current_thinking && !lastThinking ? (
            <div style={{ padding: '12px 0', textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888' }}>
              Waiting for {agentName} to move...
            </div>
          ) : (
            <div 
              ref={thinkingScrollRef}
              style={{
                borderLeft: `2px solid ${game.current_thinking ? '#e63946' : '#1a1a1a'}`,
                padding: '8px 0 8px 12px',
                marginTop: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: game.current_thinking ? '11px' : '10px',
                color: game.current_thinking ? '#888' : '#888',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '200px',
                overflowY: 'auto',
                scrollbarWidth: 'none'
              }}
            >
              {!game.current_thinking && lastThinking && <span style={{ color: '#666' }}>Last thought: </span>}
              {game.current_thinking || lastThinking?.text}
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
                {game.turn === 'w' ? "⚠️ Your king is in check!" : `⚠️ ${agentName}'s king is in check!`}
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
          pointerEvents: (isMoving || !game.agent_connected) ? 'none' : 'auto'
        }} ref={boardRef}>
          <ChessBoard 
            fen={game.fen} 
            onMove={makeMove} 
            isMyTurn={isMyTurn} 
            lastMove={(game.move_history || [])[(game.move_history || []).length - 1] || null} 
            moveHistory={game.move_history || []}
            boardTheme={boardTheme}
            pieceTheme={pieceTheme}
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
                {game.status === 'abandoned' ? 'Game expired due to inactivity' : (game.result === 'draw' ? 'Draw by ' + game.result_reason : (game.result === 'white' ? 'You won by ' : agentName + ' won by ') + game.result_reason)}
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
            <span style={{ fontSize: '12px' }}>{game.agent_avatar || '🦞'}</span>
          </div>
          {unreadCount > 0 && (
            <span style={{ background: '#e63946', color: 'white', borderRadius: '99px', padding: '1px 6px', fontFamily: "'Inter', sans-serif", fontSize: '10px', fontWeight: 700 }}>
              {unreadCount}
            </span>
          )}
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
              <span style={{ fontSize: '20px', color: '#666', display: 'block', marginBottom: '5px' }}>{game.agent_avatar || '🦞'}</span>
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
                    <button onClick={acceptAgentResignation} style={{ display: 'block', width: '100%', marginTop: '8px', background: '#e63946', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', fontFamily: "'Inter', sans-serif", fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Accept Resignation</button>
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
            placeholder={`Message ${agentName}...`}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: "'Inter', sans-serif", fontSize: '14px', color: '#e0e0e0',
              caretColor: '#e63946', touchAction: 'manipulation'
            }}
          />
          <button 
            type="submit"
            disabled={!chatInput.trim()}
            style={{
              width: '30px', height: '30px', background: chatInput.trim() ? '#e63946' : '#1a1a1a',
              border: 'none', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: chatInput.trim() ? 'pointer' : 'default', touchAction: 'manipulation', transition: 'background 120ms',
              color: chatInput.trim() ? 'white' : '#888'
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
        ) : game.turn === 'w' ? (
          <div style={{
            background: '#e63946', color: 'white', height: '26px', padding: '0 10px', borderRadius: '6px',
            fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pillPop 300ms ease both'
          }}>YOUR TURN</div>
        ) : (
          <div style={{
            background: '#1a1a1a', border: '1px solid #1a1a1a', color: '#888', height: '26px', padding: '0 10px', borderRadius: '6px',
            fontFamily: "'Inter', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase'
          }}>{`${agentName.toUpperCase()}'S TURN`}</div>
        )}
        
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#888' }}>
          Move {currentMoveNumber}
        </div>
        
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#888' }}>
          <GameTimer startTime={game.created_at} status={game.status} />
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
              {game.result === 'white' ? '🏆' : game.result === 'black' ? '🦞' : '🤝'}
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', color: '#f2f2f2', marginBottom: '8px' }}>
              {game.result === 'white' ? 'You Won!' : game.result === 'black' ? `${agentName} Won!` : "It's a Draw!"}
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
                    background: '#e63946', color: '#fff', border: 'none',
                    fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, padding: '13px 26px',
                    borderRadius: 7, width: '100%', cursor: 'pointer', letterSpacing: '-0.2px', transition: 'opacity 0.15s, transform 0.15s'
                  }}
                  onMouseEnter={e => { e.target.style.opacity = '0.9'; e.target.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.target.style.opacity = '1'; e.target.style.transform = 'none'; }}
                >
                  New Game
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
                    onClick={() => setBoardTheme(theme.id)}
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
                    onClick={() => setPieceTheme(piece.id)}
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
        input::placeholder { color: #888; }
      `}} />
    </div>
  );
}
