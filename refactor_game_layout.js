const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

// 1. Main content area
code = code.replace(
  /\{isDesktop \? \(\s*<div style=\{\{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 \}\}>/,
  `{isDesktop ? (
        <div style={{ display: 'flex', flexDirection: 'row', height: 'calc(100dvh - 52px)', overflow: 'hidden', gap: '0' }}>`
);

// 2. LEFT PANEL
code = code.replace(
  /<div style=\{\{ width: '56%', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '12px 8px 12px 16px', gap: '8px', overflow: 'hidden' \}\}>/,
  `<div style={{ width: 'min(56%, calc(100dvh - 52px - 32px))', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '16px 8px 16px 16px', gap: '10px', overflow: 'hidden' }}>`
);

// Agent section inside left panel
code = code.replace(
  /<div style=\{\{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#111111', border: '1px solid #1a1a1a', borderRadius: '12px', boxShadow: isOpenClawTurn \? '0 0 30px rgba\(230,57,70,0\.06\)' : 'none', transition: 'box-shadow 0\.7s ease' \}\}>/,
  `<div style={{ flexShrink: 0, height: '56px', display: 'flex', alignItems: 'center', gap: '10px', padding: '0 12px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '12px', boxShadow: isOpenClawTurn ? '0 0 30px rgba(230,57,70,0.06)' : 'none', transition: 'box-shadow 0.7s ease' }}>`
);

// Board wrapper
code = code.replace(
  /<div style=\{\{ width: '100%', flex: 1, position: 'relative', padding: '0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 \}\}>/,
  `<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>`
);

// Board itself
code = code.replace(
  /<div style=\{\{ width: 'min\(100%, calc\(100vh - 52px - 72px - 48px - 32px\)\)', aspectRatio: '1\/1', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch' \}\}>/,
  `<div style={{ width: '100%', height: '100%', maxWidth: 'min(100%, calc(100dvh - 52px - 56px - 52px))', aspectRatio: '1/1', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>`
);

// RIGHT DESKTOP COLUMN -> RIGHT PANEL
code = code.replace(
  /\{\/\* RIGHT DESKTOP COLUMN \*\/\}\s*<div style=\{\{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px 12px 8px', gap: '8px', overflow: 'hidden', minHeight: 0 \}\}>/,
  `{/* RIGHT DESKTOP COLUMN */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 16px 8px', gap: '10px', overflow: 'hidden', minWidth: 0 }}>`
);

// Chat section
code = code.replace(
  /\{\/\* D\) CHAT SECTION \*\/\}\s*<div style=\{\{ flexShrink: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0', borderTop: 'none', background: '#111111', border: '1px solid #1a1a1a', borderRadius: '12px', overflow: 'hidden' \}\}>/,
  `{/* D) CHAT SECTION */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d0d0d', borderRadius: '12px', border: '1px solid #1a1a1a', overflow: 'hidden', minHeight: 0 }}>`
);

fs.writeFileSync('src/pages/Game.jsx', code);
console.log('Done refactoring desktop Game layout');
