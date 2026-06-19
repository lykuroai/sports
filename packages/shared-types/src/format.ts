/** 日時を「2026年6月20日(土) 10:00」形式で表示 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "未定";
  const d = new Date(iso);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const date = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
  const time = `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  return `${date} ${time}`;
}

export function formatFee(fee: number): string {
  return fee === 0 ? "無料" : `${fee.toLocaleString()}円`;
}
