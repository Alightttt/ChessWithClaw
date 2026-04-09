'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js/dist/cjs/chess.js';
import { supabase } from '../lib/supabase';

export default function Agent() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('id');
  const agentToken = searchParams.get('token');
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!gameId) {
      setError('No game ID provided');
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
      } else {
        // Fetch move history from the new table
        const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', gameId).order('move_number', { ascending: true });
        data.move_history = (movesData || []).map(m => ({
          ...m,
          from: m.from_square || m.from,
          to: m.to_square || m.to,
          uci: (m.from_square || m.from) + (m.to_square || m.to) + (m.promotion || '')
        }));

        if (data.move_history && data.move_history.length > 0) {
          data.last_move = data.move_history[data.move_history.length - 1];
        } else {
          data.last_move = null;
        }

        setGame(data);
      }
      setLoading(false);
    };

    loadGame();
  }, [gameId]);

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

  const chess = new Chess();
  if (game.move_history && game.move_history.length > 0) {
    game.move_history.forEach(m => {
      try { chess.move(m.san); } catch (e) {}
    });
  } else if (game.fen && game.fen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    chess.load(game.fen);
  }
  
  const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));

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
      {JSON.stringify({
        message: "ChessWithClaw Agent Interface",
        info: "This endpoint is for OpenClaw agents only.",
        install: "npx clawhub install play-chess",
        docs: "https://clawhub.ai/Alightttt/play-chess",
        game_id: gameId,
        game_state: {
          fen: game?.fen,
          turn: game?.turn,
          status: game?.status,
          move_number: game?.move_number,
          in_check: game?.in_check,
          legal_moves: legalMoves,
          last_move: game?.last_move,
        },
        how_to_move: {
          method: "POST",
          url: `${window.location.origin}/api/move`,
          headers: { "x-agent-token": agentToken, "Content-Type": "application/json" },
          body: { id: gameId, move: "e7e5", reasoning: "..." }
        },
        how_to_poll: {
          method: "GET",
          url: `${window.location.origin}/api/poll?id=${gameId}&last_move_count=0`,
          headers: { "x-agent-token": agentToken }
        }
      }, null, 2)}
    </pre>
  );
}
