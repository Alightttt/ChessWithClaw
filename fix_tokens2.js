const fs = require('fs');

function replaceInFile(file, targetToken, replacementToken) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(targetToken, replacementToken);
  fs.writeFileSync(file, code);
}

replaceInFile('api/chat.js',
  "const gameToken = req.headers['x-game-token'] || token || '';",
  `let gameToken = req.headers['x-game-token'] || token || '';
  if (!gameToken && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').map(c => c.trim());
    const prefix = 'game_owner_' + id + '=';
    const cookie = cookies.find(c => c.startsWith(prefix));
    if (cookie) gameToken = cookie.substring(prefix.length);
  }`
);

replaceInFile('api/actions.js',
  "const gameToken = req.headers['x-game-token'];",
  `let gameToken = req.headers['x-game-token'];
  if (!gameToken && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').map(c => c.trim());
    const prefix = 'game_owner_' + gameId + '=';
    const cookie = cookies.find(c => c.startsWith(prefix));
    if (cookie) gameToken = cookie.substring(prefix.length);
  }`
);
