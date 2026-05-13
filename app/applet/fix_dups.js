const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf-8');
code = code.replace(/boardTheme=\{boardTheme\}\s*pieceTheme=\{pieceTheme\}/g, '');
fs.writeFileSync('src/pages/Game.jsx', code, 'utf-8');
