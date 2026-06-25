import { redirect } from "next/navigation";
import { createServerClient, SCHEMA } from "@spotomo/auth-client";
import { isPremium, fetchPublishedSports, fetchActivityEligibility } from "@spotomo/domain-common";
import NewEventForm from "./new-event-form";
import type { PickedFacility } from "./facility-picker";
import { VerifyNotice } from "../verify-notice";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ facility?: string; race?: string; pref?: string }>;
}) {
  const { facility: facilityId, race, pref } = await searchParams;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = facilityId ? `/events/new?facility=${facilityId}` : "/events/new";
    redirect(`/login?redirect=${encodeURIComponent(next)}`);
  }

  // プレミアム会員のみ参加者条件・承認制を指定できる。
  const [premium, sports, eligibility] = await Promise.all([
    isPremium(supabase, user.id),
    fetchPublishedSports(supabase),
    fetchActivityEligibility(supabase, user.id),
  ]);

  // 施設詳細から「この施設で募集を作成」で来た場合、施設を初期選択する。
  let initialFacility: PickedFacility | null = null;
  if (facilityId) {
    const { data } = await supabase
      .schema(SCHEMA.facility)
      .from("facilities")
      .select("id, name, prefecture, city, address")
      .eq("id", facilityId)
      .maybeSingle();
    if (data) initialFacility = data as PickedFacility;
  }

  return (
    <>
      {!eligibility.eligible && (
        <VerifyNotice emailVerified={eligibility.emailVerified} phoneVerified={eligibility.phoneVerified} />
      )}
      <NewEventForm
        premium={premium}
        sports={sports}
        initialFacility={initialFacility}
        initialTitle={race ? `${race} に一緒に出よう` : ""}
        initialPrefecture={pref ?? ""}
      />
    </>
  );
}
