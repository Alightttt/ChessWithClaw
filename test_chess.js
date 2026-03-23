import {Chess} from 'chess.js';
const c = new Chess();
try {
  console.log(c.move('e2e4'));
} catch (e) {
  console.log(e.message);
}
