import NewEventForm, { type GoraPrefill } from "./new-event-form";

// /clubs（楽天GORA）からの「このプランで募集する」遷移時は、クエリのGORA情報を引き継ぐ。
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const courseId = get("gora_course_id");
  const planId = get("gora_plan_id");
  const gora: GoraPrefill | null =
    courseId && planId
      ? {
          course_id: courseId,
          course_name: get("gora_course_name") ?? "",
          prefecture: get("gora_prefecture"),
          address: get("gora_address"),
          course_url: get("gora_course_url"),
          plan_id: planId,
          plan_name: get("gora_plan_name") ?? "",
          price: get("gora_price"),
          play_date: get("gora_play_date"),
          start_time: get("gora_start_time"),
          lunch: get("gora_lunch"),
          caddie: get("gora_caddie"),
          cart: get("gora_cart"),
          two_sum: get("gora_two_sum"),
          reserve_url: get("gora_reserve_url"),
        }
      : null;

  return <NewEventForm gora={gora} />;
}
