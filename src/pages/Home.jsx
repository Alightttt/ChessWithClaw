'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Copy } from 'lucide-react';
import { supabase, hasSupabase } from '../lib/supabase';

export default function Home() {
  const [gameId, setGameId] = useState(null);
  const [creating, setCreating] = useState(false);

  const humanUrl = `${window.location.origin}/Game?id=${gameId}`;
  const agentUrl = `${window.location.origin}/Agent?id=${gameId}`;

  const createGame = async () => {
    if (!hasSupabase) {
      toast.error('Supabase credentials missing. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
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

      if (error) {
        if (error.message.includes('Could not find the table') || error.message.includes('relation "games" does not exist')) {
          throw new Error('Database table "games" is missing. Please create it in your Supabase SQL Editor.');
        }
        throw error;
      }
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

  const apiUrl = `${window.location.origin}/api`;

  const telegramMessage = `Visit this URL: ${agentUrl}

You are playing chess as Black against a human opponent (White).

OPTION A: IF YOU HAVE FULL BROWSER CONTROL (Puppeteer/Playwright)
1. Open the URL above.
2. Read the GAME STATE block.
3. Type reasoning in STEP 1, move in STEP 2, and click SUBMIT.

OPTION B: REAL-TIME API (Server-Sent Events)
1. Connect to stream: GET ${apiUrl}/stream?id=${gameId}
   (You will receive a continuous stream of JSON updates when the game changes)
2. Submit your move: POST ${apiUrl}/move
   Body (JSON): {"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION C: FOR LLM AGENTS (Long-Polling - RECOMMENDED)
If you cannot keep a background SSE stream open, use this method to play seamlessly:
1. Poll for updates: GET ${apiUrl}/poll?id=${gameId}
   (This request will wait up to 8 seconds for the human to move or chat, then return the new state. If no change, it returns {"event": "timeout"}. Loop this request!)
2. Submit your move: POST ${apiUrl}/move
   Body (JSON): {"id": "${gameId}", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION D: LIVE CHAT & RESIGNATION
1. Send a chat message: POST ${apiUrl}/chat
   Body (JSON): {"id": "${gameId}", "text": "Good luck!"}
2. Request to resign: POST ${apiUrl}/chat
   Body (JSON): {"id": "${gameId}", "text": "I am completely lost. Do you accept my resignation?", "type": "resign_request"}
   (This will show an "Accept Resignation" button to the human in the app)

IMPORTANT BEHAVIOR RULES:
1. You are BLACK. White moves first.
2. When you join this match, stay here and focus ONLY on playing chess with your user. Do other tasks later.
3. If your user forgets they are playing with you (takes too long to move), inform and remind them using the chat channel you are connected to (Telegram, Discord, Slack, etc.).`;

  return (
    <div className="min-h-screen bg-[#312e2b] flex items-center justify-center p-4 font-sans transition-all duration-500">
      {gameId === null ? (
        <div className="bg-[#262421] border border-[#403d39] rounded-lg p-8 max-w-md w-full text-center shadow-2xl transition-all duration-500">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
            alt="Logo" 
            className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-6 rounded-full border-2 border-[#c62828] shadow-[0_0_20px_rgba(198,40,40,0.2)]"
          />
          <h1 className="text-3xl md:text-4xl text-[#ffffff] font-bold mb-4">
            ChessWithClaw
          </h1>
          <p className="text-[#c3c3c2] mb-8 text-sm md:text-base">
            Play chess against your AI agent. You are White. Your agent plays Black.
          </p>
          
          {!hasSupabase && (
            <div className="mb-6 p-4 bg-[#7f0000]/30 border border-[#c62828]/50 rounded-md text-[#ef5350] text-sm text-left">
              <strong>Configuration Missing:</strong> Supabase environment variables are not set. This app requires a Supabase backend to sync real-time game state between the human and the agent.
            </div>
          )}

          <button
            onClick={createGame}
            disabled={creating || !hasSupabase}
            className="w-full bg-[#c62828] hover:bg-[#e53935] text-white font-bold py-4 px-4 rounded-lg border-b-[4px] border-[#7f0000] active:border-b-0 active:translate-y-[4px] transition-all disabled:opacity-50 disabled:active:border-b-[4px] disabled:active:translate-y-0 text-2xl shadow-sm"
          >
            {creating ? 'CREATING...' : 'Play Computer'}
          </button>
        </div>
      ) : (
        <div className="bg-[#262421] border border-[#403d39] rounded-lg p-6 md:p-8 max-w-2xl w-full shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
                alt="Logo" 
                className="w-12 h-12 rounded-full border border-[#c62828]"
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
      )}
    </div>
  );
}
