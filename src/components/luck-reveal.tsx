"use client";

import { useEffect, useState } from "react";

const RPS_EMOJI: Record<string, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✌️",
};

export function parseRpsReveal(message: string): {
  yours: string;
  theirs: string;
} | null {
  const m = message.match(/(\w+)\s+vs\s+(\w+)/i);
  if (!m) return null;
  return { yours: m[1].toLowerCase(), theirs: m[2].toLowerCase() };
}

export function parseCardReveal(message: string): {
  yours: number;
  theirs: number;
} | null {
  const m = message.match(/Cards\s+(\d+)\s+vs\s+(\d+)/i);
  if (!m) return null;
  return { yours: Number(m[1]), theirs: Number(m[2]) };
}

export function LuckRevealOverlay({
  kind,
  message,
  onDone,
}: {
  kind: "rps" | "card" | "coin";
  message: string;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setVisible(false);
      onDone();
    }, kind === "coin" ? 900 : 1200);
    return () => window.clearTimeout(t);
  }, [kind, onDone]);

  if (!visible) return null;

  if (kind === "rps") {
    const parsed = parseRpsReveal(message);
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
        <div className="luck-reveal flex items-center gap-8 rounded-2xl border border-violet-500/30 bg-zinc-950 px-10 py-8 shadow-2xl">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">You</p>
            <p className="mt-2 text-5xl">
              {RPS_EMOJI[parsed?.yours ?? "rock"] ?? "✊"}
            </p>
          </div>
          <p className="text-lg font-bold text-violet-300">VS</p>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Bot</p>
            <p className="mt-2 text-5xl luck-reveal" style={{ animationDelay: "0.15s" }}>
              {RPS_EMOJI[parsed?.theirs ?? "scissors"] ?? "✌️"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "card") {
    const parsed = parseCardReveal(message);
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
        <div className="luck-reveal flex items-center gap-6 rounded-2xl border border-sky-500/30 bg-zinc-950 px-10 py-8">
          <CardFace value={parsed?.yours ?? "?"} label="You" />
          <span className="text-sky-300">vs</span>
          <CardFace value={parsed?.theirs ?? "?"} label="Bot" delay />
        </div>
      </div>
    );
  }

  const heads = /heads/i.test(message);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div
        className={`luck-coin-flip flex h-28 w-28 items-center justify-center rounded-full border-4 border-amber-400/50 bg-gradient-to-br from-amber-300 to-amber-600 text-2xl font-bold text-amber-950 shadow-lg`}
      >
        {heads ? "H" : "T"}
      </div>
    </div>
  );
}

function CardFace({
  value,
  label,
  delay,
}: {
  value: number | string;
  label: string;
  delay?: boolean;
}) {
  return (
    <div className={`text-center ${delay ? "luck-reveal" : ""}`} style={delay ? { animationDelay: "0.2s" } : undefined}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-2 flex h-24 w-16 items-center justify-center rounded-lg border-2 border-sky-400/40 bg-zinc-900 text-3xl font-bold text-sky-100">
        {value}
      </div>
    </div>
  );
}
