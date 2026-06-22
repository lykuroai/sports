import type { EventMember } from "@spotomo/domain-common";

/**
 * イベントのメンバー一覧（発起者＋承認済み参加者）。承認済みメンバー間でのみ表示する。
 * 公開情報（ニックネーム・評価・公開プロフィールへのリンク）のみを扱う。
 */
export function EventMembers({
  members,
  viewerId,
  accountUrl,
}: {
  members: EventMember[];
  viewerId: string;
  accountUrl: string;
}) {
  if (members.length === 0) return null;

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">メンバー（{members.length}人）</h2>
      <ul className="divide-y">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between py-2 text-sm">
            <span>
              <a href={`${accountUrl}/users/${m.user_id}`} className="font-medium hover:underline">
                {m.nickname ?? "メンバー"}
              </a>
              {m.user_id === viewerId && <span className="ml-1 text-slate-400">（あなた）</span>}
              <span className="ml-2 text-slate-500">評価 {(m.rating ?? 0).toFixed(1)}</span>
            </span>
            <span
              className={`badge ${
                m.role === "organizer" ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-600"
              }`}
            >
              {m.role === "organizer" ? "発起者" : "参加者"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400">
        表示されるのは公開プロフィール（ニックネーム・評価）のみです。連絡先（メール・電話・本名）は公開されません。
      </p>
    </section>
  );
}
