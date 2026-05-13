const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf-8');

code = code.replace(
  /<div style=\{\{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'rgba\(255,255,255,0\.4\)', marginTop: '-2px', marginBottom: '2px' \}\}>\s*Game \{gameNumber\} with \{agentName\}\s*<\/div>/g,
  ''
);

fs.writeFileSync('src/pages/Game.jsx', code, 'utf-8');
