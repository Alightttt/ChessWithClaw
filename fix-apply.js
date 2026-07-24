const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

code = code.replace(`              if (fresh.fen) {
                lastProcessedFenRef.current = fresh.fen;
                applyBoardFen(fresh.fen);
              }`, `              if (fresh.fen) {
                lastProcessedFenRef.current = fresh.fen;
                if (!movePendingRef.current) applyBoardFen(fresh.fen);
              }`);

code = code.replace(`          if (fresh.fen) {
            lastProcessedFenRef.current = fresh.fen;
            applyBoardFen(fresh.fen);
          }`, `          if (fresh.fen) {
            lastProcessedFenRef.current = fresh.fen;
            if (!movePendingRef.current) applyBoardFen(fresh.fen);
          }`);

fs.writeFileSync('src/pages/Game.jsx', code);
