import { Chess } from 'chess.js';
const chess = new Chess();
try {
  const moves = chess.moves({ square: 'e2', verbose: true });
  console.log('Moves:', moves);
} catch (e) {
  console.log('Error:', e.message);
}
