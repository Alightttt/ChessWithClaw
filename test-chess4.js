import { Chess } from 'chess.js';
const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQK2R w KQkq - 0 1');
try {
  const move = chess.move({ from: 'e1', to: 'g1', promotion: 'q' });
  console.log('Move successful:', move);
} catch (e) {
  console.log('Error:', e.message);
}
