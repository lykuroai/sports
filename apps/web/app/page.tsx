import { SPORT_DOMAINS } from "@spotomo/shared-types";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-lg bg-brand/10 p-8">
        <h1 className="text-2xl font-bold text-brand-dark">スポともパーク</h1>
        <p className="mt-2 text-slate-700">
          ひとつのアカウントで、ゴルフ・ランニング・アウトドアなど複数の種目の仲間募集に参加できます。
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">種目を選ぶ</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SPORT_DOMAINS.map((d) => (
            <a
              key={d.slug}
              href={`//${d.host}`}
              className="card p-6 transition hover:border-brand hover:shadow"
            >
              <div className="text-lg font-medium">{d.name}</div>
              <div className="mt-1 text-sm text-slate-500">{d.host}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
