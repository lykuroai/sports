import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient, SCHEMA } from "@spotomo/auth-client";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Stripe Webhook。署名検証 → core.stripe_events で冪等化 → facility_subscriptions を更新。
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return new NextResponse("missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return new NextResponse("invalid signature", { status: 400 });
  }

  const db = createAdminClient();

  // 冪等性: 既処理イベントはスキップ
  const { data: seen } = await db
    .schema(SCHEMA.core)
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (seen) return NextResponse.json({ received: true });
  await db.schema(SCHEMA.core).from("stripe_events").insert({ id: event.id, type: event.type });

  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as Stripe.Subscription;
    const md = sub.metadata ?? {};
    // current_period_end は API バージョンで subscription / item 双方にあり得るため両対応
    const periodEnd =
      (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
      (sub as unknown as { current_period_end?: number }).current_period_end;
    if (md.facility_id && md.owner_user_id) {
      await db
        .schema(SCHEMA.facility)
        .from("facility_subscriptions")
        .upsert(
          {
            facility_id: md.facility_id,
            owner_user_id: md.owner_user_id,
            plan_id: md.plan_id ?? null,
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_subscription_id" },
        );
    }
  }

  return NextResponse.json({ received: true });
}
