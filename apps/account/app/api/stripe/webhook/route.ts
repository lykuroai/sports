import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient, SCHEMA } from "@spotomo/auth-client";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

// Stripe Webhook（プレミアム会員）。署名検証 → core.stripe_events で冪等化 →
// account.user_subscriptions を更新。施設運営者サブスク（facility）とは metadata で区別する。
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

  // 冪等性: 既処理イベントはスキップ。core.stripe_events は facility の Webhook と共用のため、
  // 同一 event.id が両エンドポイントへ配信されても取りこぼさないよう、このエンドポイント用に
  // キーを名前空間化する（"user:" 接頭辞）。
  const eventKey = `user:${event.id}`;
  const { data: seen } = await db
    .schema(SCHEMA.core)
    .from("stripe_events")
    .select("id")
    .eq("id", eventKey)
    .maybeSingle();
  if (seen) return NextResponse.json({ received: true });
  await db.schema(SCHEMA.core).from("stripe_events").insert({ id: eventKey, type: event.type });

  if (event.type.startsWith("customer.subscription.")) {
    const sub = event.data.object as Stripe.Subscription;
    const md = sub.metadata ?? {};
    // user_id を持つサブスクのみがプレミアム会員。facility サブスクは別 Webhook が処理。
    if (md.user_id) {
      // current_period_end は API バージョンで subscription / item 双方にあり得るため両対応。
      const periodEnd =
        (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
        (sub as unknown as { current_period_end?: number }).current_period_end;
      await db
        .schema(SCHEMA.account)
        .from("user_subscriptions")
        .upsert(
          {
            user_id: md.user_id,
            plan_id: md.plan_id ?? null,
            stripe_subscription_id: sub.id,
            status: sub.status,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
    }
  }

  return NextResponse.json({ received: true });
}
