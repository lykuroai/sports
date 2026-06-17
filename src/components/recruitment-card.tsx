import Link from "next/link";
import type { Recruitment } from "@/lib/database.types";
import { RECRUITMENT_STATUS_LABEL, SKILL_LEVEL_LABEL } from "@/lib/constants";
import { formatDateTime, formatFee } from "@/lib/format";

export type RecruitmentListItem = Recruitment & {
  sports: { name: string } | null;
  facilities: { name: string } | null;
  profiles: { display_name: string; rating: number } | null;
  approved_count: number;
};

const statusColor: Partial<Record<Recruitment["status"], string>> = {
  open: "bg-emerald-100 text-emerald-700",
  few_left: "bg-amber-100 text-amber-700",
  full: "bg-slate-200 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
  finished: "bg-slate-100 text-slate-500",
};

export function RecruitmentCard({ r }: { r: RecruitmentListItem }) {
  return (
    <Link href={`/recruitments/${r.id}`} className="card block p-4 transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-center gap-2">
        <span className={`badge ${statusColor[r.status] ?? "bg-slate-100 text-slate-600"}`}>
          {RECRUITMENT_STATUS_LABEL[r.status]}
        </span>
        {r.sports && <span className="badge bg-brand/10 text-brand">{r.sports.name}</span>}
        {r.beginner_allowed && (
          <span className="badge bg-sky-100 text-sky-700">初心者歓迎</span>
        )}
      </div>

      <h3 className="mb-1 line-clamp-2 font-semibold">{r.title}</h3>

      <dl className="mt-2 space-y-1 text-sm text-slate-600">
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-400">日時</dt>
          <dd>{formatDateTime(r.event_start_at)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-slate-400">場所</dt>
          <dd>
            {r.prefecture ?? ""}
            {r.city ?? ""}
            {r.facilities ? `・${r.facilities.name}` : "・施設未定"}
          </dd>
        </div>
        <div className="flex gap-4">
          <span>
            <span className="text-slate-400">参加費 </span>
            {formatFee(r.participation_fee)}
          </span>
          <span>
            <span className="text-slate-400">定員 </span>
            {r.approved_count}/{r.capacity}人
          </span>
          <span>
            <span className="text-slate-400">レベル </span>
            {SKILL_LEVEL_LABEL[r.skill_level]}
          </span>
        </div>
      </dl>

      {r.profiles && (
        <p className="mt-3 text-xs text-slate-400">
          主催: {r.profiles.display_name}（評価 {r.profiles.rating.toFixed(1)}）
        </p>
      )}
    </Link>
  );
}
