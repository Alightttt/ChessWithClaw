const fs = require('fs');
let code = fs.readFileSync('src/components/LivePlatformActivity/index.jsx', 'utf8');

const target = `<div className={styles.queenFloat} style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '120px',
    height: '120px',
    opacity: 0.06,
    pointerEvents: 'none',
    zIndex: 0
  }}>
    <ChessPiece pieceKey="wQ" theme="neo" />
  </div>`;

const replacement = `<div style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '120px',
    height: '120px',
    opacity: 0.06,
    pointerEvents: 'none',
    zIndex: 0
  }}>
    <div className={styles.queenFloat} style={{ width: '100%', height: '100%' }}>
      <ChessPiece pieceKey="wQ" theme="neo" />
    </div>
  </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/LivePlatformActivity/index.jsx', code);
