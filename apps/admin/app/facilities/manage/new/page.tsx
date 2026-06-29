import Link from "next/link";
import { requireAdmin } from "@spotomo/auth-client";
import { createFacility } from "../../../actions";
import { FacilityFields } from "../facility-fields";

export const metadata = { title: "施設の新規登録" };

export default async function FacilityCreatePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">施設の新規登録</h1>
        <Link href="/facilities/manage" className="text-sm text-brand hover:underline">← 一覧へ</Link>
      </div>
      <form action={createFacility} className="card space-y-4 p-6">
        <FacilityFields />
        <button className="btn-primary w-full" type="submit">登録する</button>
      </form>
    </div>
  );
}
