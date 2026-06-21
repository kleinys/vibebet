import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  // No explicit apiVersion pin — use the library default for the installed
  // stripe major. When you're ready to commit to a version, pin it here.
  cached = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
  return cached;
}
