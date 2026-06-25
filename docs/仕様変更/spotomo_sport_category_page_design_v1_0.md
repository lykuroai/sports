# Spotomo 種目単位画面設計書 v1.0

作成日: 2026-06-25  
対象サイト: Spotomo / スポーツ・レジャー仲間募集プラットフォーム  
対象画面: 種目単位画面 / 種目別トップ画面  
前提仕様: 1つのサイトに集約、1つのアカウント、1つの共通施設DB、1つの仲間募集DB、1つの管理画面

---

## 1. 目的

本設計書は、Spotomoのトップ画面から遷移する**種目単位画面**の仕様を定義する。

種目単位画面は、ゴルフ、ランニング、アウトドア、サッカー、テニス、フィットネスなど、各スポーツ・レジャーカテゴリごとの入口ページである。

ユーザーは種目単位画面から、以下の行動を行える。

1. その種目の仲間募集を探す
2. その種目に関連する施設を探す
3. イベント・大会情報を探す
4. 募集を作成する
5. 種目に関連する説明・参加方法を確認する
6. 地域・日時・レベル・目的で絞り込む

本サイトは1つに集約するため、種目ごとに別サイトを作るのではなく、**共通サイト内の種目別ページ**として展開する。

---

## 2. 基本方針

```text
サイト: 1つ
URL: 種目別に分ける
ユーザー管理: 共通
施設DB: 共通
仲間募集DB: 共通
イベントDB: 共通
表示: 種目コードで絞り込み
管理画面: 共通
```

### 2.1 種目単位画面の役割

| 役割 | 内容 |
|---|---|
| 種目別入口 | トップ画面から種目を選んだ後の着地点 |
| 仲間募集導線 | その種目の新着・おすすめ募集を表示 |
| 施設検索導線 | その種目で利用できる施設を表示 |
| イベント導線 | 大会・イベント・体験会などを表示 |
| SEOページ | 「ゴルフ 仲間募集」「ランニング 仲間募集」などの検索流入を狙う |
| 募集作成導線 | 種目が選択済みの状態で募集作成へ誘導 |

---

## 3. 対象種目カテゴリ

初期実装では、以下の大カテゴリを対象とする。

| 大カテゴリ | URL例 | 主な種目 |
|---|---|---|
| ゴルフ | `/golf` | ゴルフ、ゴルフ練習場、ラウンド仲間 |
| ランニング | `/running` | ランニング、マラソン、ジョギング、陸上競技 |
| アウトドア | `/outdoor` | キャンプ、登山、BBQ、釣り、ハイキング |
| 球技 | `/ball-sports` | サッカー、フットサル、野球、バスケ、バレー |
| テニス | `/tennis` | テニス、ソフトテニス |
| フィットネス | `/fitness` | ジム、ヨガ、ピラティス、ダンス |
| 水泳・水辺 | `/water-sports` | 水泳、SUP、カヤック、サーフィン |
| ウィンタースポーツ | `/winter-sports` | スキー、スノーボード、スノーシュー |
| レジャー | `/leisure` | ボウリング、ダーツ、ビリヤード、カラオケ |

必要に応じて、以下のように小カテゴリページを追加する。

```text
/outdoor/camp
/outdoor/hiking
/outdoor/fishing
/ball-sports/soccer
/ball-sports/baseball
/fitness/yoga
```

---

## 4. URL設計

### 4.1 基本URL

```text
/{sport_slug}
```

例:

```text
/golf
/running
/outdoor
/tennis
/fitness
/leisure
```

### 4.2 詳細導線URL

| 画面 | URL例 | 説明 |
|---|---|---|
| 種目トップ | `/running` | ランニングの入口画面 |
| 種目別仲間募集一覧 | `/running/recruitments` | ランニング募集一覧 |
| 種目別施設一覧 | `/running/facilities` | ランニング施設一覧 |
| 種目別イベント一覧 | `/running/events` | マラソン大会・イベント一覧 |
| 種目別募集作成 | `/recruitments/new?sport=running` | 種目選択済みで作成 |
| 施設詳細 | `/facilities/{facility_id}` | 共通施設詳細 |
| 募集詳細 | `/recruitments/{recruitment_id}` | 共通募集詳細 |
| イベント詳細 | `/events/{event_id}` | 共通イベント詳細 |

### 4.3 小カテゴリURL

