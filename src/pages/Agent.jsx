import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChessBoard from '../components/chess/ChessBoard';
import { Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Chess } from 'chess.js';

export default function Agent() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('id');
  const agentToken = searchParams.get('token');
  
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    if (!gameId || !agentToken) {
      setError('Missing game ID or token');
      setLoading(false);
      return;
    }

    const fetchState = async () => {
      try {
        const response = await fetch(`/api/state?id=${gameId}`, {
          headers: { 'x-agent-token': agentToken }
        });
        if (!response.ok) throw new Error('Failed to fetch state');
        const data = await response.json();
        setGame(data);
        setLoading(false);
      } catch (err) {}
    };

    fetchState();

    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(prev => ({ ...prev, ...payload.new }));
      })
      .subscribe((status) => {
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setTimeout(() => channel.subscribe(), 2000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, agentToken]);

  const handleMove = async (from, to) => {
    const moveStr = from + to;
    try {
      await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-token': agentToken },
        body: JSON.stringify({ id: gameId, move: moveStr })
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
        headers: { 'Content-Type': 'application/json', 'x-agent-token': agentToken },
        body: JSON.stringify({ id: gameId, sender: 'agent', role: 'agent', message: text })
      });
    } catch (err) {
      console.error('Failed to send chat:', err);
    }
  };

  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  if (loading || !game) {
    return <div className="p-4 text-white">Loading...</div>;
  }

  const isMyTurn = game.turn === 'b' && game.status === 'active';
  const lastMove = (game.move_history || [])[(game.move_history || []).length - 1] || null;
  let legalMovesArray = [];
  try {
    const tempChess = new Chess(game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    legalMovesArray = tempChess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
  } catch(e) {}

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans max-w-2xl mx-auto flex flex-col gap-4">
      <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', color: '#444', fontFamily: 'Inter', margin: '-1rem -1rem 1rem -1rem' }}>
    ⚙️ Automated Agent Interface — Not for manual use
  </div>
      <div className="flex justify-between items-center bg-neutral-900 p-4 rounded-lg" style={{ display: 'none' }}>
        <h1 className="font-bold text-xl flex items-center gap-2">
          <span className="text-2xl">🦞</span> OpenClaw View
        </h1>
        <div data-testid="turn-indicator" className={`px-4 py-2 font-bold rounded-md ${isMyTurn ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
          {isMyTurn ? 'Your Turn' : 'Waiting for White'}
        </div>
      </div>

      <div data-testid="chess-board" className="w-full aspect-square bg-[#333] rounded-lg overflow-hidden relative">
        <ChessBoard 
          fen={game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
          onMove={handleMove}
          isMyTurn={isMyTurn}
          lastMove={lastMove}
          moveHistory={game.move_history || []}
          boardTheme="green"
          pieceTheme="merida"
          playerColor="b"
          interactive={true}
        />
      </div>

      <div className="flex flex-col gap-2 flex-1 bg-neutral-900 p-4 rounded-lg">
        <div className="flex-1 overflow-y-auto max-h-40 flex flex-col gap-2" style={{ display: 'none' }}>
          {(game.chat_history || []).map((msg, i) => (
            <div key={i} className={`p-2 rounded text-sm ${msg.sender === 'agent' ? 'bg-neutral-800 text-white self-end' : 'bg-neutral-700 text-neutral-200 self-start'}`}>
              {msg.text}
            </div>
          ))}
        </div>
        <form onSubmit={handleChat} className="flex gap-2">
          <input 
            type="text"
            data-testid="chat-input"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            className="flex-1 bg-neutral-800 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-red-500"
            placeholder="Type a message..."
          />
          <button 
            type="submit" 
            data-testid="chat-send"
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded flex items-center justify-center"
          >
            <Send size={16} />
          </button>
          <input data-testid="thinking-input" style={{ position: 'absolute', opacity: 0.01, width: 1, height: 1, zIndex: -1 }} tabIndex={-1} aria-hidden="true" />
        </form>
      </div>
          <div data-testid="current-fen" style={{ display: 'none' }}>{game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}</div>
      <div data-testid="legal-moves" style={{ display: 'none' }}>{JSON.stringify(legalMovesArray)}</div>
      <div data-testid="turn-indicator" style={{ display: 'none' }}>{isMyTurn ? 'Your Turn' : 'Waiting for White'}</div>
    </div>
  );
}
