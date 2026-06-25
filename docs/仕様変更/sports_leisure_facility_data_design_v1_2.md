# スポーツ・レジャー施設データ取得・登録設計書

- 対象サービス: Spotomo / Lykuro 系スポーツ・レジャー仲間募集サービス
- 対象領域: スポーツ施設、レジャー施設、アウトドア施設、自然系スポット、補助施設、コース・集合場所
- 作成日: 2026-06-25
- 版数: v1.2
- 更新内容: v1.1 の「アウトドア + マラソン・陸上競技」から、すべてのスポーツ・レジャー種目へ対象範囲を拡張

---

## 1. 目的

本設計書は、Spotomo / Lykuro 系のスポーツ・レジャー仲間募集サービスにおいて、ユーザーが仲間募集・イベント作成時に利用できる「施設」「コース」「集合場所」「補助施設」を、外部データ取得と自社登録を組み合わせて構築するための基本設計を定義する。

対象はマラソン・陸上競技だけではなく、以下のようなスポーツ・レジャー全体とする。

```text
ゴルフ
ランニング
マラソン
サッカー
フットサル
野球
ソフトボール
テニス
バスケットボール
バレーボール
卓球
バドミントン
水泳
フィットネス
ヨガ
ダンス
武道
格闘技
ボルダリング
サイクリング
スキー
スノーボード
キャンプ
登山
釣り
BBQ
SUP
カヤック
ボウリング
ダーツ
ビリヤード
カラオケ
公園散策
観光レジャー
```

ただし、サービス健全性と法規制対応のため、以下は初期対象外とする。

```text
ギャンブル施設
成人向け施設
危険物・武器を主目的とする施設
違法行為・迷惑行為を前提とするスポット
```

---

## 2. 基本方針

スポーツ・レジャー施設データは、単一APIだけで網羅できない。以下の複数データソースを組み合わせる。

| 取得元 | 主な用途 | 取得方法 | 注意点 |
|---|---|---|---|
| Google Places API | 営業中の施設、店舗系、ジム、スタジアム、ゴルフ場、テニスコート、プール、ボウリング場、カラオケ等 | Nearby Search / Text Search / Place Details | Google由来データの保存・表示・キャッシュは利用規約を確認する |
| OpenStreetMap / Overpass API | 公園、スポーツコート、競技場、自然系POI、登山口、キャンプ場、トイレ、駐車場、ルート | Overpass API | OSMへの帰属表示が必要。データ品質は地域差がある |
| 自治体オープンデータ | 公共施設、体育施設、スポーツ施設、公園、観光施設、公衆トイレ、公営駐車場、イベント | CKAN API / CSV / XLSX | 自治体ごとに形式・列名・更新頻度が異なる |
| 国土数値情報 / 国交省API | 都市公園、自然公園区域、文化施設データ内のスポーツ施設など全国GISデータ | GML / SHP / GeoJSON / API | データ年度、利用条件、商用利用可否を個別確認する |
| 楽天GORA API | ゴルフ場、ゴルフ場詳細、プラン・予約導線 | 楽天WebサービスAPI | ゴルフ領域はGoogleより予約情報・料金情報に強い |
| 施設公式サイト | 料金、営業時間、予約URL、利用ルール、臨時休業 | 手動確認 / 半自動クロール | 規約・robots.txtを確認する |
| 自社登録 | APIにない施設、集合場所、イベント主催者が使う独自コース | 管理画面 / ユーザー提案 | 承認フローと重複チェックが必要 |

推奨方針:

```text
外部データはバッチで取得
↓
自社DBに正規化して保存
↓
管理画面で確認・補完・承認
↓
ユーザー画面は自社DBを検索
↓
予約可否・料金・臨時休業など変動情報は手動または必要時確認
```

---

## 3. 対象カテゴリ体系

### 3.1 大分類

| 大分類コード | 大分類名 | 説明 |
|---|---|---|
| outdoor | アウトドア | キャンプ、登山、釣り、自然体験など |
| running | ランニング・マラソン | ランニングコース、陸上競技場、マラソン集合場所など |
| ball_sports | 球技 | サッカー、野球、バスケ、バレー、テニス等 |
| golf | ゴルフ | ゴルフ場、練習場、インドアゴルフ、パークゴルフ等 |
| fitness | フィットネス | ジム、ヨガ、ピラティス、ダンス、スタジオ等 |
| martial_arts | 武道・格闘技 | 柔道、剣道、空手、合気道、ボクシング等 |
| water_sports | 水泳・水辺スポーツ | プール、海水浴場、SUP、カヤック、ダイビング等 |
| winter_sports | ウィンタースポーツ | スキー場、スケートリンク、スノーボード等 |
| cycling | 自転車・サイクリング | サイクリングロード、BMX、駐輪場、シェアサイクル等 |
| urban_sports | アーバンスポーツ | スケートボード、ボルダリング、パルクール等 |
| recreation | レジャー・娯楽 | ボウリング、ダーツ、ビリヤード、カラオケ、遊園地等 |
| culture_leisure | 観光・文化レジャー | 観光施設、博物館、動物園、水族館、公園散策等 |
| support | 補助施設 | 駐車場、トイレ、シャワー、ロッカー、温泉、道の駅等 |

