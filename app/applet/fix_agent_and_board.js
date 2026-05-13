const fs = require('fs');

// 1. CHESSBOARD SQUARE TESTIDS
let cbCode = fs.readFileSync('src/components/chess/ChessBoard.jsx', 'utf-8');

cbCode = cbCode.replace(
  /<div([\s\S]*?)className=\`w-full h-full relative/g,
  `<div$1data-testid={\`square-\${colLetter}\${rowNumber}\`} className=\`w-full h-full relative`
);
cbCode = cbCode.replace( // if it didn't match
  /<div key=\{\`\$\{row\}-\$\{col\}\`\}([\s\S]*?)className=/g,
  `<div key={\`\${row}-\${col}\`}$1data-testid={\`square-\${colLetter}\${rowNumber}\`} className=`
);
fs.writeFileSync('src/components/chess/ChessBoard.jsx', cbCode, 'utf-8');

// 2. AGENT.JSX
let agentCode = fs.readFileSync('src/pages/Agent.jsx', 'utf-8');

// Update imports for supabase and chess.js (for legal moves)
if (!agentCode.includes('import { supabase }')) {
  agentCode = agentCode.replace(
    /import \{ Send \} from 'lucide-react';/,
    `import { Send } from 'lucide-react';\nimport { supabase } from '../lib/supabase';\nimport { Chess } from 'chess.js';`
  );
}

// Add real-time and legal moves
agentCode = agentCode.replace(
  /const fetchState = async \(\) => \{[\s\S]*?return \(\) => clearInterval\(intervalId\);\s*\}, \[gameId, agentToken\]\);/g,
  `useEffect(() => {
    if (!gameId || !agentToken) {
      setError('Missing game ID or token');
      setLoading(false);
      return;
    }

    const fetchState = async () => {
      try {
        const response = await fetch(\`/api/state?id=\${gameId}\`, {
          headers: { 'x-agent-token': agentToken }
        });
        if (!response.ok) throw new Error('Failed to fetch state');
        const data = await response.json();
        setGame(data);
        setLoading(false);
      } catch (err) {}
    };

    fetchState();

    const channel = supabase
      .channel(\`game-\${gameId}\`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: \`id=eq.\${gameId}\` }, (payload) => {
        setGame(prev => ({ ...prev, ...payload.new }));
      })
      .subscribe((status) => {
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setTimeout(() => channel.subscribe(), 2000);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, agentToken]);`
);

// Header Banner replacement
agentCode = agentCode.replace(
  /<div style=\{\{ background: '#111', borderBottom: '1px solid #e63946', fontSize: '12px', color: '#555', textAlign: 'center', padding: '6px', margin: '-1rem -1rem 1rem -1rem' \}\}>[\s\S]*?<\/div>/g,
  `<div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px', color: '#444', fontFamily: 'Inter', margin: '-1rem -1rem 1rem -1rem' }}>
    ⚙️ Automated Agent Interface — Not for manual use
  </div>`
);

// chess-board testid on wrapper
agentCode = agentCode.replace(
  /<div className="w-full aspect-square bg-\[#333\] rounded-lg overflow-hidden relative">/g,
  `<div data-testid="chess-board" className="w-full aspect-square bg-[#333] rounded-lg overflow-hidden relative">`
);

// Hide display components 
agentCode = agentCode.replace(
  /<div className="flex justify-between items-center bg-neutral-900 p-4 rounded-lg">([\s\S]*?)<\/div>/,
  `<div className="flex justify-between items-center bg-neutral-900 p-4 rounded-lg" style={{ display: 'none' }}>$1</div>`
);
agentCode = agentCode.replace(
  /<div className="flex-1 overflow-y-auto max-h-40 flex flex-col gap-2">([\s\S]*?)<\/div>/,
  `<div className="flex-1 overflow-y-auto max-h-40 flex flex-col gap-2" style={{ display: 'none' }}>$1</div>`
);

// Calculate legal moves
agentCode = agentCode.replace(
  `const lastMove = (game.move_history || [])[(game.move_history || []).length - 1] || null;`,
  `const lastMove = (game.move_history || [])[(game.move_history || []).length - 1] || null;
  let legalMovesArray = [];
  try {
    const tempChess = new Chess(game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    legalMovesArray = tempChess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
  } catch(e) {}`
);

// Add hidden divs before the final return closing tag
agentCode = agentCode.replace(
  `</div>\n    </div>`,
  `</div>
      <div data-testid="current-fen" style={{ display: 'none' }}>{game.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}</div>
      <div data-testid="legal-moves" style={{ display: 'none' }}>{JSON.stringify(legalMovesArray)}</div>
      <div data-testid="turn-indicator" style={{ display: 'none' }}>{isMyTurn ? 'Your Turn' : 'Waiting for White'}</div>
    </div>`
);

fs.writeFileSync('src/pages/Agent.jsx', agentCode, 'utf-8');
console.log("Agent updated");
