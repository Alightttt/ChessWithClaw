const fs = require('fs');

let content = fs.readFileSync('src/pages/Game.jsx', 'utf8');

// Replace both board instances to add pointer events logic
content = content.replace(
  /<div style={{ borderRadius: '4px', overflow: 'hidden', boxShadow: isOpenClawTurn \? '0 0 40px rgba\(230,57,70,0\.12\), 0 0 80px rgba\(230,57,70,0\.06\)' : '0 2px 20px rgba\(0,0,0,0\.6\), 0 0 0 1px rgba\(0,0,0,0\.4\)', width: '100%', position: 'relative', transition: 'box-shadow 0\.8s ease' }}>\s*<ChessBoard /g,
  `<div style={{ borderRadius: '4px', overflow: 'hidden', boxShadow: isOpenClawTurn ? '0 0 40px rgba(230,57,70,0.12), 0 0 80px rgba(230,57,70,0.06)' : '0 2px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4)', width: '100%', position: 'relative', transition: 'box-shadow 0.8s ease' }}>
          <div style={{ pointerEvents: game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned' ? 'auto' : 'none', opacity: game?.agent_connected || game?.status === 'finished' || game?.status === 'abandoned' ? 1 : 0.7 }}>
          <ChessBoard `
);

content = content.replace(
  /onCapture={handleCapture}\s*\/>\s*<\/div>/g,
  `onCapture={handleCapture}
          />
          </div>
          </div>`
);

fs.writeFileSync('src/pages/Game.jsx', content);
console.log('Fixed chessboard wrappers');
