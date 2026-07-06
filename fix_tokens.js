const fs = require('fs');

function replaceInFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  
  // Replace x-game-token logic
  const targetToken = "const gameToken = req.headers['x-game-token'] || '';";
  const replacementToken = `let gameToken = req.headers['x-game-token'] || '';
  if (!gameToken && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').map(c => c.trim());
    const prefix = 'game_owner_' + (gameId || id) + '=';
    const cookie = cookies.find(c => c.startsWith(prefix));
    if (cookie) {
      gameToken = cookie.substring(prefix.length);
    }
  }`;
  
  code = code.replace(targetToken, replacementToken);
  
  fs.writeFileSync(file, code);
}

replaceInFile('api/move.js');
replaceInFile('api/chat.js');
replaceInFile('api/actions.js');