```text
/{sport_slug}/{sub_category_slug}
```

例:

```text
/outdoor/camp
/outdoor/hiking
/running/marathon
/ball-sports/soccer
/fitness/yoga
```

---

## 5. 画面構成

種目単位画面は、以下のセクションで構成する。

```text
1. ヘッダー
2. 種目ヒーローエリア
3. 種目内検索エリア
4. クイック導線
5. 新着仲間募集
6. おすすめ施設
7. イベント・大会情報
8. 小カテゴリ一覧
9. 初心者向け説明
10. 人気地域
11. フッター
```

---

## 6. PC画面ワイヤーフレーム

```text
+------------------------------------------------------+
| Header                                               |
| Logo | 種目から探す | 施設 | 仲間募集 | ログイン     |
+------------------------------------------------------+
| Breadcrumb                                           |
| ホーム > ランニング                                  |
+------------------------------------------------------+
| Hero                                                 |
| [ランニング仲間を見つけよう]                         |
| 説明文                                               |
| [仲間募集を探す] [施設を探す] [募集を作成]            |
+------------------------------------------------------+
| Search Box                                           |
| 地域 | 日時 | レベル | 目的 | キーワード | 検索        |
+------------------------------------------------------+
| Quick Menu                                           |
| 募集一覧 | 施設一覧 | イベント | 初心者歓迎 | 近くで探す   |
+------------------------------------------------------+
| New Recruitments                                     |
| Card | Card | Card | Card                               |
+------------------------------------------------------+
| Recommended Facilities                               |
| Card | Card | Card | Card                               |
+------------------------------------------------------+
| Events / Races                                       |
| Card | Card | Card                                      |
+------------------------------------------------------+
| Sub Categories                                       |
| マラソン | ジョギング | 陸上競技場 | ランニングコース |
+------------------------------------------------------+
| Guide Content                                        |
| ランニング仲間募集の使い方                           |
+------------------------------------------------------+
| Footer                                               |
+------------------------------------------------------+
```

---

## 7. スマホ画面ワイヤーフレーム

```text
+-------------------------------+
| Header                        |
| Logo              Menu        |
+-------------------------------+
| Hero                          |
| ランニング仲間を見つけよう    |
| [探す] [募集作成]             |
+-------------------------------+
| Search                        |
| キーワード                    |
| 地域                          |
| 日時                          |
| [検索]                        |
+-------------------------------+
| Quick Menu                    |
| 募集 | 施設 | イベント | 近く |
+-------------------------------+
| 新着仲間募集                  |
| Card                          |
| Card                          |
| もっと見る                    |
+-------------------------------+
| おすすめ施設                  |
| Card                          |
| Card                          |
| もっと見る                    |
+-------------------------------+
| イベント・大会                |
| Card                          |
+-------------------------------+
| 小カテゴリ                    |
| Chip Chip Chip                |
+-------------------------------+
| Footer                        |
+-------------------------------+
```

---

## 8. ヒーローエリア仕様

### 8.1 表示項目

| 項目 | 内容 |
|---|---|
| 種目名 | ゴルフ、ランニング、アウトドア等 |
| キャッチコピー | 種目ごとの訴求文 |
| 説明文 | 何ができる画面か説明 |
| 背景画像 | 種目に合うビジュアル |
| CTA1 | 仲間募集を探す |
| CTA2 | 施設を探す |
| CTA3 | 募集を作成する |

### 8.2 種目別コピー例

| 種目 | メインコピー | サブコピー |
|---|---|---|
| ゴルフ | ゴルフ仲間を見つけよう | ラウンド仲間、練習仲間、初心者歓迎の募集を探せます。 |
| ランニング | 一緒に走る仲間を見つけよう | ランニング、マラソン、ジョギング仲間を地域やレベルで探せます。 |
| アウトドア | 自然を楽しむ仲間を見つけよう | キャンプ、登山、BBQ、釣りなどの仲間募集に参加できます。 |
| 球技 | チームスポーツの仲間を見つけよう | サッカー、野球、バスケ、バレーなどの参加者を探せます。 |
| フィットネス | 一緒に続ける仲間を見つけよう | ジム、ヨガ、ダンス、トレーニング仲間を探せます。 |
| レジャー | 気軽に遊べる仲間を見つけよう | ボウリング、ダーツ、ビリヤード、カラオケなどを楽しめます。 |

