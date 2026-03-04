import { Chess } from 'chess.js';

const chess = new Chess();
try {
  const move = chess.move({ from: 'e2', to: 'e4', promotion: 'q' });
  console.log('Move successful:', move);
} catch (e) {
  console.error('Move failed:', e);
}
