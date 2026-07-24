const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

code = code.replace(`            if (freshData.fen) applyBoardFen(freshData.fen);`, `            if (freshData.fen && !movePendingRef.current) applyBoardFen(freshData.fen);`);

fs.writeFileSync('src/pages/Game.jsx', code);
