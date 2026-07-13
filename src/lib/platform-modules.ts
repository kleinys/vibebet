import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PlatformModuleKind = "duel" | "hustle" | "market" | "arcade" | "watch";

export interface PlatformModule {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: PlatformModuleKind;
  target_href: string;
  icon_emoji: string;
  install_count: number;
  installed: boolean;
}

function parseModule(raw: Record<string, unknown>): PlatformModule {
  return {
    id: String(raw.id ?? ""),
    slug: String(raw.slug ?? ""),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    kind: (raw.kind as PlatformModuleKind) ?? "duel",
    target_href: String(raw.target_href ?? "/play"),
    icon_emoji: String(raw.icon_emoji ?? "✨"),
    install_count: Number(raw.install_count ?? 0),
    installed: Boolean(raw.installed),
  };
}

export async function listPlatformModules(limit = 24): Promise<PlatformModule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_platform_modules", {
    p_limit: limit,
  });
  if (error) {
    console.error("list_platform_modules:", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map(parseModule);
}

export async function getPlatformModule(
  slug: string,
): Promise<PlatformModule | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_platform_module", {
    p_slug: slug,
  });
  if (error || !data || typeof data !== "object") return null;
  return parseModule(data as Record<string, unknown>);
}

export async function getMyInstalledModules(): Promise<
  Pick<PlatformModule, "slug" | "name" | "kind" | "target_href" | "icon_emoji">[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_installed_modules");
  if (error || !Array.isArray(data)) return [];
  return (data as Record<string, unknown>[]).map((m) => ({
    slug: String(m.slug ?? ""),
    name: String(m.name ?? ""),
    kind: (m.kind as PlatformModuleKind) ?? "duel",
    target_href: String(m.target_href ?? "/play"),
    icon_emoji: String(m.icon_emoji ?? "✨"),
  }));
}
