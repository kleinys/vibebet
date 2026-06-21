export type FastAsset = "btc" | "eth" | "sol";

export const FAST_ASSET_ICONS: Record<FastAsset, string> = {
  btc: "₿",
  eth: "Ξ",
  sol: "◎",
};

export const FAST_ASSET_LABELS: Record<FastAsset, string> = {
  btc: "Bitcoin",
  eth: "Ethereum",
  sol: "Solana",
};
