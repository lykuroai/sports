#!/usr/bin/env python3
"""全国のマラソン・駅伝・ロードレース大会データを一度きり収集する。

出所（いずれも API 経由・利用規約準拠。HTML スクレイピングは行わない）:
  - Wikipedia (ja) MediaWiki API  …… 地方別/季節別「陸上競技大会」カテゴリの大会名。
                                     本文は CC BY-SA 4.0。
  - Wikidata SPARQL (WDQS)        …… 各大会の座標・都道府県・公式サイト。データは CC0。

出力: running_races_japan.csv（name, prefecture, city, website_url, latitude,
      longitude, source, source_id, wikipedia_title）。

注意: 継続的な自動取得は行わない方針（CLAUDE.md §6.6）。本スクリプトは初期データ
      投入のための一度きり収集を想定する。再収集時は礼儀として sleep を入れている。
"""
import csv
import json
import re
import time
import urllib.parse
import urllib.request

UA = "spotomo-running/1.0 (one-off race dataset; contact support@lykuro.ai)"
WP_API = "https://ja.wikipedia.org/w/api.php"
WDQS = "https://query.wikidata.org/sparql"

# 大会を多く含む umbrella カテゴリ（種別別＋地方別）。1 段だけサブカテゴリを辿る。
# （Category:日本の陸上競技大会 の実在サブカテゴリから選定）
SEED_CATEGORIES = [
    "日本のマラソン大会",
    "日本のトレイルランニング大会",
    "駅伝",
    "日本開催の冬季陸上競技大会",
    "関東地方開催の陸上競技大会",
    "東海地方開催の陸上競技大会",
    "近畿地方開催の陸上競技大会",
    "東北地方開催の陸上競技大会",
    "九州地方開催の陸上競技大会",
]

PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]

# 市民が参加する「大会」だけを残すための名前フィルタ。
KEEP = re.compile(r"(マラソン|駅伝|ロードレース|ハーフ|ランニング|マイル|競歩|リレーマラソン)")
# 選手権・国体・国際大会など参加対象でないもの、および書籍/番組/一覧などの非イベント記事を除外。
DROP = re.compile(
    r"(選手権|国民体育大会|国体|ユニバーシアード|世界|アジア|オリンピック|日本選手権"
    r"|インターハイ|総合体育大会|クロスカントリー選手権|^第?\s*\d+\s*回"
    # 非イベント記事（駅伝トピックカテゴリ由来の書籍/番組/一覧/人物/部活動 等）
    r"|一覧|人物|記録$|ダイジェスト|生情報|直前|続報|への道|物語|言葉|ポリス"
    r"|シリーズ$|撰|予選|三大|競技部|ダイスケ|絆|^駅伝競走$|の道$)"
)


def wp_api(params):
    params = {**params, "format": "json", "formatversion": "2"}
    url = WP_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=60))


def category_pages(cat, depth=0, seen_cats=None):
    """カテゴリ直下のページ名を返す（depth<1 ならサブカテゴリも 1 段辿る）。"""
    if seen_cats is None:
        seen_cats = set()
    pages, cont = [], None
    while True:
        p = {
            "action": "query", "list": "categorymembers",
            "cmtitle": f"Category:{cat}", "cmlimit": "500", "cmtype": "page|subcat",
        }
        if cont:
            p["cmcontinue"] = cont
        d = wp_api(p)
        for m in d["query"]["categorymembers"]:
            t = m["title"]
            if t.startswith("Category:"):
                sub = t.split(":", 1)[1]
                if depth < 1 and sub not in seen_cats:
                    seen_cats.add(sub)
                    pages += category_pages(sub, depth + 1, seen_cats)
            elif ":" not in t:  # 記事名前空間のみ
                pages.append(t)
        cont = d.get("continue", {}).get("cmcontinue")
        if not cont:
            break
        time.sleep(0.3)
    return pages


CITY_RE = re.compile(r"([一-龥ぁ-んァ-ヶーA-Za-z]+?[市区町村])")


