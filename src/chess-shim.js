// Chess.js shim — redirects all chess.js imports to window.Chess from CDN
const ChessConstructor = function(...args) {
  if (typeof window !== 'undefined' && typeof window.Chess === 'function') {
    return new window.Chess(...args);
  }
  throw new Error('Chess not loaded yet');
};

ChessConstructor.prototype = Object.create(
  typeof window !== 'undefined' && window.Chess ? window.Chess.prototype : Object.prototype
);

export { ChessConstructor as Chess };
export default ChessConstructor;
