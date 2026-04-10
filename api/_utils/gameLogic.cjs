function detectGameEvent(chessBefore, chessAfter, moveObj) {
  if (chessAfter.isCheckmate()) return "checkmate";
  if (chessAfter.isStalemate()) return "stalemate";
  if (chessAfter.isCheck()) {
    if (moveObj.color === 'w') return "agent_in_check";
    return "check_delivered";
  }
  if (moveObj.captured) return "piece_captured";
  if (moveObj.san.includes('O-O')) return "castled";
  if (moveObj.promotion) return "promotion";
  return "normal_move";
}

function getMaterialBalance(fen) {
  const fenBoard = fen.split(' ')[0];
  const counts = { p:0, n:0, b:0, r:0, q:0, P:0, N:0, B:0, R:0, Q:0 };
  for (let char of fenBoard) {
    if (counts[char] !== undefined) counts[char]++;
  }
  return {
    white: { P: counts.P, N: counts.N, B: counts.B, R: counts.R, Q: counts.Q },
    black: { p: counts.p, n: counts.n, b: counts.b, r: counts.r, q: counts.q }
  };
}

function getEmotionalContext(moveObj, chessAfter, wasInCheck) {
  if (moveObj.captured) {
    return "human_captured_your_piece";
  } else if (chessAfter.isCheck() || wasInCheck) {
    return "human_is_in_check";
  } else if (moveObj.san.includes('O-O')) {
    return "human_castled";
  } else if (moveObj.san.includes('+') || moveObj.san.includes('#') || (moveObj.piece !== 'p' && parseInt(moveObj.to[1]) >= 5)) {
    return "human_made_aggressive_move";
  } else {
    return "human_made_quiet_move";
  }
}

module.exports = {
  detectGameEvent,
  getMaterialBalance,
  getEmotionalContext
};
