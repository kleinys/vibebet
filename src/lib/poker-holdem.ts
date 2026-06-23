import { Hand } from "pokersolver";

const RANKS = "23456789TJQKA";
const SUITS = "cdhs";

export type Card = string; // e.g. "As", "Td"

export type PokerPhase = "preflop" | "flop" | "turn" | "river" | "showdown";

export type PokerState = {
  deck: Card[];
  deckIdx: number;
  hole: { creator: Card[]; opponent: Card[] };
  community: Card[];
  phase: PokerPhase;
};

function shuffleDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) deck.push(`${r}${s}`);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function dealNewPokerHand(): PokerState {
  const deck = shuffleDeck();
  return {
    deck,
    deckIdx: 4,
    hole: { creator: [deck[0], deck[1]], opponent: [deck[2], deck[3]] },
    community: [],
    phase: "preflop",
  };
}

export function advancePokerStreet(state: PokerState): PokerState {
  const next = { ...state, community: [...state.community], deckIdx: state.deckIdx };
  if (next.phase === "preflop") {
    next.community.push(next.deck[next.deckIdx++], next.deck[next.deckIdx++], next.deck[next.deckIdx++]);
    next.phase = "flop";
  } else if (next.phase === "flop") {
    next.community.push(next.deck[next.deckIdx++]);
    next.phase = "turn";
  } else if (next.phase === "turn") {
    next.community.push(next.deck[next.deckIdx++]);
    next.phase = "river";
  } else if (next.phase === "river") {
    next.phase = "showdown";
  }
  return next;
}

export function evaluateShowdown(state: PokerState): {
  winner: "creator" | "opponent" | "draw";
  creatorRank: string;
  opponentRank: string;
} {
  const cHand = Hand.solve([...state.hole.creator, ...state.community]);
  const oHand = Hand.solve([...state.hole.opponent, ...state.community]);
  const winners = Hand.winners([cHand, oHand]);
  let winner: "creator" | "opponent" | "draw" = "draw";
  if (winners.length === 1) {
    winner = winners[0] === cHand ? "creator" : "opponent";
  }
  return {
    winner,
    creatorRank: cHand.descr,
    opponentRank: oHand.descr,
  };
}

export function maskPokerState(state: PokerState, role: "creator" | "opponent" | "spectator"): PokerState {
  if (state.phase !== "showdown" && role !== "spectator") {
    return {
      ...state,
      hole: {
        creator: role === "creator" ? state.hole.creator : ["??", "??"],
        opponent: role === "opponent" ? state.hole.opponent : ["??", "??"],
      },
    };
  }
  return state;
}
