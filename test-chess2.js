import { Chess } from 'chess.js';
const chess = new Chess();
try {
  console.log(chess.move('e5'));
} catch (e) {
  console.log('Error:', e.message);
}