### 3.2 詳細カテゴリ

| 大分類 | 中分類 | 施設例 |
|---|---|---|
| アウトドア | キャンプ | キャンプ場、オートキャンプ場、RVパーク、コテージ、グランピング |
| アウトドア | BBQ・ピクニック | BBQ場、ピクニック場、デイキャンプ場 |
| アウトドア | 登山・ハイキング | 登山口、ハイキングコース、山、展望台、ビジターセンター |
| アウトドア | 公園・自然 | 公園、都市公園、自然公園、森林公園、自然保護区 |
| アウトドア | 釣り | 釣り場、釣り堀、海釣り施設、釣り桟橋 |
| ランニング | ランニング | ランニングコース、ジョギングコース、河川敷コース、公園周回コース |
| ランニング | マラソン | マラソン大会集合場所、試走コース、給水所候補、折返し地点 |
| ランニング | 陸上競技 | 陸上競技場、トラック、補助競技場、クロスカントリーコース |
| 球技 | サッカー・フットサル | サッカー場、フットサルコート、運動広場 |
| 球技 | 野球・ソフトボール | 野球場、ソフトボール場、バッティングセンター |
| 球技 | バスケットボール | 体育館、バスケットコート、屋外コート |
| 球技 | バレーボール | 体育館、ビーチバレーコート |
| 球技 | テニス・ラケットスポーツ | テニスコート、卓球場、バドミントンコート、スカッシュコート |
| 球技 | ラグビー・アメフト | ラグビー場、アメフト場、多目的競技場 |
| ゴルフ | ゴルフ | ゴルフ場、ゴルフ練習場、インドアゴルフ、パークゴルフ、ミニゴルフ |
| フィットネス | ジム | フィットネスジム、トレーニングジム、公共トレーニング室 |
| フィットネス | スタジオ | ヨガスタジオ、ピラティススタジオ、ダンススタジオ |
| 武道・格闘技 | 武道 | 柔道場、剣道場、空手道場、合気道場、弓道場 |
| 武道・格闘技 | 格闘技 | ボクシングジム、キックボクシング、レスリング、総合格闘技ジム |
| 水泳・水辺 | 水泳 | 屋内プール、屋外プール、市民プール、ウォーターパーク |
| 水泳・水辺 | マリンスポーツ | SUP施設、カヤック施設、カヌー施設、ダイビングショップ、サーフスポット |
| ウィンター | 雪・氷 | スキー場、スノーボード場、スケートリンク、スノーシューエリア |
| 自転車 | サイクリング | サイクリングロード、BMXコース、自転車公園、シェアサイクル拠点 |
| アーバンスポーツ | スケート・クライミング | スケートボードパーク、ボルダリングジム、クライミングジム |
| レジャー | 室内レジャー | ボウリング場、ダーツバー、ビリヤード場、カラオケ、ゲームセンター |
| レジャー | 体験・観光 | 遊園地、動物園、水族館、植物園、観光施設、道の駅 |
| 補助施設 | 利便施設 | 駐車場、公衆トイレ、シャワー、ロッカー、更衣室、温泉、売店 |

---

## 4. データ構築アーキテクチャ

```text
外部データソース
  ├─ Google Places API
  ├─ OpenStreetMap / Overpass API
  ├─ 自治体オープンデータ
  ├─ 国土数値情報 / 国交省API
  ├─ 楽天GORA API
  ├─ 施設公式サイト
  └─ 自社登録 / ユーザー提案
        ↓
施設取得バッチ
        ↓
生データ保存 facility_sources
        ↓
正規化処理
        ↓
カテゴリマッピング
        ↓
住所・緯度経度補完
        ↓
重複判定
        ↓
facilities / facility_details
        ↓
管理画面で確認・修正・承認
        ↓
ユーザー向け施設検索API
        ↓
仲間募集・イベント作成画面
```

---

## 5. データの3層管理

| 層 | 内容 | 主な項目 |
|---|---|---|
| 1. 自動取得データ | Google Places、OSM、自治体オープンデータ、国土数値情報、楽天GORAから取得 | 施設名、住所、緯度経度、カテゴリ、電話番号、Webサイト、外部ID |
| 2. 運営者手動補完データ | 自社運営者が管理画面で補完 | 予約URL、料金、営業期間、注意事項、写真、カテゴリ修正、利用条件 |
| 3. 施設管理者・利用者登録データ | 施設オーナー、利用者、イベント主催者が登録・修正提案 | 施設追加、修正提案、閉鎖報告、写真追加、集合場所提案 |

---

## 6. Google Places API 取得設計

### 6.1 用途

Google Places APIは、営業中の施設・店舗系情報の取得に向いている。

取得しやすい項目:

```text
施設名
住所
緯度経度
電話番号
公式サイトURL
営業時間
評価
口コミ数
Google Place ID
施設タイプ
```

