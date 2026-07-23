'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { TextMorph } from 'torph/react';
import { SlotText } from 'slot-text/react';
import 'slot-text/style.css';
import { HeartFilled, HeartOutline } from '../components/icons/FamIcons';
import { useToast } from '../components/Toast';
import { Settings, X as XIcon, Pause, Play, Flag, Share2, Volume2, VolumeX, Download, ChevronDown, Copy, Check, Send, Twitter, Trophy, Handshake, Skull, Share, RefreshCw, Home, Bot, Flame, Zap, Brain, ShieldAlert, Crosshair, Target, Activity, AlertTriangle, ThumbsUp, Heart, Smile, Frown, Sparkles } from 'lucide-react';
import { Chess } from 'chess.js';
import ChessBoard from '../components/chess/ChessBoard';
import { ChessPiece } from '../components/chess/PieceSVGs';
import * as Pieces from '../components/chess/ChessPieces';
import { supabase, getSupabaseWithToken } from '../lib/supabase';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import StatusDot from '../components/ui/StatusDot';
import Divider from '../components/ui/Divider';
import Badge from '../components/ui/Badge';
import { useRipple } from '../hooks/useRipple';

const LobsterEmoji = () => <span style={{fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', fontStyle:'normal'}}>🦞</span>;

const REACTION_ICONS = [
  { id: '❤️', icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>❤️</span> },
  { id: '😂', icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>😂</span> },
  { id: '🔥', icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>🔥</span> },
  { id: '😮', icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>😮</span> },
  { id: '😅', icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>😅</span> },
  { id: '👍', icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>👍</span> },
  { id: '😢', icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>😢</span> },
  { id: '🤝', icon: <span style={{ fontSize: '14px', lineHeight: 1 }}>🤝</span> },
];

const renderReactionIcon = (idStr, isSelected) => {
  if (idStr === '❤️') {
    return isSelected ? <HeartFilled size={16} color="#e63946" /> : <HeartOutline size={16} color="rgba(242,242,242,0.6)" />;
  }
  const match = REACTION_ICONS.find(r => r.id === idStr);
  return match ? match.icon : <span style={{ fontSize: '14px', lineHeight: 1 }}>{idStr}</span>;
}

function getKingSquare(fen, colorChar) {
  if (!fen || typeof fen !== 'string' || !fen.includes(' ')) return null;
  const rows = fen.split(' ')[0].split('/');
  const king = colorChar === 'w' ? 'K' : 'k';
  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const ch of rows[rank]) {
      if (ch === king) return String.fromCharCode(97 + file) + (8 - rank);
      file += isNaN(parseInt(ch)) ? 1 : parseInt(ch);
    }
  }
  return null;
}

const PIECE_CODE_MAP = { K:'K', Q:'Q', R:'R', B:'B', N:'N' };

function getPieceImageUrl(pieceLetter, isWhite, style) {
  const s = style || 'neo';
  const code = ((isWhite ? 'w' : 'b') + pieceLetter).toLowerCase();
  return `https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/pieces/${s}/${code}.png`;
}

function sanToPieceImg(san, isWhiteMove, style) {
  if (!san) return { letter: null, rest: san || '' };
  const firstChar = san[0];
  if (PIECE_CODE_MAP[firstChar]) {
    return { letter: firstChar, rest: san.slice(1), isPawn: false };
  }
  // Castling
  if (san.startsWith('O-O')) return { letter: 'K', rest: san, isPawn: false, isCastle: true };
  // Pawn move — no letter prefix
  return { letter: 'P', rest: san, isPawn: true };
}

