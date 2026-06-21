"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "vibebet_guide_dismissed";

export function OnboardingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "1") {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="border-b border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-2.5 text-center text-sm text-fuchsia-100">
      New here?{" "}
      <Link href="/guide" className="font-medium underline hover:text-white">
        Read the playbook
      </Link>{" "}
      — VIBE, Lightning Rounds, The Courtroom, and ranks in plain English.
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setVisible(false);
        }}
        className="ml-3 text-xs text-fuchsia-300/80 hover:text-white"
      >
        Dismiss
      </button>
    </div>
  );
}
