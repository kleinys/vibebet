import { z } from "zod";

/**
 * Treat empty strings in env vars as "not set". Without this, an unset Stripe
 * key written as `STRIPE_SECRET_KEY=` in .env.local would parse as `""` and
 * fail the `.min(10)` check even though `.optional()` is set.
 */
const optionalSecret = (minLength: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.length === 0 ? undefined : v),
    z.string().min(minLength).optional(),
  );

/**
 * Server-side env schema. Validated lazily on first access so that build-time
 * static analysis (e.g. `next build` in CI without secrets) does not crash.
 */
const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret(20),
  STRIPE_SECRET_KEY: optionalSecret(10),
  STRIPE_WEBHOOK_SECRET: optionalSecret(10),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

let cachedServerEnv: z.infer<typeof ServerEnvSchema> | null = null;

export function serverEnv() {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = ServerEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid server environment:\n" +
        parsed.error.issues
          .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
          .join("\n"),
    );
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export function clientEnv() {
  return ClientEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