---

## 9. 種目内検索エリア

### 9.1 検索条件

| 条件 | 内容 |
|---|---|
| キーワード | 募集タイトル、施設名、地域名 |
| 地域 | 都道府県、市区町村、現在地周辺 |
| 日時 | 今日、明日、今週末、日付指定 |
| レベル | 初心者歓迎、経験者向け、誰でも可 |
| 目的 | 交流、練習、試合、イベント、体験 |
| 性別条件 | 指定なし、男性、女性、男女混合 |
| 年齢層 | 指定なし、20代、30代、40代以上等 |
| 募集状態 | 募集中、締切間近、満員除外 |

### 9.2 初期表示条件

種目ページでは、該当種目が初期選択された状態で検索する。

```text
sport_code = current_sport
status = active
sort = newest
```

例:

```text
/running
→ sport_code = running
```

---

## 10. クイック導線

種目単位画面には、行動を早く開始するためのクイック導線を配置する。

| 導線 | 遷移先 | 説明 |
|---|---|---|
| 仲間募集を探す | `/{sport_slug}/recruitments` | 該当種目の募集一覧 |
| 施設を探す | `/{sport_slug}/facilities` | 該当種目の施設一覧 |
| イベントを探す | `/{sport_slug}/events` | 該当種目のイベント一覧 |
| 近くで探す | 位置情報検索 | 現在地周辺の募集・施設 |
| 募集を作成 | `/recruitments/new?sport={sport_code}` | 種目選択済みで作成 |

---

## 11. 新着仲間募集セクション

### 11.1 表示条件

```text
sport_code = current_sport
status = open
start_at >= now または event_date >= today
```

### 11.2 表示項目

| 項目 | 内容 |
|---|---|
| 募集タイトル | 例: 週末ランニング仲間募集 |
| 種目 | ランニング、ゴルフ等 |
| 地域 | 都道府県・市区町村 |
| 施設名 | 紐づく施設がある場合 |
| 開催日時 | 日付・時間 |
| 募集人数 | 定員・現在参加数 |
| レベル | 初心者歓迎等 |
| 主催者 | ニックネーム・アイコン |
| ステータス | 募集中、締切間近、満員 |

### 11.3 募集カード例

```text
[初心者歓迎] 皇居ランニング仲間募集
東京都千代田区 / 2026-07-05 09:00
現在 3 / 8人
初心者歓迎・男女問わず
[詳細を見る]
```

---

## 12. おすすめ施設セクション

### 12.1 表示条件

施設は共通DBから取得し、種目との紐づけで絞り込む。

```text
facilities.status = active
facility_sports.sport_code = current_sport
```

### 12.2 表示項目

| 項目 | 内容 |
|---|---|
| 施設名 | 施設名称 |
| カテゴリ | 陸上競技場、ゴルフ場、キャンプ場等 |
| 住所 | 市区町村まで優先表示 |
| 写真 | メイン画像 |
| 対応種目 | 複数表示可能 |
| 設備 | 駐車場、トイレ、シャワー等 |
| 予約URL | 登録済みの場合 |
| 確認状態 | 運営確認済み等 |

### 12.3 施設カード例

```text
皇居外周ランニングコース
東京都千代田区
対応: ランニング / ウォーキング
設備: トイレあり、駅近
[施設詳細]
```

---

## 13. イベント・大会情報セクション

### 13.1 対象

| 種目 | イベント例 |
|---|---|
| ランニング | マラソン大会、駅伝、練習会 |
| ゴルフ | コンペ、試打会、初心者体験会 |
| アウトドア | キャンプイベント、登山ツアー、BBQ会 |
| 球技 | 練習試合、大会、個サル |
| フィットネス | ヨガイベント、ダンス体験会 |

### 13.2 表示項目

| 項目 | 内容 |
|---|---|
| イベント名 | 大会・イベント名 |
| 種目 | 対応種目 |
| 開催日 | 日付 |
| 開催地域 | 都道府県・市区町村 |
| 会場 | 施設名 |
| 申込URL | 外部URLまたは内部申込 |
| ステータス | 受付中、終了、締切 |

---

## 14. 小カテゴリ一覧

種目内でさらに細かく探せるよう、小カテゴリを表示する。

### 14.1 ランニング例

```text
ランニング
マラソン
ジョギング
駅伝
陸上競技
ランニングコース
陸上競技場
```

