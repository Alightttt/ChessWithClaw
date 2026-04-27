import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ChessBoard from '../components/chess/ChessBoard';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Settings, Brain, MessageSquare, Terminal } from 'lucide-react';

export default function Agent() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('id');
  const agentToken = searchParams.get('token');
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [chatInput, setChatInput] = useState('');
  const [thinkingInput, setThinkingInput] = useState('');
  const [activeTab, setActiveTab] = useState('thinking'); // thinking | chat
  
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
        headers: { 'Content-Type': 'application/json', 'x-agent-token': agentToken },
        body: JSON.stringify({ id: gameId, move: moveStr, reasoning })
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
        body: JSON.stringify({ id: gameId, sender: 'agent', text })
      });
    } catch (err) {
      console.error('Failed to send chat:', err);
    }
  };

  if (loading || error || !game) {
    return (
      <div className="min-h-screen bg-black font-mono text-xs text-green-500 p-6 break-all">
        {loading ? `> Loading Agent connection... Game ID: ${gameId}` : `> Error: ${error}\n> System halt.`}
      </div>
    );
  }

  const isMyTurn = game.turn === 'b' && game.status === 'active';
  const lastMove = (game.move_history || [])[(game.move_history || []).length - 1] || null;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="h-16 glass border-b border-white/5 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-lg">🦞</div>
          <div>
            <h1 className="font-bold tracking-tight leading-tight">Agent Terminal</h1>
            <div className="text-[10px] text-neutral-500 font-mono tracking-wider font-semibold uppercase">Game #{gameId?.slice(0,6)}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-md glass font-mono text-xs font-semibold text-neutral-400 capitalize border-white/5 hidden sm:block">
            {game.status}
          </div>
          <div className={`px-3 py-1.5 rounded-md font-mono text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${isMyTurn ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'glass border-white/5 text-neutral-500'}`}>
            {isMyTurn && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
            {isMyTurn ? 'Your Turn' : 'Waiting...'}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Board */}
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
          <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,1)] ring-1 ring-white/10 mb-6">
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
            <AnimatePresence>
              {game.turn === 'w' && (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none"
                >
                  <div className="flex items-center gap-3 px-6 py-3 rounded-full glass border border-white/10 text-white font-medium text-sm">
                    <span className="w-2 h-2 rounded-full bg-neutral-400 animate-pulse" />
                    Waiting for White&apos;s move...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4 flex flex-col justify-center">
              <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Color</div>
              <div className="font-mono font-medium flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-black border border-neutral-700" />
                Black
              </div>
            </div>
            <div className="glass-card p-4 flex flex-col justify-center">
              <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Last Move</div>
              <div className="font-mono font-medium text-red-500">
                {lastMove ? lastMove.san : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="w-full lg:w-[400px] flex flex-col gap-4">
          
          <div className="glass-card p-2 flex gap-2">
            <button 
              onClick={() => setActiveTab('thinking')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${activeTab === 'thinking' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <Brain size={16} /> Thinking
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${activeTab === 'chat' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <MessageSquare size={16} /> Chat
            </button>
          </div>

          <div className="glass-card flex-1 min-h-[300px] p-0 overflow-hidden flex flex-col">
            <AnimatePresence mode="wait">
              {activeTab === 'thinking' ? (
                <motion.div key="thinking" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col flex-1 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Terminal size={14} className="text-red-500" />
                    <span className="text-xs font-mono font-semibold text-neutral-400 tracking-wider">PROCESS_LOG</span>
                  </div>
                  <textarea 
                    value={thinkingInput}
                    onChange={handleThinkingChange}
                    placeholder="Output raw internal monologue and evaluations here prior to making a move..."
                    className="flex-1 w-full bg-transparent resize-none outline-none font-mono text-sm text-neutral-300 placeholder:text-neutral-700 leading-relaxed scrollbar-thin scrollbar-thumb-white/10"
                  />
                </motion.div>
              ) : (
                <motion.div key="chat" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col flex-1 p-4">
                   <div className="flex-1 overflow-y-auto mb-4 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-white/10">
                    {!(game.chat_history || []).length ? (
                      <div className="m-auto text-center text-neutral-600 font-mono text-xs">NO MESSAGES</div>
                    ) : (
                      (game.chat_history || []).map((msg, i) => (
                        <div key={i} className={`p-3 rounded-xl max-w-[85%] text-sm ${msg.sender === 'agent' ? 'bg-red-500/10 text-red-100 border border-red-500/20 self-end rounded-tr-sm' : 'glass border-white/5 text-neutral-300 self-start rounded-tl-sm'}`}>
                          {msg.text}
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleChat} className="flex gap-2">
                    <input 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Send message..."
                      className="flex-1 bg-neutral-900 border border-white/10 rounded-lg px-4 py-2 text-sm focus:border-red-500/50 outline-none transition-colors"
                    />
                    <button type="submit" disabled={!chatInput.trim()} className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-colors">
                      <Send size={16} />
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {(game.status === 'finished' || game.status === 'abandoned') && (
            <button
              onClick={() => navigate('/')}
              className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] active:scale-95"
            >
              Start New Protocol
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
