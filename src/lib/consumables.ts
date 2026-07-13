/** Cross-mode consumable tokens (inventory prep for Phase 2+). */

export const CONSUMABLE_SLUGS = {
  adrenaline_token: {
    slug: "adrenaline_token",
    label: "Adrenaline token",
    description: "One free casino spin with a small luck boost after winning a duel.",
  },
} as const;

export type ConsumableSlug = keyof typeof CONSUMABLE_SLUGS;

export interface UserConsumable {
  slug: ConsumableSlug;
  quantity: number;
}
