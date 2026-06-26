import { notFound } from "next/navigation";
import { createServerClient } from "@spotomo/auth-client";
import {
  fetchPublicProfile,
  fetchPublishedSports,
  fetchUserSports,
} from "@spotomo/domain-common";
import {
  GENDER_LABEL,
  SKILL_LEVEL_LABEL,
  VERIFICATION_STATUS_LABEL,
} from "@spotomo/shared-types";
import type { Gender, SkillLevel } from "@spotomo/shared-types";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const [profile, sports, userSports] = await Promise.all([
    fetchPublicProfile(supabase, id),
    fetchPublishedSports(supabase),
    fetchUserSports(supabase, id),
  ]);
  if (!profile) notFound();

  const sportName = new Map(sports.map((s) => [s.id, s.name]));
  const mySports = userSports
    .map((u) => ({ name: sportName.get(u.sport_id), level: u.skill_level as SkillLevel }))
    .filter((u): u is { name: string; level: SkillLevel } => Boolean(u.name));

  const isSelf = viewer?.id === id;
  const verified = profile.verification_status === "verified";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="card flex items-center gap-4 p-6">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={profile.nickname}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-2xl text-slate-500">
            {profile.nickname.slice(0, 1)}
          </div>
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{profile.nickname}</h1>
            {verified && (
              <span className="badge bg-emerald-100 text-emerald-700">
                {VERIFICATION_STATUS_LABEL.verified}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            評価 {profile.rating.toFixed(1)}／参加 {profile.participation_count}回・主催{" "}
            {profile.organizer_count}回
          </p>
        </div>
      </div>

      {profile.introduction && (
        <div className="card p-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">自己紹介</h2>
          <p className="whitespace-pre-wrap text-slate-700">{profile.introduction}</p>
        </div>
      )}

      <dl className="card grid grid-cols-2 gap-4 p-6 text-sm">
        <div>
          <dt className="text-slate-500">性別</dt>
          <dd>{GENDER_LABEL[profile.gender as Gender] ?? "指定なし"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">年代</dt>
          <dd>{profile.age_range || "未回答"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">活動エリア</dt>
          <dd>{profile.area || "未設定"}</dd>
        </div>
      </dl>

      {mySports.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">取り組む種目</h2>
          <ul className="flex flex-wrap gap-2">
            {mySports.map((s) => (
              <li key={s.name} className="badge bg-slate-100 text-slate-700">
                {s.name}・{SKILL_LEVEL_LABEL[s.level]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isSelf && (
        <a href="/profile" className="block text-center text-sm text-brand hover:underline">
          プロフィールを編集する
        </a>
      )}
    </div>
  );
}