### 6.2 対象Place Types

Google Places APIのPlace Typesは、スポーツ・レジャー施設の初期取得に利用する。

#### Sports系

```text
arena
athletic_field
fishing_charter
fishing_pier
fishing_pond
fitness_center
golf_course
gym
ice_skating_rink
indoor_golf_course
playground
race_course
ski_resort
sports_activity_location
sports_club
sports_coaching
sports_complex
sports_school
stadium
swimming_pool
tennis_court
```

#### Entertainment and Recreation系

```text
adventure_sports_center
amusement_center
amusement_park
aquarium
barbecue_area
botanical_garden
bowling_alley
city_park
community_center
cycling_park
dance_hall
dog_park
event_venue
go_karting_venue
hiking_area
indoor_playground
karaoke
marina
miniature_golf_course
national_park
observation_deck
off_roading_area
paintball_center
park
picnic_ground
planetarium
skateboard_park
state_park
tourist_attraction
video_arcade
visitor_center
water_park
```

#### 補助・周辺施設

```text
parking
parking_garage
parking_lot
rest_stop
bike_sharing_station
transit_station
train_station
bus_station
bicycle_store
sporting_goods_store
sportswear_store
```

### 6.3 取得方針

```text
屋内施設: gym / fitness_center / sports_club / bowling_alley / karaoke などで取得
競技施設: athletic_field / sports_complex / stadium / arena / race_course で取得
公園・自然: park / city_park / hiking_area / national_park / picnic_ground で取得
ゴルフ: golf_course / indoor_golf_course / miniature_golf_course を取得し、楽天GORAで補完
水辺: swimming_pool / marina / fishing_pier / fishing_pond / water_park を取得
冬スポーツ: ski_resort / ice_skating_rink を取得
```

### 6.4 取り扱い注意

Google由来データは、検索・表示・最新確認用途に使う。Googleデータを自社施設マスターとして長期保存・再配布する場合は、Google Maps Platformの利用規約を確認する。

推奨方針:

```text
Google Place IDは参照キーとして保存
自社独自項目はfacilitiesに保存
Google由来の詳細情報は必要時に再取得
長期保存が必要な項目は規約確認後に保存
```

---

## 7. OpenStreetMap / Overpass API 取得設計

### 7.1 用途

OpenStreetMapは、公共・自然系・屋外施設の取得に強い。特に、公園、スポーツコート、登山口、キャンプ場、トイレ、駐車場、ルート情報の取得に利用する。

### 7.2 OSM基本タグ

| 対象 | OSMタグ |
|---|---|
| スポーツセンター | `leisure=sports_centre` |
| スタジアム | `leisure=stadium` |
| 競技場・コート | `leisure=pitch` |
| ランニングトラック | `leisure=track` |
| テニスコート | `leisure=pitch` + `sport=tennis` |
| サッカー場 | `leisure=pitch` + `sport=soccer` |
| 野球場 | `leisure=pitch` + `sport=baseball` |
| バスケットコート | `leisure=pitch` + `sport=basketball` |
| バレーボールコート | `leisure=pitch` + `sport=volleyball` |
| ゴルフ場 | `leisure=golf_course` / `sport=golf` |
| プール | `leisure=swimming_pool` / `sport=swimming` |
| フィットネス | `leisure=fitness_centre` |
| ボルダリング・クライミング | `sport=climbing` |
| スケートボード | `leisure=skatepark` / `sport=skateboard` |
| ボウリング | `leisure=bowling_alley` / `sport=10pin` |
| 公園 | `leisure=park` |
| キャンプ場 | `tourism=camp_site` |
| オートキャンプ / RV | `tourism=caravan_site` |
| ピクニック場 | `tourism=picnic_site` |
| 登山口 | `highway=trailhead` |
| 登山ルート | `route=hiking` |
| ランニングルート | `route=running` |
| 自転車ルート | `route=bicycle` |
| サイクリングロード | `highway=cycleway` |
| 展望台 | `tourism=viewpoint` |
| 自然保護区 | `boundary=protected_area` / `leisure=nature_reserve` |
| BBQ | `amenity=bbq` |
| トイレ | `amenity=toilets` |
| 駐車場 | `amenity=parking` |
| シャワー | `amenity=shower` |
| 温泉・浴場 | `amenity=public_bath` |

### 7.3 sport値の例

```text
athletics
running
soccer
baseball
softball
basketball
volleyball
tennis
table_tennis
badminton
rugby_union
american_football
golf
swimming
climbing
fitness
judo
karate
boxing
cycling
skateboard
skiing
ice_skating
surfing
canoe
rowing
sailing
fishing
```

### 7.4 Overpass API取得例

