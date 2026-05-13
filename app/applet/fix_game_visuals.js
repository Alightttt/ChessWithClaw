const fs = require('fs');

let gameCode = fs.readFileSync('src/pages/Game.jsx', 'utf-8');

// ==== 1. Update Typing Indicator ====
const newTypingIndicator = `{agentTyping && (
              <div style={{ display:'flex', alignItems:'center', gap:'4px', padding:'8px 12px' }}>
                <span style={{fontSize:'11px', color:'#555', marginRight:'4px', fontFamily:'Inter'}}>
                  {agentName}
                </span>
                {['0s','0.15s','0.3s'].map((delay, i) => (
                  <span key={i} style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#555', display:'inline-block', animation:\`typingBounce 1.2s \${delay} ease-in-out infinite\` }} />
                ))}
              </div>
            )}`;

gameCode = gameCode.replace(
  /\{agentTyping && \([\s\S]*?alignSelf: 'flex-start', background: '#161616', border: '1px solid #222'[\s\S]*?<\/div>\s*\)\}/g,
  newTypingIndicator
);

// ==== 2. Update Bubble Styles ====
gameCode = gameCode.replace(/borderRadius: '16px 16px 4px 16px', padding: '10px 14px', maxWidth: '75%'/g, "borderRadius: '18px 18px 4px 18px', padding: '10px 14px', maxWidth: '78%'");
gameCode = gameCode.replace(/borderRadius: '16px 16px 16px 4px', padding: '10px 14px', maxWidth: '75%'/g, "borderRadius: '18px 18px 18px 4px', padding: '10px 14px', maxWidth: '78%'");

// Change background: '#1a1a1a' to '#1c1c1c' for agent
gameCode = gameCode.replace(/background: '#1a1a1a', color: '#f2f2f2'/g, "background: '#1c1c1c', color: '#f2f2f2'");

// ==== 4. Add setBoardTheme and setPieceStyle to Supabase REALTIME ====
const oldRealtimePayload = /if\s*\(\s*payload\.new\.chat_history\s*\)\s*setChatMessages\(\s*payload\.new\.chat_history\s*\)\;/;
const newRealtimePayload = `if (payload.new.chat_history) setChatMessages(payload.new.chat_history);
      if (payload.new.board_theme) setBoardTheme(payload.new.board_theme);
      if (payload.new.piece_style) setPieceStyle(payload.new.piece_style);`;

gameCode = gameCode.replace(oldRealtimePayload, newRealtimePayload);

// Add missing states if they don't exist
if (!gameCode.includes('const [boardTheme, setBoardTheme] =')) {
  gameCode = gameCode.replace('const [game, setGame] = useState(null);', `const [game, setGame] = useState(null);\n  const [boardTheme, setBoardTheme] = useState(game?.board_theme || 'green');\n  const [pieceStyle, setPieceStyle] = useState(game?.piece_style || 'standard');`);
}

// Ensure theme colors rendering below chessboard
const colorDots = `
          {/* THEME SELECTOR DOTS */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
            {[
              { name: 'green', color: '#769656' },
              { name: 'brown', color: '#B58863' },
              { name: 'slate', color: '#4C7B9B' },
              { name: 'navy', color: '#5B84A8' },
              { name: 'red', color: '#C45A41' },
              { name: 'forest', color: '#2E6B34' }
            ].map((theme) => (
              <div
                key={theme.name}
                onClick={async () => {
                  setBoardTheme(theme.name);
                  await getSupabaseWithToken(localStorage.getItem(\`game_owner_\${gameId}\`)).from('games').update({ board_theme: theme.name }).eq('id', gameId);
                }}
                style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: theme.color,
                  border: boardTheme === theme.name ? '2px solid #f2f2f2' : '2px solid transparent',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
`;

gameCode = gameCode.replace(/<ChessBoard([\s\S]*?)\/>/g, `<ChessBoard boardTheme={boardTheme} pieceStyle={pieceStyle} $1/>\n${colorDots}`);


fs.writeFileSync('src/pages/Game.jsx', gameCode, 'utf-8');

// ==== 6. ChessBoard.jsx Themes ====
let cbCode = fs.readFileSync('src/components/chess/ChessBoard.jsx', 'utf-8');

if (!cbCode.includes('THEMES')) {
  cbCode = cbCode.replace(
    'const { fen, move_history, last_move, player_color, turn } = game || {};',
    `const { fen, move_history, last_move, player_color, turn } = game || {};
  const currentTheme = boardTheme;
  const THEMES = {
     green:  { light: '#EEEED2', dark: '#769656' },
     brown:  { light: '#F0D9B5', dark: '#B58863' },
     slate:  { light: '#DEE3E6', dark: '#4C7B9B' },
     navy:   { light: '#C8D8E8', dark: '#5B84A8' },
     red:    { light: '#EDD5B3', dark: '#C45A41' },
     forest: { light: '#F5F5F0', dark: '#2E6B34' },
  };
  const themeColors = THEMES[currentTheme] || THEMES.green;`
  );

  cbCode = cbCode.replace(
    /const isLight = \(\s*row \+ col\s*\) % 2 === 0;/g,
    `const isLight = (row + col) % 2 === 0;
                const squareColor = isLight ? themeColors.light : themeColors.dark;`
  );

  cbCode = cbCode.replace(
    /backgroundColor:\s*isLight\s*\?\s*'#[A-Fa-f0-9]+'\s*:\s*'#[A-Fa-f0-9]+'/g,
    `backgroundColor: squareColor`
  );

  cbCode = cbCode.replace(
    /const url = \`https:\/\/raw\.githubusercontent\.com\/GiorgioMegrelli\/chess\.com-boards-and-pieces\/master\/pieces\/\$\{pTheme\}\/\$\{pieceName\}\.png\`;/g,
    `const url = \`/pieces/\${pieceStyle}/\${pieceName}.svg\`;`
  );
  
  // Actually the previous piece image url might be changed. So:
  cbCode = cbCode.replace(
    /const url =.*?;/g,
    `const url = \`/pieces/\${pieceStyle}/\${pieceName}.svg\`;`
  );

  // We define props.boardTheme and props.pieceStyle
  cbCode = cbCode.replace(/game,(\s*)onMove/g, "game,$1onMove,$1boardTheme = 'green',$1pieceStyle = 'standard'");

  fs.writeFileSync('src/components/chess/ChessBoard.jsx', cbCode, 'utf-8');
}

console.log("Game.jsx + ChessBoard.jsx updated visually");
