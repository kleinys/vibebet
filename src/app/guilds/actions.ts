"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function createGuild(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const parsed = z
    .object({
      name: z.string().trim().min(3).max(40),
      tag: z.string().trim().min(2).max(5).regex(/^[A-Za-z0-9]+$/),
      description: z.string().trim().max(200).optional(),
    })
    .safeParse({
      name: formData.get("name"),
      tag: formData.get("tag"),
      description: formData.get("description") || undefined,
    });
  if (!parsed.success) return { error: "Invalid guild details." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_guild", {
    p_name: parsed.data.name,
    p_tag: parsed.data.tag.toUpperCase(),
    p_description: parsed.data.description ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath("/guilds");
  revalidatePath("/account/profile");
  return { ok: "Guild created! Share your slug so others can join." };
}

export async function joinGuild(
  _prev: { error?: string; ok?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: string }> {
  const slug = z.string().trim().min(3).safeParse(formData.get("slug"));
  if (!slug.success) return { error: "Enter a guild slug." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_guild", { p_slug: slug.data });
  if (error) return { error: error.message };

  revalidatePath("/guilds");
  revalidatePath("/account/profile");
  return { ok: "Joined guild!" };
}

export async function leaveGuild(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_guild");
  if (error) return { error: error.message };
  revalidatePath("/guilds");
  revalidatePath("/account/profile");
  return {};
}

export async function disbandGuild(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("disband_guild");
  if (error) return { error: error.message };
  revalidatePath("/guilds");
  revalidatePath("/account/profile");
  return {};
}