```bash
curl -X POST "https://overpass-api.de/api/interpreter" \
  --data-urlencode 'data=
[out:json][timeout:60];
area["name"="東京都"]["admin_level"="4"]->.searchArea;
(
  node["leisure"="sports_centre"](area.searchArea);
  way["leisure"="sports_centre"](area.searchArea);

  node["leisure"="stadium"](area.searchArea);
  way["leisure"="stadium"](area.searchArea);

  node["leisure"="pitch"](area.searchArea);
  way["leisure"="pitch"](area.searchArea);

  node["leisure"="track"](area.searchArea);
  way["leisure"="track"](area.searchArea);

  node["leisure"="swimming_pool"](area.searchArea);
  way["leisure"="swimming_pool"](area.searchArea);

  node["tourism"="camp_site"](area.searchArea);
  way["tourism"="camp_site"](area.searchArea);

  relation["route"="running"](area.searchArea);
  relation["route"="bicycle"](area.searchArea);

  node["amenity"="toilets"](area.searchArea);
  node["amenity"="parking"](area.searchArea);
);
out center tags;
'
```

### 7.5 取り扱い注意

OSMデータを使う場合は、OpenStreetMapへの帰属表示が必要である。

表示例:

```text
© OpenStreetMap contributors
```

---

## 8. 自治体オープンデータ取得設計

### 8.1 用途

自治体オープンデータは、公共スポーツ施設、公園、体育館、運動場、観光施設、公衆トイレ、公営駐車場、イベントの取得に向いている。

対象データセット例:

```text
公共施設一覧
スポーツ施設一覧
体育施設一覧
公園一覧
観光施設一覧
イベント一覧
公衆トイレ一覧
公営駐車場一覧
公営駐輪場一覧
学校開放施設一覧
運動公園一覧
指定管理施設一覧
```

### 8.2 検索キーワード

```text
スポーツ施設
体育施設
体育館
運動場
運動公園
総合運動場
陸上競技場
競技場
スタジアム
野球場
サッカー場
フットサル
テニスコート
バスケットボール
バレーボール
卓球
バドミントン
武道場
柔道場
剣道場
弓道場
プール
トレーニング室
ランニングコース
ジョギングコース
マラソンコース
公園
観光施設
キャンプ場
BBQ
バーベキュー
海水浴場
釣り場
公衆トイレ
駐車場
イベント
市民マラソン
スポーツ大会
```

### 8.3 取得方式

多くの自治体オープンデータサイトは、CKAN形式またはCSV / XLSXファイルで提供される。

基本フロー:

```text
1. CKAN APIでデータセット検索
2. データセット詳細を取得
3. CSV / XLSX / JSONリソースURLを取得
4. ファイルをダウンロード
5. カラム名を正規化
6. 緯度経度・住所・施設名を抽出
7. カテゴリマッピング
8. facilitiesにupsert
9. facility_sourcesに元データを保存
```

CKAN検索例:

```bash
curl "https://data.bodik.jp/api/3/action/package_search?q=スポーツ施設&rows=20"
```

---

## 9. 国土数値情報 / 国交省API 取得設計

### 9.1 用途

国土数値情報は、全国レベルの公園・自然区域・文化施設・スポーツ施設候補を補完するために利用する。

対象:

```text
都市公園データ
自然公園地域データ
自然保護区域
土地利用データ
文化施設データ内のスポーツ施設
運動公園を含む都市公園
```

### 9.2 注意点

国土数値情報はデータ年度が古い場合がある。また、データごとに利用条件が異なるため、商用サービスで利用する場合は必ず利用条件を確認する。

特に、都市公園データは古い版が残っている場合があり、文化施設データ内のスポーツ施設には休館中施設が含まれる場合がある。そのため、公開前に自治体データ、公式サイト、Google Places等で確認する。

---

## 10. 楽天GORA API 取得設計

### 10.1 用途

ゴルフ領域は、Google Places APIだけでは予約・料金・プラン情報が不足するため、楽天GORA APIを併用する。

対象:

```text
ゴルフ場検索
ゴルフ場詳細
プラン検索
予約導線
エリアコード検索
```

### 10.2 取得方針

```text
Google Places APIでゴルフ場候補を取得
楽天GORA APIでゴルフ場詳細・予約導線を補完
同一施設は名称・住所・緯度経度・電話番号で統合
楽天GORAの外部IDをfacility_sourcesに保存
```

---

## 11. バッチ処理設計

### 11.1 基本方針

スポーツ・レジャー施設データは、原則として定期バッチで自社DBへ取り込む。

```text
外部API・オープンデータを定期取得
↓
自社 facilities DB に保存
↓
ユーザー検索は自社DBを参照
↓
予約・営業状態など変わりやすい情報は手動更新または必要時確認
```

### 11.2 バッチ一覧

