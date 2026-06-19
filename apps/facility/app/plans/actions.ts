"use server";

import { redirect } from "next/navigation";
import { createServerClient, requireFacilityOwner, SCHEMA } from "@spotomo/auth-client";
import { getStripe, facilityOrigin } from "@/lib/stripe";
import { ensureBillingCustomer } from "@/lib/billing";

/** verified オーナーのみ。Stripe Checkout（サブスク）を開始する。 */
export async function startCheckout(formData: FormData): Promise<void> {
  const facilityId = String(formData.get("facility_id"));
  const planId = String(formData.get("plan_id"));
  const user = await requireFacilityOwner(facilityId);

  const supabase = await createServerClient();
  const { data: plan } = await supabase
    .schema(SCHEMA.facility)
    .from("subscription_plans")
    .select("stripe_price_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan?.stripe_price_id) redirect("/plans?error=price_unset");

  const customerId = await ensureBillingCustomer(user.id, user.email ?? null);
  const origin = facilityOrigin();
  const meta = { facility_id: facilityId, plan_id: planId, owner_user_id: user.id };

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${origin}/plans?success=1`,
    cancel_url: `${origin}/plans?canceled=1`,
    metadata: meta,
    subscription_data: { metadata: meta },
  });
  if (session.url) redirect(session.url);
  redirect("/plans?error=session");
}

/** Stripe カスタマーポータル（解約・支払い方法変更）。 */
export async function openPortal(formData: FormData): Promise<void> {
  const facilityId = String(formData.get("facility_id"));
  const user = await requireFacilityOwner(facilityId);
  const customerId = await ensureBillingCustomer(user.id, user.email ?? null);

  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${facilityOrigin()}/plans`,
  });
  redirect(portal.url);
}
