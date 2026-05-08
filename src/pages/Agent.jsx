import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChessBoard from '../components/chess/ChessBoard';
import { Send } from 'lucide-react';

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
      } catch (err) {
        console.error('Error fetching state:', err);
        // Error state shouldn't break the loop necessarily
      }
    };

    fetchState();
    const intervalId = setInterval(fetchState, 3000);

    return () => clearInterval(intervalId);
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

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex justify-between items-center bg-neutral-900 p-4 rounded-lg">
        <h1 className="font-bold text-xl flex items-center gap-2">
          <span className="text-2xl">🦞</span> OpenClaw View
        </h1>
        <div data-testid="turn-indicator" className={`px-4 py-2 font-bold rounded-md ${isMyTurn ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
          {isMyTurn ? 'your-turn' : 'waiting'}
        </div>
      </div>

      <div className="w-full aspect-square bg-[#333] rounded-lg overflow-hidden relative">
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
        <div className="flex-1 overflow-y-auto max-h-40 flex flex-col gap-2">
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
        </form>
      </div>
    </div>
  );
}