| バッチ名 | 内容 | 推奨頻度 |
|---|---|---|
| places_sports_fetch_job | Google Placesからスポーツ施設候補を取得 | 週1回 |
| places_leisure_fetch_job | Google Placesからレジャー施設候補を取得 | 週1回 |
| osm_sports_fetch_job | OSM / Overpassからスポーツ施設・コート・ルートを取得 | 週1回〜月1回 |
| osm_outdoor_fetch_job | OSM / Overpassから自然系POIを取得 | 週1回〜月1回 |
| municipal_facility_fetch_job | 自治体オープンデータから公共施設・スポーツ施設を取得 | 週1回〜月1回 |
| municipal_event_fetch_job | 自治体オープンデータからスポーツ・レジャーイベントを取得 | 毎日〜週1回 |
| mlit_fetch_job | 国土数値情報 / 国交省APIを取得 | 月1回〜数か月に1回 |
| rakuten_gora_fetch_job | 楽天GORAからゴルフ場・プラン情報を取得 | 毎日〜週1回 |
| facility_normalize_job | カラム名、カテゴリ、住所、緯度経度を正規化 | 取得後即時 |
| facility_category_mapping_job | 外部タイプを自社カテゴリへ変換 | 取得後即時 |
| facility_deduplicate_job | 既存施設との重複判定 | 取得後即時 |
| facility_upsert_job | 新規登録または更新 | 取得後即時 |
| facility_cleanup_job | 閉鎖、重複、不正データを整理 | 月1回 |

### 11.3 バッチ処理フロー

```text
1. 外部データ取得
2. 生データ保存
3. 自社共通形式へ正規化
4. カテゴリマッピング
5. 住所・緯度経度の補完
6. 重複候補検索
7. 自動マージまたは確認待ち登録
8. facilitiesへ登録・更新
9. 管理画面で確認
10. 公開状態に反映
```

---

## 12. 手動登録・補完設計

### 12.1 手動登録が必要な理由

外部APIやオープンデータだけでは、以下の情報が不足しやすい。

```text
公式予約URL
利用料金
営業期間
臨時休業
駐車場有無
トイレ・シャワー・売店
ロッカー・更衣室
レンタル有無
初心者向け可否
ファミリー向け可否
ペット可否
写真
注意事項
利用ルール
管理者確認済みフラグ
団体利用可否
個人利用可否
大会利用可否
```

そのため、管理者による手動登録・編集画面を必須機能とする。

### 12.2 基本情報

```text
施設名
カテゴリ
サブカテゴリ
対応スポーツ・レジャー種目
住所
都道府県
市区町村
緯度
経度
電話番号
公式サイトURL
予約URL
説明文
```

### 12.3 共通設備項目

```text
営業期間
営業時間
定休日
料金
駐車場あり
トイレあり
シャワーあり
更衣室あり
ロッカーあり
売店あり
レンタルあり
初心者向け
ファミリー向け
団体利用可
個人利用可
大会利用可
```

### 12.4 種目別詳細項目

| 種目 | 追加項目 |
|---|---|
| ランニング・陸上 | トラック周長、レーン数、公認・非公認、距離表示、路面種別、高低差、給水ポイント |
| ゴルフ | ホール数、パー、練習場有無、カート有無、予約方式、楽天GORA ID |
| テニス | コート数、屋内/屋外、サーフェス、ナイター、壁打ち有無 |
| 野球・サッカー | グラウンド種別、人工芝/天然芝/土、照明、観客席、予約単位 |
| 体育館競技 | コート面数、床材、空調、器具貸出、利用可能種目 |
| 水泳 | 屋内/屋外、25m/50m、レーン数、子供プール、温水、監視員 |
| 武道 | 畳/板床、道場面数、防具貸出、観覧席 |
| フィットネス | マシン、スタジオ、月額/都度利用、体験利用、トレーナー有無 |
| アウトドア | BBQ可、焚き火可、直火可、宿泊可、日帰り可、ペット可 |
| 釣り | 海/川/湖/釣り堀、レンタル、釣果情報、遊漁券、営業時間 |
| スキー・スノボ | リフト数、コース数、難易度、レンタル、スクール、積雪状況URL |
| ボルダリング | 壁面積、グレード、初心者講習、シューズレンタル |
| ボウリング等 | レーン数、個室有無、団体予約、飲食可否 |

### 12.5 管理項目

```text
公開状態
確認状態
情報元
最終確認日
管理者メモ
承認者
作成者
更新者
重複候補ID
掲載優先度
```

### 12.6 手動登録フロー

```text
管理者が施設を登録
↓
住所から緯度経度を取得
↓
重複施設をチェック
↓
カテゴリ・対応種目を設定
↓
公式URL・予約URLを登録
↓
種目別詳細・設備・注意事項を追加
↓
写真を追加
↓
公開前に承認
↓
施設検索に表示
```

---

## 13. 利用者・施設管理者による登録提案

### 13.1 利用者提案フロー

```text
ユーザーが施設を提案
↓
仮登録 status = pending
↓
重複候補を自動表示
↓
運営者が確認
↓
問題なければ承認
↓
公開
```

### 13.2 施設管理者向け機能

将来的には、施設管理者が自分の施設情報を編集できるようにする。

```text
施設オーナー申請
施設情報編集
予約URL更新
料金更新
営業期間更新
写真アップロード
臨時休業登録
閉鎖報告
イベント・体験会登録
```

---

## 14. カテゴリマッピング設計

### 14.1 外部タイプから自社カテゴリへの変換例

