const fs = require('fs');
let code = fs.readFileSync('src/components/GameCreated.jsx', 'utf8');

const target = `    const cookieName = \`game_owner_\${gameId}\`;
    const cookieMatch = document.cookie.match(new RegExp('(^| )' + cookieName + '=([^;]+)'));
    const localOwner = localStorage.getItem(\`game_owner_\${gameId}\`);
    if (cookieMatch && !localOwner) {
      // Hydrate to localStorage for easy cross-tab use
      localStorage.setItem(\`game_owner_\${gameId}\`, cookieMatch[2]);
    }`;

code = code.replace(target, "");
fs.writeFileSync('src/components/GameCreated.jsx', code);
