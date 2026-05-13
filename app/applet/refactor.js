const fs = require('fs');

let code = fs.readFileSync('src/pages/Game.jsx', 'utf-8');

// Match MAIN CONTENT
const mainContentRegex = /(\s*\{\/\* MAIN CONTENT SECTION \*\/\}.*?)(?=\s*\{\/\* STATUS BAR \*\/\})/s;
const match = mainContentRegex.exec(code);

if (!match) {
  console.log("Could not find MAIN CONTENT SECTION");
  process.exit(1);
}

const originalMainContent = match[1];

const agentCardMatch = /(\s*\{\/\* A\) AGENT CARD \*\/\}.*?)(?=\s*\{\/\* B\) CHESS BOARD \*\/\})/s.exec(originalMainContent);
const boardMatch = /(\s*\{\/\* B\) CHESS BOARD \*\/\}.*?)(?=\s*\{\/\* C\) YOU CARD \*\/\})/s.exec(originalMainContent);
const youCardMatch = /(\s*\{\/\* C\) YOU CARD \*\/\}.*?)(?=\s*\{\/\* D\) CHAT SECTION \*\/\})/s.exec(originalMainContent);
const chatMatch = /(\s*\{\/\* D\) CHAT SECTION \*\/\}.*?)(?=\s*\{\/\* E\) MOVE HISTORY \*\/\})/s.exec(originalMainContent);
const moveHistoryMatch = /(\s*\{\/\* E\) MOVE HISTORY \*\/\}.*?)(?=\s*\{\/\* STEP 4: BOTTOM INFO BAR \*\/\})/s.exec(originalMainContent);
const bottomInfoMatch = /(\s*\{\/\* STEP 4: BOTTOM INFO BAR \*\/\}.*)/s.exec(originalMainContent);

let agentCard = agentCardMatch[1];
let board = boardMatch[1];
let youCard = youCardMatch[1];
let chatSection = chatMatch[1];
let moveHistory = moveHistoryMatch[1];
let bottomInfo = bottomInfoMatch[1];

// Make adjustments to chess board optimistic updates for BOTH mobile and desktop
board = board.replace("fen={game.fen}", "fen={optimisticFen || game.fen}");
board = board.replace("lastMove={(game.move_history || [])[(game.move_history || []).length - 1] || null}", "lastMove={optimisticLastMove || (game.move_history || [])[(game.move_history || [])?.length - 1] || null}");

let dAgentCard = agentCard.replace("background: '#0e0e0e'", "background: '#111111'");
dAgentCard = dAgentCard.replace("borderBottom: '1px solid #111'", "border: '1px solid #1a1a1a', borderRadius: '12px'");

let dBoard = board.replace("padding: '12px'", "padding: '0', display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0, flexDirection: 'column'");
// We want exactly what's requested: Chess board centered gracefully
dBoard = dBoard.replace("<div style={{ width: '100%', flexShrink: 0, position: 'relative', padding: '12px', boxSizing: 'border-box' }}>",
  "<div style={{ width: '100%', flex: 1, position: 'relative', padding: '0', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>" + 
  "<div style={{ width: 'min(100%, calc(100vh - 52px - 72px - 48px - 32px))', aspectRatio: '1/1', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>");
dBoard = dBoard + "\n</div>"; // Close the inner wrapper

let dChatSection = chatSection.replace("background: '#0a0a0a'", "background: '#111111', border: '1px solid #1a1a1a', borderRadius: '12px', overflow: 'hidden'");
dChatSection = dChatSection.replace("height: '180px'", "flex: 1, minHeight: 0");
dChatSection = dChatSection.replace("borderTop: '1px solid #111111'", "borderTop: 'none'");

let dMoveHistory = moveHistory.replace("background: '#0a0a0a'", "background: '#111111', border: '1px solid #1a1a1a', borderRadius: '12px', overflow: 'hidden', height: moveHistoryOpen ? '240px' : '160px', flexShrink: 0, display: 'flex', flexDirection: 'column', transition: 'height 0.3s ease'");
dMoveHistory = dMoveHistory.replace("padding: '10px 12px', borderTop: '1px solid #111'", "padding: '0 12px', height: '36px', borderBottom: '1px solid #1a1a1a', background: '#161616'");
dMoveHistory = dMoveHistory.replace("maxHeight: '200px'", "flex: 1");

let dBottomInfo = bottomInfo.replace("background: '#0a0a0a'", "background: '#111111'");
dBottomInfo = dBottomInfo.replace("borderTop: '1px solid #1a1a1a'", "border: '1px solid #1a1a1a', borderRadius: '8px', height: '40px'");

const newMainContent = `
      {/* MAIN CONTENT AREA - RESPONSIVE */}
      {isDesktop ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
          {/* LEFT DESKTOP COLUMN */}
          <div style={{ width: '56%', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '12px 8px 12px 16px', gap: '8px', overflow: 'hidden' }}>
            \${dAgentCard}
            \${dBoard}
            \${dBottomInfo}
          </div>

          {/* RIGHT DESKTOP COLUMN */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px 12px 8px', gap: '8px', overflow: 'hidden', minHeight: 0 }}>
            \${dChatSection}
            \${dMoveHistory}
          </div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="scrollbar-none">
            \${agentCard}
            \${board}
            \${youCard}
            \${chatSection}
            \${moveHistory}
          </div>
          \${bottomInfo}
        </>
      )}
`;

code = code.substring(0, match.index) + newMainContent + code.substring(match.index + match[0].length);

fs.writeFileSync('src/pages/Game.jsx', code, 'utf-8');

console.log("Game.jsx layout refactored.");