| 外部ソース | 外部タイプ | 自社カテゴリ |
|---|---|---|
| Google | `golf_course` | golf/golf_course |
| Google | `indoor_golf_course` | golf/indoor_golf |
| Google | `fitness_center` | fitness/gym |
| Google | `gym` | fitness/gym |
| Google | `swimming_pool` | water_sports/swimming_pool |
| Google | `tennis_court` | ball_sports/tennis |
| Google | `bowling_alley` | recreation/bowling |
| Google | `ski_resort` | winter_sports/ski |
| Google | `ice_skating_rink` | winter_sports/ice_skating |
| Google | `sports_complex` | ball_sports/sports_complex |
| Google | `athletic_field` | running/athletics_field |
| Google | `barbecue_area` | outdoor/bbq |
| Google | `campground` | outdoor/camp |
| Google | `park` / `city_park` | outdoor/park |
| OSM | `leisure=pitch` + `sport=soccer` | ball_sports/soccer |
| OSM | `leisure=pitch` + `sport=baseball` | ball_sports/baseball |
| OSM | `leisure=pitch` + `sport=tennis` | ball_sports/tennis |
| OSM | `leisure=track` + `sport=athletics` | running/track |
| OSM | `leisure=golf_course` | golf/golf_course |
| OSM | `leisure=swimming_pool` | water_sports/swimming_pool |
| OSM | `tourism=camp_site` | outdoor/camp |
| OSM | `route=running` | running/running_course |
| OSM | `route=bicycle` | cycling/cycling_route |

### 14.2 複数カテゴリ対応

1つの施設が複数種目に対応する場合がある。

例:

```text
総合体育館: basketball, volleyball, badminton, table_tennis, fitness
運動公園: running, soccer, baseball, tennis, athletics
スポーツセンター: gym, swimming, martial_arts, dance
公園: running, picnic, cycling, dog_park, outdoor
```

そのため、`facilities.category` は主カテゴリ、複数種目は `facility_sports` テーブルで管理する。

---

## 15. 重複判定設計

### 15.1 判定条件

同じ施設が、Google、OSM、自治体データ、楽天GORA、自社登録に重複して出るため、重複判定を行う。

判定条件:

```text
施設名が近い
緯度経度が100m以内
住所が近い
電話番号が同じ
公式URLが同じ
外部IDが同じ
```

施設タイプによって距離しきい値を変える。

| 施設タイプ | 推奨距離しきい値 |
|---|---:|
| 屋内店舗・ジム | 30m |
| 体育館・テニスコート | 50m |
| 公園・運動公園 | 200m |
| ゴルフ場・スキー場 | 500m |
| ランニングコース・登山ルート | ルート形状比較を優先 |

### 15.2 名称正規化

```text
全角・半角を統一
大文字・小文字を統一
空白を除去
記号を除去
株式会社・有限会社などを除去
「体育館」「総合体育館」「スポーツセンター」などの類似語を正規化
「Golf Club」「ゴルフクラブ」「GC」などの類似語を正規化
```

### 15.3 PostGIS距離判定例

```sql
SELECT id, name
FROM facilities
WHERE ST_DWithin(
  geography(ST_MakePoint(longitude, latitude)),
  geography(ST_MakePoint(:lng, :lat)),
  :radius_m
);
```

---

## 16. DB設計

### 16.1 facilities

