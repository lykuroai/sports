import { createClient } from "@/lib/supabase/server";
import { RecruitmentForm } from "@/components/recruitment-form";

export const metadata = { title: "募集を作成" };

export default async function NewRecruitmentPage() {
  const supabase = await createClient();
  const { data: sports } = await supabase
    .from("sports")
    .select("id, name, category_type")
    .eq("status", "published")
    .order("display_order");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">募集を作成</h1>
      <RecruitmentForm sports={sports ?? []} />
    </div>
  );
}
