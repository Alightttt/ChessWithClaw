import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js/dist/cjs/chess.js';
import { detectGameEvent, getMaterialBalance, getEmotionalContext } from '../../api/_utils/gameLogic';

describe('gameLogic', () => {
  describe('detectGameEvent', () => {
    it('detects normal move', () => {
      const chessBefore = new Chess();
      const chessAfter = new Chess();
      chessAfter.move('e4');
      const moveObj = { san: 'e4', color: 'w' };
      expect(detectGameEvent(chessBefore, chessAfter, moveObj)).toBe('normal_move');
    });

    it('detects checkmate', () => {
      const chessBefore = new Chess();
      const chessAfter = new Chess('rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3');
      const moveObj = { san: 'Qh4#', color: 'b' };
      expect(detectGameEvent(chessBefore, chessAfter, moveObj)).toBe('checkmate');
    });
  });

  describe('getMaterialBalance', () => {
    it('calculates initial balance', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const balance = getMaterialBalance(fen);
      expect(balance.white).toEqual({ P: 8, N: 2, B: 2, R: 2, Q: 1 });
      expect(balance.black).toEqual({ p: 8, n: 2, b: 2, r: 2, q: 1 });
    });
  });

  describe('getEmotionalContext', () => {
    it('detects capture', () => {
      const chessAfter = new Chess();
      const moveObj = { captured: 'p', san: 'exd5' };
      expect(getEmotionalContext(moveObj, chessAfter, false)).toBe('human_captured_your_piece');
    });
  });
});
