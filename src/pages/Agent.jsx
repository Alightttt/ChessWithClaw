'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Settings, X as XIcon, Pause, Play, Flag, Share2, Volume2, VolumeX, Download, ChevronDown, Copy, Check, Send, Twitter } from 'lucide-react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import { wN as WN } from '../components/chess/ChessPieces';
import { supabase } from '../lib/supabase';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import StatusDot from '../components/ui/StatusDot';
import Divider from '../components/ui/Divider';
import Badge from '../components/ui/Badge';
import { useRipple } from '../hooks/useRipple';

const LobsterEmoji = () => <span style={{fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle:'normal'}}>🦞</span>;


export default function Agent() {
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('id');
  const agentToken = searchParams.get('token');
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [agentSectionOpen, setAgentSectionOpen] = useState(false);
  const [moveHistoryOpen, setMoveHistoryOpen] = useState(false);
  
  const [boardSize, setBoardSize] = useState(320);
  const [boardTheme, setBoardTheme] = useState(() => localStorage.getItem('cwc_theme') || 'green');
  const [pieceTheme, setPieceTheme] = useState(() => localStorage.getItem('cwc_pieces') || 'neo');

  const [agentTyping, setAgentTyping] = useState(false);
  const [isCheckState, setIsCheckState] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [agentDisconnected, setAgentDisconnected] = useState(false);

  const [visibleThought, setVisibleThought] = useState('');
  const prevThoughtValRef = useRef('');

  const [chatInput, setChatInput] = useState('');
  const [localMessages, setLocalMessages] = useState([]);
  const [boardLocked, setBoardLocked] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [agentJustConnected, setAgentJustConnected] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [closingGameOver, setClosingGameOver] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [showCommentary, setShowCommentary] = useState(false);
  const [lastMoveHighlight, setLastMoveHighlight] = useState(null);
  const [arrivedSquare, setArrivedSquare] = useState(null);
  
  const [optimisticFenState, setOptimisticFenState] = useState(null);
  const [optimisticLastMove, setOptimisticLastMove] = useState(null);
  
  const [agentConnected, setAgentConnected] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 900);

  const submittingRef = useRef(false);
  const channelRef = useRef(null);
  const chatChannelRef = useRef(null);
  const containerRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const prevMoveCountRef = useRef(0);
  const prevStatusRef = useRef('waiting');
  const connectedToastShown = useRef(false);
  const mountedMsgCount = useRef(0);
  const activePickerMsgIdRef = useRef(null);
  const [activePickerMsgId, setActivePickerMsgId] = useState(null);
  const seenMsgCountRef = useRef(0);

  const PIECE_SYMBOLS={p:'♟',r:'♜',n:'♞',b:'♝',q:'♛'};

  const normalizedMessages = useMemo(() => {
    const serverTexts = new Set(chatMessages.map(m => m.text || m.message));
    const combined = [
      ...chatMessages,
      ...localMessages.filter(m => !serverTexts.has(m.text || m.message))
    ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return combined.map((msg, idx) => ({ ...msg, id: msg.id || `cwc-msg-${idx}` }));
  }, [chatMessages, localMessages]);

  const sendReaction = async (msgId, emoji) => {
    setActivePickerMsgId(null);
    setChatMessages(prev => (prev || []).map(msg => {
        if (msg.id !== msgId) return msg;
        const reactions = { ...(msg.reactions || {}) };
        const current = reactions[emoji] || [];
        const hasIt = current.includes('agent');
        if (hasIt) {
          const newArr = current.filter(r => r !== 'agent');
          if (newArr.length === 0) delete reactions[emoji]; else reactions[emoji] = newArr;
        } else {
          Object.keys(reactions).forEach(e => {
            reactions[e] = (reactions[e] || []).filter(r => r !== 'agent');
            if (reactions[e].length === 0) delete reactions[e];
          });
          reactions[emoji] = [...current.filter(r => r !== 'agent'), 'agent'];
        }
        return { ...msg, reactions };
    }));
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, action: 'react', messageId: msgId, emoji, sender: 'agent' })
    }).catch(() => {});
  };

  const setupChatSubscription = useCallback(() => {
     if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
     const channel = supabase.channel('chats-' + gameId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: 'game_id=eq.' + gameId }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const c = payload.new;
          const mapped = {
            id: c.id, role: c.sender, sender: c.sender, text: c.message, message: c.message,
            timestamp: new Date(c.created_at).getTime(), reactions: c.payload?.reactions || {}
          };
          setChatMessages(prev => {
            const exists = prev.find(m => m.id === mapped.id || (m.timestamp === mapped.timestamp && m.text === mapped.text));
            if (exists) return prev;
            return [...prev, mapped].sort((a,b) => a.timestamp - b.timestamp);
          });
          setLocalMessages(prev => prev.filter(m => m.text !== mapped.text));
        } else if (payload.eventType === 'UPDATE') {
          setChatMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, reactions: payload.new.payload?.reactions || {} } : m));
        }
      })
      .subscribe();
     chatChannelRef.current = channel;
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !agentToken) { setNotFound(true); setLoading(false); return; }
    
    fetch(`/api/state?id=${gameId}`, { headers: { 'x-agent-token': agentToken } })
      .then(res => res.json())
      .then(data => {
        setGame(data);
        if (data.chat_history) setChatMessages(data.chat_history);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });

    const channel = supabase.channel(`cwc-game-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
          setGame(prev => ({ ...prev, ...payload.new }));
      })
      .subscribe();
    channelRef.current = channel;
    setupChatSubscription();

    return () => {
      supabase.removeChannel(channel);
      if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
    };
  }, [gameId, agentToken, setupChatSubscription]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput;
    setLocalMessages(prev => [...prev, { role: 'agent', sender: 'agent', text: text, timestamp: Date.now() }]);
    setChatInput('');
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-token': agentToken },
      body: JSON.stringify({ id: gameId, text, sender: 'agent' })
    });
  };

  const makeMove = useCallback(async (from, to, promotion) => {
      if (!game || game.turn !== 'b' || game.status !== 'active') return;
      submittingRef.current = true;
      setBoardLocked(true);
      fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-agent-token': agentToken },
        body: JSON.stringify({ id: gameId, move: from + to + (promotion || '') })
      }).finally(() => { submittingRef.current = false; setBoardLocked(false); });
  }, [game, gameId, agentToken]);

  if (loading) return <div>Loading...</div>;
  if (notFound) return <div>Game not found</div>;

  return (
    <div ref={containerRef} style={{ height: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column' }}>
       <header style={{ padding: '16px', borderBottom: '1px solid #111' }}>Agent View: {gameId}</header>
       <div style={{ flex: 1, display: 'flex', flexDirection: isDesktop ? 'row' : 'column' }}>
          <div style={{ flex: 1, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChessBoard fen={game?.fen} onMove={makeMove} playerColor="b" boardTheme={boardTheme} pieceTheme={pieceTheme} />
          </div>
          <div style={{ width: isDesktop ? '360px' : '100%', borderLeft: '1px solid #111', display: 'flex', flexDirection: 'column' }}>
             <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {normalizedMessages.map(m => (
                  <div key={m.id} style={{ marginBottom: '8px', textAlign: m.role === 'human' ? 'left' : 'right' }}>
                    <div style={{ fontSize: '10px', opacity: 0.5 }}>{m.sender}</div>
                    <div style={{ background: m.role === 'human' ? '#222' : '#e63946', padding: '8px', borderRadius: '8px', display: 'inline-block' }}>{m.text}</div>
                  </div>
                ))}
             </div>
             <form onSubmit={sendMessage} style={{ padding: '8px', display: 'flex' }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} style={{ flex: 1, background: '#111', color: '#fff', border: '1px solid #222', padding: '8px' }} />
                <button type="submit">Send</button>
             </form>
          </div>
       </div>
    </div>
  );
}
