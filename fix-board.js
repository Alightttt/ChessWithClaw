const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

// Effect 1: game.fen changes
code = code.replace(`  useEffect(() => {
    if (!game?.fen) return;
    if (game.fen === boardFenRef.current) return;
    const gameBoard = game.fen.split(' ')[0];`, `  useEffect(() => {
    if (!game?.fen) return;
    if (movePendingRef.current) return;
    if (game.fen === boardFenRef.current) return;
    const gameBoard = game.fen.split(' ')[0];`);

// Effect 2: postgres_changes
code = code.replace(`      if (newPosition !== prevPosition) {
        applyBoardFen(incoming.fen);`, `      if (newPosition !== prevPosition) {
        if (!movePendingRef.current) {
          applyBoardFen(incoming.fen);
        }`);

fs.writeFileSync('src/pages/Game.jsx', code);
