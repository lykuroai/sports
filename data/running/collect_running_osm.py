#!/usr/bin/env python3
"""
日本全国のランニング関連施設を OpenStreetMap (Overpass API) から一度きり収集する。
対象: 公園(leisure=park, 名称付き), 陸上トラック(leisure=track), 競技場(leisure=stadium で陸上/ランニング).
出力: facilities CSV 取り込み許可カラム + 参照用列。
ライセンス: ODbL — © OpenStreetMap contributors（出典表示必須）。
継続スクレイピングではなくワンショット取得（仕様§6.6 準拠）。
"""
import csv, json, sys, time, urllib.parse, urllib.request

OVERPASS_ENDPOINTS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# ISO3166-2 -> 都道府県名（日本語）
PREFS = {
    "JP-01":"北海道","JP-02":"青森県","JP-03":"岩手県","JP-04":"宮城県","JP-05":"秋田県",
    "JP-06":"山形県","JP-07":"福島県","JP-08":"茨城県","JP-09":"栃木県","JP-10":"群馬県",
    "JP-11":"埼玉県","JP-12":"千葉県","JP-13":"東京都","JP-14":"神奈川県","JP-15":"新潟県",
    "JP-16":"富山県","JP-17":"石川県","JP-18":"福井県","JP-19":"山梨県","JP-20":"長野県",
    "JP-21":"岐阜県","JP-22":"静岡県","JP-23":"愛知県","JP-24":"三重県","JP-25":"滋賀県",
    "JP-26":"京都府","JP-27":"大阪府","JP-28":"兵庫県","JP-29":"奈良県","JP-30":"和歌山県",
    "JP-31":"鳥取県","JP-32":"島根県","JP-33":"岡山県","JP-34":"広島県","JP-35":"山口県",
    "JP-36":"徳島県","JP-37":"香川県","JP-38":"愛媛県","JP-39":"高知県","JP-40":"福岡県",
    "JP-41":"佐賀県","JP-42":"長崎県","JP-43":"熊本県","JP-44":"大分県","JP-45":"宮崎県",
    "JP-46":"鹿児島県","JP-47":"沖縄県",
}

def query(iso):
    # 1クエリで3種をまとめて取得。公園は名称付きのみ（ノイズ抑制）。
    q = f"""
[out:json][timeout:120];
area["ISO3166-2"="{iso}"][admin_level=4]->.a;
(
  nwr["leisure"="track"]["sport"!~"cycling|horse_racing|motor|bmx|karting|dog_racing"](area.a);
  nwr["leisure"~"stadium|pitch"]["sport"~"athletics|running|multi"](area.a);
  nwr["name"~"陸上競技場"]["leisure"](area.a);
);
out center tags;
"""
    data = urllib.parse.urlencode({"data": q}).encode()
    for attempt in range(6):
        endpoint = OVERPASS_ENDPOINTS[attempt % len(OVERPASS_ENDPOINTS)]
        try:
            req = urllib.request.Request(endpoint, data=data,
                                         headers={"User-Agent": "spotomo-onetime-collect/1.0 (contact: support@lykuro.ai)"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r).get("elements", [])
        except Exception as e:
            wait = 10 * (attempt + 1)
            print(f"  retry {iso} via {endpoint} ({e}); wait {wait}s", flush=True)
            time.sleep(wait)
    print(f"  GIVE UP {iso}", flush=True)
    return []

def classify(tags):
    name = tags.get("name", "") or ""
    if tags.get("leisure") == "park":
        return "公園・ランニングコース"
    if tags.get("leisure") == "track":
        return "陸上競技場・トラック"
    if "陸上競技場" in name:
        return "陸上競技場・トラック"
    if tags.get("leisure") == "stadium":
        return "競技場"
    if tags.get("leisure") == "pitch":
        return "陸上競技場・トラック"
    return "その他"

OUT = "/private/tmp/claude-501/-Users-senkai-kaku-spotomo/3a4354c9-eaf8-4e16-9424-dc4a2cd59628/scratchpad/running_facilities_japan.csv"
FIELDS = ["name","facility_type","prefecture","city","address","postal_code",
          "latitude","longitude","osm_type","osm_id","website"]

def main():
    seen = set()
    total = 0
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for iso, pref in PREFS.items():
            els = query(iso)
            n = 0
            for e in els:
                key = (e["type"], e["id"])
                if key in seen:
                    continue
                t = e.get("tags", {})
                name = t.get("name") or t.get("name:ja")
                if not name:
                    continue
                name = " ".join(name.split())  # 改行・連続空白を除去（行崩れ防止）
                lat = e.get("lat") or e.get("center", {}).get("lat")
                lon = e.get("lon") or e.get("center", {}).get("lon")
                if lat is None or lon is None:
                    continue
                seen.add(key)
                city = t.get("addr:city", "")
                addr = t.get("addr:full") or " ".join(
                    x for x in [t.get("addr:city",""), t.get("addr:suburb",""),
                                t.get("addr:neighbourhood",""), t.get("addr:block_number",""),
                                t.get("addr:housenumber","")] if x)
                w.writerow({
                    "name": name,
                    "facility_type": classify(t),
                    "prefecture": pref,
                    "city": city,
                    "address": addr,
                    "postal_code": t.get("addr:postcode",""),
                    "latitude": lat,
                    "longitude": lon,
                    "osm_type": e["type"],
                    "osm_id": e["id"],
                    "website": t.get("website") or t.get("contact:website",""),
                })
                n += 1
                total += 1
            f.flush()
            print(f"{iso} {pref}: {n} rows (total {total})", flush=True)
            time.sleep(8)  # Overpass への負荷配慮
    print(f"DONE total={total} -> {OUT}", flush=True)

if __name__ == "__main__":
    main()
