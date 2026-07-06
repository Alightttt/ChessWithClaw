const fs = require('fs');
let code = fs.readFileSync('src/components/LivePlatformActivity/index.jsx', 'utf8');

code = code.replace(
  "export default function LivePlatformActivity() {",
  "export default function LivePlatformActivity({ onPlayNow }) {"
);

code = code.replace(
  `<a href="/api/new" style={{ color: '#E63946', textDecoration: 'none', fontWeight: 600, marginLeft: '8px' }}>Challenge Mine Now →</a>`,
  `<a href="#" onClick={(e) => { e.preventDefault(); if (onPlayNow) onPlayNow(e); else window.location.href = '/api/new'; }} style={{ color: '#E63946', textDecoration: 'none', fontWeight: 600, marginLeft: '8px' }}>Challenge Mine Now →</a>`
);

fs.writeFileSync('src/components/LivePlatformActivity/index.jsx', code);
