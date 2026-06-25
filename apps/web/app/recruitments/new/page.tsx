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
    const next = facilityId ? `/recruitments/new?facility=${facilityId}` : "/recruitments/new";
    redirect(`/login?redirect=${encodeURIComponent(next)}`);
  }

  // プレミアム会員のみ参加者条件・承認制を指定できる。
  const [premium, sports, eligibility] = await Promise.all([
    isPremium(supabase, user.id),
    fetchPublishedSports(supabase),
    fetchActivityEligibility(supabase, user.id),
  ]);

  // 施設詳細から「この施設で募集を作成」で来た場合、施設を初期選択する。
  // あわせて施設の種目(facility_sports)を取得し、募集の大分類/小分類の初期値にする。
  let initialFacility: PickedFacility | null = null;
  let initialSportId = "";
  if (facilityId) {
    const [{ data }, { data: fsp }] = await Promise.all([
      supabase.schema(SCHEMA.facility).from("facilities").select("id, name, prefecture, city, address").eq("id", facilityId).maybeSingle(),
      supabase.schema(SCHEMA.facility).from("facility_sports").select("sport_id").eq("facility_id", facilityId).limit(1).maybeSingle(),
    ]);
    if (data) initialFacility = data as PickedFacility;
    initialSportId = (fsp as { sport_id: string } | null)?.sport_id ?? "";
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
        initialSportId={initialSportId}
        initialTitle={race ? `${race} に一緒に出よう` : ""}
        initialPrefecture={pref ?? ""}
      />
    </>
  );
}
