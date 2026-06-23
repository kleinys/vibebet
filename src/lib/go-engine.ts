/** Simplified 9×9 Go — capture by liberties, pass-pass ends with stone count (+ komi for white). */

export type GoCell = 0 | 1 | 2; // 0 empty, 1 black (creator), 2 white (opponent)

const SIZE = 9;
const KOMI = 6.5;

export function initialGoBoard(): GoCell[] {
  return Array(SIZE * SIZE).fill(0) as GoCell[];
}

function neighbors(idx: number): number[] {
  const r = Math.floor(idx / SIZE);
  const c = idx % SIZE;
  const out: number[] = [];
  if (r > 0) out.push((r - 1) * SIZE + c);
  if (r < SIZE - 1) out.push((r + 1) * SIZE + c);
  if (c > 0) out.push(r * SIZE + (c - 1));
  if (c < SIZE - 1) out.push(r * SIZE + (c + 1));
  return out;
}

function collectGroup(board: GoCell[], idx: number): { stones: number[]; liberties: Set<number> } {
  const color = board[idx];
  const stones: number[] = [];
  const liberties = new Set<number>();
  const stack = [idx];
  const seen = new Set<number>([idx]);
  while (stack.length) {
    const cur = stack.pop()!;
    stones.push(cur);
    for (const n of neighbors(cur)) {
      if (board[n] === 0) liberties.add(n);
      else if (board[n] === color && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return { stones, liberties };
}

function removeGroup(board: GoCell[], idx: number): GoCell[] {
  const next = [...board] as GoCell[];
  const { stones } = collectGroup(next, idx);
  for (const s of stones) next[s] = 0;
  return next;
}

export function applyGoMove(
  board: GoCell[],
  idx: number,
  color: 1 | 2,
  prevBoard: GoCell[] | null,
): { board?: GoCell[]; error?: string; captures?: number } {
  if (idx < 0 || idx >= SIZE * SIZE) return { error: "Off board." };
  if (board[idx] !== 0) return { error: "Occupied." };

  let next = [...board] as GoCell[];
  next[idx] = color;

  let captures = 0;
  const opp = color === 1 ? 2 : 1;
  for (const n of neighbors(idx)) {
    if (next[n] === opp) {
      const g = collectGroup(next, n);
      if (g.liberties.size === 0) {
        for (const s of g.stones) {
          next[s] = 0;
          captures++;
        }
      }
    }
  }

  const selfGroup = collectGroup(next, idx);
  if (selfGroup.liberties.size === 0) return { error: "Suicide." };

  if (prevBoard && next.every((v, i) => v === prevBoard[i])) {
    return { error: "Ko — repeat forbidden." };
  }

  return { board: next, captures };
}

export function scoreGo(board: GoCell[]): { black: number; white: number; winner: "creator" | "opponent" | "draw" } {
  let black = 0;
  let white = 0;
  for (const c of board) {
    if (c === 1) black++;
    else if (c === 2) white++;
  }
  white += KOMI;
  if (black > white) return { black, white, winner: "creator" };
  if (white > black) return { black, white, winner: "opponent" };
  return { black, white, winner: "draw" };
}

export function goColorForUser(isCreator: boolean): 1 | 2 {
  return isCreator ? 1 : 2;
}

export const GO_BOARD_SIZE = SIZE;
