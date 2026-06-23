import Image from "next/image";
import { SPORT_DOMAINS } from "@spotomo/shared-types";
import heroImage from "../public/park-hero.webp";

export default function HomePage() {
  // ヒーロー（総合トップのメインビジュアル）。角は直角、種目カードを画像内に配置。
  return (
    <section className="relative overflow-hidden">
      <Image
        src={heroImage}
        alt="スポともパーク"
        priority
        className="h-auto w-full"
      />
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/25 to-transparent p-4 sm:p-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">スポともパーク</h1>
        <p className="mt-2 max-w-xl text-sm text-white/90 sm:text-base">
          ひとつのアカウントで、ゴルフ・ランニング・アウトドアなど複数の種目の仲間募集に参加できます。
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-3">
          {SPORT_DOMAINS.map((d) => (
            <a
              key={d.slug}
              href={`//${d.host}`}
              className="bg-white/90 p-3 backdrop-blur transition hover:bg-white sm:p-4"
            >
              <div className="text-base font-medium text-slate-900">{d.name}</div>
              <div className="mt-0.5 text-xs text-slate-500">{d.host}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
