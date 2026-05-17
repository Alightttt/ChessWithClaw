const fs = require('fs');
let code = fs.readFileSync('src/pages/Agent.jsx', 'utf8');

// replace lastMoveFrom declaring
code = code.replace(/const \[lastMoveFrom, setLastMoveFrom\] = useState\(null\);/, `const [lastMoveHighlight, setLastMoveHighlight] = useState(null);
  const [arrivedSquare, setArrivedSquare] = useState(null);`);

// In makeMove, update lastMoveHighlight instead of optimisticLastMove
code = code.replace(/setOptimisticLastMove\(\{ from, to \}\);/g, `setOptimisticLastMove({ from, to });\n      setLastMoveHighlight({ from, to });`);

// In Realtime subscription, handle agent move highlight
code = code.replace(/\/\/ Fetch fresh state to get moves from separate table/, `
            // Update last move highlight and flash arrived square
            if (fenChanged) {
              const agentMoveTo = newData.last_move?.to || newData.last_move?.to_square;
              setLastMoveHighlight({
                from: newData.last_move?.from || newData.last_move?.from_square,
                to: agentMoveTo
              });
              if (agentMoveTo) {
                setArrivedSquare(agentMoveTo);
                setTimeout(() => setArrivedSquare(null), 700);
              }
            }

            // Fetch fresh state to get moves from separate table`);

// In ChessBoard usage
code = code.replace(/lastMove=\{optimisticLastMove \|\| \(game\.move_history \|\| \[\]\)\[\(game\.move_history \|\| \[\]\)\?\.length - 1\] \|\| null\}/g, `lastMove={lastMoveHighlight || optimisticLastMove || (game.move_history || [])[(game.move_history || [])?.length - 1] || null} arrivedSquare={arrivedSquare}`);

fs.writeFileSync('src/pages/Agent.jsx', code);
