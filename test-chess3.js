import { Chess } from 'chess.js';
const chess = new Chess();
try {
  const move = chess.move({ from: 'g1', to: 'f3', promotion: 'q' });
  console.log('Move successful:', move);
} catch (e) {
  console.log('Error:', e.message);
}
