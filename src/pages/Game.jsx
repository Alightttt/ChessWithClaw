import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Settings, MessageSquare, History, Trophy, Clock, User, ChevronRight, ChevronLeft, RotateCcw, AlertTriangle, Send, MoreVertical, X, Check, Copy, Share2, Maximize2, Minimize2, Palette, Info, HelpCircle } from 'lucide-react';
import { useToast } from '../components/Toast';
import { getSupabaseWithToken } from '../lib/supabase';
import StatusDot from '../components/StatusDot';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import Divider from '../components/Divider';
import Modal from '../components/Modal';

// ... (rest of the file content would go here, but I need to read the full file first to be safe)
