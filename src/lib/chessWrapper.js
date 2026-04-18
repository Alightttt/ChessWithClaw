let ChessClass = null

export const getChess = async () => {
  if (!ChessClass) {
    const mod = await import('chess.js')
    ChessClass = mod.Chess
  }
  return ChessClass
}

export const createChess = async (fen) => {
  const Chess = await getChess()
  return fen ? new Chess(fen) : new Chess()
}
