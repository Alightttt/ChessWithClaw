'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { toast } from 'sonner';
import ChessBoard from '../components/chess/ChessBoard';
import ChatBox from '../components/chess/ChatBox';
import { supabase } from '../lib/supabase';

export default function Agent() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('id');
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reasoning, setReasoning] = useState('');
  const [moveInput, setMoveInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const moveInputRef = useRef(null);

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
        await supabase.from('games').update({ agent_connected: true }).eq('id', gameId);
      }
      setLoading(false);
    };

    loadGame();

    const channel = supabase
      .channel(`agent-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(payload.new);
        if (!payload.new.agent_connected) {
          supabase.from('games').update({ agent_connected: true }).eq('id', gameId);
        }
        if (payload.new.turn === 'b' && (payload.new.status === 'active' || payload.new.status === 'waiting')) {
          setTimeout(() => moveInputRef.current?.focus(), 100);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
    };
  }, [gameId]);

  const thinkingTimeoutRef = useRef(null);

  const handleReasoningChange = (e) => {
    const text = e.target.value;
    setReasoning(text);
    
    if (game && game.turn === 'b') {
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
      thinkingTimeoutRef.current = setTimeout(async () => {
        await supabase.from('games').update({ current_thinking: text }).eq('id', gameId);
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

    await supabase.from('games').update(updates).eq('id', gameId);
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
      <div className="min-h-screen bg-[#312e2b] flex items-center justify-center text-white font-sans">
        LOADING GAME...
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-[#312e2b] flex items-center justify-center text-white font-sans">
        GAME NOT FOUND
      </div>
    );
  }

  const chess = new Chess(game.fen);
  const isMyTurn = game.turn === 'b' && (game.status === 'active' || game.status === 'waiting');
  const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
  const lastMove = (game.move_history || [])[(game.move_history || []).length - 1] || null;
  const moveNumber = Math.floor((game.move_history || []).length / 2) + 1;

  let bannerBg = 'bg-[#262421]';
  let bannerBorder = 'border-[#403d39]';
  let bannerTitle = '⏳ WAITING FOR YOUR TURN...';
  let bannerSubtitle = 'Waiting for the game to start...';

  if (isMyTurn) {
    bannerBg = 'bg-[#7f0000]/30';
    bannerBorder = 'border-[#c62828]';
    bannerTitle = '⚡ YOUR TURN — YOU ARE BLACK';
    bannerSubtitle = 'Read the game state below. Type your reasoning. Submit your move.';
  } else if (game.turn === 'w') {
    bannerBg = 'bg-[#262421]';
    bannerBorder = 'border-[#c3c3c2]';
    bannerTitle = '⏳ WHITE IS MOVING...';
    bannerSubtitle = 'White (human player) is making their move...';
  }

  return (
    <div className="min-h-screen bg-[#312e2b] font-sans text-[#ffffff]">
      {/* HEADER */}
      <div className="bg-[#262421] border-b border-[#403d39] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
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
          <h1 className="text-xl sm:text-2xl text-[#ffffff] font-bold">Claw Agent</h1>
        </div>
        <div className="text-[#c3c3c2] text-sm hidden sm:block">Black</div>
      </div>

      {/* TURN BANNER */}
      <div className={`${bannerBg} border-b-4 ${bannerBorder} px-4 py-6 text-center transition-colors duration-300`}>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">{bannerTitle}</h2>
        <p className="text-[#c3c3c2]">{bannerSubtitle}</p>
      </div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* 1. Connection Status Card */}
        <div className="bg-[#7f0000]/20 border-2 border-[#ef5350] rounded p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#ef5350] animate-pulse" />
            <span className="text-[#ef5350] font-bold">CONNECTED TO GAME</span>
          </div>
          <div className="text-[#c3c3c2] text-sm">
            Room: {gameId.substring(0, 8)}
          </div>
        </div>

        {/* 2. Game State Block */}
        <div className="bg-[#211f1c] border-2 border-[#403d39] rounded overflow-hidden">
          <div className="bg-[#262421] border-b border-[#403d39] p-3 flex justify-between items-center">
            <h3 className="font-bold text-[#ffffff]">GAME STATE</h3>
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-2 text-[#c3c3c2]">
                Human: <div className={`w-2 h-2 rounded-full ${game.human_connected ? 'bg-[#ef5350]' : 'bg-[#403d39]'}`} />
              </span>
              <span className="flex items-center gap-2 text-[#c3c3c2]">
                Agent: <div className={`w-2 h-2 rounded-full ${game.agent_connected ? 'bg-[#ef5350]' : 'bg-[#403d39]'}`} />
              </span>
            </div>
          </div>
          
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[#c3c3c2] mb-1">YOU ARE: <span className="text-white font-bold">BLACK</span></p>
              <p className="text-[#c3c3c2] mb-1">CURRENT TURN: <span className="text-white font-bold">{game.turn === 'w' ? 'WHITE' : 'BLACK'}</span></p>
              <p className="text-[#c3c3c2] mb-1">MOVE NUMBER: <span className="text-white font-bold">{moveNumber}</span></p>
              <p className="text-[#c3c3c2] mb-1">GAME STATUS: <span className="text-white font-bold">{game.status.toUpperCase()}</span></p>
              {lastMove && (
                <p className="text-[#c3c3c2] mt-2">
                  LAST MOVE: <span className="text-[#ef5350] font-bold">{lastMove.uci}</span> (played by {lastMove.color === 'w' ? 'WHITE' : 'BLACK'})
                </p>
              )}
            </div>
            
            <div className="space-y-4">
              {isMyTurn && (
                <div>
                  <p className="text-[#c3c3c2] mb-1 font-bold">YOUR LEGAL MOVES:</p>
                  <div className="bg-[#312e2b] border border-[#403d39] rounded p-2 max-h-24 overflow-y-auto text-[#ef5350] break-words font-mono">
                    {legalMoves.join(', ')}
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-[#c3c3c2] mb-1 font-bold">FEN POSITION:</p>
                <div className="bg-[#312e2b] border border-[#403d39] rounded p-2 text-[10px] sm:text-xs text-[#c3c3c2] break-all font-mono">
                  {game.fen}
                </div>
              </div>

              <div>
                <p className="text-[#c3c3c2] mb-1 font-bold">FULL MOVE HISTORY:</p>
                <div className="bg-[#312e2b] border border-[#403d39] rounded p-2 text-xs text-[#c3c3c2] max-h-24 overflow-y-auto font-mono">
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
            <div className="bg-[#211f1c] border-2 border-[#403d39] rounded overflow-hidden">
              <div className="bg-[#262421] border-b border-[#403d39] p-3">
                <h3 className="font-bold text-[#ffffff]">STEP 1: TYPE YOUR REASONING (optional but encouraged)</h3>
              </div>
              <div className="p-4">
                <textarea
                  value={reasoning}
                  onChange={handleReasoningChange}
                  rows={8}
                  className="w-full bg-[#312e2b] border border-[#403d39] focus:border-[#c62828] rounded p-3 text-[#ffffff] font-mono outline-none resize-y transition-colors"
                  placeholder="I see that White just played... My evaluation is... I should respond with..."
                />
                <p className="text-[#c3c3c2] text-xs mt-2 italic">
                  (Your reasoning will be shown live to your opponent as you type)
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#211f1c] border-2 border-[#403d39] rounded overflow-hidden">
              <div className="bg-[#262421] border-b border-[#403d39] p-3">
                <h3 className="font-bold text-[#ffffff]">STEP 2: ENTER YOUR MOVE AND SUBMIT</h3>
              </div>
              <div className="p-4 space-y-4">
                {error && (
                  <div className="bg-[#7f0000]/20 border border-[#ef5350] rounded p-3 text-[#ef5350] text-sm">
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
                    className="flex-1 bg-[#312e2b] border border-[#403d39] focus:border-[#c62828] rounded px-4 py-3 text-xl text-[#ffffff] font-mono outline-none transition-colors"
                  />
                  <button
                    onClick={submitMove}
                    disabled={submitting || !moveInput.trim()}
                    className="bg-[#c62828] hover:bg-[#e53935] disabled:opacity-50 disabled:hover:bg-[#c62828] text-white font-bold py-3 px-8 rounded-lg border-b-[4px] border-[#7f0000] active:border-b-0 active:translate-y-[4px] transition-all disabled:active:border-b-[4px] disabled:active:translate-y-0 text-lg"
                  >
                    {submitting ? 'SUBMITTING...' : 'SUBMIT MOVE'}
                  </button>
                </div>
                <p className="text-[#ef5350] text-xs font-bold">
                  ⚠️ Only moves from YOUR LEGAL MOVES list above will be accepted.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4. Move Format Guide */}
        <div className="bg-[#211f1c] border-2 border-[#403d39] rounded p-4">
          <h3 className="font-bold text-center text-[#c3c3c2] mb-4">MOVE FORMAT GUIDE</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[#c3c3c2]">
            <ul className="space-y-2">
              <li><span className="text-white">Pawn move:</span> e7e5 (UCI) or e5 (SAN)</li>
              <li><span className="text-white">Piece move:</span> g8f6 (UCI) or Nf6 (SAN)</li>
              <li><span className="text-white">Piece symbols:</span> N=Knight B=Bishop R=Rook Q=Queen K=King</li>
            </ul>
            <ul className="space-y-2">
              <li><span className="text-white">Kingside castle:</span> O-O</li>
              <li><span className="text-white">Queenside castle:</span> O-O-O</li>
              <li><span className="text-white">Promotion:</span> e7e8q, e7e8r, e7e8b, e7e8n</li>
            </ul>
          </div>
          <p className="text-center text-[#ef5350] text-xs mt-4 font-bold">
            IMPORTANT: Only moves in YOUR LEGAL MOVES list are valid.
          </p>
        </div>

        {/* 5. Reference Board */}
        <div className="bg-[#211f1c] border-2 border-[#403d39] rounded overflow-hidden">
          <div className="bg-[#262421] border-b border-[#403d39] p-3">
            <h3 className="font-bold text-[#c3c3c2]">BOARD POSITION (REFERENCE ONLY — submit your move above)</h3>
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
          <div className="bg-[#262421] border-4 border-[#c62828] rounded-xl p-8 text-center animate-in fade-in zoom-in duration-500">
            <h2 className="text-3xl font-bold text-[#ffffff] mb-2">
              GAME OVER — {game.result === 'white' ? 'WHITE WINS' : game.result === 'black' ? 'BLACK WINS' : 'DRAW'}
            </h2>
            <p className="text-[#c3c3c2] text-lg">
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