```sql
CREATE TABLE facilities (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT,

  category TEXT NOT NULL,
  sub_category TEXT,
  address TEXT,
  prefecture TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  phone TEXT,
  website_url TEXT,
  reservation_url TEXT,
  description TEXT,

  opening_hours TEXT,
  closed_days TEXT,
  business_period TEXT,
  price_info TEXT,

  has_parking BOOLEAN DEFAULT false,
  has_toilet BOOLEAN DEFAULT false,
  has_shower BOOLEAN DEFAULT false,
  has_shop BOOLEAN DEFAULT false,
  has_rental BOOLEAN DEFAULT false,
  has_locker BOOLEAN DEFAULT false,
  has_changing_room BOOLEAN DEFAULT false,
  has_lighting BOOLEAN DEFAULT false,

  beginner_friendly BOOLEAN DEFAULT false,
  family_friendly BOOLEAN DEFAULT false,
  personal_use_allowed BOOLEAN DEFAULT false,
  group_use_allowed BOOLEAN DEFAULT false,
  event_use_allowed BOOLEAN DEFAULT false,

  source_type TEXT,
  source_priority TEXT,
  status TEXT DEFAULT 'pending',
  verification_status TEXT DEFAULT 'unverified',

  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  last_checked_at TIMESTAMP,

  created_by BIGINT,
  updated_by BIGINT,
  approved_by BIGINT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 16.2 facility_sports

複数種目対応用テーブル。

```sql
CREATE TABLE facility_sports (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT REFERENCES facilities(id),
  sport_code TEXT NOT NULL,
  sport_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(facility_id, sport_code)
);
```

### 16.3 facility_sources

```sql
CREATE TABLE facility_sources (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT REFERENCES facilities(id),

  source_type TEXT NOT NULL,
  source_id TEXT,
  source_name TEXT,
  source_url TEXT,
  license TEXT,

  raw_data JSONB,
  fetched_at TIMESTAMP DEFAULT now()
);
```

### 16.4 facility_photos

```sql
CREATE TABLE facility_photos (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT REFERENCES facilities(id),
  image_url TEXT NOT NULL,
  caption TEXT,
  source_type TEXT,
  uploaded_by BIGINT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now()
);
```

### 16.5 facility_change_requests

```sql
CREATE TABLE facility_change_requests (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT REFERENCES facilities(id),
  requested_by BIGINT,
  request_type TEXT,
  proposed_data JSONB,
  status TEXT DEFAULT 'pending',
  reviewed_by BIGINT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

### 16.6 facility_sport_details

種目別に異なる詳細情報はJSONBまたは詳細テーブルで管理する。初期実装では `detail_type` + `detail_data` 方式が拡張しやすい。

```sql
CREATE TABLE facility_sport_details (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT REFERENCES facilities(id),
  sport_code TEXT NOT NULL,
  detail_type TEXT,
  detail_data JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

例:

```json
{
  "track_length_m": 400,
  "lane_count": 8,
  "surface_type": "全天候型",
  "certified": true,
  "has_distance_markers": true
}
```

```json
{
  "court_count": 6,
  "surface_type": "砂入り人工芝",
  "indoor": false,
  "night_lighting": true
}
```

---

## 17. API設計

### 17.1 ユーザー向け施設検索

```http
GET /api/facilities?category=golf&lat=35.6812&lng=139.7671&radius=30000
```

検索条件例:

```text
カテゴリ
スポーツ種目
現在地緯度経度
半径
都道府県
市区町村
キーワード
設備条件
営業中フラグ
初心者向け
ファミリー向け
予約URLあり
```

### 17.2 種目別検索例

```http
GET /api/facilities?sport=running&lat=35.6812&lng=139.7671&radius=10000
```

```http
GET /api/facilities?sport=tennis&prefecture=tokyo&has_lighting=true
```

```http
GET /api/facilities?sport=golf&lat=35.6812&lng=139.7671&radius=50000&has_reservation=true
```

```http
GET /api/facilities?category=recreation&sub_category=bowling&city=新宿区
```

### 17.3 施設詳細

```http
GET /api/facilities/{facility_id}
```

### 17.4 ユーザーによる施設提案

```http
POST /api/facility-proposals
```

リクエスト例:

```json
{
  "name": "○○テニスコート",
  "category": "ball_sports",
  "sports": ["tennis"],
  "address": "東京都○○市...",
  "website_url": "https://example.com",
  "description": "ナイター利用できるテニスコートです。"
}
```

### 17.5 管理者向け施設作成

```http
POST /admin/api/facilities
```

### 17.6 管理者向け施設更新

```http
PUT /admin/api/facilities/{facility_id}
```

### 17.7 管理者向け承認

```http
POST /admin/api/facilities/{facility_id}/approve
```

---

## 18. 管理画面要件

### 18.1 施設一覧

```text
キーワード検索
カテゴリ検索
スポーツ種目検索
都道府県・市区町村検索
公開状態フィルタ
確認状態フィルタ
重複候補表示
最終確認日表示
一括公開・非公開
外部ソース別フィルタ
予約URL有無フィルタ
設備条件フィルタ
```

### 18.2 施設編集

```text
基本情報編集
対応スポーツ・レジャー種目編集
緯度経度地図指定
公式URL・予約URL編集
料金・営業期間編集
設備フラグ編集
種目別詳細編集
写真管理
注意事項編集
公開状態変更
確認済みチェック
外部データ比較
```

### 18.3 重複確認画面

```text
重複候補一覧
名称類似度表示
距離表示
住所比較
電話番号比較
URL比較
外部ID比較
マージ実行
別施設として保存
```

---

## 19. ステータス設計

| status | 意味 |
|---|---|
| draft | 下書き |
| pending | 申請中・確認待ち |
| active | 公開中 |
| rejected | 却下 |
| hidden | 非表示 |
| closed | 閉鎖 |
| duplicate | 重複 |

確認状態は別項目で管理する。

| verification_status | 意味 |
|---|---|
| unverified | 未確認 |
| auto_imported | 自動取得済み |
| operator_verified | 運営者確認済み |
| owner_verified | 施設管理者確認済み |
| user_reported | 利用者報告あり |

---

## 20. 実装優先順位

### Step 1: 管理者による手動登録・編集画面

最初に管理者用の手動登録画面を作る。

対象:

```text
施設登録
施設編集
カテゴリ・種目設定
公開・非公開
承認
重複チェック
```

### Step 2: スポーツ・レジャーカテゴリマスター作成

対象:

```text
大分類
中分類
種目コード
表示名
アイコン
検索用キーワード
外部ソースマッピング
```

### Step 3: Google Places API取り込み

対象:

```text
sports系 Place Types
entertainment and recreation系 Place Types
補助施設 Place Types
```

### Step 4: OpenStreetMap / Overpass API取り込み

対象:

```text
leisure=sports_centre
leisure=stadium
leisure=pitch
leisure=track
leisure=park
tourism=camp_site
route=running
route=bicycle
amenity=toilets
amenity=parking
```

### Step 5: 自治体オープンデータ取り込み

対象:

```text
公共施設
スポーツ施設
体育施設
公園
観光施設
公衆トイレ
駐車場
イベント
```

### Step 6: 楽天GORA API取り込み

対象:

```text
ゴルフ場
ゴルフ場詳細
プラン
予約URL
```

### Step 7: 国土数値情報取り込み

対象:

```text
都市公園
自然公園地域
文化施設データ内のスポーツ施設
```

### Step 8: 利用者・施設管理者による登録提案

対象:

```text
施設提案
修正提案
閉鎖報告
写真投稿
集合場所提案
```

---

## 21. 運用ルール

### 21.1 更新頻度

| データ | 更新頻度 |
|---|---|
| Google Places | 週1回 |
| OSM / Overpass | 週1回〜月1回 |
| 自治体オープンデータ | 週1回〜月1回 |
| 自治体イベント | 毎日〜週1回 |
| 国土数値情報 | 月1回〜数か月に1回 |
| 楽天GORA | 毎日〜週1回 |
| 手動登録データ | 即時反映または承認後反映 |
| ユーザー提案 | 承認後反映 |

### 21.2 公開前チェック

```text
施設名が正しい
カテゴリ・種目が正しい
住所・緯度経度が正しい
重複施設ではない
公式URL・予約URLが不正ではない
営業情報が古すぎない
禁止事項・注意事項が入力されている
利用規約・ライセンス上問題がない
スポーツ施設の場合、個人利用・団体利用・大会利用の可否が確認されている
安全上の注意が必要な施設は注意事項が入力されている
```

---

## 22. ライセンス・規約上の注意

### 22.1 Google Places

Google Maps Platformの利用規約を確認し、保存可能な情報、キャッシュ可能期間、Googleマップ表示との関係を確認する。

### 22.2 OpenStreetMap

OpenStreetMapデータを利用する場合は、帰属表示を行う。

表示例:

```text
© OpenStreetMap contributors
```

### 22.3 自治体オープンデータ

自治体ごとにライセンスが異なる。CC BY、政府標準利用規約、独自規約などを確認する。

### 22.4 国土数値情報

データセットごとに利用条件、データ年度、商用利用可否が異なる。特に古い都市公園データや非商用条件が付くデータは、自社商用サービスでの利用可否を確認する。

### 22.5 楽天GORA

楽天Webサービスの利用規約、アフィリエイト条件、表示義務、API制限を確認する。

---

## 23. 参考情報

- Google Places API Place Types: https://developers.google.com/maps/documentation/places/web-service/place-types
- OpenStreetMap Wiki - sport: https://wiki.openstreetmap.org/wiki/Key:sport
- OpenStreetMap Wiki - leisure=pitch: https://wiki.openstreetmap.org/wiki/Tag:leisure%3Dpitch
- OpenStreetMap Wiki - leisure=track: https://wiki.openstreetmap.org/wiki/Tag:leisure%3Dtrack
- OpenStreetMap Wiki - tourism: https://wiki.openstreetmap.org/wiki/Key:tourism
- OpenStreetMap Wiki - amenity: https://wiki.openstreetmap.org/wiki/Key:amenity
- Overpass API by Example: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example
- デジタル庁 自治体標準オープンデータセット: https://www.digital.go.jp/resources/open_data/municipal-standard-data-set-test
- 国土数値情報 都市公園データ: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P13.html
- 国土数値情報 文化施設データ: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P27.html
- 不動産情報ライブラリ API操作説明: https://www.reinfolib.mlit.go.jp/help/apiManual/
- 楽天GORAゴルフ場検索API: https://webservice.rakuten.co.jp/documentation/gora-golf-course-search
- 楽天GORAゴルフ場詳細API: https://webservice.rakuten.co.jp/documentation/gora-golf-course-detail
- 楽天GORAプラン検索API: https://webservice.rakuten.co.jp/documentation/gora-plan-search

---

## 24. 結論

スポーツ・レジャー施設データは、外部データをバッチで取得し、自社DBに取り込んだうえで、管理画面で手動補完・承認する方式が最も安定する。

最初の実装では、以下を優先する。

```text
1. 管理者による手動登録・編集画面
2. スポーツ・レジャーカテゴリマスター作成
3. Google Places APIによる施設候補取得
4. OpenStreetMap / Overpass APIによる公共・自然・屋外施設取得
5. 自治体オープンデータによる公共施設・スポーツ施設・公園補完
6. 楽天GORA APIによるゴルフ場・予約導線補完
7. 国土数値情報による公園・自然公園区域・スポーツ施設補完
8. ユーザー・施設管理者による登録提案
```

この構成により、スポーツ・レジャー全体を対象にしながら、APIで自動取得できる基本情報と、運営者・施設管理者が補完する詳細情報を組み合わせ、実用的な施設マスターを構築できる。
