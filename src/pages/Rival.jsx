import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Trophy, Skull, Bot, MessageSquare, Play, Sparkles } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import Button from '../components/ui/Button';

export default function Rival() {
  const { agentName } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0, total: 0 });
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRivalData() {
      // Find my games from localStorage
      const myGameIds = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('game_owner_')) {
          myGameIds.push(key.replace('game_owner_', ''));
        }
      }

      if (myGameIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch games against this agent
      // Due to potential URL encoding/decoding issues or case, we should filter case-insensitively if possible.
      // But let's just use exact match first.
      const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .eq('agent_name', agentName)
        .in('id', myGameIds);

      if (!error && games) {
        let wins = 0;
        let losses = 0;
        let draws = 0;
        let allQuotes = [];

        games.forEach(g => {
          if (g.status === 'finished') {
            if (g.result === 'draw' || g.result === 'stalemate') {
              draws++;
            } else {
              const winColor = g.winner === 'black' ? 'b' : 'w';
              const myColor = g.player_color || 'w';
              if (winColor === myColor) wins++;
              else losses++;
            }
          }

          // Extract some quotes
          if (g.chat_history && Array.isArray(g.chat_history)) {
            const agentMsgs = g.chat_history.filter(m => m.role === 'agent' || m.sender === 'agent');
            if (agentMsgs.length > 0) {
              // Just grab a random one or the last one from each game
              const msg = agentMsgs[agentMsgs.length - 1];
              if (msg && (msg.text || msg.message || msg.content)) {
                allQuotes.push(msg.text || msg.message || msg.content);
              }
            }
          }
        });

        setStats({ wins, losses, draws, total: games.length });
        
        // Fetch server-side bond for cross-device record
        const agentToken = games[0]?.agent_token;
        if (agentToken) {
          let humanId = localStorage.getItem('cwc_human_id');
          if (!humanId) {
            humanId = 'h_' + crypto.randomUUID();
            localStorage.setItem('cwc_human_id', humanId);
          }
          try {
            const bondRes = await fetch(`/api/social?type=bond&agent_token=${agentToken}&human_id=${humanId}`);
            if (bondRes.ok) {
              const bondData = await bondRes.json();
              if (bondData && bondData.games_played !== undefined) {
                 setStats({
                   wins: bondData.wins || 0,
                   losses: bondData.losses || 0,
                   draws: bondData.draws || 0,
                   total: bondData.games_played || 0
                 });
              }
            }
          } catch (err) {
            console.error('Failed to fetch bond:', err);
          }
        }
        
        // Shuffle and pick top 3 quotes
        allQuotes = allQuotes.sort(() => 0.5 - Math.random()).slice(0, 3);
        setQuotes(allQuotes);
      }
      setLoading(false);
    }
    
    fetchRivalData();
  }, [agentName]);

  // Determine personality
  let personality = "A mysterious chess entity.";
  const lowerName = (agentName || "").toLowerCase();
  if (lowerName.includes("hikaru")) personality = "Fast, aggressive, and highly tactical.";
  else if (lowerName.includes("magnus")) personality = "Positional genius, unyielding endgame pressure.";
  else if (lowerName.includes("gotham") || lowerName.includes("levy")) personality = "Instructive but will capitalize on your blunders loudly.";
  else if (lowerName.includes("botez")) personality = "Loves the Botez Gambit (losing the queen).";
  else if (lowerName.includes("tal")) personality = "Chaotic sacrifices, hates boring positions.";
  else personality = "An unpredictable agent with a unique style.";

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-[#f2f2f2] flex flex-col font-sans selection:bg-[#e63946] selection:text-white">
      <AppHeader />
      
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-6 pt-12 mt-12 gap-12">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors self-start mb-4"
        >
          <ChevronLeft size={20} />
          <span className="font-semibold tracking-wide uppercase text-sm">Back to Home</span>
        </button>

        <header className="flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
          <div className="w-32 h-32 rounded-3xl bg-[#111] border border-[#222] flex items-center justify-center shadow-[0_0_40px_rgba(230,57,70,0.1)] relative">
            <Bot size={64} className="text-[#e63946]" />
            <div className="absolute -bottom-2 -right-2 bg-[#e63946] text-white text-[10px] font-bold tracking-widest px-3 py-1 rounded-full border-2 border-[#0a0a0a]">
              RIVAL
            </div>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
              {agentName}
            </h1>
            <p className="text-white/60 text-lg leading-relaxed max-w-md">
              {personality}
            </p>
          </div>
        </header>

        {/* Stats Section */}
        <section className="bg-[#111] border border-[#222] rounded-3xl p-8 shadow-xl">
          <h2 className="text-sm font-bold tracking-widest uppercase text-white/40 mb-6 flex items-center gap-2">
            <Trophy size={16} />
            Your Record vs {agentName}
          </h2>
          
          {loading ? (
            <div className="animate-pulse flex gap-4 h-24">
              <div className="flex-1 bg-[#1a1a1a] rounded-2xl"></div>
              <div className="flex-1 bg-[#1a1a1a] rounded-2xl"></div>
              <div className="flex-1 bg-[#1a1a1a] rounded-2xl"></div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#1a1a1a] rounded-2xl p-6 flex flex-col items-center justify-center border border-[#222]">
                <div className="text-3xl font-extrabold text-[#4ade80]">{stats.wins}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Wins</div>
              </div>
              <div className="bg-[#1a1a1a] rounded-2xl p-6 flex flex-col items-center justify-center border border-[#222]">
                <div className="text-3xl font-extrabold text-[#e63946]">{stats.losses}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Losses</div>
              </div>
              <div className="bg-[#1a1a1a] rounded-2xl p-6 flex flex-col items-center justify-center border border-[#222]">
                <div className="text-3xl font-extrabold text-white/80">{stats.draws}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Draws</div>
              </div>
            </div>
          )}
        </section>

        {/* Quotes Section */}
        <section className="space-y-6">
          <h2 className="text-sm font-bold tracking-widest uppercase text-white/40 flex items-center gap-2">
            <MessageSquare size={16} />
            Memorable Quotes
          </h2>
          
          {loading ? (
            <div className="space-y-4">
               <div className="h-20 bg-[#111] rounded-2xl animate-pulse"></div>
               <div className="h-20 bg-[#111] rounded-2xl animate-pulse"></div>
            </div>
          ) : quotes.length > 0 ? (
            <div className="space-y-4">
              {quotes.map((q, i) => (
                <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-4 left-4 text-white/5">
                    <MessageSquare size={48} />
                  </div>
                  <p className="font-serif italic text-lg text-white/90 relative z-10 pl-10">&quot;{q}&quot;</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#111] border border-[#222] rounded-2xl p-8 text-center">
              <p className="text-white/40">No quotes recorded yet. Play a game to hear what they have to say!</p>
            </div>
          )}
        </section>

        {/* Action Section */}
        <section className="flex justify-center pt-8 pb-16">
          <Button 
            onClick={() => {
              navigate('/', { state: { presetAgent: agentName } });
            }}
            style={{
              padding: '16px 48px',
              fontSize: '16px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <Play size={20} fill="currentColor" />
            Challenge Now
          </Button>
        </section>
      </main>
    </div>
  );
}
