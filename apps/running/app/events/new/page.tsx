import { redirect } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import { isPremium, fetchPublishedSports, fetchActivityEligibility } from "@spotomo/domain-common";
import NewEventForm from "./new-event-form";
import { VerifyNotice } from "../verify-notice";

export default async function NewEventPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/events/new");

  // プレミアム会員のみ参加者条件・承認制を指定できる。
  const [premium, sports, eligibility] = await Promise.all([
    isPremium(supabase, user.id),
    fetchPublishedSports(supabase),
    fetchActivityEligibility(supabase, user.id),
  ]);

  return (
    <>
      {!eligibility.eligible && (
        <VerifyNotice emailVerified={eligibility.emailVerified} phoneVerified={eligibility.phoneVerified} />
      )}
      <NewEventForm premium={premium} sports={sports} />
    </>
  );
}
