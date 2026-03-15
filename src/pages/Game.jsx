'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
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
  return <span>{mins}:{secs.toString().padStart(2, '0')}</span>;
}

export default function Game() {
  const { id } = useParams();
  const gameId = id;
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
  const createRipple = useRipple();
  
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
      
      const usedHeight =
        52 +   // header
        100 +  // agent section (merged, collapsed)
        48 +   // status bar
        44 +   // chat header
        44 +   // move history header
        24;    // padding
      
      const maxH = vh - usedHeight;
      const maxW = vw - 24;
      
      setBoardSize(Math.min(maxW, maxH, 460));
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
      } else if (type === 'check') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.error("Audio error:", e);
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
    const agentName = game.agent_name || 'OpenClaw';
    if (game.status === 'finished' || game.status === 'abandoned') {
      document.title = 'Game Over | ChessWithClaw';
    } else if (game.turn === 'w') {
      document.title = 'Your Turn | ChessWithClaw';
    } else {
      document.title = `${agentName} is thinking... | ChessWithClaw`;
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
        data.move_history = movesData || [];

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
          const newMoveHistory = [...(prev.move_history || []), payload.new];
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
      if (document.visibilityState === 'visible') connectChannel();
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
    if (isMoving) return;
    
    if (!localStorage.getItem(`game_owner_${gameId}`)) {
      toast.error('You are not the creator of this game.');
      return;
    }

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
        setIsMoving(false);
        return;
      }

      const newMoveHistory = [...(game.move_history || []), {
        number: Math.floor((game.move_history || []).length / 2) + 1,
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
        setGame(previousGame);
        throw new Error('Failed to submit move');
      }
    } catch (e) {
      toast.error('Illegal move or failed to submit');
    } finally {
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
    const url = `${window.location.origin}/Agent?id=${gameId}`;
    navigator.clipboard.writeText(url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontFamily: "'DM Sans', sans-serif" }}>
        Loading game...
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={{ height: '100dvh', background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f0f0f0', fontFamily: "'DM Sans', sans-serif", gap: '16px' }}>
        <div style={{ fontSize: '20px', fontWeight: 600 }}>Game not found</div>
        <button onClick={(e) => { createRipple(e); navigate('/'); }} className="hover:bg-[#cc2f3b] active:scale-[0.98]" style={{ position: 'relative', overflow: 'hidden', background: '#e63946', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', fontWeight: 700, cursor: 'pointer', transition: 'all 120ms' }}>
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
      style={{
      height: 'var(--vh, 100dvh)',
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingBottom: '48px',
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
      background: '#080808'
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
        borderBottom: '1px solid #161616',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        overflow: 'hidden'
      }}>
        <img 
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
          alt="Logo" 
          style={{ width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => navigate('/')}
        />
        
        <div style={{
          background: '#111',
          border: '1px solid #1c1c1c',
          borderRadius: '8px',
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            color: '#666',
            whiteSpace: 'nowrap'
          }}>#{gameId.slice(0, 6).toUpperCase()}</span>
          <button onClick={copyRoomCode} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#2a2a2a' }}>
            {copiedRoom ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
          </button>
        </div>

        <button 
          onClick={() => setShowSettings(true)}
          style={{
            width: '34px', height: '34px',
            background: '#111', border: '1px solid #1c1c1c',
            borderRadius: '8px', color: '#444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'color 150ms'
          }}
          className="hover:text-[#888]"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* FIX 3 — MERGED AGENT SECTION */}
      <div style={{
        background: '#111111',
        borderBottom: '1px solid #161616',
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
            background: '#181818', border: '1px solid #222',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
            animation: justConnected ? 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
          }}>
            {game.agent_avatar || '🦞'}
          </div>
          
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: '16px', fontWeight: 700, color: '#e0e0e0',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1
            }}>
              {game.agent_name || 'YOUR OPENCLAW'}
            </div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px', lineHeight: 1, whiteSpace: 'nowrap', marginTop: '3px',
              color: agentTimeout ? '#f59e0b' : (!game.agent_connected ? '#333' : (game.current_thinking ? '#e63946' : (game.turn === 'w' ? '#444' : '#e63946')))
            }}>
              {agentTimeout ? "⏱ Agent delayed" :
               !game.agent_connected ? (<span>Not here yet... <span style={{color: '#555'}}>Send them the invite link.</span></span>) : 
               game.turn === 'w' ? "Watching you..." : 
               (<span>Thinking<span className="animate-pulse">...</span></span>)}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {agentTimeout && game.status === 'active' && (
              <button 
                onClick={(e) => { createRipple(e); handleClaimVictory(); }}
                className="hover:bg-[#cc2f3b] active:scale-[0.98]"
                style={{
                  position: 'relative', overflow: 'hidden',
                  background: '#e63946', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                  transition: 'all 120ms'
                }}
              >
                Claim Win
              </button>
            )}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', position: 'relative',
              background: agentTimeout ? '#f59e0b' : (!game.agent_connected ? '#1e1e1e' : (game.current_thinking ? '#e63946' : '#22c55e'))
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
              onClick={() => setAgentSectionOpen(!agentSectionOpen)}
              style={{
                background: 'none', border: 'none', color: '#2a2a2a', cursor: 'pointer',
                fontSize: '14px', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              className="hover:text-[#666]"
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
          borderTop: agentSectionOpen ? '1px solid #161616' : 'none'
        }}>
          {!game.agent_connected ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#2a2a2a' }}>Agent not connected yet.</div>
              <button 
                onClick={(e) => { createRipple(e); copyInvite(); }}
                className="hover:bg-[#1a1a1a] active:scale-[0.98]"
                style={{
                  position: 'relative', overflow: 'hidden',
                  width: '100%', height: '30px', background: '#141414', border: '1px solid #1c1c1c',
                  borderRadius: '7px', color: copiedInvite ? '#22c55e' : '#3a3a3a', fontFamily: "'DM Sans', sans-serif", fontSize: '11px',
                  marginTop: '8px', cursor: 'pointer', transition: 'all 150ms'
                }}
              >
                {copiedInvite ? 'Copied!' : 'Copy Invite Link'}
              </button>
            </div>
          ) : agentTimedOut ? (
            <div style={{ padding: '12px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#d97706', marginBottom: '8px' }}>
                Agent seems delayed. They might have disconnected or crashed.
              </div>
              <button 
                onClick={(e) => { createRipple(e); copyInvite(); }}
                className="hover:bg-[#1a1a1a] active:scale-[0.98]"
                style={{
                  position: 'relative', overflow: 'hidden',
                  width: '100%', height: '30px', background: '#141414', border: '1px solid #1c1c1c',
                  borderRadius: '7px', color: copiedInvite ? '#22c55e' : '#3a3a3a', fontFamily: "'DM Sans', sans-serif", fontSize: '11px',
                  cursor: 'pointer', transition: 'all 150ms'
                }}
              >
                {copiedInvite ? 'Copied!' : 'Copy Agent Link'}
              </button>
            </div>
          ) : !game.current_thinking && !lastThinking ? (
            <div style={{ padding: '12px 0', textAlign: 'center', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#333' }}>
              Waiting for agent to move...
            </div>
          ) : (
            <div 
              ref={thinkingScrollRef}
              style={{
                borderLeft: `2px solid ${game.current_thinking ? '#e63946' : '#1e1e1e'}`,
                padding: '8px 0 8px 12px',
                marginTop: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: game.current_thinking ? '11px' : '10px',
                color: game.current_thinking ? '#666' : '#2a2a2a',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '200px',
                overflowY: 'auto',
                scrollbarWidth: 'none'
              }}
            >
              {!game.current_thinking && lastThinking && <span style={{ color: '#1e1e1e' }}>Last thought: </span>}
              {game.current_thinking || lastThinking?.text}
            </div>
          )}
        </div>
      </div>

      {/* FIX 4 — BOARD CONTAINER */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '10px 12px',
        background: '#080808',
        flexShrink: 0
      }}>
        <div style={{
          position: 'relative',
          width: `${boardSize}px`,
          height: `${boardSize}px`,
          borderRadius: '3px',
          overflow: 'hidden',
          border: '1px solid rgba(230,57,70,0.08)',
          boxShadow: '0 0 0 1px #0f0f0f, 0 4px 24px rgba(0,0,0,0.8)',
          flexShrink: 0
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
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>
                {game.status === 'abandoned' ? 'GAME ABANDONED' : 'GAME OVER'}
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#e63946', marginTop: '4px', fontWeight: 600 }}>
                {game.status === 'abandoned' ? 'Game expired due to inactivity' : (game.result === 'draw' ? 'Draw by ' + game.result_reason : (game.result === 'white' ? 'You won by ' : 'Agent won by ') + game.result_reason)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FIX 5 — LIVE CHAT */}
      <div style={{
        background: '#0d0d0d',
        borderTop: '1px solid #161616',
        display: 'flex',
        flexDirection: 'column',
        height: '200px',
        flexShrink: 0
      }}>
        <div style={{
          height: '38px', padding: '0 14px', borderBottom: '1px solid #111',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#555' }}>Chat with {game.agent_name || "your agent"}</span>
            <span style={{ fontSize: '12px' }}>{game.agent_avatar || '🦞'}</span>
          </div>
          {unreadCount > 0 && (
            <span style={{ background: '#e63946', color: 'white', borderRadius: '99px', padding: '1px 6px', fontFamily: "'DM Sans', sans-serif", fontSize: '10px', fontWeight: 700 }}>
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
              <span style={{ fontSize: '20px', color: '#1a1a1a', display: 'block', marginBottom: '5px' }}>{game.agent_avatar || '🦞'}</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#222' }}>{game.agent_name || "Your OpenClaw"} can chat while playing</span>
            </div>
          ) : (
            (game.chat_history || []).map((msg, i) => {
              const isHuman = msg.sender === 'human';
              if (msg.type === 'resign_request') {
                return (
                  <div key={i} style={{
                    alignSelf: 'flex-start', background: '#131313', border: '1px solid #e63946', borderRadius: '8px 8px 8px 2px',
                    padding: '7px 10px', maxWidth: '78%', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#999', lineHeight: 1.4,
                    animation: 'msgSlide 200ms ease both'
                  }}>
                    {msg.text}
                    <button onClick={acceptAgentResignation} style={{ display: 'block', width: '100%', marginTop: '8px', background: '#e63946', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Accept Resignation</button>
                  </div>
                );
              }
              return (
                <div key={i} style={{ alignSelf: isHuman ? 'flex-end' : 'flex-start', maxWidth: '78%', animation: 'msgSlide 200ms ease both', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    background: isHuman ? '#160c0c' : '#131313',
                    border: `1px solid ${isHuman ? 'rgba(230,57,70,0.1)' : '#1a1a1a'}`,
                    borderRadius: isHuman ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                    padding: '7px 10px',
                    fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: isHuman ? '#bbb' : '#999', lineHeight: 1.4,
                    display: 'flex', flexDirection: 'column', gap: '4px'
                  }}>
                    <div>{msg.text}</div>
                    {msg.timestamp && (
                      <div style={{ fontSize: '9px', color: '#555', alignSelf: isHuman ? 'flex-end' : 'flex-start' }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  {!isHuman && (
                    <div style={{ fontSize: '9px', color: '#444', marginTop: '4px', marginLeft: '4px', fontFamily: "'DM Sans', sans-serif" }}>
                      {game.agent_name || 'OpenClaw'}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={sendMessage} style={{
          height: '44px', borderTop: '1px solid #111', padding: '0 12px', gap: '8px',
          display: 'flex', alignItems: 'center', flexShrink: 0
        }}>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Message your agent..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#e0e0e0',
              caretColor: '#e63946', touchAction: 'manipulation'
            }}
          />
          <button 
            type="submit"
            disabled={!chatInput.trim()}
            style={{
              width: '30px', height: '30px', background: chatInput.trim() ? '#e63946' : '#181818',
              border: 'none', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: chatInput.trim() ? 'pointer' : 'default', touchAction: 'manipulation', transition: 'background 120ms',
              color: chatInput.trim() ? 'white' : '#333'
            }}
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* FIX 6 — MOVE HISTORY */}
      <div style={{
        background: '#111111',
        borderTop: '1px solid #161616'
      }}>
        <div 
          onClick={() => setMoveHistoryOpen(!moveHistoryOpen)}
          style={{
            height: '44px', padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', flexShrink: 0, touchAction: 'manipulation'
          }}
        >
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#555' }}>Move History</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              background: '#181818', border: '1px solid #1c1c1c', borderRadius: '6px', padding: '2px 7px',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#3a3a3a'
            }}>{(game.move_history || []).length}</span>
            <ChevronDown size={14} color="#2a2a2a" style={{ transform: moveHistoryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }} />
          </div>
        </div>

        <div style={{
          maxHeight: moveHistoryOpen ? '200px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 220ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: '200px', scrollbarWidth: 'none' }}>
            {!(game.move_history || []).length ? (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#222', textAlign: 'center', padding: '10px 0' }}>No moves yet</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 1fr' }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '9px', color: '#222', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #141414', paddingBottom: '4px', marginBottom: '4px' }}>#</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '9px', color: '#222', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #141414', paddingBottom: '4px', marginBottom: '4px' }}>You</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '9px', color: '#222', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #141414', paddingBottom: '4px', marginBottom: '4px' }}>{game.agent_name || 'OpenClaw'}</div>
                
                {Array.from({ length: Math.ceil((game.move_history || []).length / 2) }).map((_, i) => {
                  const wMove = game.move_history[i * 2];
                  const bMove = game.move_history[i * 2 + 1];
                  const isLatestW = i * 2 === game.move_history.length - 1;
                  const isLatestB = i * 2 + 1 === game.move_history.length - 1;
                  
                  return (
                    <React.Fragment key={i}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#2a2a2a', padding: '3px' }}>{i + 1}.</div>
                      <div style={{ 
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: isLatestW ? '#e63946' : '#555', padding: '3px', borderRadius: '3px',
                        background: isLatestW ? 'rgba(230,57,70,0.05)' : 'transparent', border: isLatestW ? '1px solid rgba(230,57,70,0.1)' : '1px solid transparent'
                      }}>{wMove?.san}</div>
                      <div style={{ 
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: isLatestB ? '#e63946' : '#555', padding: '3px', borderRadius: '3px',
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

      {/* FIX 7 — STATUS BAR */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '48px',
        background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid #161616', padding: '0 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50
      }}>
        {game.status === 'finished' || game.status === 'abandoned' ? (
          <div style={{
            background: '#181818', border: '1px solid #222', color: '#e63946', height: '26px', padding: '0 10px', borderRadius: '6px',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>GAME OVER</div>
        ) : game.turn === 'w' ? (
          <div style={{
            background: '#e63946', color: 'white', height: '26px', padding: '0 10px', borderRadius: '6px',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pillPop 300ms ease both'
          }}>YOUR TURN</div>
        ) : (
          <div style={{
            background: '#181818', border: '1px solid #222', color: '#3a3a3a', height: '26px', padding: '0 10px', borderRadius: '6px',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center', textTransform: 'uppercase'
          }}>{game.agent_name || 'OPENCLAW'}&apos;S TURN</div>
        )}
        
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#2a2a2a' }}>
          Move {currentMoveNumber}
        </div>
        
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#222' }}>
          <GameTimer startTime={game.created_at} status={game.status} />
        </div>
      </div>

      {/* SETTINGS MODAL (Untouched) */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Settings" size="md">
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] tracking-wider uppercase">Preferences</h3>
            <div className="space-y-2">
              <label className="text-sm text-[var(--color-text-secondary)]">Board Theme</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'green', colors: ['#eeeed2', '#769656'] },
                  { id: 'classic', colors: ['#f0d9b5', '#b58863'] },
                  { id: 'blue', colors: ['#dee3e6', '#8ca2ad'] },
                  { id: 'purple', colors: ['#e1d5e6', '#8a789a'] },
                  { id: 'monochrome', colors: ['#e0e0e0', '#888888'] }
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
        input::placeholder { color: #222; }
      `}} />
    </div>
  );
}
