'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useToast } from '../contexts/ToastContext';
import ChessBoard from '../components/chess/ChessBoard';
import ChatBox from '../components/chess/ChatBox';
import { supabase, getSupabaseWithToken } from '../lib/supabase';

export default function Agent() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('id');
  const { toast } = useToast();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reasoning, setReasoning] = useState('');
  const [moveInput, setMoveInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const moveInputRef = useRef(null);

  const channelRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectDelayRef = useRef(1000);

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
      } else if (data.agent_connected) {
        toast.error('An agent is already connected to this game.');
        setGame(data);
      } else {
        setGame(data);
        await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ agent_connected: true }).eq('id', gameId);
      }
      setLoading(false);
    };

    loadGame();

    const connectChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase.channel(`agent-${gameId}`);
      channelRef.current = channel;

      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(payload.new);
        if (!payload.new.agent_connected) {
          getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ agent_connected: true }).eq('id', gameId);
        }
        if (payload.new.turn === 'b' && (payload.new.status === 'active' || payload.new.status === 'waiting')) {
          setTimeout(() => moveInputRef.current?.focus(), 100);
        }
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          reconnectDelayRef.current = 1000;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
            connectChannel();
          }, reconnectDelayRef.current);
        }
      });
    };

    connectChannel();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        connectChannel();
      } else {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleBeforeUnload = () => {
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ agent_connected: false }).eq('id', gameId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gameId, role: 'agent' })
      }).catch(() => {});
    }, 15000);

    return () => {
      clearInterval(heartbeatInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ agent_connected: false }).eq('id', gameId);
    };
  }, [gameId, toast]);

  const thinkingTimeoutRef = useRef(null);

  const handleReasoningChange = (e) => {
    const text = e.target.value;
    setReasoning(text);
    
    if (game && game.turn === 'b') {
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
      thinkingTimeoutRef.current = setTimeout(async () => {
        await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ current_thinking: text }).eq('id', gameId);
      }, 500);
    }
  };

  const submitMove = async () => {
    if (!moveInput.trim() || !game) return;
    
    // Security check: prevent move if another agent is already connected and it's not us
    // (In a real app, we'd use a secure token here)
    
    setSubmitting(true);
    setError('');

    const chess = new Chess(game.fen);
    let move = null;

    try {
      move = chess.move(moveInput.trim());
    } catch (e) {
      try {
        const from = moveInput.trim().substring(0, 2);
        const to = moveInput.trim().substring(2, 4);
        const promotion = moveInput.trim().length > 4 ? moveInput.trim().substring(4, 5) : 'q';
        move = chess.move({ from, to, promotion });
      } catch (err) {
        move = null;
      }
    }

    if (!move) {
      setError(`Invalid move: '${moveInput}'. Not in your legal moves list.`);
      setSubmitting(false);
      return;
    }

    const newThinkingLog = [...(game.thinking_log || []), {
      moveNumber: Math.floor((game.move_history || []).length / 2) + 1,
      text: reasoning || '(no reasoning provided)',
      finalMove: move.san,
      timestamp: Date.now()
    }];

    const newMoveHistory = [...(game.move_history || []), {
      number: Math.floor((game.move_history || []).length / 2) + 1,
      color: 'b',
      from: move.from,
      to: move.to,
      san: move.san,
      uci: move.from + move.to + (move.promotion || ''),
      timestamp: Date.now()
    }];

    const updates = {
      fen: chess.fen(),
      turn: 'w',
      move_history: newMoveHistory,
      thinking_log: newThinkingLog,
      current_thinking: '',
      status: 'active'
    };

    if (chess.isCheckmate()) {
      updates.status = 'finished';
      updates.result = 'black';
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

    // Optimistic update
    setGame(prev => ({ ...prev, ...updates }));

    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update(updates).eq('id', gameId);
    setReasoning('');
    setMoveInput('');
    setSubmitting(false);
  };

  const sendMessage = async (text) => {
    const newMessage = { sender: 'agent', text, timestamp: Date.now() };
    
    // Optimistic update
    setGame(prev => ({ ...prev, chat_history: [...(prev.chat_history || []), newMessage] }));
    
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gameId, text, sender: 'agent' })
      });
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col font-sans">
        <div className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-bg-elevated)] animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)', backgroundSize: '200% 100%' }}></div>
            <div className="w-32 h-6 bg-[var(--color-bg-elevated)] rounded animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)', backgroundSize: '200% 100%' }}></div>
          </div>
        </div>
        <div className="bg-[var(--color-bg-surface)] border-b-4 border-[var(--color-border-subtle)] px-4 py-6 text-center">
          <div className="w-64 h-8 bg-[var(--color-bg-elevated)] rounded mx-auto mb-2 animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)', backgroundSize: '200% 100%' }}></div>
          <div className="w-48 h-4 bg-[var(--color-bg-elevated)] rounded mx-auto animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)', backgroundSize: '200% 100%' }}></div>
        </div>
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 w-full">
          <div className="w-full h-16 bg-[var(--color-bg-elevated)] rounded animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)', backgroundSize: '200% 100%' }}></div>
          <div className="w-full h-64 bg-[var(--color-bg-elevated)] rounded animate-[shimmer_1.5s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)', backgroundSize: '200% 100%' }}></div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center text-[var(--color-text-primary)] font-sans">
        GAME NOT FOUND
      </div>
    );
  }

  const chess = new Chess(game.fen);
  const isMyTurn = game.turn === 'b' && (game.status === 'active' || game.status === 'waiting');
  const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
  const lastMove = (game.move_history || [])[(game.move_history || []).length - 1] || null;
  const moveNumber = Math.floor((game.move_history || []).length / 2) + 1;

  let bannerBg = 'bg-[var(--color-bg-surface)]';
  let bannerBorder = 'border-[var(--color-border-subtle)]';
  let bannerTitle = '⏳ WAITING FOR YOUR TURN...';
  let bannerSubtitle = 'Waiting for the game to start...';

  if (isMyTurn) {
    bannerBg = 'bg-[var(--color-red-primary)]/30';
    bannerBorder = 'border-[var(--color-red-primary)]';
    bannerTitle = '⚡ YOUR TURN — YOU ARE BLACK';
    bannerSubtitle = 'Read the game state below. Type your reasoning. Submit your move.';
  } else if (game.turn === 'w') {
    bannerBg = 'bg-[var(--color-bg-surface)]';
    bannerBorder = 'border-[var(--color-border-subtle)]';
    bannerTitle = '⏳ WHITE IS MOVING...';
    bannerSubtitle = 'White (human player) is making their move...';
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] font-sans text-[var(--color-text-primary)]">
      {/* HEADER */}
      <div className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
            alt="Logo" 
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            className="w-10 h-10 rounded-full border border-[var(--color-border-subtle)] object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://images.unsplash.com/photo-1580541832626-2a7131ee809f?w=400&q=80";
            }}
          />
          <h1 className="text-xl sm:text-2xl text-[var(--color-text-primary)] font-bold">Claw Agent</h1>
        </div>
        <div className="text-[var(--color-text-secondary)] text-sm hidden sm:block">Black</div>
      </div>

      {/* TURN BANNER */}
      <div className={`${bannerBg} border-b-4 ${bannerBorder} px-4 py-6 text-center transition-colors duration-300`}>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">{bannerTitle}</h2>
        <p className="text-[var(--color-text-secondary)]">{bannerSubtitle}</p>
      </div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* 1. Connection Status Card */}
        <div className="bg-[var(--color-red-primary)]/20 border-2 border-[var(--color-red-primary)] rounded p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[var(--color-red-primary)] animate-pulse" />
            <span className="text-[var(--color-red-primary)] font-bold">CONNECTED TO GAME</span>
          </div>
          <div className="text-[var(--color-text-secondary)] text-sm font-bold">
            Room #{gameId.substring(0, 6).toUpperCase()}
          </div>
        </div>

        {/* 2. Game State Block */}
        <div className="bg-[var(--color-bg-elevated)] border-2 border-[var(--color-border-subtle)] rounded overflow-hidden">
          <div className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] p-3 flex justify-between items-center">
            <h3 className="font-bold text-[var(--color-text-primary)]">GAME STATE</h3>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                Human: <div className={`w-2 h-2 rounded-full ${game.human_connected ? 'bg-[var(--color-red-primary)]' : 'bg-[var(--color-border-subtle)]'}`} />
              </span>
              <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                Agent: <div className={`w-2 h-2 rounded-full ${game.agent_connected ? 'bg-[var(--color-red-primary)]' : 'bg-[var(--color-border-subtle)]'}`} />
              </span>
            </div>
          </div>
          
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[var(--color-text-secondary)] mb-1">YOU ARE: <span className="text-[var(--color-text-primary)] font-bold">BLACK</span></p>
              <p className="text-[var(--color-text-secondary)] mb-1">CURRENT TURN: <span className="text-[var(--color-text-primary)] font-bold">{game.turn === 'w' ? 'WHITE' : 'BLACK'}</span></p>
              <p className="text-[var(--color-text-secondary)] mb-1">MOVE NUMBER: <span className="text-[var(--color-text-primary)] font-bold">{moveNumber}</span></p>
              <p className="text-[var(--color-text-secondary)] mb-1">GAME STATUS: <span className="text-[var(--color-text-primary)] font-bold">{game.status.toUpperCase()}</span></p>
              {lastMove && (
                <p className="text-[var(--color-text-secondary)] mt-2">
                  LAST MOVE: <span className="text-[var(--color-red-primary)] font-bold">{lastMove.uci}</span> (played by {lastMove.color === 'w' ? 'WHITE' : 'BLACK'})
                </p>
              )}
            </div>
            
            <div className="space-y-4">
              {isMyTurn && (
                <div>
                  <p className="text-[var(--color-text-secondary)] mb-1 font-bold">YOUR LEGAL MOVES:</p>
                  <div className="bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] rounded p-2 max-h-24 overflow-y-auto text-[var(--color-red-primary)] break-words font-mono">
                    {legalMoves.join(', ')}
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-[var(--color-text-secondary)] mb-1 font-bold">FEN POSITION:</p>
                <div className="bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] rounded p-2 text-[10px] sm:text-xs text-[var(--color-text-secondary)] break-all font-mono">
                  {game.fen}
                </div>
              </div>

              <div>
                <p className="text-[var(--color-text-secondary)] mb-1 font-bold">FULL MOVE HISTORY:</p>
                <div className="bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] rounded p-2 text-xs text-[var(--color-text-secondary)] max-h-24 overflow-y-auto font-mono">
                  {(game.move_history || []).map((m, i) => (
                    <span key={i}>
                      {i % 2 === 0 ? `${m.number}. ` : ''}{m.san} 
                    </span>
                  ))}
                  {(!game.move_history || game.move_history.length === 0) && 'No moves yet'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Action Area */}
        {isMyTurn && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Step 1 */}
            <div className="bg-[var(--color-bg-elevated)] border-2 border-[var(--color-border-subtle)] rounded overflow-hidden">
              <div className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] p-3">
                <h3 className="font-bold text-[var(--color-text-primary)]">STEP 1: TYPE YOUR REASONING (optional but encouraged)</h3>
              </div>
              <div className="p-4">
                <textarea
                  value={reasoning}
                  onChange={handleReasoningChange}
                  rows={8}
                  className="w-full bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] focus:border-[var(--color-red-primary)] rounded p-3 text-[var(--color-text-primary)] font-mono outline-none resize-y transition-colors"
                  placeholder="I see that White just played... My evaluation is... I should respond with..."
                />
                <p className="text-[var(--color-text-secondary)] text-xs mt-2 italic">
                  (Your reasoning will be shown live to your opponent as you type)
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[var(--color-bg-elevated)] border-2 border-[var(--color-border-subtle)] rounded overflow-hidden">
              <div className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] p-3">
                <h3 className="font-bold text-[var(--color-text-primary)]">STEP 2: ENTER YOUR MOVE AND SUBMIT</h3>
              </div>
              <div className="p-4 space-y-4">
                {error && (
                  <div className="bg-[var(--color-red-primary)]/20 border border-[var(--color-red-primary)] rounded p-3 text-[var(--color-red-primary)] text-sm">
                    {error}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-4">
                  <input
                    ref={moveInputRef}
                    type="text"
                    value={moveInput}
                    onChange={(e) => setMoveInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitMove()}
                    placeholder="e.g. e7e5 or Nf6"
                    className="flex-1 bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] focus:border-[var(--color-red-primary)] rounded px-4 py-3 text-xl text-[var(--color-text-primary)] font-mono outline-none transition-colors"
                  />
                  <button
                    onClick={submitMove}
                    disabled={submitting || !moveInput.trim()}
                    className="bg-[var(--color-red-primary)] hover:bg-[var(--color-red-hover)] disabled:opacity-50 disabled:hover:bg-[var(--color-red-primary)] text-white font-bold py-3 px-8 rounded-lg border-b-[4px] border-[var(--color-red-hover)] active:border-b-0 active:translate-y-[4px] transition-all disabled:active:border-b-[4px] disabled:active:translate-y-0 text-lg"
                  >
                    {submitting ? 'SUBMITTING...' : 'SUBMIT MOVE'}
                  </button>
                </div>
                <p className="text-[var(--color-red-primary)] text-xs font-bold">
                  ⚠️ Only moves from YOUR LEGAL MOVES list above will be accepted.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4. Move Format Guide */}
        <div className="bg-[var(--color-bg-elevated)] border-2 border-[var(--color-border-subtle)] rounded p-4">
          <h3 className="font-bold text-center text-[var(--color-text-secondary)] mb-4">MOVE FORMAT GUIDE</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[var(--color-text-secondary)]">
            <ul className="space-y-2">
              <li><span className="text-[var(--color-text-primary)]">Pawn move:</span> e7e5 (UCI) or e5 (SAN)</li>
              <li><span className="text-[var(--color-text-primary)]">Piece move:</span> g8f6 (UCI) or Nf6 (SAN)</li>
              <li><span className="text-[var(--color-text-primary)]">Piece symbols:</span> N=Knight B=Bishop R=Rook Q=Queen K=King</li>
            </ul>
            <ul className="space-y-2">
              <li><span className="text-[var(--color-text-primary)]">Kingside castle:</span> O-O</li>
              <li><span className="text-[var(--color-text-primary)]">Queenside castle:</span> O-O-O</li>
              <li><span className="text-[var(--color-text-primary)]">Promotion:</span> e7e8q, e7e8r, e7e8b, e7e8n</li>
            </ul>
          </div>
          <p className="text-center text-[var(--color-red-primary)] text-xs mt-4 font-bold">
            IMPORTANT: Only moves in YOUR LEGAL MOVES list are valid.
          </p>
        </div>

        {/* 5. Reference Board */}
        <div className="bg-[var(--color-bg-elevated)] border-2 border-[var(--color-border-subtle)] rounded overflow-hidden">
          <div className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] p-3">
            <h3 className="font-bold text-[var(--color-text-secondary)]">BOARD POSITION (REFERENCE ONLY — submit your move above)</h3>
          </div>
          <div className="p-4 flex justify-center">
            <div className="scale-75 sm:scale-100 origin-top">
              <ChessBoard 
                fen={game.fen} 
                onMove={() => {}} 
                isMyTurn={false} 
                lastMove={lastMove} 
                showCoordinates={false} 
                interactive={false} 
                boardTheme="green"
              />
            </div>
          </div>
        </div>

        {/* 6. Live Chat */}
        <div className="h-[300px]">
          <ChatBox 
            chatHistory={game.chat_history || []} 
            onSendMessage={sendMessage} 
            onAcceptResignation={() => {}}
          />
        </div>

        {/* 7. Game Over Block */}
        {game.status === 'finished' && (
          <div className="bg-[var(--color-bg-surface)] border-4 border-[var(--color-red-primary)] rounded-xl p-8 text-center animate-in fade-in zoom-in duration-500">
            <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              GAME OVER — {game.result === 'white' ? 'WHITE WINS' : game.result === 'black' ? 'BLACK WINS' : 'DRAW'}
            </h2>
            <p className="text-[var(--color-text-secondary)] text-lg">
              Reason: {game.result_reason === 'checkmate' ? 'Checkmate' : 
                       game.result_reason === 'stalemate' ? 'Stalemate' : 
                       game.result_reason === 'resignation' ? 'Resignation' : 'Draw'}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
