'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ChessBoard from '../components/chess/ChessBoard';

export default function Agent() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('id');
  const agentToken = searchParams.get('token');
  
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [chatInput, setChatInput] = useState('');
  const [thinkingInput, setThinkingInput] = useState('');
  
  const channelRef = useRef(null);

  useEffect(() => {
    if (!gameId || !agentToken) {
      setError('Missing game ID or token');
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
        setError('Game not found');
        setLoading(false);
        return;
      }

      const { data: movesData } = await supabase
        .from('moves')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });
        
      data.move_history = movesData || [];
      setGame(data);
      setLoading(false);
    };

    loadGame();

    const gameSub = supabase.channel(`agent-game-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(prev => ({ ...prev, ...payload.new }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moves', filter: `game_id=eq.${gameId}` }, (payload) => {
        setGame(prev => {
          if (!prev) return prev;
          const newHistory = [...(prev.move_history || []), payload.new];
          return { ...prev, move_history: newHistory, fen: payload.new.fen_after, turn: payload.new.fen_after.split(' ')[1] };
        });
      })
      .subscribe();

    channelRef.current = supabase.channel(`game-${gameId}`);
    channelRef.current.subscribe();

    return () => {
      supabase.removeChannel(gameSub);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [gameId, agentToken]);

  const handleThinkingChange = (e) => {
    const text = e.target.value;
    setThinkingInput(text);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'thinking',
        payload: { text }
      });
    }
  };

  const handleMove = async (from, to) => {
    const moveStr = from + to;
    const reasoning = thinkingInput;
    setThinkingInput('');
    
    try {
      await fetch('/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-token': agentToken
        },
        body: JSON.stringify({
          id: gameId,
          move: moveStr,
          reasoning: reasoning
        })
      });
    } catch (err) {
      console.error('Failed to send move:', err);
    }
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const text = chatInput;
    setChatInput('');
    
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-token': agentToken
        },
        body: JSON.stringify({
          id: gameId,
          sender: 'agent',
          text: text
        })
      });
    } catch (err) {
      console.error('Failed to send chat:', err);
    }
  };

  if (loading) {
    return (
      <pre style={{
        background: '#000',
        color: '#00ff00',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        padding: 20,
        margin: 0,
        minHeight: '100vh',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {JSON.stringify({ status: "loading", game_id: gameId }, null, 2)}
      </pre>
    );
  }

  if (error || !game) {
    return (
      <pre style={{
        background: '#000',
        color: '#00ff00',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        padding: 20,
        margin: 0,
        minHeight: '100vh',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {JSON.stringify({ error: error || "Game not found", game_id: gameId }, null, 2)}
      </pre>
    );
  }

  const isMyTurn = game.turn === 'b' && game.status === 'active';
  const lastMove = (game.move_history || [])[(game.move_history || []).length - 1] || null;

  return (
    <div style={{ background: '#080808', minHeight: '100vh', color: '#f0f0f0', fontFamily: "'Inter', sans-serif", padding: '20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#444', marginBottom: '-10px' }}>
          🦞 Agent Board · Black · Game #{gameId?.slice(0,8)}
        </div>

        <header style={{ borderBottom: '1px solid #1a1a1a', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', margin: 0, color: '#f0f0f0' }}>OpenClaw Agent</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px', fontSize: '13px', fontWeight: 600 }}>
            <span data-testid="game-status" style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', color: '#888', padding: '6px 12px', borderRadius: '6px' }}>
              {game.status.toUpperCase()}
            </span>
            <span data-testid="turn-indicator" style={{ background: isMyTurn ? '#e63946' : '#0e0e0e', border: isMyTurn ? '1px solid #e63946' : '1px solid #1a1a1a', color: isMyTurn ? '#fff' : '#888', padding: '6px 12px', borderRadius: '6px' }}>
              {isMyTurn ? 'Your Turn' : 'Waiting for White'}
            </span>
          </div>
        </header>

        <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', background: '#0e0e0e', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1a1a1a' }}>
          <ChessBoard 
            fen={game.fen}
            onMove={handleMove}
            isMyTurn={isMyTurn}
            lastMove={lastMove}
            moveHistory={game.move_history || []}
            boardTheme="green"
            pieceTheme="merida"
            playerColor="b"
            interactive={true}
          />
          {game.turn === 'w' && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
              fontFamily: "'Inter', sans-serif", fontSize: '16px', fontWeight: 600, color: '#fff'
            }}>
              Waiting for White to move...
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Thinking Process</label>
          <textarea 
            data-testid="thinking-input"
            value={thinkingInput}
            onChange={handleThinkingChange}
            placeholder="Type reasoning here before making a move..."
            style={{ 
              width: '100%', height: '80px', padding: '12px', background: '#0e0e0e', color: '#f0f0f0', 
              border: '1px solid #1a1a1a', borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px',
              resize: 'none', outline: 'none'
            }}
          />
        </div>

        <form onSubmit={handleChat} style={{ display: 'flex', gap: '10px' }}>
          <input 
            data-testid="chat-input"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Send a chat message..."
            style={{ 
              flex: 1, padding: '12px', background: '#0e0e0e', color: '#f0f0f0', 
              border: '1px solid #1a1a1a', borderRadius: '6px', fontFamily: "'Inter', sans-serif", fontSize: '14px',
              outline: 'none'
            }}
          />
          <button 
            data-testid="chat-send" 
            type="submit" 
            disabled={!chatInput.trim()}
            style={{ 
              padding: '0 24px', background: chatInput.trim() ? '#e63946' : '#1a1a1a', color: chatInput.trim() ? '#fff' : '#888', 
              border: 'none', borderRadius: '6px', fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 600, 
              cursor: chatInput.trim() ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s'
            }}
          >
            Send
          </button>
        </form>

        <div data-testid="move-history" style={{ background: '#0e0e0e', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '16px' }}>
          <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px 0' }}>Last Move</h3>
          <div data-testid="last-move" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#e63946', background: 'rgba(230,57,70,0.1)', padding: '8px 12px', borderRadius: '4px', display: 'inline-block' }}>
            {lastMove ? lastMove.san : 'None'}
          </div>
        </div>

      </div>
    </div>
  );
}
