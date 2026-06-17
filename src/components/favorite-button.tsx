import { toggleFavorite } from "@/app/favorites/actions";

/**
 * お気に入り／フォローのトグルボタン（サーバーコンポーネント）。
 * active は呼び出し側で favorites を引いて渡す。
 */
export function FavoriteButton({
  targetType,
  targetId,
  active,
  path,
  labelOn = "★ お気に入り済み",
  labelOff = "☆ お気に入り",
}: {
  targetType: "recruitment" | "facility" | "sport" | "organizer";
  targetId: string;
  active: boolean;
  path: string;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <form action={toggleFavorite}>
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="path" value={path} />
      <button
        type="submit"
        className={`btn w-full border ${
          active
            ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
        }`}
      >
        {active ? labelOn : labelOff}
      </button>
    </form>
  );
}
