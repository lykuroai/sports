import Image from "next/image";
import { SPORT_DOMAINS } from "@spotomo/shared-types";
import heroImage from "../public/park-hero.png";

export default function HomePage() {
  return (
    <div className="space-y-8">
      {/* ヒーロー（総合トップのメインビジュアル）。 */}
      <section className="relative overflow-hidden rounded-2xl">
        <Image
          src={heroImage}
          alt="スポともパーク"
          priority
          className="h-auto w-full"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/55 to-transparent p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">スポともパーク</h1>
          <p className="mt-2 max-w-xl text-sm text-white/90 sm:text-base">
            ひとつのアカウントで、ゴルフ・ランニング・アウトドアなど複数の種目の仲間募集に参加できます。
          </p>
        </div>
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
