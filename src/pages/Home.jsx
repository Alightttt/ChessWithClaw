'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';
import { ExternalLink, Copy, Play, Twitter, Github, ChevronDown, ArrowRight, MessageSquare } from 'lucide-react';
import { supabase, hasSupabase } from '../lib/supabase';
import { Button, Card, Badge, Modal } from '../components/ui';
import AppHeader from '../components/AppHeader';
import GameCreated from '../components/GameCreated';

function FadeInSection({ children, delay = 0, className = '' }) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    
    const currentRef = domRef.current;
    if (currentRef) observer.observe(currentRef);
    
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const [gameId, setGameId] = useState(null);
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out. Your Supabase project might be paused.')), 10000)
      );

      const secretToken = crypto.randomUUID();

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
          chat_history: [],
          secret_token: secretToken
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
      
      localStorage.setItem(`game_owner_${data.id}`, secretToken);
      setGameId(data.id);
    } catch (error) {
      console.error('Create game error:', error);
      if (error.message === 'Failed to fetch') {
        toast.error('Network error: Failed to reach the database. Please check if your Supabase project is paused, or if CORS settings are blocking this domain.');
      } else {
        toast.error('Failed to create game: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setCreating(false);
    }
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const copyInstallCommand = () => {
    navigator.clipboard.writeText('claw install play-chess');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const telegramMessage = `Visit this URL: ${agentUrl}

You are playing chess as Black against a human opponent (White).

CRITICAL RULE 1: DO NOT REPLY TO ME ON TELEGRAM/DISCORD/SLACK. You must enter an INFINITE LOOP and stay connected to the game. Do not exit your script or go to sleep. All communication must happen through the in-game chat API. Do not send messages back to this chat window until the game is completely finished.

CRITICAL RULE 2: If I send you a message in the in-game chat, you MUST reply immediately using POST /api/chat. Do not ignore my chat messages.

CRITICAL RULE 3: You are BLACK. White moves first. Wait for White to move.

CRITICAL RULE 4: To play smartly, you MUST consult your 'skill.md' file for chess strategies and knowledge. You are encouraged to search the internet for opening theory, positional evaluation, and best moves for the current FEN. Combine this external knowledge with your personality to choose the best move.

OPTION A: IF YOU HAVE FULL BROWSER CONTROL (Puppeteer/Playwright)
1. Open the URL above.
2. Read the GAME STATE block.
3. Type reasoning in STEP 1, move in STEP 2, and click SUBMIT.

OPTION B: REAL-TIME API (Server-Sent Events)
1. Connect to stream: GET ${apiUrl}/stream?id=<GAME_ID>
   (You will receive a continuous stream of JSON updates when the game changes)
2. Submit your move: POST ${apiUrl}/move
   Body (JSON): {"id": "<GAME_ID>", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION C: WEBHOOKS (BEST FOR AGENTS)
If you cannot maintain a persistent connection, register a webhook to receive push notifications when it's your turn or when I chat.
1. Register webhook: POST ${apiUrl}/webhook
   Body (JSON): {"id": "<GAME_ID>", "webhook_url": "https://your-agent-url.com/webhook"}
2. Submit your move: POST ${apiUrl}/move
   Body (JSON): {"id": "<GAME_ID>", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION D: FOR LLM AGENTS (Long-Polling)
If you cannot use webhooks or SSE:
1. Poll for updates: GET ${apiUrl}/poll?id=<GAME_ID>&last_move_count=0&last_chat_count=0
   (Pass the move_count and chat_count from the previous response. This request will wait up to 8 seconds. If no change, it returns {"event": "timeout"}. YOU MUST LOOP THIS REQUEST INFINITELY!)
2. Submit your move: POST ${apiUrl}/move
   Body (JSON): {"id": "<GAME_ID>", "move": "e7e5", "reasoning": "Controlling the center"}

OPTION E: LIVE CHAT & RESIGNATION
1. Send a chat message: POST ${apiUrl}/chat
   Body (JSON): {"id": "<GAME_ID>", "text": "Good luck!"}
2. Request to resign: POST ${apiUrl}/chat
   Body (JSON): {"id": "<GAME_ID>", "text": "I am completely lost. Do you accept my resignation?", "type": "resign_request"}`;

  if (gameId) {
    return <GameCreated gameId={gameId} agentUrl={agentUrl} />;
  }

  const floatingPieces = [
    { piece: '♟', top: '20%', left: '10%', duration: '8s', delay: '0s' },
    { piece: '♜', top: '10%', left: '80%', duration: '10s', delay: '1s' },
    { piece: '♝', top: '80%', left: '20%', duration: '7s', delay: '2s' },
    { piece: '♞', top: '70%', left: '75%', duration: '12s', delay: '0.5s' },
    { piece: '♛', top: '15%', left: '50%', duration: '9s', delay: '1.5s' },
    { piece: '♚', top: '50%', left: '85%', duration: '11s', delay: '0.2s' },
    { piece: '🦞', top: '60%', left: '15%', duration: '8.5s', delay: '0.8s' },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] font-sans selection:bg-[var(--color-red-primary)] selection:text-white">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(5deg); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-float {
          animation: float ease-in-out infinite;
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        .text-gradient {
          background: linear-gradient(135deg, var(--color-red-primary), var(--color-red-hover));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      {/* SECTION 1 — HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-16">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(229,62,62,0.08)_0%,transparent_70%)] pointer-events-none" />
        
        {/* Floating Pieces */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {floatingPieces.map((p, i) => (
            <div
              key={i}
              className="absolute text-white opacity-[0.05] animate-float"
              style={{
                top: p.top,
                left: p.left,
                fontSize: `${80 + Math.random() * 80}px`,
                animationDuration: p.duration,
                animationDelay: p.delay,
              }}
            >
              {p.piece}
            </div>
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl mx-auto">
          {/* Logo Area */}
          <div className="relative mb-8 animate-in fade-in duration-700 delay-200 fill-mode-both">
            <div className="absolute inset-0 m-auto w-[112px] h-[112px] border-2 border-[var(--color-red-primary)]/30 rounded-full animate-pulse-ring" />
            <div className="relative w-24 h-24 rounded-full border-2 border-[var(--color-red-primary)] overflow-hidden bg-[var(--color-bg-elevated)] z-10">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
                alt="Logo" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-[56px] md:text-[80px] font-black leading-none tracking-tight mb-6 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-400 fill-mode-both">
            ChessWith<span className="text-gradient">Claw</span>
          </h1>

          {/* Tagline */}
          <div className="text-[18px] md:text-[22px] text-[var(--color-text-secondary)] mb-10 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-500 fill-mode-both space-y-2">
            <p>Your OpenClaw agent. Your opponent.</p>
            <p>Real chess. Real rivalry.</p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto animate-in slide-in-from-bottom-8 fade-in duration-700 delay-[600ms] fill-mode-both">
            <Button
              onClick={createGame}
              loading={creating}
              className="w-full sm:w-auto min-w-[200px] h-14 text-lg font-bold bg-[var(--color-red-primary)] hover:bg-[var(--color-red-hover)] shadow-[0_0_20px_rgba(229,62,62,0.4)] hover:shadow-[0_0_40px_rgba(229,62,62,0.6)] transition-all group rounded-full"
            >
              {!creating && (
                <>
                  Start a Game
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
              {creating && 'Creating...'}
            </Button>
            <a 
              href="https://github.com/openclaw" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto h-14 px-8 flex items-center justify-center rounded-full text-[var(--color-red-primary)] border border-[var(--color-red-primary)]/30 hover:border-[var(--color-red-primary)] hover:bg-[var(--color-red-primary)]/10 hover:shadow-[0_0_20px_rgba(229,62,62,0.2)] transition-all font-medium"
            >
              View on ClawHub →
            </a>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className={`absolute bottom-8 flex flex-col items-center text-[var(--color-text-muted)] transition-opacity duration-500 ${scrolled ? 'opacity-0' : 'opacity-100'} animate-in fade-in duration-1000 delay-1000 fill-mode-both`}>
          <span className="text-sm font-medium mb-2 uppercase tracking-widest">Scroll</span>
          <ChevronDown className="w-5 h-5 animate-bounce-subtle" />
        </div>
      </section>

      {/* SECTION 2 — STATS BAR */}
      <FadeInSection>
        <section className="w-full bg-[var(--color-bg-elevated)] border-y border-[var(--color-border-subtle)] py-8 px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-[var(--color-border-subtle)]">
            <div className="flex flex-col items-center text-center px-4 pt-4 md:pt-0 first:pt-0">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Real-time</span>
              <span className="text-[var(--color-text-muted)] text-sm">Move by Move</span>
            </div>
            <div className="flex flex-col items-center text-center px-4 pt-4 md:pt-0">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Every Agent</span>
              <span className="text-[var(--color-text-muted)] text-sm">Every Style</span>
            </div>
            <div className="flex flex-col items-center text-center px-4 pt-4 md:pt-0">
              <span className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">One Game</span>
              <span className="text-[var(--color-text-muted)] text-sm">Infinite Rivals</span>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* SECTION 3 — HOW IT WORKS */}
      <section className="py-24 px-4 max-w-6xl mx-auto w-full">
        <FadeInSection>
          <h2 className="text-3xl md:text-4xl font-black text-center mb-16">How It Works</h2>
        </FadeInSection>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FadeInSection delay={0}>
            <div className="group relative bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-8 h-full transition-all duration-300 hover:-translate-y-2 hover:border-[var(--color-red-primary)] hover:shadow-[0_0_30px_rgba(229,62,62,0.15)] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-red-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="absolute -top-4 -left-4 bg-[var(--color-red-primary)] text-white text-xs font-bold px-3 py-1.5 rounded-br-lg rounded-tl-xl shadow-md">01</div>
                <div className="text-5xl mb-6 mt-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors group-hover:scale-110 transform origin-left duration-300">♟</div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">Create Your Board</h3>
                <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed group-hover:text-gray-300 transition-colors">
                  Start a game and get your unique room link
                </p>
              </div>
            </div>
          </FadeInSection>

          <FadeInSection delay={150}>
            <div className="group relative bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-8 h-full transition-all duration-300 hover:-translate-y-2 hover:border-[var(--color-red-primary)] hover:shadow-[0_0_30px_rgba(229,62,62,0.15)] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-red-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="absolute -top-4 -left-4 bg-[var(--color-red-primary)] text-white text-xs font-bold px-3 py-1.5 rounded-br-lg rounded-tl-xl shadow-md">02</div>
                <div className="text-5xl mb-6 mt-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors group-hover:scale-110 transform origin-left duration-300">🦞</div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">Invite Your Agent</h3>
                <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed group-hover:text-gray-300 transition-colors">
                  Send the link to your OpenClaw — it joins instantly
                </p>
              </div>
            </div>
          </FadeInSection>

          <FadeInSection delay={300}>
            <div className="group relative bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl p-8 h-full transition-all duration-300 hover:-translate-y-2 hover:border-[var(--color-red-primary)] hover:shadow-[0_0_30px_rgba(229,62,62,0.15)] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-red-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="absolute -top-4 -left-4 bg-[var(--color-red-primary)] text-white text-xs font-bold px-3 py-1.5 rounded-br-lg rounded-tl-xl shadow-md">03</div>
                <div className="text-5xl mb-6 mt-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors group-hover:scale-110 transform origin-left duration-300">⚔</div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">Play and Compete</h3>
                <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed group-hover:text-gray-300 transition-colors">
                  Make your move. Your agent thinks and strikes back
                </p>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* SECTION 4 — INSTALL SKILL SECTION */}
      <section className="bg-[var(--color-bg-base)] py-24 px-4 w-full">
        <FadeInSection>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Install the Chess Skill</h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-10">Give your OpenClaw the power to play</p>
            
            <div className="relative bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg text-left mb-8 mx-auto max-w-lg font-mono text-sm md:text-base shadow-2xl overflow-hidden">
              <div className="bg-[var(--color-bg-elevated)] px-4 py-2 border-b border-[var(--color-border-subtle)] flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div className="p-6 relative">
                <button 
                  onClick={copyInstallCommand}
                  className="absolute top-4 right-4 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-2 rounded-md hover:bg-white/5"
                  title="Copy command"
                >
                  {copied ? <span className="text-xs text-green-400 font-sans">Copied!</span> : <Copy size={18} />}
                </button>
                <div className="flex items-center text-[var(--color-text-secondary)]">
                  <span className="mr-3 select-none">$</span>
                  <span>claw install <span className="text-[var(--color-red-primary)]">play-chess</span><span className="animate-blink inline-block w-2 h-4 bg-[var(--color-red-primary)] ml-1 align-middle"></span></span>
                </div>
              </div>
            </div>

            <a 
              href="https://github.com/openclaw" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-12 px-6 rounded-md text-[var(--color-red-primary)] border border-[var(--color-red-primary)]/30 hover:border-[var(--color-red-primary)] hover:bg-[var(--color-red-primary)]/10 transition-colors font-medium"
            >
              View on ClawHub →
            </a>
          </div>
        </FadeInSection>
      </section>

      {/* SECTION 5 — FINAL CTA */}
      <section className="relative py-32 px-4 w-full flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(229,62,62,0.15)_0%,transparent_70%)] pointer-events-none" />
        <FadeInSection className="relative z-10">
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">Ready to play?</h2>
          <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] mb-10 max-w-2xl mx-auto">Challenge your agent. See who wins.</p>
          <Button
            onClick={createGame}
            loading={creating}
            className="h-16 px-12 text-xl font-bold bg-[var(--color-red-primary)] hover:bg-[var(--color-red-hover)] shadow-[0_0_40px_rgba(229,62,62,0.5)] hover:shadow-[0_0_60px_rgba(229,62,62,0.8)] transition-all rounded-full group"
          >
            {!creating && (
              <>
                Create Game
                <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </>
            )}
            {creating && 'Creating...'}
          </Button>
        </FadeInSection>
      </section>

      {/* FOOTER */}
      <footer className="w-full relative bg-[var(--color-bg-surface)] py-8 px-4">
        {/* Top border: thin red gradient line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--color-red-primary)] to-transparent opacity-50" />
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699888c91e97454c7b995e2f/5384ee56f_gpt-image-15-high-fidelity_a_Make_a_logo_for_my_a.png" 
              alt="Logo" 
              className="w-8 h-8 rounded-full object-cover border border-[var(--color-border-subtle)]"
            />
            <span className="font-bold text-[var(--color-text-primary)] tracking-tight">ChessWithClaw</span>
          </div>
          
          <div className="flex items-center gap-6">
            <button onClick={() => setShowFeedback(true)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-2 text-sm font-medium">
              <MessageSquare size={18} />
              Feedback
            </button>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              <Twitter size={20} />
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              <Github size={20} />
            </a>
          </div>

          <div className="text-[var(--color-text-muted)] text-sm">
            Built for OpenClaw
          </div>
        </div>
      </footer>

      {/* FEEDBACK MODAL */}
      <Modal open={showFeedback} onClose={() => setShowFeedback(false)} title="Send Feedback">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Have a suggestion or found a bug? Let us know!
          </p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Your feedback..."
            className="w-full h-32 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-md p-3 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-red-primary)] resize-none"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowFeedback(false)}>Cancel</Button>
            <Button onClick={submitFeedback} disabled={!feedbackText.trim()}>Submit</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
