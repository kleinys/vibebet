import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { serverEnv } from "@/lib/env";
import { post as postLedger, LedgerError } from "@/lib/ledger";

/**
 * Stripe webhook receiver.
 *
 * Phase 0 scope:
 *   - Verify signature with the webhook secret.
 *   - Use Stripe's `event.id` as the ledger `externalRef` — repeat deliveries
 *     are deduped at the DB level via the unique constraint on
 *     `ledger_transactions.external_ref`.
 *   - Handle `payment_intent.succeeded` as a Gem credit (the only flow we
 *     plan to wire in Phase 1). For now it requires `metadata.user_id` and
 *     `metadata.gem_amount` on the PaymentIntent.
 *
 * Notes:
 *   - This route MUST receive the raw body. Next's app router gives us that
 *     via `request.text()` — DO NOT call `request.json()` first.
 *   - This route is excluded from auth middleware in `src/middleware.ts`.
 */

export const runtime = "nodejs"; // Stripe's crypto needs node, not edge.

export async function POST(request: NextRequest) {
  const env = serverEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_signature", message: (err as Error).message },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event);
        break;

      // Wire these up later:
      // case "charge.refunded":
      // case "payment_intent.payment_failed":
      default:
        // Acknowledge but don't act. Stripe will stop retrying.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error", {
      eventId: event.id,
      type: event.type,
      err,
    });
    // Returning 500 tells Stripe to retry. The ledger's idempotency means
    // retries are safe.
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  // Only act on paid sessions.
  if (session.payment_status !== "paid") {
    console.info("[stripe-webhook] checkout.session.completed but not paid", {
      eventId: event.id,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return;
  }

  const userId = session.metadata?.user_id;
  const gemAmountStr = session.metadata?.gem_amount;
  const bundleSlug = session.metadata?.bundle_slug;
  const product = session.metadata?.product;

  if (product === "pro" && session.mode === "subscription" && userId) {
    const expires = new Date();
    expires.setDate(expires.getDate() + 31);
    const { createAdminClient } = await import("@/lib/supabase/admin");
    try {
      const admin = createAdminClient();
      await admin.rpc("activate_pro_subscription", {
        p_user_id: userId,
        p_expires: expires.toISOString(),
        p_stripe_customer_id:
          typeof session.customer === "string" ? session.customer : null,
      });
    } catch (e) {
      console.error("[stripe-webhook] pro activation failed", e);
    }
    return;
  }

  if (!userId || !gemAmountStr) {
    console.warn("[stripe-webhook] checkout.session without gem metadata", {
      eventId: event.id,
      sessionId: session.id,
    });
    return;
  }

  const gemAmount = Number.parseInt(gemAmountStr, 10);
  if (!Number.isFinite(gemAmount) || gemAmount <= 0) {
    throw new Error(`invalid gem_amount in metadata: ${gemAmountStr}`);
  }

  try {
    const result = await postLedger({
      kind: "gem_purchase",
      externalRef: event.id, // Stripe event id is globally unique.
      createdBy: userId,
      metadata: {
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        usd_amount_cents: session.amount_total,
        usd_currency: session.currency,
        bundle_slug: bundleSlug,
      },
      entries: [
        {
          account: { kind: "user_wallet", userId, currency: "gem" },
          amount: gemAmount,
          currency: "gem",
        },
        {
          account: { kind: "system_mint", currency: "gem", code: "gem_mint" },
          amount: -gemAmount,
          currency: "gem",
        },
      ],
    });

    console.info("[stripe-webhook] gem purchase posted (session)", {
      eventId: event.id,
      sessionId: session.id,
      userId,
      gemAmount,
      transactionId: result.transactionId,
      alreadyPosted: result.alreadyPosted,
    });
  } catch (err) {
    if (err instanceof LedgerError) {
      console.error("[stripe-webhook] ledger error", {
        code: err.code,
        message: err.message,
      });
    }
    throw err;
  }
}

async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const intent = event.data.object as Stripe.PaymentIntent;
  const userId = intent.metadata?.user_id;
  const gemAmountStr = intent.metadata?.gem_amount;

  if (!userId || !gemAmountStr) {
    // Not a Gem purchase — could be a future product. Acknowledge and skip.
    console.warn("[stripe-webhook] payment_intent without gem metadata", {
      eventId: event.id,
      intentId: intent.id,
    });
    return;
  }

  const gemAmount = Number.parseInt(gemAmountStr, 10);
  if (!Number.isFinite(gemAmount) || gemAmount <= 0) {
    throw new Error(`invalid gem_amount in metadata: ${gemAmountStr}`);
  }

  try {
    const result = await postLedger({
      kind: "gem_purchase",
      externalRef: event.id, // Stripe event id — unique per event.
      createdBy: userId,
      metadata: {
        stripe_payment_intent_id: intent.id,
        usd_amount_cents: intent.amount,
        usd_currency: intent.currency,
      },
      entries: [
        {
          account: { kind: "user_wallet", userId, currency: "gem" },
          amount: gemAmount,
          currency: "gem",
        },
        {
          account: { kind: "system_mint", currency: "gem", code: "gem_mint" },
          amount: -gemAmount,
          currency: "gem",
        },
      ],
    });

    if (result.alreadyPosted) {
      console.info("[stripe-webhook] duplicate event, ignored", {
        eventId: event.id,
        transactionId: result.transactionId,
      });
    } else {
      console.info("[stripe-webhook] gem purchase posted", {
        eventId: event.id,
        userId,
        gemAmount,
        transactionId: result.transactionId,
      });
    }
  } catch (err) {
    if (err instanceof LedgerError) {
      console.error("[stripe-webhook] ledger error", {
        code: err.code,
        message: err.message,
      });
    }
    throw err;
  }
}
