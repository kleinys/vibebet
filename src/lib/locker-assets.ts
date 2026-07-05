/** Raster locker gambling assets (generated art). */
export const LOCKER_ASSETS_VERSION = "1";

function asset(path: string) {
  return `/locker-assets/${path}?v=${LOCKER_ASSETS_VERSION}`;
}

export const LOCKER_WHEEL_IMAGE = asset("vibe-casino-wheel.png");

export const CASE_IMAGES = {
  common: asset("case-uncommon-closed.png"),
  uncommon: asset("case-uncommon-closed.png"),
  rare: asset("case-rare-closed.png"),
  epic: asset("case-epic-closed.png"),
  legendary: asset("case-legendary-closed.png"),
  open: asset("case-open-burst.png"),
} as const;