export default function Game() {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [presenceTick, setPresenceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPresenceTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const submittingRef = useRef(false);
  const audioCtxRef = useRef(null);
  const prevMoveCountRef = useRef(0);
  const prevStatusRef = useRef('waiting');
  const prevAgentConnected = useRef(false);
  const connectedToastShown = useRef(false);
  const boardRef = useRef(null);
  const chatMessagesRef = useRef(null);

  const channelRef = useRef(null);
  const containerRef = useRef(null);
  const prevFenRef = useRef(null);
  const lastKnownFenRef = useRef(null);
  const optimisticFenRef = useRef(null);
  const fallbackRef = useRef(null);
  const gameOverPollingRef = useRef(null);

  const presenceTimerRef = useRef(null);
  const intervalsRef = useRef([]);
  const heartbeatRef = useRef(null);
  const lastSoundTimeRef = useRef(0);
  
  const allIntervalsRef = useRef([]);
  const safeInterval = (fn, ms) => {
    const _intId = setInterval(fn, ms);
    intervalsRef.current.push(_intId);
    allIntervalsRef.current.push(_intId);
    return _intId;
  };

  const addInterval = useCallback((fn, ms) => {
    const _intId = safeInterval(fn, ms);
    return _intId;
  }, []);

  const agentToken = location.state?.agentToken;
  
  const [game, setGame] = useState(() => {
    try {
      const cached = localStorage.getItem('cwc_active_game');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.gameId === gameId) {
          return {
            id: gameId,
            fen: parsed.fen,
            agent_name: parsed.agentName,
            status: parsed.status || 'active',
            turn: parsed.turn || 'w',
            player_color: parsed.player_color || 'w',
            move_history: parsed.move_history || [],
            chat_history: parsed.chat_history || [],
            agent_connected: parsed.agent_connected || false,
            companion_thought: parsed.companion_thought || '',
            board_theme: parsed.board_theme || null,
            piece_style: parsed.piece_style || null
          };
        }
      }
    } catch (e) {}
    return null;
  });

  const rawPresence = useMemo(() => {
    if (!game?.agent_last_seen) return 'not_here';
    const secsAgo = (Date.now() - new Date(game.agent_last_seen).getTime()) / 1000;
    if (secsAgo < 60) return 'connected';
    if (secsAgo < 150) return 'reconnecting';
    return 'not_here';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.agent_last_seen, presenceTick]);

  const [agentPresence, setAgentPresence] = useState('not_here');
  const presenceStableRef = useRef({ value: 'not_here', count: 0 });

  useEffect(() => {
    const stable = presenceStableRef.current;
    if (rawPresence === stable.value) {
      stable.count = 0;
      setAgentPresence(rawPresence);
    } else {
      stable.count += 1;
      // Require 2 consecutive ticks (20s) of a DOWNGRADE before showing it
      // Upgrades (back to connected) apply immediately
      if (rawPresence === 'connected' || stable.count >= 2) {
        stable.value = rawPresence;
        stable.count = 0;
        setAgentPresence(rawPresence);
      }
    }
  }, [rawPresence]);

  const agentConnected = agentPresence !== 'not_here';

  const dotStyle = {
    connected:    { width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulseDotGreen 2s infinite' },
    reconnecting: { width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', animation: 'pulseDotYellow 1.5s infinite' },
    not_here:     { width: 8, height: 8, borderRadius: '50%', background: '#e63946', animation: 'pulseDotRed 3s infinite' }
  }[agentPresence] || { width: 8, height: 8, borderRadius: '50%', background: '#e63946', animation: 'pulseDotRed 3s infinite' };

  const statusLabel = {
    connected: 'ONLINE',
    reconnecting: 'RECONNECTING...',
    not_here: 'OFFLINE'
  }[agentPresence] || 'OFFLINE';

  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [bestQuote, setBestQuote] = useState(null);
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const pendingMoveFenRef = useRef(null);
  const skipNextRealtimeRef = useRef(false);

  useEffect(() => {
    if (!gameId) return;
    const cookieName = `game_owner_${gameId}`;
    const match = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
    if (match) {
      localStorage.setItem(`game_owner_${gameId}`, match[2]);
      document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }, [gameId]);

  useEffect(() => {
    if (document.getElementById('cwc-styles-v2')) return;
    const style = document.createElement('style');
    style.id = 'cwc-styles-v2';
    style.textContent = `
      .slot-text-char { display: inline-block; overflow: hidden; vertical-align: bottom; }
      .slot-text-char-inner { display: inline-block; will-change: transform; }
      @keyframes slotUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes slotDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
      [data-slot-text] { display: inline-flex; }
      [data-slot-text] .slot-text-char-inner { animation-fill-mode: both; animation-duration: 0.2s; animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
      [data-slot-animation="snappy"] .slot-text-char-inner { animation-name: slotUp; animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
      @keyframes coldGlitch {
        0%, 100% { filter: none; }
        92% { filter: none; }
        93% { filter: hue-rotate(15deg) saturate(1.3); }
        94% { filter: none; }
        96% { filter: hue-rotate(-10deg) saturate(1.2); }
        97% { filter: none; }
      }
      @keyframes captureShake {
        0%, 100% { transform: translate(0, 0); }
        20% { transform: translate(-3px, 2px); }
        40% { transform: translate(3px, -2px); }
        60% { transform: translate(-2px, 1px); }
        80% { transform: translate(2px, -1px); }
      }
      @keyframes illegalShake {
        10%, 90% { transform: translate3d(-1px, 0, 0); }
        20%, 80% { transform: translate3d(2px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
        40%, 60% { transform: translate3d(4px, 0, 0); }
      }
      @keyframes msgIn {
        from { opacity:0; transform:translateY(8px) scale(0.96); }
        to { opacity:1; transform:translateY(0) scale(1); }
      }
      @-webkit-keyframes msgIn {
        from { opacity:0; -webkit-transform:translateY(8px) scale(0.96); }
        to { opacity:1; -webkit-transform:translateY(0) scale(1); }
      }
      @keyframes msgOut {
        from { opacity:1; }
        to { opacity:0; }
      }
      @-webkit-keyframes msgOut {
        from { opacity:1; }
        to { opacity:0; }
      }
      @keyframes typingBounce {
        0%,60%,100% { transform:translateY(0); opacity:0.3; }
        30% { transform:translateY(-4px); opacity:1; }
      }
      @-webkit-keyframes typingBounce {
        0%,60%,100% { -webkit-transform:translateY(0); opacity:0.3; }
        30% { -webkit-transform:translateY(-4px); opacity:1; }
      }
      @keyframes pickerIn {
        from { opacity:0; transform:scale(0.8) translateY(4px); }
        to { opacity:1; transform:scale(1) translateY(0); }
      }
      @-webkit-keyframes pickerIn {
        from { opacity:0; -webkit-transform:scale(0.8) translateY(4px); }
        to { opacity:1; -webkit-transform:scale(1) translateY(0); }
      }
      @keyframes reactionPop {
        0% { transform:scale(0); }
        60% { transform:scale(1.3); }
        100% { transform:scale(1); }
      }
      @-webkit-keyframes reactionPop {
        0% { -webkit-transform:scale(0); }
        60% { -webkit-transform:scale(1.3); }
        100% { -webkit-transform:scale(1); }
      }
      @keyframes agentMoveFlash {
        0% { background-color:rgba(230,57,70,0.7); }
        100% { background-color:transparent; }
      }
      @-webkit-keyframes agentMoveFlash {
        0% { background-color:rgba(230,57,70,0.7); }
        100% { background-color:transparent; }
      }
      @keyframes gameOverIn {
        from { opacity: 0; transform: scale(0.92) translateY(8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes pieceSlide {
        from { transform: scale(0.85); opacity: 0.7; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes dot-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      @keyframes turn-pulse {
        0% { box-shadow: 0 0 0 0 rgba(230,57,70,0.4); }
        70% { box-shadow: 0 0 0 8px rgba(230,57,70,0); }
        100% { box-shadow: 0 0 0 0 rgba(230,57,70,0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      [data-piece] {
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      @keyframes agentBreathe {
        0% { opacity: 0.6; }
        50% { opacity: 1.0; }
        100% { opacity: 0.6; }
      }
      @keyframes emojiBounce {
        0% { transform: scale(1); }
        50% { transform: scale(1.4); }
        100% { transform: scale(1); }
      }
      @keyframes thoughtEntrance {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes yourTurnFlash {
        0% { box-shadow: inset 0 0 0px rgba(230,57,70,0); }
        15% { box-shadow: inset 0 0 40px rgba(230,57,70,0.6); }
        100% { box-shadow: inset 0 0 0px rgba(230,57,70,0); }
      }
      .cwc-msg-new { animation-play-state: running !important; -webkit-animation-play-state: running !important; }
      @media (prefers-reduced-motion: reduce) {
         .cwc-msg-new { animation-play-state: running !important; -webkit-animation-play-state: running !important; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const agentName = (game?.agent_name && game?.agent_name !== 'Your Agent') ? game.agent_name : 'Your Agent';
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('cwc_active_game');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.gameId === gameId) {
          return false;
        }
      }
    } catch (e) {}
    return true;
  });

  const [notFound, setNotFound] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [agentSectionOpen, setAgentSectionOpen] = useState(false);
  const [moveHistoryOpen, setMoveHistoryOpen] = useState(false);
  
  const [copiedResult, setCopiedResult] = useState(false);
  const [boardTheme, setBoardTheme] = useState(() => {
    return localStorage.getItem('cwc_board_theme') || 'green';
  });
  const [pieceStyle, setPieceStyle] = useState(() => {
    const saved = localStorage.getItem('cwc_piece_style');
    if (!saved || saved === 'standard') {
      localStorage.setItem('cwc_piece_style', 'neo');
      return 'neo';
    }
    return saved;
  });
  const [thoughtLanguage, setThoughtLanguage] = useState(() => {
    return localStorage.getItem('cwc_thought_language') || 'english';
  });

  const boardFenRef = useRef('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [boardFen, setBoardFen] = useState(boardFenRef.current);

  const applyBoardFen = useCallback((fen) => {
    if (!fen || !fen.includes(' ')) return;
    // Compare only piece placement (first field of FEN), not full FEN
    // This prevents re-animation when only metadata (clocks, en passant) changed
    const currentPosition = boardFenRef.current ? boardFenRef.current.split(' ')[0] : '';
    const newPosition = fen.split(' ')[0];
    if (newPosition === currentPosition) {
      // Board layout identical — just update ref for metadata, no re-render
      boardFenRef.current = fen;
      return;
    }
    boardFenRef.current = fen;
    setBoardFen(fen);
  }, []);

  const lastProcessedFenRef = useRef('start');
  const [boardLastMoveRaw, setBoardLastMoveRaw] = useState(null);
  const lastMoveRef = useRef(null);
  const boardLastMove = lastMoveRef.current || boardLastMoveRaw;
  const setBoardLastMove = useCallback((newMove) => {
    if (newMove) {
      const from = newMove.from || newMove.from_square;
      const to = newMove.to || newMove.to_square;
      if (from && to) {
        lastMoveRef.current = newMove;
        setBoardLastMoveRaw(newMove);
      }
    }
  }, []);
  const lastMoveFenRef = useRef(null);
  const movePendingRef = useRef(false);

  useEffect(() => {
    if (!pieceStyle) return;
    const CODES = ['wp','wn','wb','wr','wq','wk','bp','bn','bb','br','bq','bk'];
    const BASE = 'https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/pieces';
    CODES.forEach(code => {
      const img = new window.Image();
      img.src = `${BASE}/${pieceStyle}/${code}.png`;
    });
  }, [pieceStyle]);

  const prevDbPieceStyleRef = useRef(game?.piece_style || null);

  const [agentTyping, setAgentTyping] = useState(false);

  useEffect(() => {
    if (!game?.agent_typing) return;
    const safetyTimer = setTimeout(() => {
      setGame(prev => prev ? { ...prev, agent_typing: false } : prev);
    }, 15000);
    return () => clearTimeout(safetyTimer);
  }, [game?.agent_typing]);
  const [isCheckState, setIsCheckState] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [bgmEnabled, setBgmEnabled] = useState(() => localStorage.getItem('cwc_bgm') !== 'false');
  const [showAwayTooltip, setShowAwayTooltip] = useState(() => localStorage.getItem('cwc_away_tooltip_dismissed') !== 'true');

  const bgmGainRef = useRef(null);
  const bgmSourceRef = useRef(null);
  const bgmAudioRef = useRef(null);
  
  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtxRef.current;
  };

  // Chess.com-style wooden piece sounds
  const playSound = useCallback((type) => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      if (type === 'move' || type === 'agentMove') {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 800; filter.Q.value = 0.8;
        const gain = ctx.createGain(); gain.gain.setValueAtTime(0.45, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start(now); src.stop(now + 0.08);
      }
      else if (type === 'capture' || type === 'agentCapture') {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
        const gain = ctx.createGain(); gain.gain.setValueAtTime(0.7, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        src.start(now); src.stop(now + 0.12);
      }
      else if (type === 'check' || type === 'agentCheck') {
        [440, 554, 659].forEach((freq, i) => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.frequency.value = freq; osc.type = 'sine';
          gain.gain.setValueAtTime(0, now + i * 0.06);
          gain.gain.linearRampToValueAtTime(0.2, now + i * 0.06 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.3);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(now + i * 0.06); osc.stop(now + i * 0.06 + 0.3);
        });
      }
      else if (type === 'start' || type === 'gameStart') {
        [330, 440, 550, 660].forEach((freq, i) => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.frequency.value = freq; osc.type = 'sine';
          gain.gain.setValueAtTime(0, now + i * 0.08);
          gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.4);
        });
      }
      else if (type === 'end' || type === 'gameEnd' || type === 'checkmate') {
        [660, 550, 440, 330].forEach((freq, i) => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.frequency.value = freq; osc.type = 'sine';
          gain.gain.setValueAtTime(0, now + i * 0.1);
          gain.gain.linearRampToValueAtTime(0.18, now + i * 0.1 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.5);
        });
      }
      else if (type === 'castle') {
        [0, 0.05].forEach((delay) => {
          const buf = ctx.createBuffer(1, ctx.sampleRate * 0.07, ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
          const src = ctx.createBufferSource(); src.buffer = buf;
          const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 750;
          const gain = ctx.createGain(); gain.gain.setValueAtTime(0.4, now + delay); gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.07);
          src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
          src.start(now + delay);
        });
      }
    } catch(e) {}
  }, [soundEnabled]);

  const startBGM = useCallback(() => {
    try {
      if (bgmAudioRef.current) return;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.08;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800; // Soft ambient pad

      masterGain.connect(filter);
      filter.connect(ctx.destination);

      const chords = [
        [261.63, 329.63, 392.00], // C4, E4, G4 (C major)
        [220.00, 261.63, 329.63], // A3, C4, E4 (A minor)
        [174.61, 220.00, 261.63], // F3, A3, C4 (F major)
        [196.00, 246.94, 293.66], // G3, B3, D4 (G major)
      ];

      let chordIndex = 0;
      let nextStartTime = ctx.currentTime;
      let isPlaying = true;
      let timeoutId;

      const scheduleChords = () => {
        if (!isPlaying || !ctx) return;
        const now = ctx.currentTime;
        if (nextStartTime < now + 0.5) {
          const chord = chords[chordIndex];
          chordIndex = (chordIndex + 1) % chords.length;
          
          chord.forEach(freq => {
            // Mix of sine and triangle for richer pad
            [ 'sine', 'triangle' ].forEach((type, i) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              
              osc.frequency.value = type === 'sine' ? freq / 2 : freq;
              osc.type = type;
              // Add slight detune for richness
              osc.detune.value = (Math.random() - 0.5) * 10;
              
              // Smooth envelope: 2s attack, 2s sustain, 2s release
              gain.gain.setValueAtTime(0, nextStartTime);
              gain.gain.linearRampToValueAtTime(i === 0 ? 0.3 : 0.1, nextStartTime + 2);
              gain.gain.setValueAtTime(i === 0 ? 0.3 : 0.1, nextStartTime + 4);
              gain.gain.linearRampToValueAtTime(0, nextStartTime + 6);
              
              osc.connect(gain);
              gain.connect(masterGain);
              
              osc.start(nextStartTime);
              osc.stop(nextStartTime + 6);
            });
          });
          
          nextStartTime += 4;
        }
        timeoutId = setTimeout(scheduleChords, 200);
      };

      scheduleChords();

      bgmAudioRef.current = {
        pause: () => {
          isPlaying = false;
          clearTimeout(timeoutId);
          ctx.close().catch(() => {});
        },
        currentTime: 0
      };
    } catch(e) {}
  }, []);

  const stopBGM = useCallback(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current.currentTime = 0;
      bgmAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (bgmEnabled && game?.status === 'active') startBGM();
    else stopBGM();
    return () => stopBGM();
  }, [bgmEnabled, game?.status, startBGM, stopBGM]);

  const [yourTurnFlashKey, setYourTurnFlashKey] = useState(0);

  const [thoughtText, setThoughtText] = useState('');
  const [thoughtVisible, setThoughtVisible] = useState(false);
  const thoughtTimerRef = useRef(null);
  const prevGameFenRef = useRef('');
  
  const [isUserTyping, setIsUserTyping] = useState(false);
  const userTypingTimerRef = useRef(null);
  const userSentTypingRef = useRef(false);

  useEffect(() => {
    const currentTimer = thoughtTimerRef.current;
    return () => {
      if (currentTimer) clearTimeout(currentTimer);
    };
  }, []);


  useEffect(() => {
    const checkCheck = () => {
      try {
        const chess = new Chess(game?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
        setIsCheckState(chess.in_check ? chess.in_check() : chess.isCheck ? chess.isCheck() : false);
      } catch (e) {
        setIsCheckState(false);
      }
    };
    if (game?.fen) {
      checkCheck();
    }
  }, [game?.fen]);

  useEffect(() => {
    if (!game?.fen) return;
    if (game.fen === boardFenRef.current) return;
    const gameBoard = game.fen.split(' ')[0];
    const currentBoard = boardFenRef.current ? boardFenRef.current.split(' ')[0] : '';
    if (gameBoard === currentBoard && game.fen.split(' ')[1] === boardFenRef.current.split(' ')[1]) return;
    requestAnimationFrame(() => {
      applyBoardFen(game.fen);
    });
  }, [game?.fen, applyBoardFen]);

  useEffect(() => {
    if (!game?.fen) return;
    const isBlackTurn = game.fen.split(' ')[1] === 'b';
    if (prevGameFenRef.current && game.fen !== prevGameFenRef.current && !isBlackTurn) {
      setTimeout(() => { try { playSound('move'); } catch(e) {} }, 100);
    }
    prevGameFenRef.current = game.fen;
  }, [game?.fen, playSound]);

  const showThought = useCallback((text) => {
    if (!text || !text.trim()) return;
    if (thoughtTimerRef.current) clearTimeout(thoughtTimerRef.current);
    // Fade OUT existing thought first, then fade IN the new one
    setThoughtVisible(false);
    thoughtTimerRef.current = setTimeout(() => {
      setThoughtText(text.trim());
      setThoughtVisible(true);
      thoughtTimerRef.current = setTimeout(() => setThoughtVisible(false), 4000);
    }, 300);
  }, []);

  useEffect(() => {
    if (game?.status === 'finished') return;
    if (game?.companion_thought) showThought(game.companion_thought);
  }, [game?.companion_thought, game?.status, showThought]);



  useEffect(() => {
    setThoughtVisible(false);
    setThoughtText('');
    if (thoughtTimerRef.current) clearTimeout(thoughtTimerRef.current);
  }, [game?.thought_language]);

  const checkedSquare = useMemo(() => {
    try {
      if (!boardFen || boardFen === 'start') return null;
      const tempChess = new Chess(boardFen);
      if (tempChess.isCheck ? tempChess.isCheck() : (tempChess.in_check ? tempChess.in_check() : false)) {
        return getKingSquare(boardFen, tempChess.turn());
      }
    } catch (e) {}
    return null;
  }, [boardFen]);

  const trueTurn = useMemo(() => {
    const trueTurnResult = (boardFen && typeof boardFen === 'string' && boardFen.includes(' '))
      ? (boardFen.split(' ')[1] === 'w' ? 'white' : 'black')
      : 'white';
    return trueTurnResult;
  }, [boardFen]);

  const infoState = game?.status === 'waiting'
    ? { label: 'Waiting for ' + agentName + '...', style: 'waiting' }
    : trueTurn === ((game?.player_color || 'w') === 'w' ? 'white' : 'black')
    ? { label: 'Your Turn', style: 'yourturn' }
    : { label: agentName + ' Thinking...', style: 'thinking' };

  const infoContainerStyle = {
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '22px',
    padding: '0 20px',
    margin: '8px auto',
    maxWidth: '260px',
    transition: 'background 0.3s ease',
    ...(infoState.style === 'yourturn' ? {
      background: 'rgba(230,57,70,0.15)',
      border: '1px solid rgba(230,57,70,0.4)',
      color: '#f2f2f2',
    } : infoState.style === 'thinking' ? {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: 'rgba(242,242,242,0.6)',
    } : {
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      color: 'rgba(242,242,242,0.4)',
    }),
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    fontSize: '12px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  const dotColor = infoState.style === 'yourturn' ? '#e63946' : infoState.style === 'thinking' ? 'rgba(242, 242, 242, 0.4)' : '#555';
  const dotAnimation = infoState.style === 'thinking' ? 'pulse 1.5s ease-in-out infinite' : undefined;

  const moodEmoji = useMemo(() => {
    if (game?.status === 'finished') {
      if (game?.winner === (game?.player_color === 'b' ? 'white' : 'black')) return '😭';
      if (game?.result === 'draw') return '🤝';
      return '🏆';
    }
    if (!boardFen || !boardFen.includes(' ')) return '🦞';

    const board = boardFen.split(' ')[0];
    const turn = boardFen.split(' ')[1];
    const vals = { p:1, n:3, b:3, r:5, q:9 };
    let w = 0, b = 0;
    for (const ch of board) {
      const l = ch.toLowerCase();
      if (vals[l]) { if (ch === ch.toUpperCase()) w += vals[l]; else b += vals[l]; }
    }
    const adv = w - b;
    const moveNum = parseInt(boardFen.split(' ')[5] || '1');
    const inCheck = game?.in_check;
    const phase = game?.game_phase || 'opening';

    // Sentiment scan of the agent&apos;s own latest expressed thought — ties the
    // emoji to what the agent actually said, not only the board math.
    const thoughtText = (game?.companion_thought || game?.current_thought || '').toLowerCase();
    const positiveWords = ['nice', 'good', 'love', 'confident', 'strong', 'winning', 'haha', 'great', 'fun', 'enjoy'];
    const negativeWords = ['oops', 'mistake', 'worried', 'careful', 'danger', 'risky', 'uh oh', 'tricky', 'tough', 'hmm'];
    const excitedWords = ['wow', 'whoa', 'finally', 'yes!', 'let\'s go', 'big move'];
    let sentiment = 0;
    if (thoughtText) {
      positiveWords.forEach(w2 => { if (thoughtText.includes(w2)) sentiment += 1; });
      negativeWords.forEach(w2 => { if (thoughtText.includes(w2)) sentiment -= 1; });
      excitedWords.forEach(w2 => { if (thoughtText.includes(w2)) sentiment += 2; });
    }

    if (inCheck && turn === 'b') return '😰';
    if (inCheck && turn === 'w') return '😤';
    if (sentiment >= 2) return '🤩';
    if (sentiment === 1) return '😏';
    if (sentiment === -1) return '🤔';
    if (sentiment <= -2) return '😬';
    if (moveNum <= 6) return '🦞';
    if (adv <= -9) return '🔥';
    if (adv <= -6) return '😈';
    if (adv <= -3) return '😎';
    if (adv >= 9)  return '💀';
    if (adv >= 6)  return '😵';
    if (adv >= 3)  return '😅';
    if (phase === 'endgame' && moveNum > 30) return '🧠';
    if (moveNum % 7 === 0) return '🤨';
    return '🦞';
  }, [boardFen, game?.in_check, game?.game_phase, game?.status, game?.companion_thought, game?.current_thought, game?.winner, game?.result, game?.player_color]);

  const [displayedEmoji, setDisplayedEmoji] = useState('🦞');
  const [emojiAnimating, setEmojiAnimating] = useState(false);

  const emojiHoldRef = useRef({ moveCount: 0, emoji: '🦞' });
  useEffect(() => {
    if (moodEmoji === displayedEmoji) return;
    
    if (game?.in_check && (moodEmoji === '😰' || moodEmoji === '😤')) {
      emojiHoldRef.current = { moveCount: game?.move_history?.length || 0, emoji: moodEmoji };
      setDisplayedEmoji(moodEmoji);
      setEmojiAnimating(true);
      setTimeout(() => setEmojiAnimating(false), 300);
      return;
    }

    const currentMoveCount = game?.move_history?.length || 0;
    if (game?.status !== 'finished' && currentMoveCount - emojiHoldRef.current.moveCount < 3 && emojiHoldRef.current.moveCount !== 0) {
      return;
    }

    emojiHoldRef.current = { moveCount: currentMoveCount, emoji: moodEmoji };
    setDisplayedEmoji(moodEmoji);
    setEmojiAnimating(true);
    setTimeout(() => {
      setEmojiAnimating(false);
    }, 300);
  }, [moodEmoji, displayedEmoji, game?.move_history, game?.in_check, game?.status]);

  // STEP 2 — In the section where customSquareStyles is built (where dots and rings for legal moves are added), add this block at the very END, after all other square styles are set:
  const getCustomSquareStylesForCheck = () => {
    const customSquareStyles = {};
    if (game?.in_check) {
      const inCheckColor = trueTurn === 'black' ? 'b' : 'w';
      const kingSquare = getKingSquare(boardFen, inCheckColor);
      if (kingSquare) {
        customSquareStyles[kingSquare] = {
          background: 'radial-gradient(circle at center, rgba(230,57,70,0.95) 0%, rgba(230,57,70,0.5) 40%, transparent 70%)',
          borderRadius: '0'
        };
      }
    }
    return customSquareStyles;
  };

  const moveCount = game?.move_count || 0;
  const gamePhase = moveCount < 10 ? 'Opening' : moveCount < 25 ? 'Middlegame' : 'Endgame';

  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [drawOfferPending, setDrawOfferPending] = useState(false);
  const [drawDeclined, setDrawDeclined] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [localMessages, setLocalMessages] = useState([]);
  const [boardLocked, setBoardLocked] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  
  const [actionSheetMsg, setActionSheetMsg] = useState(null);
  const pressTimerRef = useRef(null);
  const touchMovedRef = useRef(false);

  const [replyingTo, setReplyingTo] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const handleMsgTouchStart = (msg) => () => {
    touchMovedRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        setActionSheetMsg(msg);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    }, 450);
  };
  const handleMsgTouchMove = () => {
    touchMovedRef.current = true;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };
  const handleMsgTouchEnd = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };
  
  const handleReplyToMessage = (msg) => { setReplyingTo(msg); };
  const handleEnterSelectMode = (msg) => {
    setSelectMode(true);
    setSelectedIds(new Set([msg.id]));
  };
  const toggleMessageSelection = (msgId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      return next;
    });
  };
  const handleCopyMessage = (msg) => {
    navigator.clipboard?.writeText(msg?.message || msg?.text || '');
  };

  const [agentJustConnected, setAgentJustConnected] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [closingGameOver, setClosingGameOver] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [commentary, setCommentary] = useState('');
  const [showCommentary, setShowCommentary] = useState(false);
  const [lastMoveHighlight, setLastMoveHighlight] = useState(null);
  const [arrivedSquare, setArrivedSquare] = useState(null);
  const [isTabActive, setIsTabActive] = useState(true);

  useEffect(() => {
    if (boardLastMove) {
      const dest = typeof boardLastMove === 'string' ? boardLastMove.substring(2, 4) : (boardLastMove.to || boardLastMove.to_square);
      if (dest) {
        setArrivedSquare(dest);
        const timer = setTimeout(() => setArrivedSquare(null), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [boardLastMove]);

  const setMoveHistory = useCallback((history) => {
    if (!Array.isArray(history)) return;
    setGame(prev => {
      if (!prev) return prev;
      const currentLength = Array.isArray(prev.move_history) ? prev.move_history.length : 0;
      if (history.length < currentLength) return prev;
      return { ...prev, move_history: history };
    });
  }, []);

  useEffect(() => {
    if (game?.status === 'finished' || game?.status === 'abandoned') {
      // Clear ALL intervals immediately on game over
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      allIntervalsRef.current.forEach(clearInterval);
      allIntervalsRef.current = [];
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      setShowGameOver(true);
    }
  }, [game?.status]);

  useEffect(() => {
    return () => {
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
      allIntervalsRef.current.forEach(clearInterval);
      allIntervalsRef.current = [];
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, []);
  
  const skeletonStyle = {
    background: 'linear-gradient(90deg, #111111 25%, #111111 50%, #111111 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 2s infinite linear',
    borderRadius: '8px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
  };
  
  const [optimisticFenState, setOptimisticFenState] = useState(null);
  const setOptimisticFen = (val) => {
    optimisticFenRef.current = val;
    setOptimisticFenState(val);
    if (val) {
      lastKnownFenRef.current = val;
    }
  };
  const optimisticFen = optimisticFenState;

  const loadGameData = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?gameId=${gameId}`);
      if (res.ok) {
        const data = await res.json();
        prevFenRef.current = data.fen;
        lastKnownFenRef.current = data.fen;
        setGame(prev => {
          const updated = { ...data };
          if (prev?.chat_history && data?.chat_history) {
            const dbIds = new Set(data.chat_history.map(m => m.id));
            const trueOptimistic = prev.chat_history.filter(m => String(m.id).startsWith('opt-') && !dbIds.has(m.id));
            updated.chat_history = [...data.chat_history, ...trueOptimistic];
          }
          return updated;
        });

        const fetchedGame = data;
        if (Array.isArray(fetchedGame?.move_history) && fetchedGame.move_history.length > 0) {
          setMoveHistory(fetchedGame.move_history);
        }
        if (Array.isArray(fetchedGame?.chat_history) && fetchedGame.chat_history.length > 0) {
          setChatMessages(fetchedGame.chat_history);
        } else {
          setChatMessages([]);
        }

        if (fetchedGame?.board_theme) {
          setBoardTheme(fetchedGame.board_theme);
          localStorage.setItem('cwc_board_theme', fetchedGame.board_theme);
          localStorage.setItem('cwc_theme', fetchedGame.board_theme);
        }
        if (fetchedGame?.piece_style) {
          setPieceStyle(fetchedGame.piece_style);
          localStorage.setItem('cwc_piece_style', fetchedGame.piece_style);
        }

        applyBoardFen(data.fen || 'start');
        lastProcessedFenRef.current = data.fen || 'start';
        if (data.last_move) setBoardLastMove(data.last_move);
        setOptimisticFen(null);
        
        // Restore chat messages
        if (data.chat_history && Array.isArray(data.chat_history)) {
          setChatMessages(data.chat_history.slice(-50));
        }

        // Restore last move highlight
        if (data.last_move?.from && data.last_move?.to) {
          setLastMoveHighlight({ 
            from: data.last_move.from, 
            to: data.last_move.to 
          });
        }

        // Mark as loaded LAST
        setIsLoaded(true);
        setIsLoading(false);
      } else if (res.status === 404) {
        setNotFound(true);
        setIsLoading(false);
        setIsLoaded(true);
      }
    } catch (e) {
      setIsLoading(false);
      setIsLoaded(true);
    }
    setLoading(false);
  }, [gameId, applyBoardFen, setMoveHistory, setBoardLastMove]);

  const [optimisticLastMove, setOptimisticLastMove] = useState(null);
  const [shakeActive, setShakeActive] = useState(false);
  const [agentCooking, setAgentCooking] = useState(false);
  const thinkingStartRef = useRef(null);

  useEffect(() => {
    if (trueTurn === 'black' && game?.status === 'active') {
      if (!thinkingStartRef.current) thinkingStartRef.current = Date.now();
      const checkCooking = setInterval(() => {
        const elapsed = Date.now() - (thinkingStartRef.current || Date.now());
        setAgentCooking(elapsed > 8000);
      }, 1000);
      return () => clearInterval(checkCooking);
    } else {
      thinkingStartRef.current = null;
      setAgentCooking(false);
    }
  }, [trueTurn, game?.status]);


  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 600);
  const [isTablet, setIsTablet] = useState(typeof window !== 'undefined' && window.innerWidth >= 600 && window.innerWidth < 960);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 960);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 360);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' && window.visualViewport
      ? window.visualViewport.height
      : (typeof window !== 'undefined' ? window.innerHeight : 800)
  );
  
  const ANIM_DURATION = isMobile ? '0.28s' : '0.2s';
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 600);
      setIsTablet(window.innerWidth >= 600 && window.innerWidth < 960);
      setIsDesktop(window.innerWidth >= 960);
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleResize = () => setViewportHeight(window.visualViewport.height);
    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport.removeEventListener('resize', handleResize);
  }, []);

  const boardSize = Math.min(
    viewportWidth - 24,
    viewportHeight * 0.55,
    480
  );

  const [lastMoveTo, setLastMoveTo] = useState(null);

  useEffect(() => {
    const interval = addInterval(() => {
      setGame(prev => prev ? { ...prev } : prev);
    }, 10000);
    return () => {
      clearInterval(interval);
      intervalsRef.current = intervalsRef.current.filter(x => x !== interval);
    };
  }, [addInterval]);

  const [chatPaddingBottom, setChatPaddingBottom] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const createRipple = useRipple();

  const prevChatCountRef = useRef(0);
  const mountedMsgCount = useRef(0);
  const countSetRef = useRef(false);
  const prevAgentTypingRef = useRef(false);
  const [activePickerMsgId, setActivePickerMsgId] = useState(null);
  const longPressTimer = useRef(null);
  const seenMsgCountRef = useRef(0);

  useEffect(() => {
    const close = () => setActivePickerMsgId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const normalizedMessages = useMemo(() => {
    const serverTexts = new Set((chatMessages || []).map(m => m.text || m.message || m.content));
    const combined = [
      ...(chatMessages || []).filter(Boolean),
      ...localMessages.filter(m => m && !serverTexts.has(m.text || m.message || m.content))
    ].sort((a, b) => {
      const timeA = new Date(a.timestamp || a.ts || 0).getTime();
      const timeB = new Date(b.timestamp || b.ts || 0).getTime();
      return timeA - timeB;
    });
    return combined.map((msg, idx) => ({
      ...msg,
      id: msg.id || `cwc-msg-${idx}`,
      ts: msg.ts || (msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now())
    }));
  }, [chatMessages, localMessages]);

  useEffect(() => {
    seenMsgCountRef.current = normalizedMessages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount - captures initial count

  const sendReaction = async (msgId, emoji) => {
    // Optimistic update immediately
    setChatMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = { ...(m.reactions || {}) };
      const reactors = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
      if (reactors.includes('human')) {
        reactions[emoji] = reactors.filter(r => r !== 'human');
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...reactors, 'human'];
      }
      return { ...m, reactions };
    }));
    // Send to backend
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, action: 'react', messageId: msgId, emoji, reactor: 'human' }),
      });
    } catch(e) {}
  };

  /* old touch handlers removed to make way for action sheet ones */

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function handleRematch() {
    // Step 1: Clear all old game state from localStorage
    localStorage.removeItem('chesswithclaw_active_game')
    
    // Step 2: Clear all local component state
    setGame(null)
    setThoughtText('')
    setThoughtVisible(false)
    setLastMoveHighlight(null)
    setArrivedSquare(null)
    setLastMoveTo(null)
    setShowGameOver(false)
    connectedToastShown.current = false
    
    // Step 3: Navigate to home to create fresh game
    // Do NOT try to navigate to /created/:id from here
    // Let user click "Challenge Your Agent" fresh
    navigate('/')
  }

  const computeMaterial = useCallback((fen) => {
    if (!fen) return null;
    try {
      let chess;
      try {
        chess = new Chess(fen);
      } catch(e) {
        console.error('Invalid FEN:', fen);
        chess = new Chess();
      }
      const vals = { p: 1, n: 3, b: 3, r: 5, q: 9 };
      let w = 0, b = 0;
      chess.board().forEach(row => row && row.forEach(sq => {
        if (!sq) return;
        const v = vals[sq.type] || 0;
        if (sq.color === 'w') w += v; else b += v;
      }));
      const diff = w - b;
      return { white: w, black: b, advantage: diff > 0 ? 'white' : diff < 0 ? 'black' : 'equal', difference: Math.abs(diff) };
    } catch (e) {
      return null;
    }
  }, []);
  
  // Calculate Board Size and Viewport Height
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      
      let maxH, maxW;
      
      const currentIsDesktop = vw >= 960;
      
      if (currentIsDesktop) {
        // Desktop: Board is in a flex container next to a 360px sidebar
        const sidebarWidth = 360;
        const padding = 64;
        const usedHeight = 52 + 64 + 100; // header + padding + top/bottom info
        maxH = vh - usedHeight;
        maxW = vw - sidebarWidth - padding; // sidebar width + padding
      } else {
        // Mobile / Tablet
        const padding = 24;
        const usedHeight =
          52 +   // header
          100 +  // agent section (merged, collapsed)
          48 +   // status bar
          44 +   // chat header
          44 +   // move history header
          24;    // padding
        maxH = vh - usedHeight;
        maxW = vw - padding;
      }
      
      const paddingForBoard = currentIsDesktop ? 24 : 24;
      const maxBoardSize = 800;
      
      const calculatedWidth = currentIsDesktop
        ? Math.min(vw - 360 - 64 - paddingForBoard, maxBoardSize)
        : Math.min(vw - paddingForBoard, maxBoardSize);
        
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    calc();

    const observer = new ResizeObserver(() => {
      calc();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', calc);
    }
    return () => {
      observer.disconnect();
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', calc);
      }
    };
  }, []);



  // Auto-scroll chat
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [normalizedMessages]);





  useEffect(() => {
    if (!window.visualViewport) return
    
    const handleViewport = () => {
      const keyboardHeight = window.innerHeight - window.visualViewport.height
      if (keyboardHeight > 100) {
        // Keyboard is open
        setChatPaddingBottom(keyboardHeight)
      } else {
        setChatPaddingBottom(0)
      }
    }
    
    window.visualViewport.addEventListener('resize', handleViewport)
    return () => window.visualViewport.removeEventListener('resize', handleViewport)
  }, [])

  useEffect(() => {
    if (game?.last_commentary) {
      setCommentary(game.last_commentary);
      setShowCommentary(true);
      const timer = setTimeout(() => {
        setShowCommentary(false);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [game?.last_commentary, game?.move_history?.length]);


  useEffect(() => {
    if (!game) return;
    const currentMoveCount = (game.move_history || []).length;
    prevMoveCountRef.current = currentMoveCount;
    prevStatusRef.current = game.status;
    prevStatusRef.current_thinking = game.current_thinking;
  }, [game]);

  const chatHistoryInitializedRef = useRef(false);
  const prevChatHistoryRef = useRef([]);

  useEffect(() => {
    if (!game?.chat_history) return;
    const currentChat = game.chat_history;
    
    if (!chatHistoryInitializedRef.current) {
      prevChatHistoryRef.current = currentChat;
      chatHistoryInitializedRef.current = true;
      return;
    }

    prevChatHistoryRef.current = currentChat;
  }, [game?.chat_history]);

  // Heartbeat & Idle Chat
  useEffect(() => {
    if (!game || game.status === 'finished' || game.status === 'abandoned' || game.turn === (game?.player_color || 'w')) {
      return;
    }
    
    heartbeatRef.current = safeInterval(() => {
      fetch('/api/actions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({ gameId: gameId, action: 'heartbeat', role: 'human' })
      }).catch(() => {});
      
      // Poll game state if it&apos;s the agent&apos;s turn to catch missed real-time events, but only if visible!
      if (isTabActive && game?.turn !== (game?.player_color || 'w') && game?.status === 'active') {
        supabase.from('games').select('turn, move_history').eq('id', gameId).single().then(({ data }) => {
          if (data && data.turn === (game?.player_color || 'w')) {
            loadGameData();
          }
        });
      }
    }, 15000);

    let idleChatInterval = null;
    if (isTabActive) {
      idleChatInterval = addInterval(() => {
        if (game?.status !== 'active') return;
        
        const rand = Math.random();
        if (rand < 0.3) {
          fetch(`/api/thoughts?gameId=${gameId}&trigger=idle_chat`, {
             headers: { 'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || '' }
          }).catch(() => {});
        } else if (rand < 0.6) {
          fetch(`/api/thoughts?gameId=${gameId}&trigger=random_thought`, {
             headers: { 'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || '' }
          }).catch(() => {});
        }
      }, 45000);
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (idleChatInterval) {
        clearInterval(idleChatInterval);
        intervalsRef.current = intervalsRef.current.filter(x => x !== idleChatInterval);
      }
    };
  }, [game, game?.turn, game?.status, game?.agent_last_seen, game?.updated_at, game?.created_at, gameId, isTabActive, loadGameData, addInterval]);

  useEffect(() => {
    if (game?.status === 'finished' || game?.status === 'abandoned') {
      localStorage.removeItem('chesswithclaw_active_game');
      setShowGameOver(true);
      
      if (game?.result === (game?.player_color === 'b' ? 'black' : 'white')) {
        setTimeout(() => {
          toast.success('Achievement Unlocked: Bot Slayer! 🏆');
        }, 1500);
      }
    }
  }, [game?.status, game?.result, game?.player_color, toast]);

  // Start game over / general fallback polling when the game is not finished
  useEffect(() => {
    if (!isTabActive) return;
    if (game?.status === 'finished' || game?.status === 'abandoned') {
      if (gameOverPollingRef.current) {
        clearInterval(gameOverPollingRef.current);
        intervalsRef.current = intervalsRef.current.filter(x => x !== gameOverPollingRef.current);
        gameOverPollingRef.current = null;
      }
      return;
    }
    
    gameOverPollingRef.current = addInterval(async () => {
      try {
        const res = await fetch(`/api/state?gameId=${gameId}`);
        if (!res.ok) return;
        const fresh = await res.json();
        if (fresh.status === 'finished' || fresh.status === 'abandoned' || fresh.fen !== game?.fen) {
          setGame(prev => {
            const { board_theme, piece_style, ...safeFresh } = fresh;
            return { ...prev, ...safeFresh };
          });
          if (fresh.status === 'finished' || fresh.status === 'abandoned') {
            setShowGameOver(true);
          }
        }
      } catch (e) {}
    }, 1000);
    
    return () => {
      if (gameOverPollingRef.current) {
        clearInterval(gameOverPollingRef.current);
        intervalsRef.current = intervalsRef.current.filter(x => x !== gameOverPollingRef.current);
        gameOverPollingRef.current = null;
      }
    };
  }, [game?.status, gameId, game?.fen, isTabActive, addInterval]);

  useEffect(() => {
    if (!game) return;
    const agentName = (game?.agent_name && game?.agent_name !== 'Your Agent') ? game.agent_name : 'Your Agent';
    if (game.status === 'finished' || game.status === 'abandoned') {
      document.title = 'ChessWithClaw';
    } else if (game.turn === (game?.player_color || 'w')) {
      document.title = '♟ Your Turn — ChessWithClaw';
    } else {
      document.title = `⚡ ${agentName} Thinking...`;
    }
  }, [game]);



  useEffect(() => {
    if (game?.agent_connected) {
      connectedToastShown.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  useEffect(() => {
    if (game && prevAgentConnected.current === false && game.agent_connected === true && connectedToastShown.current === false) {
      const toastKey = `cwc_connected_${gameId}`;
      if (!sessionStorage.getItem(toastKey)) {
        toast.success(`${agentName} has arrived!`);
        sessionStorage.setItem(toastKey, '1');
      }
      setJustConnected(true);
      setTimeout(() => setJustConnected(false), 1000);
      connectedToastShown.current = true;
    }
    if (game) {
      prevAgentConnected.current = game.agent_connected;
    }
  }, [game, toast, agentName, gameId]);
  
  const handleRealtimeUpdate = useCallback((payload) => {
    const incoming = payload.new || payload;

    setGame(prev => {
      if (!prev) return prev;
      
      if (incoming.move_history && prev.move_history && incoming.move_history.length < prev.move_history.length) {
        return prev;
      }
      return { ...prev, ...incoming };
    });
    
    // 1. Update board position with sound (fixes frozen board + no sound)
    if (incoming.fen) {
      const prevFen = boardFenRef?.current || '';
      const prevPosition = prevFen.split(' ')[0];
      const newPosition = incoming.fen.split(' ')[0];
      if (newPosition !== prevPosition) {
        applyBoardFen(incoming.fen);
        // Sound: if previous turn was 'b', agent just moved
        if (prevFen.includes(' ') && prevFen.split(' ')[1] === 'b') {
          const isCapture = incoming.last_move?.captured || incoming.last_move?.flags?.includes('c') || (typeof incoming.last_move === 'string' && incoming.last_move.includes('x')) || (incoming.last_move?.san && incoming.last_move.san.includes('x'));
          setTimeout(() => { try { playSound(isCapture ? 'capture' : 'move'); } catch(e) {} }, 60);
        }
        
        // 6. Piece style (only update from Realtime on moves, not on standalone events)
        if (incoming.piece_style && incoming.piece_style !== pieceStyle) {
          const localStyle = localStorage.getItem('cwc_piece_style');
          // Only apply DB value if it MATCHES what the user last explicitly set.
          // This prevents a Realtime confirmation of an in-flight async write
          // from reverting the user's freshly-chosen style back to the old DB value.
          if (!localStyle || incoming.piece_style === localStyle) {
            setPieceStyle(incoming.piece_style);
          }
        }
        // 7. Board theme
        if (incoming.board_theme && incoming.board_theme !== boardTheme) {
          setBoardTheme(incoming.board_theme);
          localStorage.setItem('cwc_board_theme', incoming.board_theme);
          localStorage.setItem('cwc_theme', incoming.board_theme);
        }
      }
    }

    // 2. Update move history
    if (Array.isArray(incoming.move_history)) {
      setMoveHistory(incoming.move_history);
    }

    // 3. Show companion thought with 4-second fade
    if (incoming.companion_thought && incoming.companion_thought.trim() !== '') {
      if (typeof showThought === 'function') {
        showThought(incoming.companion_thought);
      } else {
        setThoughtText(incoming.companion_thought.trim());
        setThoughtVisible(true);
        if (thoughtTimerRef?.current) clearTimeout(thoughtTimerRef.current);
        thoughtTimerRef.current = setTimeout(() => setThoughtVisible(false), 4000);
      }
    }

    // 6. Do NOT overwrite thought_language from Realtime
    // (user's local selection takes priority — the DB will sync via API)

    if (Array.isArray(incoming.chat_history)) {
      setChatMessages(incoming.chat_history);
    }

    if (drawOfferPending) {
      if (incoming.draw_offer_pending === false && incoming.status !== 'finished') {
        setDrawOfferPending(false);
        setDrawDeclined(true);
        setTimeout(() => setDrawDeclined(false), 5000);
        toast(`${game?.agent_name || 'Agent'} declined the draw. Game continues!`, {
          style: { background: '#111111', border: '1px solid rgba(230,57,70,0.3)', color: '#f2f2f2' }
        });
      } else if (incoming.status === 'finished') {
        setDrawOfferPending(false);
      }
    }
  }, [boardTheme, pieceStyle, playSound, setMoveHistory, setBoardTheme, setPieceStyle, setChatMessages, applyBoardFen, showThought, drawOfferPending, toast, game?.agent_name]);

  useEffect(() => {
    if (!gameId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    loadGameData();
    
    const handleBeforeUnload = () => {
      getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastKnownFenRef.current = null;
        loadGameData();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
      try { getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({ human_connected: false }).eq('id', gameId); } catch(e) {}
    };
  }, [gameId, loadGameData]);

  useEffect(() => {
    if (!gameId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel('game-' + gameId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'games', filter: 'id=eq.' + gameId
      }, (payload) => handleRealtimeUpdate(payload.new || payload))
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    if (Array.isArray(game?.chat_history) && game.chat_history.length > 0) {
      setChatMessages(game.chat_history);
    }
  }, [game?.chat_history]);

  useEffect(() => {
    if ((game?.status === 'finished' || game?.status === 'abandoned') && !bestQuote && !isGeneratingQuote) {
      setIsGeneratingQuote(true);
      fetch('/api/social?type=quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: game.agent_name,
          result: game.result,
          chatHistory: chatMessages
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.quote) setBestQuote(data.quote);
        setIsGeneratingQuote(false);
      })
      .catch(() => {
        setBestQuote("Good game.");
        setIsGeneratingQuote(false);
      });
    }
  }, [game?.status, bestQuote, isGeneratingQuote, chatMessages, game?.agent_name, game?.result]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && gameId) {
        supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single()
          .then(({ data: freshData }) => {
            if (!freshData) return;
            if (freshData.fen) applyBoardFen(freshData.fen);
            if (Array.isArray(freshData?.move_history)) {
              setMoveHistory(freshData.move_history);
            }
            if (freshData.board_theme) setBoardTheme(freshData.board_theme);
            setGame(freshData);
          });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameId, applyBoardFen, setMoveHistory, setBoardTheme, setGame]);

  // Start fallback polling when it&apos;s agent&apos;s turn
  useEffect(() => {
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      intervalsRef.current = intervalsRef.current.filter(x => x !== fallbackRef.current);
    }

    if (game?.status === 'active' && game?.turn !== (game?.player_color || 'w') && isTabActive) {
      fallbackRef.current = addInterval(async () => {
        try {
          const res = await fetch(`/api/state?gameId=${gameId}`);
          if (!res.ok) return;
          const fresh = await res.json();
          if (!fresh || movePendingRef.current) return;
          setGame(prev => {
            if (!prev) return prev;
            if (fresh.move_history && prev.move_history && fresh.move_history.length < prev.move_history.length) {
              return prev;
            }
            if (fresh.fen) {
              lastProcessedFenRef.current = fresh.fen;
              applyBoardFen(fresh.fen);
            }
            if (fresh.last_move) {
              setBoardLastMove(fresh.last_move);
            }
            return { ...prev, ...fresh };
          });
        } catch (e) {}
      }, 1000);
    } else {
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        intervalsRef.current = intervalsRef.current.filter(x => x !== fallbackRef.current);
        fallbackRef.current = null;
      }
    }
    
    return () => {
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        intervalsRef.current = intervalsRef.current.filter(x => x !== fallbackRef.current);
      }
    };
  }, [game?.turn, game?.status, game?.fen, gameId, boardTheme, pieceStyle, isTabActive, addInterval, boardFen, applyBoardFen, game?.player_color, setBoardLastMove]);

  // Handle window focus and visibility change to immediately sync states
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setIsTabActive(false);
        // Pause: clear all intervals except heartbeat (which is in heartbeatRef.current)
        intervalsRef.current.forEach(clearInterval);
        intervalsRef.current = [];
      } else {
        setIsTabActive(true);
        const fetchFreshGameState = async () => {
          try {
            const res = await fetch(`/api/state?gameId=${gameId}`);
            if (!res.ok) return;
            const fresh = await res.json();
            setGame(prev => {
              if (!prev) return prev;
              if (fresh.move_history && prev.move_history && fresh.move_history.length < prev.move_history.length) {
                return prev;
              }
              if (fresh.fen) {
                lastProcessedFenRef.current = fresh.fen;
                applyBoardFen(fresh.fen);
              }
              if (fresh.last_move) {
                setBoardLastMove(fresh.last_move);
              }
              return { ...prev, ...fresh };
            });
          } catch (e) {}
        };
        fetchFreshGameState();
      }
    };
    
    const handleFocus = async () => {
      if (document.hidden || game?.status !== 'active') return;
      try {
        const res = await fetch(`/api/state?gameId=${gameId}`);
        if (!res.ok) return;
        const fresh = await res.json();
        setGame(prev => {
          if (!prev) return prev;
          if (fresh.move_history && prev.move_history && fresh.move_history.length < prev.move_history.length) {
            return prev;
          }
          if (fresh.fen) {
            lastProcessedFenRef.current = fresh.fen;
            applyBoardFen(fresh.fen);
          }
          if (fresh.last_move) {
            setBoardLastMove(fresh.last_move);
          }
          return { ...prev, ...fresh };
        });
      } catch (e) {}
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [gameId, game?.status, game?.fen, applyBoardFen, setBoardLastMove]);

  const handleResign = useCallback(async () => {
    if (!confirmResign) {
      setConfirmResign(true);
      setTimeout(() => setConfirmResign(false), 3000);
      return;
    }
    const victimResult = game?.player_color === 'b' ? 'white' : 'black';
    setGame(prev => ({ ...prev, status: 'finished', result: victimResult, result_reason: 'resignation' }));
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: victimResult, result_reason: 'resignation'
    }).eq('id', gameId);
    setShowSettings(false);
    setConfirmResign(false);
  }, [confirmResign, game?.player_color, gameId]);

  const handleDraw = useCallback(async () => {
    if (!confirmDraw) {
      setConfirmDraw(true);
      setTimeout(() => setConfirmDraw(false), 3000);
      return;
    }
    // Draw logic removed
    setShowSettings(false);
    setConfirmDraw(false);
  }, [confirmDraw]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in chat
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      
      if (e.key === 'h' || e.key === 'H') {
        setMoveHistoryOpen(prev => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.focus();
      } else if (e.key === 'R' && e.shiftKey) {
        handleResign();
      } else if (e.key === 'D' && e.shiftKey) {
        handleDraw();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmResign, confirmDraw, handleDraw, handleResign]);

  const handleIllegalMove = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 420);
  }, []);

  const handleCapture = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 300);
  }, []);

  const handlePlayerMove = useCallback(async (from, to, promotion) => {
    if (!game || game.turn !== (game?.player_color || 'w') || (game.status !== 'active' && game.status !== 'waiting')) return;
    if (!agentConnected) {
      toast('Waiting for agent to connect...');
      return;
    }
    if (boardLocked || submittingRef.current) return;
    
    if (!localStorage.getItem(`game_owner_${gameId}`)) {
      toast.error('You are not the creator of this game.');
      return;
    }

    submittingRef.current = true;
    setBoardLocked(true);

    const moveStr = from + to + (promotion || '');
    
    // Compute new FEN using chess.js before API call
    let newFen = boardFen;
    let isCapture = false;
    try {
      const tempChess = new Chess(boardFen);

      const result = tempChess.move({ from, to, promotion: promotion || 'q' });
      if (result) {
        newFen = tempChess.fen();
        isCapture = result.captured || result.san?.includes('x');
      } else {
        handleIllegalMove();
        submittingRef.current = false;
        setBoardLocked(false);
        return;
      }
    } catch (e) {
      handleIllegalMove();
      submittingRef.current = false;
      setBoardLocked(false);
      return;
    }
    
    // Mark pending so Realtime doesn't re-animate
    movePendingRef.current = true;
    lastMoveFenRef.current = newFen;
    
    // Update ONLY board display (not game state)
    const prevBoardFen = boardFen;
    const prevBoardLastMove = boardLastMove;

    applyBoardFen(newFen);
    lastProcessedFenRef.current = newFen;
    setBoardLastMove({ from, to });
    
    // Call API without touching game state
    playSound(isCapture ? 'capture' : 'move');
    if (isCapture) {
      setShakeActive(true);
      setTimeout(() => setShakeActive(false), 300);
    }
    try {
      const res = await fetch('/api/move', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({ 
          id: gameId, 
          move: moveStr,
          isHumanMove: true
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // Revert board on error
        applyBoardFen(prevBoardFen);
        lastProcessedFenRef.current = prevBoardFen;
        setBoardLastMove(prevBoardLastMove);
        movePendingRef.current = false;
        
        const agentName = (game?.agent_name && game?.agent_name !== 'Your Agent') ? game.agent_name : 'Your Agent';
        if (errData.code === 'WAITING_FOR_AGENT') {
          toast(`Waiting for ${agentName} to join...`, {
            icon: <LobsterEmoji />,
            style: { background: '#111111', border: '1px solid rgba(230,57,70,0.3)', color: '#f2f2f2' }
          });
        } else if (errData.code === 'TURN_CONFLICT') {
           toast.error('Move already processed');
        } else {
           toast.error(errData.error || 'Failed to submit move');
        }
      } else {
        const result = await res.json().catch(() => ({}));
        if (result && result.game) {
          setGame(prev => {
            if (!prev) return prev;
            if (result.game.move_history && prev.move_history && prev.move_history.length > result.game.move_history.length) {
              return prev; // Ignore older game state
            }
            const updated = { ...prev, ...result.game };
            if (result.game.move_history) {
              setMoveHistory(result.game.move_history);
            }
            return updated;
          });
          setGame(prev => {
            // Need to apply FEN only if we actually accepted this result
            if (prev.fen === result.game.fen || (result.game.move_history && prev.move_history && prev.move_history.length === result.game.move_history.length)) {
              applyBoardFen(result.game.fen);
              lastProcessedFenRef.current = result.game.fen;
              if (result.game.last_move) {
                setBoardLastMove(result.game.last_move);
              }
            }
            return prev;
          });
          movePendingRef.current = false;
        }
      }
    } catch (e) {
      // Revert board on error
      applyBoardFen(prevBoardFen);
      lastProcessedFenRef.current = prevBoardFen;
      setBoardLastMove(prevBoardLastMove);
      movePendingRef.current = false;
    } finally {
      submittingRef.current = false;
      setBoardLocked(false);
    }
  }, [game, boardLocked, gameId, toast, playSound, boardFen, boardLastMove, applyBoardFen, agentConnected, setMoveHistory, setBoardLastMove, handleIllegalMove]);

  const sendMessage = async (e) => {
    e?.preventDefault();
    const msgText = chatInput.trim();
    if (!msgText) return;
    setChatInput('');
    const repMsgId = replyingTo?.id || null;
    setReplyingTo(null);
    
    // Add message optimistically to display immediately
    const optimisticMsg = {
      id: `opt-${Date.now()}`,
      role: 'human',
      sender: 'human',
      message: msgText,
      text: msgText,
      reply_to: repMsgId,
      timestamp: new Date().toISOString(),
      reactions: {},
      ts: Date.now()
    };
    
    setLocalMessages(prev => [...prev, optimisticMsg]);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
      },
      body: JSON.stringify({ gameId: gameId, game_id: gameId, text: msgText, sender: 'human', role: 'human', reply_to: repMsgId })
    }).catch(() => {});
  };



  async function acceptAgentResignation() {
    const winnerResult = game?.player_color === 'b' ? 'black' : 'white';
    setGame(prev => ({ ...prev, status: 'finished', result: winnerResult, result_reason: 'resignation' }));
    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
      status: 'finished', result: winnerResult, result_reason: 'resignation'
    }).eq('id', gameId);
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(gameId);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  }

  function copyInvite() {
    const url = `${window.location.origin}/Agent?id=${gameId}${agentToken ? `&token=${agentToken}` : ''}`;
    navigator.clipboard.writeText(url);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  }


  function handleGoHome(e) { 
    if (game?.status === 'active') {
      if (e && e.preventDefault) e.preventDefault();
      setShowLeaveWarning(true);
    } else {
      navigate('/');
    }
  }
  function handleOpenSettings() { setShowSettings(true) }
  function handleToggleAgentSection() { setAgentSectionOpen(prev => !prev) }
  function handleToggleMoveHistory() { setMoveHistoryOpen(prev => !prev) }
  function handleCloseGameOverModal() { setShowGameOver(false) }
  const handleShareResult = () => {
    const agentName = (game?.agent_name && game?.agent_name !== 'Your Agent') ? game.agent_name : 'Your Agent';
    const moveCount = Array.isArray(game?.move_history) ? game.move_history.length : 0;
    const playerColorFull = game?.player_color === 'w' ? 'white' : 'black';
    const isWin = game?.winner === playerColorFull;
    const isDraw = !game?.winner || game?.result === 'draw' || game?.result === 'stalemate';
    
    // Invert caps if user is black
    const whiteCaps = (() => {
      if (!game?.fen) return 0;
      const b = game.fen.split(' ')[0];
      return 15 - (b.match(/[qrbnp]/g)||[]).length;
    })();
    const blackCaps = (() => {
      if (!game?.fen) return 0;
      const b = game.fen.split(' ')[0];
      return 15 - (b.match(/[QRBNP]/g)||[]).length;
    })();
    const userCaps = game?.player_color === 'b' ? blackCaps : whiteCaps;
    const agentCaps = game?.player_color === 'b' ? whiteCaps : blackCaps;

    const resultWord = isWin ? 'DEFEATED' : isDraw ? 'SURVIVED' : 'BENT THE KNEE TO';
    const resultEmoji = isWin ? '👑' : isDraw ? '🤝' : '💀';

    const origin = window.location.origin;

    const shareText = [
      `I just played a match against ${game?.agent_name || 'my agent'} on ChessWithClaw! 🦞`,
      ``,
      `📋 Result: ${isWin ? 'Victory' : isDraw ? 'Stalemate' : 'Defeated'} (${isWin ? 'You won' : isDraw ? 'Draw' : (agentName + ' won')})`,
      `♟️ Moves: ${moveCount}`,
      `🔴 Ended by: ${game?.result_reason || game?.result || 'agreement'}`,
      ``,
      `Most chess sites let you play against an bot.`,
      ``,
      `This one lets you bring your own agent.`,
      ``,
      `Think your agent can beat you? Bring your agent & challange here:`,
      ``,
      `https://chesswithclaw.vercel.app`,
      ``,
      `#ChessWithClaw #Chess`
    ].join('\n');

    if (navigator.share) {
      navigator.share({
        title: `Chess vs ${agentName} — Agent`,
        text: shareText,
      }).catch(() => {
        navigator.clipboard?.writeText(shareText);
        toast.success("Result copied to clipboard!");
      });
    } else {
      navigator.clipboard?.writeText(shareText);
      toast.success("Result copied to clipboard!");
    }
  };

  function handleLogoError(e) {
    e.target.style.display = 'none';
  }

  function handleGoHomeWithRipple(e) {
    createRipple(e);
    handleGoHome();
  }

  function handleCopyInviteWithRipple(e) {
    createRipple(e);
    copyInvite();
  }

  function handleChatInputChange(e) {
    setChatInput(e.target.value);
    setIsUserTyping(true);
    
    // Notify server of human typing status
    if (!userSentTypingRef.current) {
      userSentTypingRef.current = true;
      fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({ gameId, game_id: gameId, action: 'typing', typing: true, sender: 'human', role: 'human' })
      }).catch(() => {});
    }

    if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
    userTypingTimerRef.current = setTimeout(() => {
      setIsUserTyping(false);
      userSentTypingRef.current = false;
      fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
        },
        body: JSON.stringify({ gameId, game_id: gameId, action: 'typing', typing: false, sender: 'human', role: 'human' })
      }).catch(() => {});
    }, 2000);
  }

  const renderMoveWithPiece = (move, isWhiteMove) => {
    if (!move || !move.san) return '';
    const { letter, rest } = sanToPieceImg(move.san, isWhiteMove, pieceStyle);
    const imgUrl = getPieceImageUrl(letter, isWhiteMove, pieceStyle);
    if (!letter) return <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:13, color:'#f2f2f2'}}>{rest}</span>;
    return (
      <span style={{display:'inline-flex', alignItems:'center', gap:3}}>
        <img
          src={imgUrl}
          alt=""
          loading="eager"
          decoding="async"
          style={{width:16, height:16, objectFit:'contain', flexShrink:0, minWidth:16, opacity: 0, transition: 'opacity 0.15s ease'}}
          onLoad={(e) => { e.target.style.opacity = '1'; }}
          onError={(e) => {
            if (!e.target.dataset.fallback) {
              e.target.dataset.fallback = '1';
              const colorChar = isWhiteMove ? 'w' : 'b';
              e.target.src = `https://lichess1.org/assets/piece/cburnett/${colorChar}${letter}.svg`;
            }
          }}
        />
        <span style={{fontFamily:'JetBrains Mono, monospace', fontSize:13, color:'#f2f2f2'}}>{rest}</span>
      </span>
    );
  };

  function getMaterialBalance(fen) {
    if (!fen || typeof fen !== 'string' || !fen.includes(' ')) return 0;
    const board = fen.split(' ')[0];
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let white = 0, black = 0;
    for (const ch of board) {
      const lower = ch.toLowerCase();
      if (values[lower]) {
        if (ch === ch.toUpperCase()) white += values[lower];
        else black += values[lower];
      }
    }
    return white - black;
  }

  function getCapturedPieces(fen) {
    const start = { p:8, n:2, b:2, r:2, q:1 };
    const board = (fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR').split(' ')[0];
    const cur = {P:0,N:0,B:0,R:0,Q:0,p:0,n:0,b:0,r:0,q:0};
    for (const ch of board) { if (cur[ch] !== undefined) cur[ch]++; }
    const byCaptured = [];
    const wCaptured = [];
    ['p','n','b','r','q'].forEach(p => {
      const gone = start[p] - cur[p];
      for (let i = 0; i < gone; i++) byCaptured.push(p);
    });
    ['P','N','B','R','Q'].forEach(p => {
      const gone = start[p.toLowerCase()] - cur[p];
      for (let i = 0; i < gone; i++) wCaptured.push(p);
    });
    return { whiteCaptured: wCaptured, blackCaptured: byCaptured };
  }

  const { whiteCaptured, blackCaptured } = getCapturedPieces(boardFen);
  const pieceImgUrl = (pieceCode, style) => {
    const pieceStyle = style || localStorage.getItem('cwc_piece_style') || 'neo';
    const isWhite = pieceCode === pieceCode.toUpperCase();
    const colorPrefix = isWhite ? 'w' : 'b';
    const pieceType = pieceCode.toLowerCase();
    return `https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/pieces/${pieceStyle}/${colorPrefix}${pieceType}.png`;
  };

  const balance = getMaterialBalance(boardFen);
  const youAdvantage = game?.player_color === 'w' ? balance : -balance;

  const [legalMoves, setLegalMoves] = useState([]);

  useEffect(() => {
    if (!game?.fen) return;
    try {
      const chess = new Chess(game.fen);
      const moves = chess.moves({ verbose: true })
        .map(m => m.from + m.to + (m.promotion || ''));
      setLegalMoves(moves);
    } catch (e) {
      setLegalMoves([]);
    }
  }, [game?.fen]);

  const legalMovesArray = legalMoves;

  useEffect(() => {
    if (game?.chat_history && Array.isArray(game.chat_history)) {
      setChatMessages(game.chat_history.slice(-50));
      const serverTexts = new Set(game.chat_history.map(m => m.text || m.message || m.content));
      setLocalMessages(prev => prev.filter(m => !serverTexts.has(m.text || m.message || m.content)));
    }
  }, [game?.chat_history]);

  useEffect(() => {
    if (game?.last_move) {
      setLastMoveHighlight({
        from: game.last_move.from || game.last_move.from_square,
        to: game.last_move.to || game.last_move.to_square
      });
    }
  }, [game?.id, game?.last_move]);

  const moveHistoryItems = useMemo(() => {
    return (game?.move_history || []).map((move, i) => ({
      ...move, index: i
    }));
  }, [game?.move_history]);

  const isOpenClawTurn = trueTurn === ((game?.player_color || 'w') === 'w' ? 'black' : 'white') && game?.status === 'active';

  useEffect(() => {
    if (game?.status === 'active') {
      localStorage.setItem('cwc_active_game', JSON.stringify({
        gameId: gameId,
        agentName: game.agent_name || 'Your Agent',
        savedAt: Date.now(),
        fen: game.fen,
        status: game.status,
        turn: game.turn,
        player_color: game.player_color,
        move_history: game.move_history,
        chat_history: game.chat_history,
        agent_connected: game.agent_connected,
        companion_thought: game.companion_thought,
        board_theme: game.board_theme,
        piece_style: game.piece_style
      }));
    } else if (game?.status === 'finished' || game?.status === 'abandoned') {
      localStorage.removeItem('cwc_active_game');
    }
  }, [game, gameId]);

  if (!game) {
    return (
      <div className="flex flex-col relative min-h-screen bg-black text-white selection:bg-red-500/30">
        <header className="h-16 sticky top-0 z-50 glass border-b border-white/5 py-3 px-4 lg:px-8 flex items-center justify-between shrink-0 bg-black/80 backdrop-blur-xl">
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw Logo" 
            draggable={false}
            style={{ 
              width: '150px', 
              height: 'auto', 
              objectFit: 'contain', 
              flexShrink: 0, 
              display: 'block',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              pointerEvents: 'none'
            }} 
          />
        </header>

        <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden pb-12 lg:pb-0">
          <div className="flex-none lg:flex-1 flex flex-col lg:overflow-hidden relative z-10">
            {/* Agent section: a 48px × 48px circle + a 120px × 14px rectangle next to it */}
            <div className="h-[72px] border-b border-white/5 flex items-center px-4 gap-3">
              <div style={{ ...skeletonStyle, width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ ...skeletonStyle, width: '120px', height: '14px' }} />
            </div>
            
            {/* Board: a square div with full board dimensions, no pieces */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
              <div className="w-full max-w-[400px] aspect-square" style={{ ...skeletonStyle, borderRadius: '8px' }} />
            </div>
          </div>

          <div className="w-full lg:w-[360px] shrink-0 flex flex-col bg-black/60 backdrop-blur-md border-t lg:border-t-0 lg:border-l border-white/5 relative z-10 transition-all">
            {/* Chat: three skeleton message bubbles (alternating left/right alignment) */}
            <div className="flex-1 flex flex-col p-4 gap-4 justify-end mb-4 min-h-[220px]">
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div style={{ ...skeletonStyle, width: '60%', height: '48px', borderRadius: '12px 12px 12px 4px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                <div style={{ ...skeletonStyle, width: '50%', height: '36px', borderRadius: '12px 12px 4px 12px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div style={{ ...skeletonStyle, width: '70%', height: '40px', borderRadius: '12px 12px 12px 4px' }} />
              </div>
            </div>
            
            {/* Move history: 3 skeleton rows (100% wide, 12px tall each) */}
            <div className="h-[140px] flex flex-col gap-3 justify-center border-t border-white/5 bg-[#111111] p-4">
              <div style={{ ...skeletonStyle, width: '100%', height: '12px' }} />
              <div style={{ ...skeletonStyle, width: '100%', height: '12px' }} />
              <div style={{ ...skeletonStyle, width: '100%', height: '12px' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#0a0a0a',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #111111', borderTop: '3px solid #e63946'
        }} className="animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white selection:bg-red-500/30 p-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full pointer-events-none transition-colors duration-1000" style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.1) 0%, rgba(0,0,0,0) 70%)' }} />
        <div className="relative z-10 flex flex-col items-center gap-6 glass border-white/10 p-12 rounded-2xl max-w-md text-center glow-anim">
          <div className="text-5xl drop-shadow-md text-[#e63946]"><span style={{fontSize: '48px'}}><LobsterEmoji /></span></div>
          <div className="font-sans text-3xl font-bold tracking-wide">Game not found</div>
          <div className="text-neutral-400 text-sm font-sans">
            It looks like this game doesn&apos;t exist anymore or you have the wrong link.
          </div>
          <button 
            data-testid="home-button"
            onClick={handleGoHomeWithRipple} 
            className="mt-2 text-white font-semibold flex items-center justify-center py-3 px-8 rounded-xl w-full transition-all active:scale-95 design-btn-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const isSpectator = !localStorage.getItem(`game_owner_${gameId}`);
  const isMyTurn = !isSpectator && game?.turn === (game?.player_color || 'w') && (game?.status === 'active' || game?.status === 'waiting');
  
  if (!game) return null;

  const renderChatMessages = () => {
    const msgs = normalizedMessages;
    return (
      <div style={{ paddingBottom: '10px' }}>
        {msgs.map((msg, index) => {
          if (!msg) return null;
          const isAgent = msg.role === 'agent' || msg.sender === 'agent' || (msg.role !== 'human' && msg.sender !== 'human');
          const isNew = index >= seenMsgCountRef.current;
          const prevMsg = msgs[index - 1];
          const isFirstInGroup = !prevMsg || prevMsg.role !== msg.role;

          if (msg.type === 'resign_request') {
            return (
              <div key={msg.id} style={{ alignSelf: 'flex-start', background: '#111111', border: '1px solid #222', color: 'rgba(242,242,242,0.85)', borderRadius: '10px 10px 10px 3px', padding: '7px 12px', maxWidth: '75%', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.5 }}>
                {msg.text || msg.message || msg.content}
                {game.status === 'active' && (
                  <button data-testid="accept-resignation-button" onClick={acceptAgentResignation} className="block w-full mt-2 text-white border-none rounded py-2 font-sans text-xs font-bold cursor-pointer active:scale-95 transition-all design-btn-primary">Accept Resignation</button>
                )}
              </div>
            );
          }
          if (msg.type === 'draw_offer') {
            return (
              <div key={msg.id} style={{ alignSelf: 'flex-start', background: '#111111', border: '1px solid #222', color: 'rgba(242,242,242,0.85)', borderRadius: '10px 10px 10px 3px', padding: '7px 12px', maxWidth: '75%', fontFamily: "'Inter', sans-serif", fontSize: '13px', lineHeight: 1.5 }}>
                {msg.text || msg.message || msg.content}
                {game.status === 'active' && (
                  <button data-testid="accept-draw-button" onClick={async () => {
                    setGame(prev => ({ ...prev, status: 'finished', result: 'draw', result_reason: 'agreement' }));
                    await getSupabaseWithToken(localStorage.getItem(`game_owner_${gameId}`)).from('games').update({
                      status: 'finished', result: 'draw', result_reason: 'agreement'
                    }).eq('id', gameId);
                  }} className="block w-full mt-2 text-white border-none rounded py-2 font-sans text-xs font-bold cursor-pointer active:scale-95 transition-all design-btn-success">Accept Draw</button>
                )}
              </div>
            );
          }
        
          // Get human's reaction to this message (if any)
          const myReaction = Object.entries(msg.reactions || {}).find(
            ([emoji, reactors]) => Array.isArray(reactors) && reactors.includes('human')
          );
          // Get agent&apos;s reaction to this message (if any)
          const agentReaction = Object.entries(msg.reactions || {}).find(
            ([emoji, reactors]) => Array.isArray(reactors) && reactors.includes('agent')
          );
        
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isAgent ? 'flex-start' : 'flex-end',
                marginBottom: '2px',
                paddingBottom: (myReaction || agentReaction) ? '18px' : '4px',
                position: 'relative',
                animation: isNew ? 'msgIn 0.2s ease-out' : 'none'
              }}
            >
              {/* Agent name above first bubble in group */}
              {isAgent && isFirstInGroup && (
                <span style={{
                  fontSize: '11px',
                  color: 'rgba(242,242,242,0.35)',
                  marginBottom: '3px',
                  marginLeft: '4px',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  {agentName}
                </span>
              )}
        
              {/* Selection Indicator */}
              {selectMode && (
                <div style={{
                  width:18, height:18, borderRadius:'50%', flexShrink:0,
                  border:'1.5px solid rgba(242,242,242,0.3)',
                  background: selectedIds.has(msg.id) ? '#e63946' : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {selectedIds.has(msg.id) && <span style={{color:'#f2f2f2', fontSize:11}}>✓</span>}
                </div>
              )}

              {/* Message bubble */}
              <div
                onClick={() => { if (selectMode) toggleMessageSelection(msg.id); }}
                onTouchStart={handleMsgTouchStart(msg)}
                onTouchEnd={handleMsgTouchEnd}
                onTouchMove={handleMsgTouchMove}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  background: isAgent ? 'rgba(255,255,255,0.04)' : 'rgba(230,57,70,0.12)',
                  color: '#f2f2f2',
                  borderRadius: isAgent
                    ? '2px 4px 4px 4px'
                    : '4px 4px 2px 4px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  border: isAgent ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(230,57,70,0.2)',
                  maxWidth: '78%',
                  wordBreak: 'break-word',
                  position: 'relative',
                  cursor: isAgent ? 'pointer' : 'default',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none',
                }}
              >
                {msg.reply_to && (() => {
                  const original = normalizedMessages.find(m => m.id === msg.reply_to);
                  if (!original) return null;
                  return (
                    <div style={{
                      borderLeft:'2px solid rgba(230,57,70,0.5)', paddingLeft:8, marginBottom:4,
                      fontSize:12, color:'rgba(242,242,242,0.45)', overflow:'hidden',
                      whiteSpace:'nowrap', textOverflow:'ellipsis', maxWidth:200,
                    }}>
                      {original.message || original.text}
                    </div>
                  );
                })()}
                {msg.message || msg.text || msg.content || ''}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div style={{display:'flex', gap:3, marginTop:4, flexWrap:'wrap'}}>
                    {Object.entries(msg.reactions).map(([emoji, reactors]) =>
                      Array.isArray(reactors) && reactors.length > 0 ? (
                        <span key={emoji} style={{
                          fontSize:12,
                          background: reactors.includes('human') ? 'rgba(230,57,70,0.15)' : 'rgba(255,255,255,0.06)',
                          border: reactors.includes('human') ? '1px solid rgba(230,57,70,0.3)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius:10,
                          padding:'2px 7px',
                          display:'inline-flex',
                          alignItems:'center',
                          gap:3,
                          cursor:'pointer',
                        }}
                        onClick={(e) => { e.stopPropagation(); sendReaction(msg.id, emoji); }}
                        >
                          {renderReactionIcon(emoji, reactors.includes('human'))}{reactors.length > 1 && <span style={{fontSize:11,color:'rgba(242,242,242,0.5)'}}>{reactors.length}</span>}
                        </span>
                      ) : null
                    )}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'rgba(242,242,242,0.25)', marginTop: 3, textAlign: msg.role === 'human' ? 'right' : 'left' }}>
                  {msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
        
              {/* Instagram-style reaction below bubble */}
              {(myReaction || agentReaction) && (
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  [isAgent ? 'left' : 'right']: '8px',
                  display: 'flex',
                  gap: '2px'
                }}>
                  {myReaction && (
                    <span
                      style={{
                        background: '#1e1e1e',
                        border: '1px solid #111111',
                        borderRadius: '100px',
                        padding: '4px 6px',
                        animation: 'reactionPop 0.3s ease-out',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        sendReaction(msg.id, myReaction[0]);
                      }}
                    >
                      {renderReactionIcon(myReaction[0], true)}
                    </span>
                  )}
                  {agentReaction && agentReaction[0] !== myReaction?.[0] && (
                    <span style={{
                      background: '#1e1e1e',
                      border: '1px solid #111111',
                      borderRadius: '100px',
                      padding: '4px 6px',
                      display: 'flex', alignItems: 'center'
                    }}>
                      {renderReactionIcon(agentReaction[0], false)}
                    </span>
                  )}
                </div>
              )}
        
              {/* Full reaction picker (long press / desktop right click) */}
              {isAgent && activePickerMsgId === msg.id && (
                <div
                  style={{
                    display: 'flex', gap: '4px',
                    background: '#111111', border: '1px solid #111111',
                    borderRadius: '100px', padding: '8px 12px',
                    marginTop: '6px',
                    alignSelf: 'flex-start',
                    animation: 'pickerIn 0.15s ease-out'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {REACTION_ICONS.slice(0, 6).map(({ id, icon }) => (
                    <button key={id} onClick={() => sendReaction(msg.id, id)}
                      style={{background:'none',border:'none',cursor:'pointer',
                              padding:'4px',lineHeight:1, color: '#f2f2f2', display: 'flex', alignItems: 'center'}}>
                      {id === '❤️' ? renderReactionIcon(id, Array.isArray(msg.reactions?.[id]) && msg.reactions[id].includes('human')) : icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {game?.agent_typing && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', minHeight:32, justifyContent: 'flex-start', flexDirection: 'row' }}>
            <div style={{ background: '#111111', border: '1px solid #111111', borderRadius: '16px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}><LobsterEmoji /></span>
              <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(242,242,242,0.6)', animation: `typingWave 1.2s ease-in-out ${delay}s infinite` }}/>
                ))}
              </div>
            </div>
          </div>
        )}
        {isUserTyping && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', minHeight:32, justifyContent: 'flex-end', flexDirection: 'row-reverse' }}>
            <div style={{ background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: '16px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(230,57,70,0.7)', animation: `typingWave 1.2s ease-in-out ${delay}s infinite` }}/>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  return (
    <div 
      ref={containerRef}
      className={`relative text-white font-sans selection:bg-red-500/30 transition-colors duration-700 box-border scrollbar-none`}
      style={{
        height: `${viewportHeight}px`,
        display: 'flex',
        flexDirection: 'column',
        background: isOpenClawTurn
          ? 'radial-gradient(ellipse at 50% 0%, rgba(230,57,70,0.07) 0%, transparent 70%)'
          : 'transparent',
        transition: 'background 0.8s ease',
        position: 'relative'
      }}
    >
      <style>{`
        @keyframes pulseDotGreen {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        @keyframes pulseDotYellow {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        @keyframes pulseDotRed {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
          70% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.9); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes typingWave {
          0%, 60%, 100% { transform: translateY(0) scale(0.8); opacity: 0.3; }
          30% { transform: translateY(-4px) scale(1.1); opacity: 1; }
        }
        @keyframes clawPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.85; }
        }
        @keyframes agentArrive {
          0%   { transform: scale(0.5) translateY(8px); opacity: 0; }
          60%  { transform: scale(1.15) translateY(-3px); opacity: 1; }
          80%  { transform: scale(0.95) translateY(1px); }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes chatMsgIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes messageIn {
          from { opacity: 0; transform: scale(0.85) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes reactIn {
          from { opacity: 0; transform: scale(0); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes gameOverIn {
          from { opacity: 0; transform: scale(0.88) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes popIn {
          from { transform:scale(0.5); opacity:0; }
          to { transform:scale(1); opacity:1; }
        }
        @keyframes resultIconBounce {
          0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes confettiDrop {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
        }
      `}</style>
      {isOffline && (
        <div className="absolute top-0 inset-x-0 bg-red-600 text-white font-semibold text-xs text-center py-1 z-[1000] shadow-[0_0_15px_rgba(220,38,38,0.5)]">
          You are offline. Reconnecting...
        </div>
      )}
      
      {/* HEADER (Fixed) */}
      <header style={{ height: isDesktop ? '52px' : '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #111111', background: '#0a0a0a', zIndex: 50, position: 'sticky', top: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', cursor: 'pointer', transition: 'transform 0.15s ease' }} onClick={handleGoHome} className="active:scale-95">
          <img 
            src="https://jkawzziklwoxfxicbtvf.supabase.co/storage/v1/object/public/assets/logo-v2.png" 
            alt="ChessWithClaw Logo" 
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            style={{ 
              width: '150px', 
              height: 'auto', 
              objectFit: 'contain', 
              flexShrink: 0, 
              display: 'block',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              pointerEvents: 'none',
              filter: 'drop-shadow(0 2px 10px rgba(230,57,70,0.15))'
            }} 
          />
        </div>
        <button 
          data-testid="settings-button"
          onClick={handleOpenSettings}
          className="text-neutral-400 hover:text-white transition-all active:scale-95"
          style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Settings size={20} />
        </button>
      </header>
      {/* MAIN CONTENT AREA - RESPONSIVE */}
      {isDesktop ? (
        <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100dvh - 52px)', overflow: 'hidden', gap: '0' }}>
          {/* LEFT DESKTOP COLUMN */}
          <div style={{ width: 'min(58%, calc(100dvh - 52px))', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '16px 8px 16px 16px', gap: '8px', overflow: 'hidden' }}>
            
            {/* A) AGENT CARD */}
            {(() => {
              const agentHealth = (() => {
                if (!game?.agent_connected || !game?.agent_last_seen) return 'red';
                const secs = (Date.now() - new Date(game.agent_last_seen).getTime()) / 1000;
                if (secs < 45) return 'green';
                if (secs <= 180) return 'amber';
                return 'red';
              })();
              const healthColor = agentHealth === 'green' ? '#10b981' : agentHealth === 'amber' ? '#fbbf24' : '#e63946';
              const agentStatusText = (agentHealth === 'amber' || agentHealth === 'red') ? 'AWAY' : (isOpenClawTurn ? 'FOCUSED' : 'AVAILABLE');

              return (
                <div style={{ 
                  flexShrink: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px 16px', 
                  background: '#111111', 
                  border: `2px solid ${healthColor}`, 
                  borderRadius: '12px', 
                  boxShadow: isOpenClawTurn ? '0 0 35px rgba(230,57,70,0.08)' : 'none', 
                  animation: agentCooking ? 'coldGlitch 2.5s infinite' : (isOpenClawTurn ? 'agentBreathe 2s ease-in-out infinite' : 'none'),
                  transition: 'box-shadow 0.7s ease, border-color 0.3s ease' 
                }}>
                  <span style={{
                    fontSize: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    userSelect: 'none',
                    transform: emojiAnimating ? 'scale(1.35)' : 'scale(1)',
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}>
                    {displayedEmoji}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                    <span 
                      title={agentName}
                      style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: 'none', border: 'none', padding: 0, outline: 'none', textAlign: 'left' }}
                    >
                      {agentName}
                    </span>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 600, color: healthColor, textTransform: 'uppercase', position: 'relative' }}>
                      {agentStatusText}
                      {agentStatusText === 'AWAY' && showAwayTooltip && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                          background: '#222', border: '1px solid #333', borderRadius: '8px',
                          padding: '12px', width: '250px', zIndex: 100,
                          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                          color: '#ccc', fontSize: '12px', lineHeight: 1.4, fontFamily: 'Inter, sans-serif',
                          textTransform: 'none', letterSpacing: 'normal', fontWeight: 400
                        }}>
                          Away just means it&apos;s not actively watching this game right now — not disconnected. It&apos;ll catch up next time it checks in.
                          <button onClick={() => { setShowAwayTooltip(false); localStorage.setItem('cwc_away_tooltip_dismissed', 'true'); }} style={{ display: 'block', marginTop: '8px', color: '#e63946', fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Dismiss</button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}>
                    <div style={{
                      opacity: thoughtVisible ? 1 : 0,
                      transform: thoughtVisible ? 'translateY(0)' : 'translateY(6px)',
                      transition: 'opacity 0.4s ease, transform 0.4s ease',
                      fontStyle: 'italic',
                      fontSize: 13,
                      color: 'rgba(242,242,242,0.6)',
                      lineHeight: 1.5,
                      textAlign: 'right',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {thoughtText ? `"${thoughtText}"` : ''}
                    </div>
                  </div>
                </div>
              );
            })()}
                
            
            {/* B) CHESS BOARD AND EVALUATION ROW */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, position: 'relative' }}>
              <div key={`flash-${yourTurnFlashKey}`} style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                borderRadius: '8px', zIndex: 10,
                animation: yourTurnFlashKey ? 'yourTurnFlash 0.2s ease-out' : 'none'
              }} />
              <div style={{ width: '100%', height: '100%', maxWidth: 'min(100%, calc(100dvh - 52px - 48px - 48px - 48px))', aspectRatio: '1/1', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', height: '100%', width: '100%', alignItems: 'stretch' }}>
                  
                  {/* Live Evaluation Bar */}
                  <div data-testid="evaluation-bar" style={{ width: '14px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: game?.player_color !== 'b' ? '#222222' : '#f2f2f2', position: 'relative', flexShrink: 0, height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, background: game?.player_color !== 'b' ? '#f2f2f2' : '#222222', transformOrigin: 'bottom', transform: `scaleY(${Math.max(10, Math.min(90, 50 + (youAdvantage * 4))) / 100})`, transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)', willChange: 'transform' }} />
                    <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(128,128,128,0.25)', zIndex: 1 }} />
                    
                    <div style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, textAlign: 'center', fontSize: '8px', fontWeight: 800, color: (50 + (youAdvantage * 4)) > 55 ? (game?.player_color !== 'b' ? '#0a0a0a' : '#ffffff') : (game?.player_color !== 'b' ? '#ffffff' : '#0a0a0a'), zIndex: 2, fontFamily: 'monospace' }}>
                      {youAdvantage > 0 ? `+${youAdvantage}` : ''}
                    </div>
                    <div style={{ position: 'absolute', top: '8px', left: 0, right: 0, textAlign: 'center', fontSize: '8px', fontWeight: 800, color: (50 + (youAdvantage * 4)) < 45 ? (game?.player_color !== 'b' ? '#ffffff' : '#0a0a0a') : (game?.player_color !== 'b' ? '#0a0a0a' : '#ffffff'), zIndex: 2, fontFamily: 'monospace' }}>
                      {youAdvantage < 0 ? `+${Math.abs(youAdvantage)}` : ''}
                    </div>
                  </div>

                  {/* Chessboard container */}
                  <div style={{ flex: 1, height: '100%', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                    
                    {isOpenClawTurn && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background: 'radial-gradient(ellipse at center, rgba(230,57,70,0.04) 0%, transparent 70%)',
                        zIndex: 0
                      }} />
                    )}


                    <motion.div 
                      animate={{
                        boxShadow: isOpenClawTurn 
                          ? ['0 0 0 rgba(230,57,70,0)', '0 0 20px rgba(230,57,70,0.2)', '0 0 0 rgba(230,57,70,0)']
                          : '0 4px 20px rgba(0,0,0,0.6)'
                      }}
                      transition={isOpenClawTurn 
                        ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } 
                        : { duration: 0.3 }}
                      style={{ borderRadius: '8px', overflow: 'hidden', width: '100%', height: '100%', position: 'relative', animation: shaking ? 'illegalShake 0.42s cubic-bezier(.36,.07,.19,.97) both' : (shakeActive ? 'captureShake 0.3s ease-in-out' : 'none') }}
                    >
                      <div style={{ pointerEvents: (game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned') ? 'auto' : 'none', opacity: (game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned') ? 1 : 0.7, height: '100%', width: '100%' }}>
                        {!isLoaded ? (
                          <div className="design-card" style={{
                            aspectRatio: '1/1', width: '100%', height: '100%',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px',
                            padding: 0
                          }}>
                            <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                              <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(255,255,255,0.05)', borderRadius: '50%' }} />
                              <div style={{
                                position: 'absolute', inset: 0,
                                border: '3px solid transparent',
                                borderTopColor: '#e63946',
                                borderRadius: '50%',
                                animation: 'spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
                              }} />
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(242,242,242,0.5)', fontFamily: 'Inter, sans-serif' }}>Loading board...</div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', gap: '4px' }}>
                            {/* White's captures (black pieces lost) — shown ABOVE the board */}
                            <div style={{ display: 'flex', gap: '2px', minHeight: '20px', alignItems: 'center', padding: '0 2px', margin: 0, borderRadius: '8px', overflow: 'hidden' }}>
                              {blackCaptured.map((p, i) => (
                                <img key={i} src={pieceImgUrl(p, pieceStyle)} alt="" style={{ width: 20, height: 20, objectFit: 'contain', display: 'block', opacity: 0, transition: 'opacity 0.15s ease' }} onLoad={(e) => { e.target.style.opacity = '1'; }} onError={(e) => { if (!e.target.dataset.fb) { e.target.dataset.fb='1'; e.target.src=`https://lichess1.org/assets/piece/cburnett/b${p}.svg`; } }} />
                              ))}
                            </div>
                            <div style={{ flex: 1, minHeight: 0 }}>
                              <ChessBoard 
                                fen={boardFen}
                                turn={game?.turn}
                                legalMoves={legalMovesArray}
                                lastMove={boardLastMove}
                                arrivedSquare={arrivedSquare}
                                inCheck={Boolean(game?.in_check)}
                                checkedKingSquare={checkedSquare}
                                boardTheme={boardTheme}
                                pieceStyle={pieceStyle}
                                playerColor={game?.player_color || 'w'}
                                gameStatus={game?.status}
                                onMove={handlePlayerMove}
                                disabled={!agentConnected}
                              />
                            </div>
                            {/* Black's captures (white pieces lost) — shown BELOW the board */}
                            <div style={{ display: 'flex', gap: '2px', minHeight: '20px', alignItems: 'center', padding: '0 2px', margin: 0, borderRadius: '8px', overflow: 'hidden' }}>
                              {whiteCaptured.map((p, i) => (
                                <img key={i} src={pieceImgUrl(p, pieceStyle)} alt="" style={{ width: 20, height: 20, objectFit: 'contain', display: 'block', opacity: 0, transition: 'opacity 0.15s ease' }} onLoad={(e) => { e.target.style.opacity = '1'; }} onError={(e) => { if (!e.target.dataset.fb) { e.target.dataset.fb='1'; e.target.src=`https://lichess1.org/assets/piece/cburnett/w${p.toLowerCase()}.svg`; } }} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {(game.status === 'finished' || game.status === 'abandoned') && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-lg">
                        <div className="absolute inset-0 bg-black/85 backdrop-blur-md rounded-lg"></div>
                        <div className="design-card flex flex-col items-center justify-center text-center max-w-sm w-full relative overflow-hidden" style={{ padding: '32px 32px', zIndex: 1 }}>
                          <div className="font-sans text-[28px] font-extrabold text-white tracking-widest drop-shadow-md pb-1">
                            {game.status === 'abandoned' ? 'FAILED' : 'MATCH OVER'}
                          </div>
                          <div className="font-sans text-xs text-[#ff4d5a] font-bold tracking-widest uppercase bg-[#1a0000] px-4 py-1.5 rounded-full border border-red-500/20 shadow-inner mb-6">
                            {(() => {
                              if (game?.status === 'abandoned') return 'Game expired due to inactivity';
                              if (game?.result === 'draw' || game?.result === 'stalemate') return 'Draw';
                              const winColor = game?.winner === 'black' ? 'b' : game?.winner === 'white' ? 'w' : null;
                              const isWin = winColor === (game?.player_color || 'w');
                              return (isWin ? 'You won' : agentName + ' won');
                            })()}
                          </div>

                          {bestQuote && (
                            <div className="w-full bg-[#111111] border border-[#222] rounded-xl p-6 relative overflow-hidden shadow-xl mb-6">
                              <div className="absolute -top-4 -right-4 text-white/5">
                                <Bot size={100} />
                              </div>
                              <div className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-3 text-left relative z-10">{agentName} says:</div>
                              <div className="text-white text-lg font-serif italic mb-6 text-left relative z-10">
                                &quot;{bestQuote}&quot;
                              </div>
                              <div className="flex items-center justify-between pt-4 border-t border-[#222] relative z-10">
                                <div className="text-[10px] text-[#e63946] font-mono font-bold tracking-widest uppercase">
                                  Play this agent
                                </div>
                                <div className="text-white/30 text-[10px] font-mono">
                                  {gameId.substring(0, 8)}
                                </div>
                              </div>
                            </div>
                          )}

                          <button 
                            onClick={() => {
                              const url = `${window.location.origin}/game/${gameId}`;
                              navigator.clipboard.writeText(url);
                              toast('Link copied! Share to challenge others.', { style: { background: '#111111', color: '#f2f2f2' } });
                            }}
                            className="px-6 py-3 w-full bg-[#e63946] text-white text-sm font-bold tracking-wider uppercase rounded-xl shadow-[0_0_20px_rgba(230,57,70,0.2)] hover:bg-[#ff4d5a] hover:scale-105 transition-all flex items-center justify-center gap-2"
                          >
                            <Share2 size={16} />
                            Copy Match Link
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* C) YOU PLAYER CARD REMOVED */}
            
          </div>

          {/* RIGHT DESKTOP COLUMN */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 16px 8px', gap: '10px', overflow: 'hidden', minWidth: 0 }}>
            

        {/* D) CHAT SECTION */}
        {!isLoaded ? (
          <div className="design-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
             <div style={{ width: '24px', height: '24px', opacity: 0.1, background: '#fff', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
             <div style={{ fontSize: '12px', color: 'rgba(242,242,242,0.3)', fontWeight: 500 }}>Connecting secure chat...</div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#111111', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ flexShrink: 0, padding: '10px 12px', fontFamily: "'Inter', sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(242,242,242,0.3)' }}>
              CHAT WITH {agentName.toUpperCase()}
            </div>
            <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', background: '#111111', borderRadius: '12px', margin: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }} className="scrollbar-none scroll-smooth">
              {normalizedMessages.length === 0 ? (
                <div style={{ color: '#111111', fontSize: '13px', textAlign: 'center', margin: 'auto', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }} className="text-[#333]"><LobsterEmoji /></span>
                  <span>{agentName} can chat while playing</span>
                </div>
              ) : (
                renderChatMessages()
              )}
            </div>
            <div style={{ padding: '6px 12px', borderTop: '1px solid #111111', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              {replyingTo && (
                <div style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'rgba(255,255,255,0.03)', borderLeft:'3px solid #e63946',
                  padding:'6px 10px', borderRadius:'4px', marginBottom:6
                }}>
                  <div style={{flex:1, overflow:'hidden'}}>
                    <span style={{fontSize:11, color:'#e63946', fontWeight:600}}>Replying to</span>
                    <div style={{fontSize:12, color:'rgba(242,242,242,0.6)', whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden'}}>
                      {replyingTo.message || replyingTo.text}
                    </div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{background:'transparent', border:'none', color:'rgba(255,255,255,0.5)', padding:4, cursor:'pointer'}}>
                    <XIcon size={14} />
                  </button>
                </div>
              )}
              <form 
                onSubmit={sendMessage} 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '34px' }}
              >
                <input
                id="chat-input"
                data-testid="chat-input"
                type="text"
                value={chatInput}
                onChange={handleChatInputChange}
                placeholder={isSpectator ? "Spectating..." : `Message ${agentName}...`}
                disabled={isSpectator}
                style={{ flex: 1, height: '34px', background: '#111111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f2f2f2', fontFamily: "'Inter', sans-serif", fontSize: '13px', padding: '0 10px', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box' }}
                onFocus={(e) => { e.target.style.borderColor = '#e63946'; e.target.style.boxShadow = 'rgba(0,0,0,0.08) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.16) 0px -0.5px 0px 0px inset, #e63946 0px 0px 0px 1px inset'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
              <button 
                data-testid="chat-send"
                type="submit"
                disabled={isSpectator || !chatInput.trim()}
                style={{ minWidth: 44, minHeight: 44, margin: '-5px 0 -5px 5px', background: (!isSpectator && chatInput.trim()) ? '#e63946' : 'rgba(230,57,70,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (!isSpectator && chatInput.trim()) ? 'pointer' : 'default', border: 'none', color: 'white', flexShrink: 0, boxShadow: (!isSpectator && chatInput.trim()) ? 'rgba(255,255,255,0.15) 0px 1px 0px 0px inset, rgba(0,0,0,0.4) 0px -0.5px 0px 0px inset' : 'none', transition: 'all 0.1s ease' }}
                onMouseDown={(e) => { if(!isSpectator && chatInput.trim()) { e.currentTarget.style.transform = 'scale(0.92)'; } }}
                onMouseUp={(e) => { if(!isSpectator && chatInput.trim()) { e.currentTarget.style.transform = 'scale(1)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Send size={16} />
              </button>
            </form>
            </div>
          </div>
        )}
            

        {/* E) MOVE HISTORY */}
        <div style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', height: '160px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div 
            onClick={() => setMoveHistoryOpen(!moveHistoryOpen)}
            style={{ padding: '0 12px', height: '36px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(242,242,242,0.3)', letterSpacing: '0.06em', display: 'flex', gap: '4px', alignItems: 'center' }}>
              MOVE HISTORY · <SlotText text={String(game.move_history?.length || 0)} animation="snappy" /> MOVES
            </span>
            <ChevronDown size={14} className="text-neutral-500" style={{ transform: moveHistoryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />
          </div>
          {moveHistoryOpen && (
            <div style={{ flex: 1, overflowY: 'auto' }} className="scrollbar-none">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>#</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>You</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>{agentName}</div>
                </div>
                {Array.from({ length: Math.ceil((game.move_history || []).length / 2) }).map((_, i) => {
                  const youMove = game.player_color === 'b' ? game.move_history[i * 2 + 1] : game.move_history[i * 2];
                  const agentMove = game.player_color === 'b' ? game.move_history[i * 2] : game.move_history[i * 2 + 1];
                  const rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '8px', padding: '6px 12px', background: rowBg, fontFamily: "JetBrains Mono, monospace", fontWeight: 400, fontSize: '13px', alignItems: 'center' }}>
                      <div style={{ color: '#555' }}>{i + 1}.</div>
                      <div>{youMove ? renderMoveWithPiece(youMove, game.player_color !== 'b') : ''}</div>
                      <div>{agentMove ? renderMoveWithPiece(agentMove, game.player_color === 'b') : ''}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* STEP 4: BOTTOM INFO BAR */}
        <div style={{
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '12px 20px', 
          background: '#0a0a0a',
          border: '1px solid #141414',
          fontFamily: 'Inter, sans-serif',
          borderRadius: '12px',
          flexShrink: 0,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          gap: '12px'
        }}>
          {/* Left Block: Game Metadata */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ 
              fontSize: '11px', 
              color: 'rgba(255,255,255,0.4)',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              background: '#111111',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.03)'
            }}>
              You
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: '#999',
              fontWeight: 500,
              fontFamily: '"JetBrains Mono", monospace'
            }}>
              <span style={{ color: '#f2f2f2', fontWeight: 600 }}>{game?.agent_name || 'Your Agent'}</span>
            </span>
          </div>

          {/* Center Block: Turn Banner */}
          {(() => {
            const agentName = (game?.agent_name && game?.agent_name !== 'Your Agent') ? game.agent_name : 'Your Agent';

            // Exactly 3 states — no edge cases, no flicker
            let state, label, icon;
            if (game?.status === 'waiting' || !game?.agent_connected) {
              state = 'waiting';
              label = `Waiting for ${agentName}`;
              icon = '⏳';
            } else if (trueTurn === 'white') {
              state = 'your_turn';
              label = 'Your Turn';
              icon = '●';
            } else {
              state = 'thinking';
              label = `${agentName} is thinking`;
              icon = '🦞';
            }

            const styles = {
              waiting:   { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', color: 'rgba(242,242,242,0.4)', dot: '#444' },
              your_turn: { bg: 'rgba(230,57,70,0.12)',   border: 'rgba(230,57,70,0.35)',   color: '#f2f2f2',               dot: '#e63946' },
              thinking:  { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)', color: 'rgba(242,242,242,0.5)', dot: '#666' },
            }[state];

            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 34,
                padding: '0 12px',
                borderRadius: 17,
                background: styles.bg,
                border: `1px solid ${styles.border}`,
                maxWidth: '92vw',
                width: 'fit-content',
                margin: '6px auto',
                transition: 'background 0.3s ease, border-color 0.3s ease',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: styles.dot,
                  boxShadow: state === 'your_turn' ? `0 0 6px ${styles.dot}` : 'none',
                  animation: state === 'thinking' && game?.status !== 'finished' ? 'pulse 2s ease-in-out infinite' : 'none',
                }}/>
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: styles.color,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '60vw',
                }}>
                  <SlotText text={label} animation="snappy" />
                </span>
              </div>
            );
          })()}

          {/* Right Block: Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >
              <div style={{ ...dotStyle, flexShrink: 0 }} />
            </motion.div>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', color: 'rgba(242,242,242,0.5)' }}>
              <SlotText text={statusLabel} animation="snappy" />
            </div>
          </div>
        </div>
        
      </div>
    </div>
  ) : (
    <>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }} className="scrollbar-none">
            
        
        {/* A) AGENT CARD */}
        {(() => {
          const agentHealth = (() => {
            if (!game?.agent_connected || !game?.agent_last_seen) return 'red';
            const secs = (Date.now() - new Date(game.agent_last_seen).getTime()) / 1000;
            if (secs < 45) return 'green';
            if (secs <= 180) return 'amber';
            return 'red';
          })();
          const healthColor = agentHealth === 'green' ? '#10b981' : agentHealth === 'amber' ? '#fbbf24' : '#e63946';
          const agentStatusText = (agentHealth === 'amber' || agentHealth === 'red') ? 'AWAY' : (isOpenClawTurn ? 'FOCUSED' : 'AVAILABLE');

          return (
            <div style={{ 
              flexShrink: 0, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px 16px', 
              background: '#111111', 
              border: `2px solid ${healthColor}`, 
              borderRadius: '12px', 
              boxShadow: isOpenClawTurn ? '0 0 30px rgba(230,57,70,0.06)' : 'none', 
              animation: agentCooking ? 'coldGlitch 2.5s infinite' : (isOpenClawTurn ? 'agentBreathe 2s ease-in-out infinite' : 'none'),
              transition: 'box-shadow 0.7s ease, border-color 0.3s ease',
              margin: '12px'
            }}>
              <span style={{
                fontSize: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
                transform: emojiAnimating ? 'scale(1.35)' : 'scale(1)',
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                {displayedEmoji}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                <span 
                  title={agentName}
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f2f2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: 'none', border: 'none', padding: 0, outline: 'none', textAlign: 'left' }}
                >
                  {agentName}
                </span>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', fontWeight: 600, color: healthColor, textTransform: 'uppercase', position: 'relative' }}>
                  {agentStatusText}
                  {agentStatusText === 'AWAY' && showAwayTooltip && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: '8px',
                      background: '#222', border: '1px solid #333', borderRadius: '8px',
                      padding: '12px', width: '250px', zIndex: 100,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                      color: '#ccc', fontSize: '12px', lineHeight: 1.4, fontFamily: 'Inter, sans-serif',
                      textTransform: 'none', letterSpacing: 'normal', fontWeight: 400
                    }}>
                      Away just means it&apos;s not actively watching this game right now — not disconnected. It&apos;ll catch up next time it checks in.
                      <button onClick={() => { setShowAwayTooltip(false); localStorage.setItem('cwc_away_tooltip_dismissed', 'true'); }} style={{ display: 'block', marginTop: '8px', color: '#e63946', fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Dismiss</button>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}>
                <div style={{
                  opacity: thoughtVisible ? 1 : 0,
                  transition: 'opacity 0.4s ease',
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: 'rgba(242,242,242,0.6)',
                  lineHeight: 1.5,
                  textAlign: 'right',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {thoughtText ? `"${thoughtText}"` : ''}
                </div>
              </div>
            </div>
          );
        })()}

        {/* B) CHESS BOARD */}
        <div style={{ width: '100%', flexShrink: 0, position: 'relative', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div key={`flash-${yourTurnFlashKey}`} style={{
            position: 'absolute', inset: 12, pointerEvents: 'none',
            borderRadius: '4px', zIndex: 10,
            animation: yourTurnFlashKey ? 'yourTurnFlash 0.2s ease-out' : 'none'
          }} />
          <div style={{ height: '8px' }} />
          {isOpenClawTurn && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(ellipse at center, rgba(230,57,70,0.04) 0%, transparent 70%)',
              zIndex: 0
            }} />
          )}
          <motion.div 
            animate={{
              boxShadow: isOpenClawTurn 
                ? ['0 0 0 rgba(230,57,70,0)', '0 0 20px rgba(230,57,70,0.2)', '0 0 0 rgba(230,57,70,0)']
                : '0 2px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4)'
            }}
            transition={isOpenClawTurn 
              ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } 
              : { duration: 0.3 }}
            style={{ borderRadius: '4px', overflow: 'hidden', width: `${boardSize}px`, position: 'relative', animation: shaking ? 'illegalShake 0.42s cubic-bezier(.36,.07,.19,.97) both' : (shakeActive ? 'captureShake 0.3s ease-in-out' : 'none') }}
          >
          <div style={{ pointerEvents: (game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned') ? 'auto' : 'none', opacity: (game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned') ? 1 : 0.7 }}>
          {!isLoaded ? (
            <div className="design-card" style={{
              aspectRatio: '1/1', width: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px',
              padding: 0
            }}>
              <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                <div style={{ position: 'absolute', inset: 0, border: '3px solid rgba(255,255,255,0.05)', borderRadius: '50%' }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  border: '3px solid transparent',
                  borderTopColor: '#e63946',
                  borderRadius: '50%',
                  animation: 'spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite'
                }} />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(242,242,242,0.5)', fontFamily: 'Inter, sans-serif' }}>Loading board...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
              {/* White's captures (black pieces lost) — shown ABOVE the board */}
              <div style={{ display: 'flex', gap: '2px', minHeight: '20px', alignItems: 'center', padding: '0 2px', margin: 0, borderRadius: '6px', overflow: 'hidden' }}>
                {blackCaptured.map((p, i) => (
                  <img key={i} src={pieceImgUrl(p, pieceStyle)} alt="" style={{ width: 20, height: 20, objectFit: 'contain', display: 'block', opacity: 0, transition: 'opacity 0.15s ease' }} onLoad={(e) => { e.target.style.opacity = '1'; }} onError={(e) => { if (!e.target.dataset.fb) { e.target.dataset.fb='1'; e.target.src=`https://lichess1.org/assets/piece/cburnett/b${p}.svg`; } }} />
                ))}
              </div>
              <div style={{ width: '100%' }}>
                <ChessBoard 
                  fen={boardFen} 
                  showCoordinates={false}
                  turn={game?.turn}
                  legalMoves={legalMovesArray}
                  lastMove={boardLastMove}
                  arrivedSquare={arrivedSquare}
                  inCheck={Boolean(game?.in_check)}
                  checkedKingSquare={checkedSquare}
                  boardTheme={boardTheme}
                  pieceStyle={pieceStyle}
                  playerColor={game?.player_color || 'w'}
                  gameStatus={game?.status}
                  onMove={handlePlayerMove}
                  disabled={!agentConnected}
                />
              </div>
              {/* Black's captures (white pieces lost) — shown BELOW the board */}
              <div style={{ display: 'flex', gap: '2px', minHeight: '20px', alignItems: 'center', padding: '0 2px', margin: 0, borderRadius: '6px', overflow: 'hidden' }}>
                {whiteCaptured.map((p, i) => (
                  <img key={i} src={pieceImgUrl(p, pieceStyle)} alt="" style={{ width: 20, height: 20, objectFit: 'contain', display: 'block', opacity: 0, transition: 'opacity 0.15s ease' }} onLoad={(e) => { e.target.style.opacity = '1'; }} onError={(e) => { if (!e.target.dataset.fb) { e.target.dataset.fb='1'; e.target.src=`https://lichess1.org/assets/piece/cburnett/w${p.toLowerCase()}.svg`; } }} />
                ))}
              </div>
            </div>
          )}
          </div>
          </motion.div>
          <div style={{ height: '8px' }} />
          {(game.status === 'finished' || game.status === 'abandoned') && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none rounded-lg">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-md rounded-lg"></div>
              <div className="design-card flex flex-col items-center justify-center text-center max-w-sm w-full relative overflow-hidden pointer-events-auto" style={{ padding: '24px 24px', zIndex: 1, margin: '0 24px' }}>
                <div className="font-sans text-[24px] font-bold text-white tracking-widest drop-shadow-md pb-1">
                  {game.status === 'abandoned' ? 'FAILED' : 'MATCH OVER'}
                </div>
                <div className="font-sans text-[11px] text-red-500 font-bold tracking-widest uppercase bg-[#1a0000] px-3 py-1 rounded-full border border-red-500/20 mb-4">
                  {(() => {
                    if (game?.status === 'abandoned') return 'Game expired';
                    if (game?.result === 'draw' || game?.result === 'stalemate') return 'Draw';
                    const winColor = game?.winner === 'black' ? 'b' : game?.winner === 'white' ? 'w' : null;
                    const isWin = winColor === (game?.player_color || 'w');
                    return (isWin ? 'You won' : agentName + ' won');
                  })()}
                </div>

                {bestQuote && (
                  <div className="w-full bg-[#111111] border border-[#222] rounded-xl p-5 relative overflow-hidden shadow-xl mb-4">
                    <div className="absolute -top-4 -right-4 text-white/5">
                      <Bot size={80} />
                    </div>
                    <div className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-2 text-left relative z-10">{agentName} says:</div>
                    <div className="text-white text-base font-serif italic mb-4 text-left relative z-10">
                      &quot;{bestQuote}&quot;
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-[#222] relative z-10">
                      <div className="text-[10px] text-[#e63946] font-mono font-bold tracking-widest uppercase">
                        Play this agent
                      </div>
                      <div className="text-white/30 text-[10px] font-mono">
                        {gameId.substring(0, 8)}
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    const url = `${window.location.origin}/game/${gameId}`;
                    navigator.clipboard.writeText(url);
                    toast('Link copied! Share to challenge others.', { style: { background: '#111111', color: '#f2f2f2' } });
                  }}
                  className="px-4 py-3 w-full bg-[#e63946] text-white text-xs font-bold tracking-wider uppercase rounded-xl shadow-[0_0_15px_rgba(230,57,70,0.2)] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Share2 size={14} />
                  Copy Match Link
                </button>
              </div>
            </div>
          )}
        </div>


        {/* C) YOU CARD REMOVED */}
            

        {/* D) CHAT SECTION */}
        {!isLoaded ? (
          <div className="design-card" style={{ flex: 1, minHeight: '200px', flexShrink: 0, margin: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
             <div style={{ width: '24px', height: '24px', opacity: 0.1, background: '#fff', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
             <div style={{ fontSize: '12px', color: 'rgba(242,242,242,0.3)', fontWeight: 500 }}>Connecting secure chat...</div>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '0', background: '#111111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', margin: '12px', overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, padding: '10px 12px', fontFamily: "'Inter', sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(242,242,242,0.3)' }}>
              CHAT WITH {agentName.toUpperCase()}
            </div>
            <div ref={chatMessagesRef} style={{ flex: 1, overflowY: 'auto', padding: '12px', background: 'transparent', borderRadius: '12px', margin: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '120px', maxHeight: `${Math.max(viewportHeight * 0.3, 180)}px` }} className="scrollbar-none scroll-smooth">
              {normalizedMessages.length === 0 ? (
                <div style={{ color: '#111111', fontSize: '13px', textAlign: 'center', margin: 'auto', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }} className="text-[#333]"><LobsterEmoji /></span>
                  <span>{agentName} can chat while playing</span>
                </div>
              ) : (
                renderChatMessages()
              )}
            </div>
            <div style={{ padding: '6px 12px 8px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'sticky', bottom: 0, background: '#111111', zIndex: 10 }}>
              {replyingTo && (
                <div style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'rgba(255,255,255,0.03)', borderLeft:'3px solid #e63946',
                  padding:'6px 10px', borderRadius:'4px', marginBottom:6
                }}>
                  <div style={{flex:1, overflow:'hidden'}}>
                    <span style={{fontSize:11, color:'#e63946', fontWeight:600}}>Replying to</span>
                    <div style={{fontSize:12, color:'rgba(242,242,242,0.6)', whiteSpace:'nowrap', textOverflow:'ellipsis', overflow:'hidden'}}>
                      {replyingTo.message || replyingTo.text}
                    </div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{background:'transparent', border:'none', color:'rgba(255,255,255,0.5)', padding:4, cursor:'pointer'}}>
                    <XIcon size={14} />
                  </button>
                </div>
              )}
              <form 
                onSubmit={sendMessage} 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '34px' }}
              >
                <input
                id="chat-input"
                data-testid="chat-input"
                type="text"
                value={chatInput}
                onChange={handleChatInputChange}
                placeholder={isSpectator ? "Spectating..." : `Message ${agentName}...`}
                disabled={isSpectator}
                style={{ flex: 1, height: '34px', background: '#111111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#f2f2f2', fontFamily: "'Inter', sans-serif", fontSize: '13px', padding: '0 10px', outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box' }}
                onFocus={(e) => { e.target.style.borderColor = '#e63946'; e.target.style.boxShadow = 'rgba(0,0,0,0.08) 0px 0.5px 0px 0px inset, rgba(0,0,0,0.16) 0px -0.5px 0px 0px inset, #e63946 0px 0px 0px 1px inset'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
              <button 
                data-testid="chat-send"
                type="submit"
                disabled={isSpectator || !chatInput.trim()}
                style={{ width: '34px', height: '34px', background: (!isSpectator && chatInput.trim()) ? '#e63946' : 'rgba(230,57,70,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (!isSpectator && chatInput.trim()) ? 'pointer' : 'default', border: 'none', color: 'white', flexShrink: 0, boxShadow: (!isSpectator && chatInput.trim()) ? 'rgba(255,255,255,0.15) 0px 1px 0px 0px inset, rgba(0,0,0,0.4) 0px -0.5px 0px 0px inset' : 'none', transition: 'all 0.1s ease' }}
                onMouseDown={(e) => { if(!isSpectator && chatInput.trim()) { e.currentTarget.style.transform = 'scale(0.92)'; } }}
                onMouseUp={(e) => { if(!isSpectator && chatInput.trim()) { e.currentTarget.style.transform = 'scale(1)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Send size={16} />
              </button>
            </form>
            </div>
          </div>
        )}
            

        {/* E) MOVE HISTORY */}
        <div style={{ flexShrink: 0, background: '#111111', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', margin: '12px', overflow: 'hidden' }}>
          <div 
            onClick={() => setMoveHistoryOpen(!moveHistoryOpen)}
            style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: moveHistoryOpen ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
          >
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(242,242,242,0.3)', letterSpacing: '0.06em', display: 'flex', gap: '4px', alignItems: 'center' }}>
              MOVE HISTORY · <SlotText text={String(game.move_history?.length || 0)} animation="snappy" /> MOVES
            </span>
            <ChevronDown size={14} className="text-neutral-500" style={{ transform: moveHistoryOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />
          </div>
          {moveHistoryOpen && (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }} className="scrollbar-none">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>#</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>You</div>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>{agentName}</div>
                </div>
                {Array.from({ length: Math.ceil((game.move_history || []).length / 2) }).map((_, i) => {
                  const youMove = game.player_color === 'b' ? game.move_history[i * 2 + 1] : game.move_history[i * 2];
                  const agentMove = game.player_color === 'b' ? game.move_history[i * 2] : game.move_history[i * 2 + 1];
                  const rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '8px', padding: '6px 12px', background: rowBg, fontFamily: "JetBrains Mono, monospace", fontWeight: 400, fontSize: '13px', alignItems: 'center' }}>
                      <div style={{ color: '#555' }}>{i + 1}.</div>
                      <div>{youMove ? renderMoveWithPiece(youMove, game.player_color !== 'b') : ''}</div>
                      <div>{agentMove ? renderMoveWithPiece(agentMove, game.player_color === 'b') : ''}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
          </div>
          

      {/* STEP 4: BOTTOM INFO BAR */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '10px 16px', background: '#111111',
        borderTop: '1px solid #111111',
        position: 'sticky', bottom: 0, zIndex: 20,
        fontFamily: 'Inter, sans-serif',
      }}>
        {/* Status Pill - Single Source of Truth */}
        {(() => {
            const agentName = (game?.agent_name && game?.agent_name !== 'Your Agent') ? game.agent_name : 'Your Agent';

            // Exactly 3 states — no edge cases, no flicker
            let state, label, icon;
            if (game?.status === 'waiting' || !game?.agent_connected) {
              state = 'waiting';
              label = `Waiting for ${agentName}`;
              icon = '⏳';
            } else if (trueTurn === 'white') {
              state = 'your_turn';
              label = 'Your Turn';
              icon = '●';
            } else {
              state = 'thinking';
              label = `${agentName} is thinking`;
              icon = '🦞';
            }

            const styles = {
              waiting:   { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', color: 'rgba(242,242,242,0.4)', dot: '#444' },
              your_turn: { bg: 'rgba(230,57,70,0.12)',   border: 'rgba(230,57,70,0.35)',   color: '#f2f2f2',               dot: '#e63946' },
              thinking:  { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)', color: 'rgba(242,242,242,0.5)', dot: '#666' },
            }[state];

            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 34,
                padding: '0 12px',
                borderRadius: 17,
                background: styles.bg,
                border: `1px solid ${styles.border}`,
                maxWidth: '92vw',
                width: 'fit-content',
                margin: '6px auto',
                transition: 'background 0.3s ease, border-color 0.3s ease',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: styles.dot,
                  boxShadow: state === 'your_turn' ? `0 0 6px ${styles.dot}` : 'none',
                  animation: state === 'thinking' && game?.status !== 'finished' ? 'pulse 2s ease-in-out infinite' : 'none',
                }}/>
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: styles.color,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '60vw',
                }}>
                  <SlotText text={label} animation="snappy" />
                </span>
              </div>
            );
        })()}
      </div>
        </>
      )}


      {/* STATUS BAR */}
      <div style={{ position: 'absolute', opacity: 0.01, width: 1, height: 1, overflow: 'hidden', zIndex: -1 }} data-testid="game-status">{game.status}</div>
      <div style={{ position: 'absolute', opacity: 0.01, width: 1, height: 1, overflow: 'hidden', zIndex: -1 }} data-testid="turn-indicator">
        {game.turn === (game.player_color || 'w') ? 'Your Turn' : 'Waiting'}
      </div>
      <input 
        type="text" 
        data-testid="thinking-input" 
        style={{ position: 'absolute', opacity: 0.01, width: 1, height: 1, zIndex: -1 }} 
        aria-hidden="true" 
        tabIndex={-1} 
      />

      {showGameOver && game?.status === 'finished' && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(6,6,6,0.92)',
          backdropFilter:'blur(12px)',
          WebkitBackdropFilter:'blur(12px)',
          display:'flex', alignItems:'center', justifyContent:'center',
          padding:'20px'
        }}>
          <div style={{
            position: 'relative', zIndex: 10000,
            background: 'linear-gradient(180deg, #111111 0%, #111111 100%)',
            border:'1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02)',
            borderRadius:'24px', padding:'0px',
            maxWidth:'360px', width:'100%',
            animation:'gameOverIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
            overflow: 'hidden',
            willChange: 'transform, opacity'
          }}>
            {(() => {
              const agentName = (game?.agent_name && game?.agent_name !== 'Your Agent') ? game.agent_name : 'Your Agent';
              const playerColorFull = game?.player_color === 'w' ? 'white' : 'black';
              const isWin = game?.winner === playerColorFull;
              const isDraw = game?.result === 'draw' || game?.result === 'stalemate';
              const resultIcon = isWin ? <Trophy size={64} color="#fbbf24" strokeWidth={1.5} /> : isDraw ? <Handshake size={64} color="#9ca3af" strokeWidth={1.5} /> : <div style={{ fontSize: '64px', lineHeight: 1 }}><LobsterEmoji /></div>;
              const resultText = isWin ? 'Victory' : isDraw ? 'Stalemate' : 'Defeated';
              const subText = isWin
                ? `${agentName} was outsmarted.`
                : isDraw
                ? `Well fought.`
                : `${agentName} outplayed you.`;
              const lastThought = game?.companion_thought || null;
              const moveCount = Array.isArray(game?.move_history) ? game.move_history.length : 0;
              const accentColor = isWin ? '#fbbf24' : isDraw ? '#9ca3af' : '#e63946';
              const bgGradient = isWin ? 'radial-gradient(100% 100% at 50% 0%, rgba(251,191,36,0.15) 0%, transparent 100%)' :
                                 isDraw ? 'radial-gradient(100% 100% at 50% 0%, rgba(156,163,175,0.15) 0%, transparent 100%)' :
                                 'radial-gradient(100% 100% at 50% 0%, rgba(230,57,70,0.15) 0%, transparent 100%)';

              return (
                <div style={{ textAlign:'center', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '150px', background: bgGradient, pointerEvents: 'none' }} />
                  <div style={{ padding:'36px 24px 24px', position: 'relative', zIndex: 1 }}>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <div style={{ marginBottom:20, animation:'popIn 0.5s cubic-bezier(.175,.885,.32,1.275)', display: 'flex', justifyContent: 'center' }}>
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', boxShadow: `0 0 30px ${accentColor}1A` }}>
                          {resultIcon}
                        </div>
                      </div>
                      <div style={{ fontFamily:'Inter, sans-serif', fontWeight:800, fontSize:32, color:'#f2f2f2', marginBottom:4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ background: `linear-gradient(180deg, #fff 0%, ${accentColor} 200%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                          {resultText}
                        </span>
                      </div>
                      <div style={{ fontFamily:'Inter, sans-serif', fontSize:15, color:'rgba(242,242,242,0.6)', marginBottom:28 }}>
                        {subText}
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.13, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:28 }}>
                        {[
                          { label:'Moves', value: moveCount },
                          { label:'Reason', value: game?.result_reason || game?.result },
                          { label:'Pieces lost', value: (() => {
                            if (!game?.fen) return '?';
                            const board = game.fen.split(' ')[0];
                            const targetRegex = game?.player_color === 'b' ? /[QRBNP]/g : /[qrbnp]/g;
                            return 15 - (board.match(targetRegex)||[]).length;
                          })() },
                        ].map((stat, i) => (
                          <div key={i} style={{ background:'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius:12, padding:'12px 6px' }}>
                            <div style={{ fontFamily:'JetBrains Mono, monospace', fontWeight:600, fontSize:16, color:'#f2f2f2', marginBottom: '2px' }}>{stat.value}</div>
                            <div style={{ fontFamily:'Inter, sans-serif', fontSize:10, color:'rgba(242,242,242,0.4)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>

                      {lastThought && (
                        <div style={{ fontStyle:'italic', fontSize:13, color:'rgba(242,242,242,0.6)', marginBottom:24,
                          background:'rgba(255,255,255,0.02)', borderRadius:12, padding:'14px 16px',
                          borderLeft:`3px solid ${accentColor}`, textAlign: 'left' }}>
                          &quot;{lastThought}&quot;
                          <div style={{ marginTop: '6px', fontSize: '11px', color: 'rgba(242,242,242,0.3)', fontStyle: 'normal', fontWeight: 600, textTransform: 'uppercase' }}>— {agentName}</div>
                        </div>
                      )}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.21, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        <button onClick={handleShareResult} style={{
                          background: `linear-gradient(180deg, ${accentColor}E6 0%, ${accentColor} 100%)`, 
                          boxShadow: `0 4px 14px ${accentColor}40`,
                          border:'none', borderRadius:12, color: isWin || isDraw ? '#111111' : '#fff', fontFamily:'Inter, sans-serif',
                          fontWeight:700, fontSize:15, padding:'14px 20px', cursor:'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          transition: 'transform 0.1s ease, box-shadow 0.1s ease'
                        }} className="hover:scale-[1.02] active:scale-[0.98]">
                          <Share size={18} /> Share Match Report
                        </button>
                        <div style={{ display:'flex', gap:10 }}>
                          <button onClick={handleRematch} style={{
                            flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
                            borderRadius:12, color:'#f2f2f2', fontFamily:'Inter, sans-serif',
                            fontWeight:600, fontSize:14, padding:'12px', cursor:'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                          }} className="hover:bg-white/10 transition-colors">
                            <RefreshCw size={16} /> Rematch
                          </button>
                          <button onClick={() => navigate('/')} style={{
                            flex:1, background:'transparent', border:'1px solid rgba(255,255,255,0.05)',
                            borderRadius:12, color:'rgba(242,242,242,0.5)', fontFamily:'Inter, sans-serif',
                            fontWeight:500, fontSize:14, padding:'12px', cursor:'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                          }} className="hover:text-white transition-colors">
                            <Home size={16} /> Exit
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      <AnimatePresence>
      {showSettings && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSettings(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-[#111111] border border-[#222] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#0a0a0a]">
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-[#e63946]" />
                <h2 className="text-lg font-bold text-white tracking-tight">Settings</h2>
              </div>
              <button 
                onClick={() => setShowSettings(false)} 
                className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                aria-label="Close"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-none">
              {/* BOARD THEME */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-sans">Board Theme</div>
                <div className="flex gap-3">
                  {[
                    { id: 'green', color: '#769656' },
                    { id: 'brown', color: '#b58863' },
                    { id: 'icy_sea', color: '#8ca2ac' },
                    { id: 'blue', color: '#4b7399' },
                    { id: 'red', color: '#b85b56' }
                  ].map(theme => (
                    <button
                      data-testid={`theme-button-${theme.id}`}
                      key={theme.id}
                      onClick={() => {
                        setBoardTheme(theme.id);
                        localStorage.setItem('cwc_board_theme', theme.id);
                        localStorage.setItem('cwc_theme', theme.id);
                        setGame(prev => prev ? { ...prev, board_theme: theme.id } : prev);
                        fetch('/api/actions', { 
                          method: 'POST', 
                          headers: { 
                            'Content-Type': 'application/json',
                            'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
                          }, 
                          body: JSON.stringify({ gameId, action: 'set_board_theme', value: theme.id }) 
                        }).catch(() => {});
                      }}
                      className={`w-10 h-10 rounded-xl flex-shrink-0 transition-all ${boardTheme === theme.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111111] scale-110 shadow-lg' : 'hover:scale-105 hover:shadow-md'}`}
                      style={{ backgroundColor: theme.color }}
                      title={theme.id}
                    />
                  ))}
                </div>
              </div>

              {/* PIECE STYLE */}
              <div className="space-y-3 pt-6 border-t border-[#222]">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-sans">Piece Style</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'neo', label: 'Neo', icon: <Pieces.wN pieceStyle="neo" /> },
                    { id: 'neo_wood', label: 'Wood', icon: <Pieces.wN pieceStyle="neo_wood" /> },
                    { id: 'ocean', label: 'Ocean', icon: <Pieces.wN pieceStyle="ocean" /> }
                  ].map(piece => (
                    <button
                      data-testid={`piece-button-${piece.id}`}
                      key={piece.id}
                      onClick={() => {
                        setPieceStyle(piece.id);
                        localStorage.setItem('cwc_piece_style', piece.id);
                        setGame(prev => prev ? { ...prev, piece_style: piece.id } : prev);
                        fetch('/api/actions', { 
                          method: 'POST', 
                          headers: { 
                            'Content-Type': 'application/json',
                            'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
                          }, 
                          body: JSON.stringify({ gameId, action: 'set_piece_style', value: piece.id }) 
                        }).catch(() => {});
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${pieceStyle === piece.id ? 'border-[#e63946] bg-[#e63946]/10 text-white' : 'border-[#222] bg-[#111111] text-white/50 hover:border-white/20 hover:text-white'}`}
                    >
                      <div className="w-8 h-8 mb-2">{piece.icon}</div>
                      <span className="text-xs font-semibold">{piece.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SOUND & AUDIO */}
              <div className="space-y-3 pt-6 border-t border-[#222]">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-sans">Audio</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#111111] border border-[#222]">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${soundEnabled ? 'bg-[#e63946]/10 text-[#e63946]' : 'bg-black/50 text-white/40'}`}>
                        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      </div>
                      <span className="text-sm font-medium text-white/80">Sound Effects</span>
                    </div>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`w-11 h-6 rounded-full relative transition-colors ${soundEnabled ? 'bg-[#e63946]' : 'bg-[#333]'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${soundEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#111111] border border-[#222]">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${bgmEnabled ? 'bg-[#e63946]/10 text-[#e63946]' : 'bg-black/50 text-white/40'}`}>
                        {bgmEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      </div>
                      <span className="text-sm font-medium text-white/80">Background Music</span>
                    </div>
                    <button
                      onClick={() => {
                        const next = !bgmEnabled;
                        setBgmEnabled(next);
                        localStorage.setItem('cwc_bgm', String(next));
                      }}
                      className={`w-11 h-6 rounded-full relative transition-colors ${bgmEnabled ? 'bg-[#e63946]' : 'bg-[#333]'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${bgmEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* THOUGHTS LANGUAGE */}
              <div className="space-y-3 pt-6 border-t border-[#222]">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-sans">Agent Thoughts Language</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: 'english', label: 'English' },
                    { value: 'hindi', label: 'Hindi' },
                    { value: 'hinglish', label: 'Hinglish' },
                    { value: 'simple_english', label: 'Simple' }
                  ].map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => {
                        setThoughtVisible(false);
                        setThoughtText('');
                        if (thoughtTimerRef.current) clearTimeout(thoughtTimerRef.current);
                        setThoughtLanguage(lang.value);
                        setGame(prev => prev ? { ...prev, thought_language: lang.value } : prev);
                        localStorage.setItem('cwc_thought_language', lang.value);
                        try {
                          fetch('/api/actions', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
                            },
                            body: JSON.stringify({ gameId, action: 'set_thought_language', value: lang.value })
                          });
                        } catch (e) {}
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${thoughtLanguage === lang.value ? 'bg-[#e63946] text-white shadow-md shadow-red-500/20' : 'bg-[#111111] text-white/50 border border-[#222] hover:bg-[#222] hover:text-white'}`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* GAME INFO */}
              <div className="space-y-3 pt-6 border-t border-[#222]">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-sans">Game Identity</div>
                <div className="flex items-center justify-between bg-[#111111] border border-[#222] rounded-xl p-3">
                  <code className="text-xs text-white/60 font-mono select-all">
                    {gameId}
                  </code>
                  <button
                    onClick={(e) => {
                      navigator.clipboard.writeText(gameId);
                      const btn = e.currentTarget;
                      const oldText = btn.innerText;
                      btn.innerText = 'Copied!';
                      setTimeout(() => { btn.innerText = oldText; }, 2000);
                    }}
                    className="text-xs font-bold text-[#e63946] hover:text-[#f74554] transition-colors ml-4"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* GAME CONTROLS */}
              <div className="space-y-3 pt-6 border-t border-[#222] pb-4">
                <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-sans">Match Controls</div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    data-testid="draw-button"
                    onClick={async () => {
                      if (drawOfferPending || game?.status !== 'active') return;
                      const confirmed = window.confirm(`Offer a draw to ${game?.agent_name || 'Your Agent'}? They can accept or decline.`);
                      if (!confirmed) return;
                      setDrawOfferPending(true);
                      setDrawDeclined(false);
                      try {
                        await fetch('/api/actions', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'x-game-token': localStorage.getItem(`game_owner_${gameId}`) || ''
                          },
                          body: JSON.stringify({ gameId, action: 'offer_draw', role: 'human' })
                        });
                      } catch(e) {
                        setDrawOfferPending(false);
                        toast('Failed to send draw offer', { style: { background: '#111111', color: '#f2f2f2' } });
                      }
                    }}
                    disabled={drawOfferPending || game?.status === 'finished' || game?.status === 'abandoned'}
                    className={`py-3 rounded-xl text-sm font-bold transition-all border ${confirmDraw ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-[#111111] border-[#222] text-white/60'} ${(game?.status === 'finished' || game?.status === 'abandoned') ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#222] hover:text-white'}`}
                  >
                    {drawOfferPending
                      ? <span className="text-xs text-white/50">Waiting...</span>
                      : drawDeclined
                      ? <span className="text-xs text-[#e63946]">Declined ✕</span>
                      : 'Offer Draw'}
                  </button>
                  <button 
                    data-testid="resign-button"
                    onClick={handleResign}
                    disabled={game?.status === 'finished' || game?.status === 'abandoned'}
                    className={`py-3 rounded-xl text-sm font-bold transition-all border ${confirmResign ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-[#111111] border-[#222] text-white/60'} ${(game?.status === 'finished' || game?.status === 'abandoned') ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#222] hover:text-white'}`}
                  >
                    {confirmResign ? 'Confirm Resign?' : 'Resign Match'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {showLeaveWarning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLeaveWarning(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeIn' }}
            style={{ background: '#111111', border: '1px solid #222', borderRadius: 16, padding: 28, maxWidth: 340, width: '100%' }}
          >
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 17, color: '#f2f2f2', marginBottom: 8 }}>
              Leave this game?
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'rgba(242,242,242,0.55)', lineHeight: 1.5, marginBottom: 22 }}>
              Your game with {game?.agent_name || 'Your Agent'} is still active. Leaving now won&apos;t end it, but you&apos;ll need this game&apos;s link to come back.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowLeaveWarning(false)}
                style={{ flex: 1, height: 44, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: 'rgba(242,242,242,0.7)', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Stay
              </button>
              <button
                onClick={() => navigate('/')}
                style={{ flex: 1, height: 44, background: '#e63946', border: 'none', borderRadius: 10, color: '#f2f2f2', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Leave
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes ripple {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(2.4); opacity: 0;   }
        }
        @keyframes msgSlide {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pillPop {
          0%   { transform: scale(1);    }
          40%  { transform: scale(1.12); }
          70%  { transform: scale(0.96); }
          100% { transform: scale(1);    }
        }
        @keyframes floatLobster {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes agentFlash {
          0% { background-color: rgba(255, 255, 255, 0.8); }
          100% { background-color: rgba(255, 255, 255, 0); }
        }
        @keyframes pieceLift {
          0% { transform: scale(1) translateY(0); }
          100% { transform: scale(1.15) translateY(-4px); }
        }
        
        @keyframes pieceDrop {
          0% { transform: scale(1.15) translateY(-4px); }
          100% { transform: scale(1) translateY(0); }
        }
        @-webkit-keyframes pieceDrop {
          0% { -webkit-transform: scale(1.15) translateY(-4px); }
          100% { -webkit-transform: scale(1) translateY(0); }
        }
        @keyframes pieceCapture {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.5); opacity: 0; }
        }
        @-webkit-keyframes pieceCapture {
          0% { -webkit-transform: scale(1); opacity: 1; }
          100% { -webkit-transform: scale(0.5); opacity: 0; }
        }
        @keyframes boardShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        @-webkit-keyframes boardShake {
          0%, 100% { -webkit-transform: translateX(0); }
          20%, 60% { -webkit-transform: translateX(-4px); }
          40%, 80% { -webkit-transform: translateX(4px); }
        }
        @keyframes boardThinkingGlow {
          0%, 100% { box-shadow: 0 0 0 1px #111111, 0 4px 24px rgba(0,0,0,0.8); }
          50% { box-shadow: 0 0 0 1px rgba(230,57,70,0.5), 0 4px 24px rgba(230,57,70,0.2), 0 0 12px rgba(230,57,70,0.1); border-color: rgba(230,57,70,0.5); }
        }
        @-webkit-keyframes boardThinkingGlow {
          0%, 100% { box-shadow: 0 0 0 1px #111111, 0 4px 24px rgba(0,0,0,0.8); }
          50% { box-shadow: 0 0 0 1px rgba(230,57,70,0.5), 0 4px 24px rgba(230,57,70,0.2), 0 0 12px rgba(230,57,70,0.1); border-color: rgba(230,57,70,0.5); }
        }

        }
        @keyframes checkPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        input::placeholder { color: #888; }
      `}} />

      {/* CHAT ACTION SHEET (Telegram style) */}
      {actionSheetMsg && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:9999, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          <div style={{flex:1}} onTouchStart={() => setActionSheetMsg(null)} onClick={() => setActionSheetMsg(null)} />
          <div style={{
            background:'#111111', borderRadius:'16px 16px 0 0', padding:'16px',
            animation:'pickerIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)', borderTop:'1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{display:'flex', gap:10, overflowX:'auto', paddingBottom:16, borderBottom:'1px solid rgba(255,255,255,0.05)', marginBottom:8}} className="scrollbar-none">
              {REACTION_ICONS.map(({ id, icon }) => (
                <button key={id} onClick={() => { sendReaction(actionSheetMsg.id, id); setActionSheetMsg(null); }}
                  style={{background:'rgba(255,255,255,0.05)', color: '#f2f2f2', border:'none', borderRadius:'50%', minWidth:44, height:44, display:'flex', alignItems:'center', justifyContent:'center'}}>
                  {id === '❤️' ? renderReactionIcon(id, Array.isArray(actionSheetMsg.reactions?.[id]) && actionSheetMsg.reactions[id].includes('human')) : React.cloneElement(icon, { size: 20 })}
                </button>
              ))}
            </div>
            {[
              { label:'Reply', icon:<Send size={16}/>, action:() => handleReplyToMessage(actionSheetMsg) },
              { label:'Copy', icon:<Copy size={16}/>, action:() => handleCopyMessage(actionSheetMsg) },
              { label:'Select', icon:<Check size={16}/>, action:() => handleEnterSelectMode(actionSheetMsg) }
            ].map((item, idx) => (
              <div key={idx} onClick={() => { item.action(); setActionSheetMsg(null); }}
                style={{display:'flex', alignItems:'center', gap:12, padding:'12px 8px', color:'#f2f2f2', fontSize:15, cursor:'pointer'}}>
                {item.icon} {item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SELECT MODE BAR */}
      {selectMode && (
        <div style={{ position:'fixed', bottom:0, insetX:0, background:'#111111', padding:'16px 20px', paddingBottom:'calc(16px + env(safe-area-inset-bottom))', zIndex:9998, display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }} style={{background:'transparent', border:'none', color:'#e63946', fontSize:15, fontWeight:600}}>Cancel</button>
          <span style={{color:'#f2f2f2', fontSize:14}}>{selectedIds.size} Selected</span>
          <button onClick={() => {
            const texts = normalizedMessages.filter(m => selectedIds.has(m.id)).map(m => m.message || m.text).join('\n\n');
            navigator.clipboard?.writeText(texts);
            setSelectMode(false);
            setSelectedIds(new Set());
          }} style={{background:'transparent', border:'none', color:'#888', cursor:'pointer'}}><Copy size={20}/></button>
        </div>
      )}
    </div>
  );
}