### 14.2 アウトドア例

```text
キャンプ
登山
ハイキング
BBQ
釣り
カヤック
SUP
公園散策
```

### 14.3 球技例

```text
サッカー
フットサル
野球
バスケットボール
バレーボール
バドミントン
卓球
```

### 14.4 レジャー例

```text
ボウリング
ダーツ
ビリヤード
カラオケ
ボードゲーム
```

---

## 15. 初心者向け説明セクション

種目ページには、SEOと利用理解のために説明文を配置する。

### 15.1 表示内容

| 項目 | 内容 |
|---|---|
| この種目でできること | 仲間募集、施設検索、イベント参加 |
| 参加の流れ | 募集を探す、参加申請、主催者承認 |
| 初心者向け案内 | 初めてでも参加しやすい募集の探し方 |
| 注意事項 | マナー、安全、キャンセルルール |

### 15.2 ランニング例文

```text
ランニングページでは、地域や日時、レベルに合わせて一緒に走る仲間を探せます。
初心者歓迎のジョギング、週末の練習会、マラソン大会に向けた練習仲間など、目的に合わせて参加できます。
```

---

## 16. 人気地域セクション

### 16.1 目的

SEOと検索導線のため、種目別に人気地域リンクを表示する。

### 16.2 例

```text
東京のランニング仲間募集
神奈川のランニング仲間募集
大阪のランニング仲間募集
東京のゴルフ仲間募集
千葉のゴルフ仲間募集
埼玉のキャンプ仲間募集
```

### 16.3 URL例

```text
/running/tokyo
/golf/chiba
/outdoor/saitama
```

または検索パラメータ方式とする。

```text
/running/recruitments?prefecture=tokyo
/golf/facilities?prefecture=chiba
```

MVPでは検索パラメータ方式を優先する。

---

## 17. 種目マスターデータ設計

### 17.1 sports テーブル

```sql
CREATE TABLE sports (
  id BIGSERIAL PRIMARY KEY,
  sport_code TEXT NOT NULL UNIQUE,
  sport_name TEXT NOT NULL,
  sport_slug TEXT NOT NULL UNIQUE,
  parent_sport_code TEXT,
  category_type TEXT,
  description TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_image_url TEXT,
  icon_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 17.2 初期データ例

```sql
INSERT INTO sports
(sport_code, sport_name, sport_slug, category_type, hero_title, hero_subtitle, display_order)
VALUES
('golf', 'ゴルフ', 'golf', 'sports', 'ゴルフ仲間を見つけよう', 'ラウンド仲間や練習仲間を探せます。', 10),
('running', 'ランニング', 'running', 'sports', '一緒に走る仲間を見つけよう', 'ランニング・マラソン仲間を探せます。', 20),
('outdoor', 'アウトドア', 'outdoor', 'outdoor', '自然を楽しむ仲間を見つけよう', 'キャンプ・登山・BBQ仲間を探せます。', 30),
('tennis', 'テニス', 'tennis', 'sports', 'テニス仲間を見つけよう', '練習相手やダブルス仲間を探せます。', 40),
('fitness', 'フィットネス', 'fitness', 'fitness', '一緒に続ける仲間を見つけよう', 'ジム・ヨガ・ダンス仲間を探せます。', 50),
('leisure', 'レジャー', 'leisure', 'leisure', '気軽に遊べる仲間を見つけよう', 'ボウリング・ダーツなどの仲間を探せます。', 60);
```

---

## 18. 施設との紐づけ

施設DBは1つに集約し、種目との関連は `facility_sports` で管理する。

```sql
CREATE TABLE facility_sports (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facilities(id),
  sport_code TEXT NOT NULL REFERENCES sports(sport_code),
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (facility_id, sport_code)
);
```

例:

```text
代々木公園
- running
- walking
- outdoor
- picnic

