'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Copy, Play, Clock, Twitter, Github, MessageSquare, X, Zap } from 'lucide-react';
import { supabase, hasSupabase } from '../lib/supabase';

export default function Home() {
  const [gameId, setGameId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Generate particles only once on mount
    const newParticles = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDuration: `${15 + Math.random() * 20}s`,
      animationDelay: `${Math.random() * 10}s`,
      fontSize: `${1.5 + Math.random() * 2}rem`,
      piece: ['♞', '♜', '♟', '♛', '♚', '♝'][Math.floor(Math.random() * 6)]
    }));
    setParticles(newParticles);
  }, []);

  const humanUrl = `${window.location.origin}/Game?id=${gameId}`;
  const agentUrl = `${window.location.origin}/Agent?id=${gameId}`;
  const apiUrl = `${window.location.origin}/api`;

  const createGame = async () => {
    if (!hasSupabase) {
      toast.error('Supabase credentials missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setCreating(true);
    try {
      // Add a timeout to prevent hanging if Supabase is paused or unresponsive
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out. Your Supabase project might be paused.')), 10000)
      );

      const insertPromise = supabase
        .from('games')
        .insert([{
          status: 'waiting',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          turn: 'w',
          move_history: [],
          thinking_log: [],
          current_thinking: '',
          human_connected: false,
          agent_connected: false,
          result: null,
          result_reason: null,
          webhook_url: null,
          chat_history: []
        }])
        .select()
        .single();

      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      if (error) {
        if (error.message && (error.message.includes('Could not find the table') || error.message.includes('relation "games" does not exist'))) {
          throw new Error('Database table "games" is missing. Please create it in your Supabase SQL Editor.');
        }
        throw error;
      }
      
      // Set ownership token in local storage
      localStorage.setItem(`game_owner_${data.id}`, 'true');
      
      setGameId(data.id);
    } catch (error) {
      console.error('Create game error:', error);
      toast.error('Failed to create game: ' + (error.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    
    if (!hasSupabase) {
      toast.error('Cannot submit feedback: Database not configured');
      return;
    }

    try {
      const { error } = await supabase
        .from('feedback')
        .insert([{ message: feedbackText.trim() }]);

      if (error) {
        if (error.message && (error.message.includes('Could not find the table') || error.message.includes('relation "feedback" does not exist'))) {
          throw new Error('Database table "feedback" is missing. Please create it in your Supabase SQL Editor.');
        }
        throw error;
      }

      toast.success('Thank you for your feedback!');
      setShowFeedback(false);
      setFeedbackText('');
    } catch (error) {
      console.error('Feedback error:', error);
      toast.error('Failed to submit feedback: ' + (error.message || 'Unknown error'));
    }
  };

  const telegramMessage = `Visit this URL: ${agentUrl}

You are playing chess as Black against a human opponent (White).

OPTION A: IF YOU HAVE FULL BROWSER CONTROL (Puppeteer/Playwright)
1. Open the URL above.
2. Read the GAME STATE block.
3. Type reasoning in STEP 1, move in STEP 2, and click SUBMIT.

OPTION B: REAL-TIME API (Server-Sent Events)
1. Connect to stream: GET ${apiUrl}/stream?id=<GAME_ID>
   (You will receive a continuous stream of JSON updates when the game changes)
2. Submit your move: POST ${apiUrl}/move
   Body (JSON): {"id": "<GAME_ID>", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION C: FOR LLM AGENTS (Long-Polling - RECOMMENDED)
If you cannot keep a background SSE stream open, use this method to play seamlessly:
1. Poll for updates: GET ${apiUrl}/poll?id=<GAME_ID>&last_move_count=0&last_chat_count=0
   (Pass the move_count and chat_count from the previous response. This request will wait up to 8 seconds for the human to move or chat, then return the new state. If no change, it returns {"event": "timeout"}. Loop this request!)
2. Submit your move: POST ${apiUrl}/move
   Body (JSON): {"id": "<GAME_ID>", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION D: LIVE CHAT & RESIGNATION
1. Send a chat message: POST ${apiUrl}/chat
   Body (JSON): {"id": "<GAME_ID>", "text": "Good luck!"}
2. Request to resign: POST ${apiUrl}/chat
   Body (JSON): {"id": "<GAME_ID>", "text": "I am completely lost. Do you accept my resignation?", "type": "resign_request"}
   (This will show an "Accept Resignation" button to the human in the app)

IMPORTANT BEHAVIOR RULES:
1. You are BLACK. White moves first.
2. When you join this match, stay here and focus ONLY on playing chess with your user. Do other tasks later.
3. If your user forgets they are playing with you (takes too long to move), inform and remind them using the chat channel you are connected to (Telegram, Discord, Slack, etc.).`;

  return (
    <div className="min-h-screen bg-[#1a1917] text-white font-sans relative overflow-hidden flex flex-col">
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(100px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.05; }
          90% { opacity: 0.05; }
          100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
        }
        .chess-particle {
          position: absolute;
          bottom: -100px;
          color: #c62828;
          user-select: none;
          pointer-events: none;
          z-index: 0;
          animation-name: float-up;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>

      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {particles.map(p => (
          <div 
            key={p.id} 
            className="chess-particle"
            style={{
              left: p.left,
              animationDuration: p.animationDuration,
              animationDelay: p.animationDelay,
              fontSize: p.fontSize
            }}
          >
            {p.piece}
          </div>
        ))}
      </div>

      {gameId === null ? (
        <>
          {/* Main Content for Landing */}
          <div className="relative z-10 flex-grow flex flex-col items-center justify-center p-4 md:p-8">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto mb-16 mt-8 md:mt-12">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
                alt="ChessWithClaw Logo" 
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="w-32 h-32 md:w-40 md:h-40 mx-auto mb-6 rounded-full border border-[#403d39] shadow-[0_0_20px_rgba(198,40,40,0.2)] object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://images.unsplash.com/photo-1580541832626-2a7131ee809f?w=400&q=80";
                }}
              />
              <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 tracking-tight">
                ChessWith<span className="text-[#c62828]">Claw</span>
              </h1>
              <p className="text-lg md:text-xl text-[#c3c3c2] mb-10 max-w-2xl mx-auto">
                Challenge your OpenClaw AI agent to a real-time game of chess. Connect via Telegram and test your strategy.
              </p>
              
              <button
                onClick={createGame}
                disabled={creating}
                className="relative group inline-flex items-center justify-center px-8 py-4 text-lg md:text-xl font-bold text-white transition-all duration-300 bg-gradient-to-r from-[#c62828] to-[#ef5350] rounded-full hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-[#c62828] to-[#ef5350] rounded-full blur opacity-40 group-hover:opacity-75 transition duration-300"></div>
                <span className="relative flex items-center gap-2">
                  {creating ? 'CREATING ROOM...' : (
                    <>
                      <Play fill="currentColor" size={24} />
                      PLAY NOW
                    </>
                  )}
                </span>
              </button>
              
              {!hasSupabase && (
                <p className="mt-4 text-[#ef5350] text-sm font-medium">
                  Supabase configuration missing. Please check your environment variables.
                </p>
              )}
            </div>

            {/* How to Play Section */}
            <div className="max-w-5xl w-full mx-auto mb-16">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-white">How It Works</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#262421] border border-[#403d39] rounded-xl p-6 flex flex-col items-center text-center hover:border-[#c62828] transition-colors duration-300 shadow-lg">
                  <div className="w-16 h-16 bg-[#312e2b] rounded-full flex items-center justify-center mb-6 border border-[#403d39] text-[#c62828]">
                    <Zap size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">1. Click Play Now</h3>
                  <p className="text-[#c3c3c2]">Instantly create a secure, real-time game room for you and your agent.</p>
                </div>

                <div className="bg-[#262421] border border-[#403d39] rounded-xl p-6 flex flex-col items-center text-center hover:border-[#c62828] transition-colors duration-300 shadow-lg">
                  <div className="w-16 h-16 bg-[#312e2b] rounded-full flex items-center justify-center mb-6 border border-[#403d39] text-[#c62828]">
                    <Copy size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">2. Copy Agent Link</h3>
                  <p className="text-[#c3c3c2]">Send the generated connection link to your OpenClaw agent on Telegram.</p>
                </div>

                <div className="bg-[#262421] border border-[#403d39] rounded-xl p-6 flex flex-col items-center text-center hover:border-[#c62828] transition-colors duration-300 shadow-lg">
                  <div className="w-16 h-16 bg-[#312e2b] rounded-full flex items-center justify-center mb-6 border border-[#403d39] text-[#c62828]">
                    <Clock size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">3. Wait & Play</h3>
                  <p className="text-[#c3c3c2]">Once Claw connects to the room, make your first move as White and enjoy!</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="relative z-10 flex-grow flex items-center justify-center p-4">
          <div className="bg-[#262421] border border-[#403d39] rounded-xl p-6 md:p-8 max-w-2xl w-full shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
                  alt="Logo" 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className="w-12 h-12 rounded-full border border-[#403d39] object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://images.unsplash.com/photo-1580541832626-2a7131ee809f?w=400&q=80";
                  }}
                />
                <div>
                  <h2 className="text-xl md:text-2xl text-[#ffffff] font-bold">Game Created</h2>
                  <p className="text-[#c3c3c2] text-sm">Room #{gameId.substring(0, 6).toUpperCase()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* STEP 1 */}
              <div className="bg-[#211f1c] border border-[#403d39] rounded-md p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#c62828]"></div>
                <h3 className="text-[#c62828] font-bold mb-1 text-sm uppercase tracking-wider">Step 1</h3>
                <p className="text-[#ffffff] mb-4 text-lg">Open your chess board</p>
                <button 
                  onClick={() => window.open(humanUrl, '_blank')}
                  className="w-full bg-[#c62828] hover:bg-[#e53935] text-white font-bold py-4 px-4 rounded-lg border-b-[4px] border-[#7f0000] active:border-b-0 active:translate-y-[4px] transition-all flex items-center justify-center gap-2 text-xl shadow-sm"
                >
                  <ExternalLink size={20} />
                  Open Board in New Tab
                </button>
              </div>

              {/* STEP 2 */}
              <div className="bg-[#211f1c] border border-[#403d39] rounded-md p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#ef5350]"></div>
                <h3 className="text-[#ef5350] font-bold mb-1 text-sm uppercase tracking-wider">Step 2</h3>
                <p className="text-[#ffffff] mb-4 text-lg">Invite your agent</p>
                
                <div className="bg-[#1a1917] border border-[#403d39] rounded-lg p-4 mb-4">
                  <p className="text-[#c3c3c2] text-sm mb-2">Copy this message and send it to Claw:</p>
                  <div className="relative">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-[#c3c3c2] max-h-48 overflow-y-auto p-3 bg-[#262421] rounded border border-[#403d39]">
                      {telegramMessage}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(telegramMessage)}
                      className="absolute top-2 right-2 bg-[#312e2b] hover:bg-[#403d39] text-white p-2 rounded-md transition-colors shadow-md"
                      title="Copy Message"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#403d39] bg-[#1a1917] py-6 px-4 mt-auto w-full">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-[#c3c3c2] text-sm font-medium">
            Built for the <span className="text-[#c62828] font-bold">OpenClaw</span> community
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowFeedback(true)}
              className="text-[#c3c3c2] hover:text-white transition-colors flex items-center gap-2 text-sm font-medium bg-[#262421] px-4 py-2 rounded-full border border-[#403d39] hover:border-[#c62828]"
            >
              <MessageSquare size={16} />
              Feedback
            </button>
            
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#262421] border border-[#403d39] flex items-center justify-center text-[#c3c3c2] hover:text-white hover:border-[#c62828] transition-all">
              <Twitter size={18} />
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#262421] border border-[#403d39] flex items-center justify-center text-[#c3c3c2] hover:text-white hover:border-[#c62828] transition-all">
              <Github size={18} />
            </a>
          </div>
        </div>
      </footer>

      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#262421] border border-[#403d39] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#403d39] bg-[#1a1917]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-[#c62828]" />
                Send Feedback
              </h3>
              <button onClick={() => setShowFeedback(false)} className="text-[#c3c3c2] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Tell us what you think or report a bug..."
                className="w-full h-32 bg-[#1a1917] border border-[#403d39] rounded-lg p-3 text-white placeholder-[#c3c3c2]/50 focus:outline-none focus:border-[#c62828] resize-none mb-4"
              />
              <button
                onClick={submitFeedback}
                disabled={!feedbackText.trim()}
                className="w-full bg-[#c62828] hover:bg-[#e53935] text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

