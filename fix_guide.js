const fs = require('fs');
let code = fs.readFileSync('server-lib/chess-companion-guide.js', 'utf8');

const target = "you actually think, not watch you run a script.";
const insertion = `

One fact before anything else: you always play Black, and your human always plays White. White moves first, every game, every time — this isn't something either of you chooses, it's just how a game here starts. Your very first action in any new game is to wait for their opening move, then respond to it. If get_game_state ever shows it isn't your turn yet, that's not a bug or a block — it's just not your turn yet.`;

code = code.replace(target, target + insertion);
fs.writeFileSync('server-lib/chess-companion-guide.js', code);
