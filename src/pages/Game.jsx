'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { toast } from 'sonner';
import { Settings, X, Pause, Play, Flag, Share2, Volume2, VolumeX, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import ChessBoard from '../components/chess/ChessBoard';
import ThinkingPanel from '../components/chess/ThinkingPanel';
import ChatBox from '../components/chess/ChatBox';
import CapturedPieces from '../components/chess/CapturedPieces';
import { supabase } from '../lib/supabase';

export default function Game() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('id');
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [boardTheme, setBoardTheme] = useState('green');
  const [pieceTheme, setPieceTheme] = useState('merida');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef(null);
  const prevMoveCountRef = useRef(0);
  const prevStatusRef = useRef('waiting');
  const boardRef = useRef(null);

  const playSound = (type) => {
    if (!soundEnabled) return;
    
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

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
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
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
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.error("Audio error:", e);
    }
  };

  useEffect(() => {
    if (!game) return;
    
    const currentMoveCount = (game.move_history || []).length;
    const currentStatus = game.status;
    
    if (currentMoveCount > prevMoveCountRef.current) {
      // A move was made
      const chess = new Chess(game.fen);
      const lastMove = game.move_history[currentMoveCount - 1];
      
      if (chess.inCheck()) {
        playSound('check');
      } else if (lastMove && lastMove.san.includes('x')) {
        playSound('capture');
      } else {
        playSound('move');
      }
    }
    
    if (currentStatus === 'finished' && prevStatusRef.current !== 'finished') {
      playSound('gameover');
    }
    
    prevMoveCountRef.current = currentMoveCount;
    prevStatusRef.current = currentStatus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.move_history, game?.status, game?.fen]);

  useEffect(() => {
    if (!gameId) {
      toast.error('No game ID provided');
      return;
    }

    const loadGame = async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error || !data) {
        toast.error('Game not found');
      } else {
        setGame(data);
        if (data.status === 'finished') setGameOver(true);
        await supabase.from('games').update({ human_connected: true }).eq('id', gameId);
      }
      setLoading(false);
    };

    loadGame();

    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(payload.new);
        if (!payload.new.human_connected) {
          supabase.from('games').update({ human_connected: true }).eq('id', gameId);
        }
        if (payload.new.status === 'finished') {
          setGameOver(true);
        }
      })
      .subscribe();

    const handleBeforeUnload = () => {
      supabase.from('games').update({ human_connected: false }).eq('id', gameId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      supabase.from('games').update({ human_connected: false }).eq('id', gameId);
    };
  }, [gameId]); // Removed gameOver from deps to avoid re-subscribing

  const makeMove = async (from, to, promotion) => {
    if (!game || game.turn !== 'w' || !isMyTurn) return;
    
    // Security check: only the creator can play as white
    if (localStorage.getItem(`game_owner_${gameId}`) !== 'true') {
      toast.error('You are not the creator of this game.');
      return;
    }

    const chess = new Chess(game.fen);
    try {
      const move = chess.move({ from, to, promotion });
      if (!move) {
        toast.error('Illegal move');
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
        status: 'active'
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

      if (game.status !== 'active' && updates.status !== 'finished') {
        updates.status = 'active';
      }

      // Save previous state for rollback
      const previousGameState = { ...game };

      // Optimistic update for instant feedback
      setGame(prev => ({ ...prev, ...updates }));

      const { error: updateError } = await supabase.from('games').update(updates).eq('id', gameId);

      if (updateError) {
        toast.error('Failed to sync move with server');
        setGame(previousGameState); // Rollback
        return;
      }

      // Trigger webhook if the agent has registered one
      if (game.webhook_url) {
        try {
          fetch(game.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: updates.status === 'finished' ? 'game_over' : 'your_turn',
              game_id: gameId,
              status: updates.status,
              result: updates.result || null,
              result_reason: updates.result_reason || null,
              fen: updates.fen,
              last_move: {
                from,
                to,
                san: move.san
              },
              chat_history: game.chat_history || [],
              move_count: updates.move_history.length,
              chat_count: (game.chat_history || []).length
            })
          }).catch(err => console.error('Webhook failed to send:', err));
        } catch (e) {
          console.error('Webhook error:', e);
        }
      }

    } catch (e) {
      toast.error('Illegal move');
    }
  };

  const triggerWebhook = (event, extraData = {}) => {
    if (game && game.webhook_url) {
      try {
        fetch(game.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event,
            game_id: gameId,
            ...extraData
          })
        }).catch(err => console.error('Webhook failed:', err));
      } catch (e) {
        console.error('Webhook error:', e);
      }
    }
  };

  const playAgain = async () => {
    await supabase.from('games').update({
      status: 'active',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      turn: 'w',
      move_history: [],
      thinking_log: [],
      current_thinking: '',
      result: null,
      result_reason: null,
      chat_history: []
    }).eq('id', gameId);
    setGameOver(false);
    triggerWebhook('game_restarted');
  };

  const resign = async () => {
    if (confirm('Are you sure you want to resign?')) {
      await supabase.from('games').update({
        status: 'finished',
        result: 'black',
        result_reason: 'resignation'
      }).eq('id', gameId);
      triggerWebhook('game_over', { status: 'finished', result: 'black', result_reason: 'resignation' });
    }
  };

  const acceptAgentResignation = async () => {
    if (confirm("Accept the agent's resignation?")) {
      await supabase.from('games').update({
        status: 'finished',
        result: 'white',
        result_reason: 'resignation'
      }).eq('id', gameId);
      triggerWebhook('game_over', { status: 'finished', result: 'white', result_reason: 'resignation' });
    }
  };

  const pauseGame = async () => {
    await supabase.from('games').update({ status: 'paused' }).eq('id', gameId);
    toast.success('Game paused');
    triggerWebhook('game_paused');
  };

  const resumeGame = async () => {
    await supabase.from('games').update({ status: 'active' }).eq('id', gameId);
    toast.success('Game resumed');
    triggerWebhook('game_resumed');
  };

  const sendMessage = async (text) => {
    const sanitizeText = (str) => {
      return str.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };
    const sanitizedText = sanitizeText(text);
    const newMessage = { sender: 'human', text: sanitizedText, timestamp: Date.now() };
    
    // Optimistic update
    setGame(prev => ({ ...prev, chat_history: [...(prev.chat_history || []), newMessage] }));
    
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gameId, text: sanitizedText, sender: 'human' })
      });
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const copyPgn = () => {
    const chess = new Chess();
    if (game.move_history && game.move_history.length > 0) {
      game.move_history.forEach(m => {
        try { chess.move(m.san); } catch (e) {}
      });
    }
    navigator.clipboard.writeText(chess.pgn());
    toast.success('PGN copied to clipboard');
  };

  const shareGame = async (action) => {
    try {
      const resultText = game.result === 'white' ? 'I beat my OpenClaw agent' : game.result === 'black' ? 'My OpenClaw agent beat me' : 'I drew against my OpenClaw agent';
      const shareText = `${resultText} in ${currentMoveNumber} moves! 🦞♟️\n\nPlay against it here: ${window.location.origin}`;
      
      if (action === 'twitter') {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        window.open(twitterUrl, '_blank');
        return;
      }

      toast.info('Generating screenshot...');
      const boardElement = boardRef.current;
      if (!boardElement) throw new Error('Board not found');
      
      const canvas = await html2canvas(boardElement, {
        backgroundColor: '#312e2b',
        scale: 2,
        useCORS: true
      });
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chesswithclaw-${gameId.substring(0, 6)}.png`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Screenshot downloaded!');
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to share game');
    }
  };

  const captured = useMemo(() => {
    if (!game?.fen) return { white_lost: {}, black_lost: {} };
    const fenBoard = game.fen.split(' ')[0];
    const counts = { p:0, n:0, b:0, r:0, q:0, P:0, N:0, B:0, R:0, Q:0 };
    for (let char of fenBoard) {
      if (counts[char] !== undefined) counts[char]++;
    }
    return {
      white_lost: { 
        P: Math.max(0, 8 - counts.P), N: Math.max(0, 2 - counts.N), 
        B: Math.max(0, 2 - counts.B), R: Math.max(0, 2 - counts.R), Q: Math.max(0, 1 - counts.Q) 
      },
      black_lost: { 
        p: Math.max(0, 8 - counts.p), n: Math.max(0, 2 - counts.n), 
        b: Math.max(0, 2 - counts.b), r: Math.max(0, 2 - counts.r), q: Math.max(0, 1 - counts.q) 
      }
    };
  }, [game?.fen]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#312e2b] flex items-center justify-center text-white font-sans">
        Loading game...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[#312e2b] flex items-center justify-center text-white font-sans">
        Game not found
      </div>
    );
  }

  const chess = new Chess(game.fen);
  const isMyTurn = game.turn === 'w' && (game.status === 'active' || game.status === 'waiting');
  const isAgentTurn = game.turn === 'b' && (game.status === 'active' || game.status === 'waiting');
  const lastMove = (game.move_history || [])[(game.move_history || []).length - 1] || null;
  const lastThinking = (game.thinking_log || [])[(game.thinking_log || []).length - 1] || null;
  const currentMoveNumber = Math.floor((game.move_history || []).length / 2) + 1;
  const agentUrl = `${window.location.origin}/Agent?id=${gameId}`;

  let statusMessage = '';
  let statusColor = '';
  let statusBg = '';
  let statusBorder = '';

  if (game.status === 'finished') {
    if (game.result === 'white') {
      statusMessage = '🏆 CHECKMATE! YOU WIN!';
      statusColor = '#c62828';
    } else if (game.result === 'black') {
      statusMessage = '💀 CHECKMATE. CLAW WINS.';
      statusColor = '#c62828';
    } else {
      statusMessage = '🤝 DRAW';
      statusColor = '#c3c3c2';
    }
    statusBg = '#262421';
    statusBorder = '#403d39';
  } else if (game.status === 'paused') {
    statusMessage = '⏸ GAME PAUSED';
    statusColor = '#c3c3c2';
    statusBg = '#262421';
    statusBorder = '#403d39';
  } else if (isMyTurn) {
    if (chess.inCheck()) {
      statusMessage = '⚠️ IN CHECK! YOUR TURN (WHITE)';
      statusColor = '#ef5350';
    } else {
      statusMessage = '♟ YOUR TURN (WHITE)';
      statusColor = '#c62828';
    }
    statusBg = '#262421';
    statusBorder = '#c62828';
  } else if (!game.agent_connected) {
    statusMessage = '⏳ WAITING FOR AGENT...';
    statusColor = '#c3c3c2';
    statusBg = '#262421';
    statusBorder = '#403d39';
  } else if (isAgentTurn) {
    if (chess.inCheck()) {
      statusMessage = '⚠️ AGENT IN CHECK — THINKING...';
      statusColor = '#ef5350';
    } else {
      statusMessage = '🦞 AGENT THINKING...';
      statusColor = '#c3c3c2';
    }
    statusBg = '#262421';
    statusBorder = '#403d39';
  } else {
    statusMessage = 'WAITING...';
    statusColor = '#c3c3c2';
    statusBg = '#262421';
    statusBorder = '#403d39';
  }

  return (
    <div className="min-h-screen bg-[#312e2b] flex flex-col font-sans pb-20">
      {/* HEADER */}
      <div className="bg-[#262421] border-b border-[#403d39] px-3 sm:px-6 h-14 sm:h-16 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
            alt="Logo" 
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            className="w-10 h-10 rounded-full border border-[#403d39] object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://images.unsplash.com/photo-1580541832626-2a7131ee809f?w=400&q=80";
            }}
          />
          <h1 className="text-xl sm:text-2xl text-[#ffffff] font-bold">
            ChessWithClaw
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[#c3c3c2] text-xs sm:text-sm hidden sm:block font-bold">
            Room #{gameId.substring(0, 6).toUpperCase()}
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="text-[#c3c3c2] hover:text-[#ffffff] transition-colors p-2 rounded-full hover:bg-[#403d39]"
            title="Settings"
          >
            <Settings size={24} />
          </button>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#262421] border border-[#403d39] rounded-lg w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-[#403d39]">
              <h2 className="text-xl font-bold text-[#ffffff] flex items-center gap-2">
                <Settings size={20} /> Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-[#c3c3c2] hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Game Controls */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#c3c3c2] tracking-wider uppercase">Game Controls</h3>
                <div className="grid grid-cols-2 gap-3">
                  {game.status === 'active' ? (
                    <button onClick={pauseGame} className="flex items-center justify-center gap-2 bg-[#312e2b] hover:bg-[#403d39] text-white py-2 px-4 rounded-lg border-b-[3px] border-[#211f1c] active:border-b-0 active:translate-y-[3px] transition-all">
                      <Pause size={16} /> Pause
                    </button>
                  ) : game.status === 'paused' ? (
                    <button onClick={resumeGame} className="flex items-center justify-center gap-2 bg-[#c62828] hover:bg-[#e53935] text-white font-bold py-2 px-4 rounded-lg border-b-[3px] border-[#7f0000] active:border-b-0 active:translate-y-[3px] transition-all">
                      <Play size={16} /> Resume
                    </button>
                  ) : (
                    <button disabled className="flex items-center justify-center gap-2 bg-[#312e2b] text-[#c3c3c2] py-2 px-4 rounded-lg border-b-[3px] border-[#211f1c] cursor-not-allowed">
                      <Pause size={16} /> Pause
                    </button>
                  )}
                  
                  <button 
                    onClick={() => { resign(); setShowSettings(false); }}
                    disabled={game.status === 'finished'}
                    className="flex items-center justify-center gap-2 bg-[#7f0000]/30 hover:bg-[#7f0000]/50 text-[#ef5350] border-2 border-[#7f0000] hover:border-[#ef5350] py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Flag size={16} /> Resign
                  </button>
                </div>
              </div>

              {/* Appearance & Sound */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#c3c3c2] tracking-wider uppercase">Appearance & Sound</h3>
                
                <div className="flex items-center justify-between bg-[#312e2b] border border-[#403d39] p-3 rounded-lg mb-3">
                  <span className="text-sm text-[#ffffff] font-medium">Sound Effects</span>
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-2 rounded-md transition-colors ${soundEnabled ? 'bg-[#c62828] text-white' : 'bg-[#403d39] text-[#c3c3c2]'}`}
                  >
                    {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-[#c3c3c2] mb-1">Board Theme</label>
                  <select 
                    value={boardTheme} 
                    onChange={(e) => setBoardTheme(e.target.value)}
                    className="w-full bg-[#312e2b] border border-[#403d39] text-white rounded p-2 outline-none focus:border-[#c62828]"
                  >
                    <option value="green">Green (Default)</option>
                    <option value="classic">Classic (Red/Cream)</option>
                    <option value="blue">Blue</option>
                    <option value="purple">Purple</option>
                    <option value="monochrome">Monochrome</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[#c3c3c2] mb-1">Pieces Design</label>
                  <select 
                    value={pieceTheme} 
                    onChange={(e) => setPieceTheme(e.target.value)}
                    className="w-full bg-[#312e2b] border border-[#403d39] text-white rounded p-2 outline-none focus:border-[#c62828]"
                  >
                    <option value="unicode">Unicode (Classic)</option>
                    <option value="cburnett">CBurnett (Standard)</option>
                    <option value="alpha">Alpha</option>
                    <option value="merida">Merida</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col lg:flex-row p-1.5 sm:p-6 gap-1.5 sm:gap-6 max-w-[1400px] mx-auto w-full pb-16 sm:pb-28">
        
        {/* MOBILE: Thinking Panel on top */}
        <div className="block lg:hidden w-full shrink-0">
          <ThinkingPanel 
            agentConnected={game.agent_connected}
            agentUrl={agentUrl}
            currentThinking={game.current_thinking}
            lastThinking={lastThinking}
            isAgentTurn={isAgentTurn}
            isHumanTurn={isMyTurn}
          />
        </div>

        {/* LEFT: Chess Board */}
        <div className="flex-shrink-0 w-full lg:w-auto flex flex-col items-center justify-center overflow-hidden gap-0.5 sm:gap-2">
          {/* Top: Agent (Black) captured pieces -> White pieces lost */}
          <div className="w-full flex justify-start px-1" style={{ maxWidth: 'min(100vw - 0.75rem, 100vh - 310px, 480px)' }}>
             <CapturedPieces pieces={captured.white_lost} isWhitePieces={true} />
          </div>
          
          <div className="w-full" style={{ maxWidth: 'min(100vw - 0.75rem, 100vh - 310px, 480px)' }} ref={boardRef}>
            <ChessBoard 
              fen={game.fen} 
              onMove={makeMove} 
              isMyTurn={isMyTurn} 
              lastMove={lastMove} 
              boardTheme={boardTheme}
              pieceTheme={pieceTheme}
            />
          </div>

          {/* Bottom: Human (White) captured pieces -> Black pieces lost */}
          <div className="w-full flex justify-start px-1" style={{ maxWidth: 'min(100vw - 0.75rem, 100vh - 310px, 480px)' }}>
             <CapturedPieces pieces={captured.black_lost} isWhitePieces={false} />
          </div>
        </div>

        {/* RIGHT: Panels */}
        <div className="flex-1 flex flex-col gap-1.5 sm:gap-6 min-w-0">
          <div className="hidden lg:block">
            <ThinkingPanel 
              agentConnected={game.agent_connected}
              agentUrl={agentUrl}
              currentThinking={game.current_thinking}
              lastThinking={lastThinking}
              isAgentTurn={isAgentTurn}
              isHumanTurn={isMyTurn}
            />
          </div>
          <div className="flex-1 flex flex-col min-h-[250px] sm:min-h-[300px]">
            <ChatBox 
              chatHistory={game.chat_history || []} 
              onSendMessage={sendMessage} 
              onAcceptResignation={acceptAgentResignation}
            />
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM STATUS BAR (Universal Information Tab) */}
      <div 
        className="fixed bottom-0 left-0 right-0 border-t-2 px-3 sm:px-6 h-14 sm:h-16 flex justify-between items-center z-20 transition-colors duration-300 backdrop-blur-md shrink-0"
        style={{ backgroundColor: `${statusBg}F2`, borderTopColor: statusBorder }}
      >
        <div className="flex flex-col justify-center h-full">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div 
              className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${isMyTurn || !game.agent_connected ? 'animate-pulse' : ''}`} 
              style={{ backgroundColor: statusColor }}
            />
            <span className="font-bold text-[10px] sm:text-base" style={{ color: statusColor }}>
              {statusMessage}
            </span>
          </div>
          <span className="text-[9px] sm:text-xs text-[#c3c3c2] mt-0.5">
            {game.status === 'waiting' ? 'Waiting for opponent' : game.status === 'active' ? 'Match in progress' : game.status === 'paused' ? 'Match paused' : 'Match concluded'}
          </span>
        </div>
        
        <div className="flex flex-col items-end justify-center h-full gap-0.5 text-[#c3c3c2]">
          <div className="flex items-center gap-1.5 sm:gap-3 text-[9px] sm:text-sm">
            <span className="font-sans font-bold">Move: {currentMoveNumber}</span>
            <span className="text-[#403d39] hidden sm:inline">|</span>
            <div className="flex items-center gap-1" title={game.agent_connected ? "Agent Online" : "Agent Offline"}>
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${game.agent_connected ? 'bg-[#c62828]' : 'bg-[#c3c3c2]'}`} />
              <span className="font-bold">{game.agent_connected ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <span className="text-[8px] sm:text-[10px] text-[#c3c3c2] font-sans tracking-widest font-bold">ROOM #{gameId.substring(0, 6).toUpperCase()}</span>
        </div>
      </div>

      {/* GAME OVER MODAL */}
      {gameOver && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="bg-[#262421] border-4 border-[#c62828] rounded-lg p-8 max-w-md w-full text-center shadow-2xl transform animate-in fade-in zoom-in duration-300">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
              alt="Logo" 
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="w-20 h-20 mx-auto mb-6 rounded-full border border-[#403d39] object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://images.unsplash.com/photo-1580541832626-2a7131ee809f?w=400&q=80";
              }}
            />
            <h2 className="text-3xl font-bold text-[#ffffff] mb-2 font-sans">
              {game.result === 'white' ? '🏆 You Win!' : game.result === 'black' ? '💀 You Lose' : '🤝 Draw'}
            </h2>
            <p className="text-[#c3c3c2] mb-6">
              {game.result_reason === 'checkmate' ? `Checkmate on move ${currentMoveNumber}` : 
               game.result_reason === 'stalemate' ? 'Stalemate' : 
               game.result_reason === 'resignation' ? 'Resignation' :
               'Draw by repetition or insufficient material'}
            </p>
            
            <hr className="border-[#403d39] mb-6" />
            
            <div className="text-[#c3c3c2] mb-8">
              Total Moves: {(game.move_history || []).length}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => shareGame('download')}
                  className="flex-1 bg-[#312e2b] hover:bg-[#403d39] text-white font-bold py-3 px-2 rounded-lg border-b-[4px] border-[#211f1c] active:border-b-0 active:translate-y-[4px] transition-all text-sm shadow-sm flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  Download Image
                </button>
                <button
                  onClick={() => shareGame('twitter')}
                  className="flex-1 bg-[#000000] hover:bg-[#1a1a1a] text-white font-bold py-3 px-2 rounded-lg border-b-[4px] border-[#333333] active:border-b-0 active:translate-y-[4px] transition-all text-sm shadow-sm flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Share on X
                </button>
              </div>
              <button
                onClick={playAgain}
                className="w-full bg-[#c62828] hover:bg-[#e53935] text-white font-bold py-3 px-4 rounded-lg border-b-[4px] border-[#7f0000] active:border-b-0 active:translate-y-[4px] transition-all shadow-sm"
              >
                PLAY AGAIN
              </button>
              <button
                onClick={copyPgn}
                className="w-full bg-transparent border-2 border-[#403d39] hover:border-[#c3c3c2] text-[#c3c3c2] hover:text-[#ffffff] font-bold py-3 px-4 rounded-lg transition-colors"
              >
                COPY PGN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
