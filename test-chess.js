import { Chess } from 'chess.js';
const chess = new Chess();
try {
  console.log(chess.move('e2e4'));
} catch (e) {
  console.log('Error:', e.message);
}
try {
  console.log(chess.move({from: 'e7', to: 'e5'}));
} catch (e) {
  console.log('Error:', e.message);
}
