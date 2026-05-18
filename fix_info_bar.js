const fs = require('fs');
let code = fs.readFileSync('src/pages/Game.jsx', 'utf8');

// The bottom info bar:
const infoBarRegex = /\{\/\*\s*STEP 4: BOTTOM INFO BAR\s*\*\/\}\s*<div style=\{\{ flexShrink: 0, background.*?<\/div>/s;
const infoBarMatch = code.match(infoBarRegex);

if (infoBarMatch) {
  // modify info bar style
  let newInfoBar = infoBarMatch[0].replace(
    /style=\{\{ flexShrink: 0, background: '#111111', border: '1px solid #1a1a1a', borderRadius: '8px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 40 \}\}/,
    `style={{ flexShrink: 0, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '8px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 40 }}`
  );
  
  // remove infoBar from its current place
  code = code.replace(infoBarRegex, '');

  // find right desktop column end
  const rightColumnEndRegex = /\s*<\/div>\s*<\/div>\s*\)\s*:\s*\(\s*<>\s*<div style=\{\{ flex: 1, display: 'flex', flexDirection: 'column'/;
  
  // Actually, let's insert it before the closing of RIGHT DESKTOP COLUMN.
  // The structure is:
  // {/* E) MOVE HISTORY */}
  // ... div ...
  // </div> (end of right column)
  const moveHistoryEndRegex = /\{\/\* E\) MOVE HISTORY \*\/\}.*?<\/div>\s*<\/div>\s*\)\s*:\s*\(/s;
  
  code = code.replace(/(\{\/\* E\) MOVE HISTORY \*\/\}.*?<\/div>\s*)\s*(<\/div>\s*\)\s*:\s*\()/s, (match, p1, p2) => {
    return p1 + '\n\n' + newInfoBar + '\n' + p2;
  });
}

// Modify MOVE HISTORY style
code = code.replace(
  /<div style=\{\{ background: '#111111', border: '1px solid #1a1a1a', borderRadius: '12px', overflow: 'hidden', height: moveHistoryOpen \? '240px' : '160px', flexShrink: 0, display: 'flex', flexDirection: 'column', transition: 'height 0\.3s ease' \}\}>/,
  `<div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '12px', overflow: 'hidden', height: '160px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>`
);

// We need to keep moveHistory content open permanently? The prompt didn't say to remove the toggle, but requested height: 160px rigidly. I'll just remove the ternary operator for height.

fs.writeFileSync('src/pages/Game.jsx', code);
console.log('Fixed info bar position and move history style');
