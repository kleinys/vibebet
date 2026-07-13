import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface VibePassStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
}

export interface VibePassProgress {
  visible: boolean;
  percent: number;
  complete: boolean;
  dismissed: boolean;
  steps: VibePassStep[];
}

export async function getVibePassProgress(): Promise<VibePassProgress | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vibe_pass_progress");
  if (error || !data || typeof data !== "object") return null;

  const raw = data as Record<string, unknown>;
  const steps = Array.isArray(raw.steps)
    ? (raw.steps as Record<string, unknown>[]).map((s) => ({
        id: String(s.id ?? ""),
        label: String(s.label ?? ""),
        done: Boolean(s.done),
        href: String(s.href ?? "/"),
      }))
    : [];

  return {
    visible: Boolean(raw.visible),
    percent: Number(raw.percent ?? 0),
    complete: Boolean(raw.complete),
    dismissed: Boolean(raw.dismissed),
    steps,
  };
}
