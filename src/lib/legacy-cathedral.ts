import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CathedralElement {
  id: string;
  label: string;
  done: boolean;
}

export interface LegacyCathedral {
  visible: boolean;
  wings: number;
  maxWings: number;
  percent: number;
  displayName: string;
  companionName: string | null;
  publicSlug: string;
  elements: CathedralElement[];
}

export async function getLegacyCathedral(
  userId?: string,
): Promise<LegacyCathedral | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_legacy_cathedral", {
    p_user_id: userId ?? undefined,
  });
  if (error || !data || typeof data !== "object") return null;

  const raw = data as Record<string, unknown>;
  if (!raw.visible) return null;

  const elements = Array.isArray(raw.elements)
    ? (raw.elements as Record<string, unknown>[]).map((e) => ({
        id: String(e.id ?? ""),
        label: String(e.label ?? ""),
        done: Boolean(e.done),
      }))
    : [];

  return {
    visible: true,
    wings: Number(raw.wings ?? 0),
    maxWings: Number(raw.max_wings ?? 8),
    percent: Number(raw.percent ?? 0),
    displayName: String(raw.display_name ?? "Player"),
    companionName: (raw.companion_name as string) ?? null,
    publicSlug: String(raw.public_slug ?? ""),
    elements,
  };
}
