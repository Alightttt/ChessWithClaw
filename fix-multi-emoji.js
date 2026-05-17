const fs = require('fs');
['src/pages/Game.jsx', 'src/pages/Agent.jsx', 'src/pages/Home.jsx'].forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/>\s*🦞\s*</g, '><LobsterEmoji /><');
  fs.writeFileSync(f, content);
});
