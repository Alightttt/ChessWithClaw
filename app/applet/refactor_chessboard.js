const fs = require('fs');
let code = fs.readFileSync('src/components/chess/ChessBoard.jsx', 'utf-8');

// 1. Remove framer-motion from imports
code = code.replace(/import \{ motion, AnimatePresence \} from 'motion\/react';/, '');

// 2. Add draggedPiece to state
code = code.replace(
  'const [promotionMove, setPromotionMove] = useState(null);',
  `const [promotionMove, setPromotionMove] = useState(null);
  const [draggedPiece, setDraggedPiece] = useState(null);
  const [arrivedSquare, setArrivedSquare] = useState(null);`
);

// 3. Track arrivedSquare using lastMove
code = code.replace(
  `  const prevTurnRef = useRef(null);`,
  `  const prevTurnRef = useRef(null);

  useEffect(() => {
    if (lastMove) {
      const dest = typeof lastMove === 'string' ? lastMove.substring(2, 4) : lastMove.to;
      setArrivedSquare(dest);
      const timer = setTimeout(() => setArrivedSquare(null), 150);
      return () => clearTimeout(timer);
    }
  }, [lastMove]);
  
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'piece-arrive';
    if (!document.getElementById('piece-arrive')) {
      style.textContent = \`
        @keyframes pieceArrive {
          from { transform: scale(0.85); opacity: 0.7; }
          to   { transform: scale(1); opacity: 1; }
        }
      \`;
      document.head.appendChild(style);
    }
  }, []);
`
);

// 4. Update square rendering for drop handling
code = code.replace(
  `onClick={() => handleSquareClick(row, col)}`,
  `onClick={() => handleSquareClick(row, col)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedPiece) {
                    handleSquareClick(row, col, draggedPiece.sq);
                  }
                }}`
);

// Let's modify handleSquareClick to accept source parameter
code = code.replace(
  `const handleSquareClick = (row, col) => {`,
  `const handleSquareClick = (row, col, sourceSq = null) => {`
);

// We need to rewrite handleSquareClick to handle the drag drop logic if sourceSq is provided
code = code.replace(
  `if (!selectedSquare) {`,
  `if (sourceSq) {
      const movesToSquare = chess.moves({ square: sourceSq, verbose: true }).filter(m => m.to === square);
      if (movesToSquare.length > 0) {
        if (movesToSquare[0].promotion) {
          setPromotionMove({ from: sourceSq, to: square });
        } else {
          onMove(sourceSq, square);
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      }
      return;
    }
    
    if (!selectedSquare) {`
);

// 5. Re-do pieces rendering inside the square
// Replace {renderPiece(piece)} in an animated overlay with rendering piece directly in square
// Also remove the old overlay

const newRenderPiece = `
  const renderPiece = (piece, sq) => {
    if (!piece) return null;
    const isWhite = piece.color === 'w';
    const pieceName = \`\${piece.color}\${piece.type.toLowerCase()}\`;
    let pTheme = pieceTheme;
    if (!['neo', 'tournament', 'ocean'].includes(pTheme)) {
      pTheme = 'neo';
    }
    const url = \`https://raw.githubusercontent.com/GiorgioMegrelli/chess.com-boards-and-pieces/master/pieces/\${pTheme}/\${pieceName}.png\`;
    const isDraggable = interactive && isMyTurn && piece.color === playerColor;
    
    return (
      <img 
        src={url} 
        alt={pieceName} 
        draggable={isDraggable}
        onDragStart={(e) => {
          setDraggedPiece({ sq, piece });
          e.dataTransfer.setData('text/plain', sq);
          setTimeout(() => {
            if (e.target) e.target.style.opacity = '0.4';
          }, 0);
        }}
        onDragEnd={(e) => {
          setDraggedPiece(null);
          if (e.target) e.target.style.opacity = '1';
        }}
        className="relative z-10 w-[85%] h-[85%]" 
        style={{ 
          filter: 'none', 
          cursor: isDraggable ? 'grab' : 'default',
          animation: arrivedSquare === sq ? 'pieceArrive 0.15s ease-out' : 'none'
        }} 
      />
    );
  };
`;

code = code.replace(
  /const renderPiece = \(piece\) => \{[\s\S]*?return <img src=\{url\}.*?\/>;\s*\};/,
  newRenderPiece
);

// Remove Animated Pieces Layer entirely
code = code.replace(
  /\{\/\* Animated Pieces Layer \*\/\}[\s\S]*?\{\/\* Top Overlays Layer \(Above Pieces\) \*\/\}/,
  `{/* Top Overlays Layer (Above Pieces) */}`
);

// Render piece inside square
// Currently, square has:
/**
                {showCoordinates && row === 7 && (...)}
              </div>
*/

code = code.replace(
  /\{\/\* Coordinates \*\/\}([\s\S]*?)<\/div>/g,
  `{/* Coordinates */}$1
                {renderPiece(piece, sq)}
              </div>`
);

fs.writeFileSync('src/components/chess/ChessBoard.jsx', code, 'utf-8');
console.log("Refactored ChessBoard completed");