東京体育館
- basketball
- volleyball
- badminton
- table_tennis
- fitness
```

---

## 19. 仲間募集との紐づけ

仲間募集は `recruitments` で共通管理し、種目コードを持つ。

```sql
CREATE TABLE recruitments (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  sport_code TEXT NOT NULL REFERENCES sports(sport_code),
  facility_id BIGINT REFERENCES facilities(id),
  organizer_user_id BIGINT NOT NULL,
  description TEXT,
  prefecture TEXT,
  city TEXT,
  start_at TIMESTAMP,
  end_at TIMESTAMP,
  capacity INTEGER,
  participant_count INTEGER DEFAULT 0,
  level_type TEXT,
  purpose_type TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

---

## 20. API設計

### 20.1 種目情報取得

```http
GET /api/sports/{sport_slug}
```

レスポンス例:

```json
{
  "sport_code": "running",
  "sport_name": "ランニング",
  "sport_slug": "running",
  "hero_title": "一緒に走る仲間を見つけよう",
  "hero_subtitle": "ランニング・マラソン仲間を地域やレベルで探せます。",
  "hero_image_url": "/images/sports/running-hero.jpg"
}
```

### 20.2 種目別仲間募集取得

```http
GET /api/recruitments?sport=running&prefecture=tokyo&level=beginner&limit=8
```

### 20.3 種目別施設取得

```http
GET /api/facilities?sport=running&prefecture=tokyo&limit=8
```

### 20.4 種目別イベント取得

```http
GET /api/events?sport=running&prefecture=tokyo&limit=6
```

### 20.5 種目別トップ集約API

トップ表示用に、1回のAPIでまとめて取得する。

```http
GET /api/sport-pages/{sport_slug}
```

レスポンス例:

```json
{
  "sport": {},
  "sub_categories": [],
  "new_recruitments": [],
  "recommended_facilities": [],
  "events": [],
  "popular_areas": []
}
```

---

## 21. フロントエンドコンポーネント設計

```text
pages/
  [sportSlug]/
    index.vue
    recruitments.vue
    facilities.vue
    events.vue

components/
  sport/
    SportHero.vue
    SportSearchBox.vue
    SportQuickMenu.vue
    SportRecruitmentSection.vue
    SportFacilitySection.vue
    SportEventSection.vue
    SportSubCategoryList.vue
    SportGuideContent.vue
    SportPopularAreaList.vue

components/common/
    RecruitmentCard.vue
    FacilityCard.vue
    EventCard.vue
    CategoryChip.vue
```

### 21.1 コンポーネント責務

| コンポーネント | 役割 |
|---|---|
| SportHero | 種目別コピー、画像、CTA表示 |
| SportSearchBox | 種目内検索フォーム |
| SportQuickMenu | 募集・施設・イベントへの導線 |
| SportRecruitmentSection | 新着募集一覧 |
| SportFacilitySection | おすすめ施設一覧 |
| SportEventSection | イベント・大会一覧 |
| SportSubCategoryList | 小カテゴリリンク |
| SportGuideContent | 種目説明・初心者案内 |
| SportPopularAreaList | 人気地域SEOリンク |

---

## 22. 表示制御

### 22.1 ログイン前

| 表示 | 内容 |
|---|---|
| 仲間募集一覧 | 閲覧可 |
| 施設一覧 | 閲覧可 |
| イベント一覧 | 閲覧可 |
| 募集作成 | ログイン誘導 |
| 参加申請 | ログイン誘導 |

### 22.2 ログイン後

| 表示 | 内容 |
|---|---|
| 募集作成 | 利用可 |
| 参加申請 | 利用可 |
| お気に入り | 利用可 |
| メッセージ | 利用可 |
| 自分に合う募集 | 将来機能 |

---

## 23. 管理画面仕様

管理者は、種目単位画面の表示内容を管理できる。

### 23.1 種目管理

| 項目 | 内容 |
|---|---|
| 種目名 | 表示名 |
| URLスラッグ | `/running` など |
| ヒーロータイトル | 画面上部コピー |
| 説明文 | SEO・画面説明 |
| アイコン | カテゴリ用画像 |
| ヒーロー画像 | 背景画像 |
| 表示順 | トップ・一覧での順序 |
| 公開状態 | active / hidden |

### 23.2 種目別おすすめ管理

| 項目 | 内容 |
|---|---|
| おすすめ募集 | 管理者が固定表示可能 |
| おすすめ施設 | 管理者が固定表示可能 |
| おすすめイベント | 管理者が固定表示可能 |
| 人気地域 | 種目別に設定 |
| 小カテゴリ | 表示/非表示を管理 |

---

## 24. SEO設計

### 24.1 title例

```text
ランニング仲間募集・ランニング施設検索 | Spotomo
ゴルフ仲間募集・ゴルフ場検索 | Spotomo
キャンプ・登山・アウトドア仲間募集 | Spotomo
```

### 24.2 meta description例

```text
ランニング仲間を地域・日時・レベルで探せるSpotomo。初心者歓迎のジョギング、マラソン練習会、ランニングコースや施設情報もまとめて検索できます。
```

### 24.3 h1例

```text
ランニング仲間を見つけよう
ゴルフ仲間を見つけよう
アウトドア仲間を見つけよう
```

### 24.4 構造化データ

将来的に以下を検討する。

```text
WebSite
BreadcrumbList
SportsActivityLocation
Event
LocalBusiness
```

---

## 25. MVP実装範囲

初期リリースでは、以下を実装する。

### 25.1 必須

```text
1. 種目マスター
2. 種目トップ画面
3. 種目別ヒーロー
4. 種目別検索フォーム
5. 新着仲間募集表示
6. おすすめ施設表示
7. 小カテゴリ表示
8. 募集作成への導線
9. 管理画面で種目情報編集
```

### 25.2 後回し

```text
1. 種目別イベント詳細最適化
2. 人気地域SEOページの大量生成
3. パーソナライズおすすめ
4. レビュー連動
5. AIによる募集推薦
6. 種目別ランキング
```

---

## 26. 画面別優先順位

| 優先度 | 画面 | 理由 |
|---|---|---|
| 高 | `/golf` | ゴルフ場・楽天GORA連携があるため集客しやすい |
| 高 | `/running` | マラソン・ランニング仲間募集と相性がよい |
| 高 | `/outdoor` | キャンプ・登山・BBQなど利用者層が広い |
| 中 | `/tennis` | 施設・仲間募集ニーズが明確 |
| 中 | `/ball-sports` | 種目が多く、サブカテゴリ整理が必要 |
| 中 | `/fitness` | ジム・ヨガ・ダンスなど拡張性あり |
| 低 | `/leisure` | 初期はカテゴリ一覧レベルでよい |

---

## 27. 種目単位画面からの主要フロー

### 27.1 仲間募集を探す

```text
トップ画面
↓
種目を選択
↓
種目単位画面
↓
新着仲間募集または検索
↓
募集詳細
↓
参加申請
```

### 27.2 施設を探す

```text
トップ画面
↓
種目を選択
↓
種目単位画面
↓
おすすめ施設または施設検索
↓
施設詳細
↓
この施設で募集を探す / 募集を作成
```

### 27.3 募集を作成する

```text
種目単位画面
↓
募集を作成
↓
種目選択済み作成画面
↓
施設・日時・人数・説明を入力
↓
公開
```

---

## 28. デザイン方針

### 28.1 共通デザイン

```text
明るい
活動的
わかりやすい
初心者でも参加しやすい
カテゴリごとに色や画像で違いを出す
```

### 28.2 種目別ビジュアル例

| 種目 | 色・印象 | 画像例 |
|---|---|---|
| ゴルフ | 緑、落ち着き | ゴルフ場、芝生、クラブ |
| ランニング | 青、爽やか | 公園、ランナー、朝の道 |
| アウトドア | 緑、自然 | 山、キャンプ、焚き火 |
| 球技 | オレンジ、活発 | コート、ボール、チーム |
| フィットネス | 紫、健康 | ジム、ヨガ、トレーニング |
| レジャー | 黄色、楽しい | ボウリング、ダーツ、友人 |

---

## 29. 注意事項

1. 種目ごとにDBを分けない。
2. 施設DBは1つに集約し、種目との紐づけで表示を分ける。
3. URLは種目別に分けるが、認証・管理・検索APIは共通化する。
4. 種目ページはSEO流入を意識し、説明文と人気地域リンクを持たせる。
5. MVPでは全種目を細かく作り込みすぎず、ゴルフ・ランニング・アウトドアを優先する。

---

## 30. 結論

種目単位画面は、1つの総合サイト内で各スポーツ・レジャーに特化した入口として提供する。

```text
1サイト集約
+
種目別URL
+
共通DB
+
共通API
+
種目別表示制御
```

この構成により、ユーザーは1つのアカウントで複数種目に参加でき、運営側は施設・募集・イベントを一元管理できる。

初期実装では、以下の3画面を優先する。

```text
/golf
/running
/outdoor
```

その後、テニス、球技、フィットネス、レジャーへ順次展開する。
