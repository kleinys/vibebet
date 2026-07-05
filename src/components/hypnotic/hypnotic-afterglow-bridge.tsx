"use client";

import { useEffect } from "react";
import { useHypnoticFlow } from "@/components/hypnotic/hypnotic-flow-provider";

const AFTERGLOW_KEY = "vibebet-hypnotic-afterglow";

export function HypnoticAfterglowBridge({ animal }: { animal: string }) {
  const { triggerAfterglow, momentum } = useHypnoticFlow();

  useEffect(() => {
    return () => {
      if (momentum > 0) {
        try {
          sessionStorage.setItem(AFTERGLOW_KEY, animal);
        } catch {
          // ignore
        }
      }
    };
  }, [animal, momentum]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(AFTERGLOW_KEY);
      if (stored) {
        sessionStorage.removeItem(AFTERGLOW_KEY);
        triggerAfterglow(stored);
      }
    } catch {
      // ignore
    }
  }, [triggerAfterglow]);

  return null;
}
