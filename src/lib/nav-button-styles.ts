/** Shared filled CTA styles for game hub nav links. */
export const filledNavBtn = {
  violet:
    "rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-violet-900/40 hover:bg-violet-500",
  fuchsia:
    "rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-fuchsia-900/40 hover:bg-fuchsia-500",
  sky: "rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/40 hover:bg-sky-500",
  emerald:
    "rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-900/40 hover:bg-emerald-500",
  amber:
    "rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-amber-900/40 hover:bg-amber-500",
} as const;

export type FilledNavTone = keyof typeof filledNavBtn;
