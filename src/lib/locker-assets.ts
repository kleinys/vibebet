/** Raster locker gambling assets (generated art, matted). */
export const LOCKER_ASSETS_VERSION = "2";

function asset(path: string) {
  return `/locker-assets/${path}?v=${LOCKER_ASSETS_VERSION}`;
}

export const LOCKER_WHEEL_IMAGE = asset("vibe-casino-wheel.webp");

export const CASE_IMAGES = {
  common: asset("case-uncommon-closed.webp"),
  uncommon: asset("case-uncommon-closed.webp"),
  rare: asset("case-rare-closed.webp"),
  epic: asset("case-epic-closed.webp"),
  legendary: asset("case-legendary-closed.webp"),
  open: asset("case-open-burst.webp"),
} as const;