def prefecture_by_categories(titles):
    """各記事の所属カテゴリ名から都道府県を推定。

    都道府県名が直接出ればそれを採用。無ければ市区町村名を集め、Wikidata で
    市区町村 -> 都道府県 を一括解決する（'つくば市' -> 茨城県 等）。
    """
    pref, page_city, discontinued = {}, {}, set()
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        d = wp_api({"action": "query", "prop": "categories", "cllimit": "max",
                    "clshow": "!hidden", "titles": "|".join(batch)})
        for pg in d["query"]["pages"]:
            cats = [c["title"].split(":", 1)[-1] for c in pg.get("categories", [])]
            joined = " ".join(cats)
            # 終了/廃止された大会（「現存しない…」「○○年終了のスポーツイベント」）。
            if "現存しない" in joined or "終了のスポーツイベント" in joined:
                discontinued.add(pg["title"])
            hit = next((p for p in PREFECTURES if p in joined), None)
            if hit:
                pref[pg["title"]] = hit
                continue
            # 「○○市のスポーツ」等から市区町村名を拾う。
            for c in cats:
                m = CITY_RE.search(c)
                if m and m.group(1) not in ("市", "区", "町", "村"):
                    page_city[pg["title"]] = m.group(1)
                    break
        time.sleep(0.3)

    # 市区町村 -> 都道府県 を Wikidata で解決して埋める。
    cities = sorted(set(page_city.values()))
    city_pref = {}
    for i in range(0, len(cities), 150):
        values = " ".join(f'"{c}"@ja' for c in cities[i:i + 150])
        q = f"""SELECT DISTINCT ?cityName ?prefLabel WHERE {{
          VALUES ?cityName {{ {values} }}
          ?city rdfs:label ?cityName . ?city wdt:P17 wd:Q17 .
          ?city wdt:P131* ?pref. ?pref wdt:P31 wd:Q50337.
          ?pref rdfs:label ?prefLabel filter(lang(?prefLabel)='ja').
        }}"""
        for r in wdqs(q):
            city_pref.setdefault(r["cityName"]["value"], r["prefLabel"]["value"])
        time.sleep(1)
    for page, city in page_city.items():
        if city in city_pref:
            pref[page] = city_pref[city]
    return pref, discontinued


def wikidata_ids(titles):
    """Wikipedia 記事名 -> Wikidata QID（pageprops を 50 件ずつ）。"""
    out = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        d = wp_api({"action": "query", "prop": "pageprops", "ppprop": "wikibase_item",
                    "titles": "|".join(batch)})
        for pg in d["query"]["pages"]:
            qid = pg.get("pageprops", {}).get("wikibase_item")
            if qid:
                out[pg["title"]] = qid
        time.sleep(0.3)
    return out


def wdqs(query):
    data = urllib.parse.urlencode({"query": query}).encode()
    req = urllib.request.Request(
        WDQS, data=data,
        headers={"User-Agent": UA, "Accept": "application/sparql-results+json"})
    return json.load(urllib.request.urlopen(req, timeout=120))["results"]["bindings"]


def enrich(qids):
    """QID -> {coord, website, prefecture}（座標・公式サイト・都道府県）。"""
    info = {}
    for i in range(0, len(qids), 120):
        batch = qids[i:i + 120]
        values = " ".join(f"wd:{q}" for q in batch)
        q = f"""
        SELECT ?item ?coord ?website ?prefLabel WHERE {{
          VALUES ?item {{ {values} }}
          OPTIONAL {{ ?item wdt:P625 ?coord. }}
          OPTIONAL {{ ?item wdt:P856 ?website. }}
          OPTIONAL {{
            ?item wdt:P131* ?pref. ?pref wdt:P31 wd:Q50337.
            ?pref rdfs:label ?prefLabel filter(lang(?prefLabel)='ja').
          }}
        }}"""
        for r in wdqs(q):
            qid = r["item"]["value"].rsplit("/", 1)[-1]
            d = info.setdefault(qid, {})
            if "coord" in r and "coord" not in d:
                m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", r["coord"]["value"])
                if m:
                    d["lng"], d["lat"] = m.group(1), m.group(2)
            if "website" in r:
                d.setdefault("website", r["website"]["value"])
            if "prefLabel" in r:
                d.setdefault("prefecture", r["prefLabel"]["value"])
        time.sleep(1)
    return info


def main():
    titles = []
    for cat in SEED_CATEGORIES:
        ms = category_pages(cat)
        titles += ms
        print(f"  {cat}: {len(ms)}")
    titles = sorted(set(titles))
    titles = [t for t in titles if KEEP.search(t) and not DROP.search(t)]
    print(f"running-race pages: {len(titles)}")

    cat_pref, discontinued = prefecture_by_categories(titles)
    print(f"prefecture from categories: {len(cat_pref)} / discontinued: {len(discontinued)}")
    qmap = wikidata_ids(titles)
    print(f"with wikidata id: {len(qmap)}")
    info = enrich(sorted(set(qmap.values())))

    rows = []
    for title in titles:
        qid = qmap.get(title)
        d = info.get(qid, {}) if qid else {}
        rows.append({
            "name": title,
            # カテゴリ由来を優先（網羅性が高い）。無ければ Wikidata の都道府県。
            "prefecture": cat_pref.get(title) or d.get("prefecture", ""),
            "city": "",
            "website_url": d.get("website", ""),
            "latitude": d.get("lat", ""),
            "longitude": d.get("lng", ""),
            "source": "wikipedia",
            "source_id": qid or "",
            "wikipedia_title": title,
            "discontinued": "1" if title in discontinued else "0",
        })

    out = "running_races_japan.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    pref = sum(1 for r in rows if r["prefecture"])
    print(f"wrote {len(rows)} races -> {out} (prefecture filled: {pref})")


if __name__ == "__main__":
    main()
