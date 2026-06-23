/** American checkers on 8×8 — dark squares only. Positive = creator (red), negative = opponent (black). */

export type CheckersCell = -2 | -1 | 0 | 1 | 2;

const SIZE = 8;

export function initialCheckersBoard(): CheckersCell[] {
  const b: CheckersCell[] = Array(64).fill(0);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) b[r * SIZE + c] = -1;
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) b[r * SIZE + c] = 1;
    }
  }
  return b;
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function isDark(r: number, c: number) {
  return (r + c) % 2 === 1;
}

function pieceSide(p: CheckersCell): 1 | -1 | 0 {
  if (p > 0) return 1;
  if (p < 0) return -1;
  return 0;
}

function isKing(p: CheckersCell) {
  return Math.abs(p) === 2;
}

export type CheckersMove = { from: number; to: number; captures: number[] };

function cloneBoard(board: CheckersCell[]) {
  return [...board] as CheckersCell[];
}

function applyMove(board: CheckersCell[], move: CheckersMove): CheckersCell[] {
  const next = cloneBoard(board);
  const piece = next[move.from];
  next[move.from] = 0;
  for (const cap of move.captures) next[cap] = 0;
  next[move.to] = piece;
  const toRow = Math.floor(move.to / SIZE);
  if (piece === 1 && toRow === 0) next[move.to] = 2;
  if (piece === -1 && toRow === 7) next[move.to] = -2;
  return next;
}

function jumpDirs(side: 1 | -1, king: boolean): [number, number][] {
  const fwd = side === 1 ? -1 : 1;
  if (king) return [
    [fwd, -1], [fwd, 1], [-fwd, -1], [-fwd, 1],
  ];
  return [[fwd, -1], [fwd, 1]];
}

function stepMoves(
  board: CheckersCell[],
  from: number,
  side: 1 | -1,
  mustCapture: boolean,
): CheckersMove[] {
  const moves: CheckersMove[] = [];
  const r0 = Math.floor(from / SIZE);
  const c0 = from % SIZE;
  const piece = board[from];
  const king = isKing(piece);

  for (const [dr, dc] of jumpDirs(side, king)) {
    const r1 = r0 + dr;
    const c1 = c0 + dc;
    if (!inBounds(r1, c1) || !isDark(r1, c1)) continue;
    const mid = r1 * SIZE + c1;
    if (board[mid] !== 0) continue;
    if (!mustCapture) moves.push({ from, to: mid, captures: [] });
  }

  for (const [dr, dc] of jumpDirs(side, true)) {
    const r1 = r0 + dr;
    const c1 = c0 + dc;
    const r2 = r0 + dr * 2;
    const c2 = c0 + dc * 2;
    if (!inBounds(r2, c2) || !isDark(r2, c2)) continue;
    const mid = r1 * SIZE + c1;
    const to = r2 * SIZE + c2;
    if (board[mid] === 0 || pieceSide(board[mid]) === side) continue;
    if (board[to] !== 0) continue;
    moves.push({ from, to, captures: [mid] });
  }
  return moves;
}

export function legalCheckersMoves(board: CheckersCell[], side: 1 | -1): CheckersMove[] {
  const captures: CheckersMove[] = [];
  const quiet: CheckersMove[] = [];
  for (let i = 0; i < 64; i++) {
    if (pieceSide(board[i]) !== side) continue;
    captures.push(...stepMoves(board, i, side, true).filter((m) => m.captures.length));
    quiet.push(...stepMoves(board, i, side, false).filter((m) => !m.captures.length));
  }
  return captures.length ? captures : quiet;
}

export function applyCheckersMove(board: CheckersCell[], move: CheckersMove, side: 1 | -1) {
  const legal = legalCheckersMoves(board, side);
  const ok = legal.some(
    (m) => m.from === move.from && m.to === move.to && m.captures.join() === move.captures.join(),
  );
  if (!ok) return { error: "Illegal move." as const };
  const next = applyMove(board, move);
  const stillSide = legalCheckersMoves(next, side);
  if (move.captures.length && stillSide.some((m) => m.captures.length && m.from === move.to)) {
    return { board: next, continueTurn: true as const };
  }
  const opponent = side === 1 ? -1 : 1;
  const oppMoves = legalCheckersMoves(next, opponent);
  if (oppMoves.length === 0) {
    const creatorPieces = next.some((c) => c > 0);
    const oppPieces = next.some((c) => c < 0);
    if (!creatorPieces || !oppPieces) {
      return {
        board: next,
        winner: creatorPieces ? ("creator" as const) : ("opponent" as const),
      };
    }
    return { board: next, draw: true as const };
  }
  return { board: next, continueTurn: false as const };
}

export function checkersSideForUser(isCreator: boolean): 1 | -1 {
  return isCreator ? 1 : -1;
}
