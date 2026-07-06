const fs = require('fs');
let code = fs.readFileSync('src/pages/Home.jsx', 'utf8');

code = code.replace(
  "<LivePlatformActivity />",
  "<LivePlatformActivity onPlayNow={handlePlayNow} />"
);

fs.writeFileSync('src/pages/Home.jsx', code);
