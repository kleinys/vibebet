/** Spark-tier image tagging samples (cat vs dog). */

export type SparkTagLabel = "cat" | "dog";

export interface SparkTagImage {
  id: string;
  emoji: string;
  label: SparkTagLabel;
  hint: string;
}

export const SPARK_TAG_IMAGES: SparkTagImage[] = [
  { id: "1", emoji: "🐱", label: "cat", hint: "Domestic feline" },
  { id: "2", emoji: "🐶", label: "dog", hint: "Domestic canine" },
  { id: "3", emoji: "🐕", label: "dog", hint: "Puppy energy" },
  { id: "4", emoji: "🐈", label: "cat", hint: "Sitting cat" },
  { id: "5", emoji: "🦮", label: "dog", hint: "Guide dog" },
  { id: "6", emoji: "😺", label: "cat", hint: "Grinning cat" },
  { id: "7", emoji: "🐩", label: "dog", hint: "Poodle" },
  { id: "8", emoji: "🐈‍⬛", label: "cat", hint: "Black cat" },
  { id: "9", emoji: "🐕‍🦺", label: "dog", hint: "Service dog" },
  { id: "10", emoji: "😸", label: "cat", hint: "Happy cat" },
];

export const SPARK_SHARE_TEXT =
  "Earning VIBE on @VibeBet — markets, duels, and mini-games in one place. #VibeBet #SideHustle";

export function sparkShareUrl(): string {
  const text = encodeURIComponent(SPARK_SHARE_TEXT);
  return `https://twitter.com/intent/tweet?text=${text}`;
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
