const fs = require('fs');
let code = fs.readFileSync('api/mcp.js', 'utf8');

// Restore getChessClass
code = code.replace(
`async function getChessClass() {
  return _ChessClass;
}

function callChessMethod(chess, camelName, snakeName, ...args) {`,
`async function getChessClass() {
  if (!_ChessClass) {
    const mod = await import('chess.js');
    _ChessClass = mod.Chess || mod.default?.Chess || mod.default;
  }
  return _ChessClass;
}

function callChessMethod(chess, camelName, snakeName, ...args) {`
);

// Fix chess method calls
code = code.replace(/chess\.isCheckmate\(\)/g, `callChessMethod(chess, 'isCheckmate', 'in_checkmate')`);
code = code.replace(/chess\.isStalemate\(\)/g, `callChessMethod(chess, 'isStalemate', 'in_stalemate')`);
code = code.replace(/chess\.isDraw\(\)/g, `callChessMethod(chess, 'isDraw', 'in_draw')`);
code = code.replace(/chess\.inCheck\(\)/g, `callChessMethod(chess, 'inCheck', 'in_check')`);

fs.writeFileSync('api/mcp.js', code);
