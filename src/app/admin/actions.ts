"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ResolveSchema = z.object({
  marketId: z.string().uuid(),
  outcome: z.enum(["yes", "no"]).transform((v) => v === "yes"),
});

const CategoricalResolveSchema = z.object({
  marketId: z.string().uuid(),
  outcomeIndex: z.coerce.number().int().min(0).max(7),
});

export type ResolveState = { error?: string; ok?: string } | null;

export async function proposeResolutionCategorical(
  _prev: ResolveState,
  formData: FormData,
): Promise<ResolveState> {
  const parsed = CategoricalResolveSchema.safeParse({
    marketId: formData.get("marketId"),
    outcomeIndex: formData.get("outcomeIndex"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_resolution_categorical", {
    p_market_id: parsed.data.marketId,
    p_outcome_index: parsed.data.outcomeIndex,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/markets");
  revalidatePath(`/markets/${parsed.data.marketId}`);
  return { ok: "Proposed winning outcome — 24h window open." };
}

export async function proposeResolution(
  _prev: ResolveState,
  formData: FormData,
): Promise<ResolveState> {
  const parsed = ResolveSchema.safeParse({
    marketId: formData.get("marketId"),
    outcome: formData.get("outcome"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("propose_resolution", {
    p_market_id: parsed.data.marketId,
    p_outcome: parsed.data.outcome,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/markets");
  revalidatePath(`/markets/${parsed.data.marketId}`);
  return {
    ok: `Proposed ${parsed.data.outcome ? "YES" : "NO"} — 24h challenge window open.`,
  };
}

const FlagSchema = z.object({
  key: z.string().min(1).max(64),
  enabled: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function setFlag(
  _prev: ResolveState,
  formData: FormData,
): Promise<ResolveState> {
  const parsed = FlagSchema.safeParse({
    key: formData.get("key"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("feature_flags")
    .update({ enabled: parsed.data.enabled })
    .eq("key", parsed.data.key);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { ok: `Flag ${parsed.data.key} → ${parsed.data.enabled}` };
}

export async function seedOfficialMarkets(): Promise<ResolveState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_seed_official_markets");
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/markets");
  revalidatePath("/admin");
  return { ok: `Seeded ${data ?? 0} official market(s).` };
}

export async function seedOfficialMarketsForm(
  _prev: ResolveState,
  _formData: FormData,
): Promise<ResolveState> {
  void _prev;
  void _formData;
  return seedOfficialMarkets();
}

export async function syncPolymarketMirrorsForm(
  _prev: ResolveState,
  _formData: FormData,
): Promise<ResolveState> {
  void _prev;
  void _formData;
  return syncPolymarketMirrors();
}

export async function syncPolymarketMirrors(): Promise<ResolveState> {
  const { syncPolymarketMirrorsBatch, syncPolymarketResolutions } = await import(
    "@/lib/platform-activity"
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in as admin." };

  const result = await syncPolymarketMirrorsBatch({ force: true, limit: 250 });
  if (result.error) return { error: result.error };

  const resolved = await syncPolymarketResolutions();

  revalidatePath("/");
  revalidatePath("/markets");
  revalidatePath("/admin");
  return {
    ok: `Synced ${result.synced}/${result.fetched} Polymarket mirror(s). PM-2 finalized ${resolved} closed mirror(s).`,
  };
}

export async function populateAllMarketsForm(
  _prev: ResolveState,
  _formData: FormData,
): Promise<ResolveState> {
  void _prev;
  void _formData;
  return populateAllMarkets();
}

/** One-click cold start: official seed + Polymarket mirrors + bootstrap. */
export async function populateAllMarkets(): Promise<ResolveState> {
  const { maybeBootstrapCatalog, syncPolymarketMirrorsBatch } = await import(
    "@/lib/platform-activity"
  );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in as admin." };

  const [seedRes, bootstrapSeeded] = await Promise.all([
    supabase.rpc("admin_seed_official_markets"),
    maybeBootstrapCatalog(),
  ]);

  if (seedRes.error) return { error: seedRes.error.message };

  const sync = await syncPolymarketMirrorsBatch({ force: true, limit: 250 });
  if (sync.error) return { error: sync.error };

  revalidatePath("/");
  revalidatePath("/markets");
  revalidatePath("/admin");
  return {
    ok: `Done. Official: ${(seedRes.data ?? 0) + bootstrapSeeded} seeded · Polymarket: ${sync.synced}/${sync.fetched} mirrors. Reload home.`,
  };
}

const BotSchema = z.object({
  botUserId: z.string().uuid("Enter a valid user UUID."),
});

export async function registerPlatformBotForm(
  _prev: ResolveState,
  formData: FormData,
): Promise<ResolveState> {
  const parsed = BotSchema.safeParse({
    botUserId: formData.get("botUserId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_platform_bot", {
    p_bot_user_id: parsed.data.botUserId,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {
    ok: "Platform bot registered. Synthetic trades will run on page loads.",
  };
}
