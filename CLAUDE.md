# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 現状

MVP の基盤を実装済み（フェーズ1〜4の中核）。スタックは Next.js 16（App Router /
Server Actions）+ TypeScript + Supabase。セットアップ手順は `README.md` を参照。

### コマンド

```bash
npm run dev        # 開発サーバー（Turbopack, http://localhost:3000）
npm run build      # 本番ビルド（型チェック込み）
npm run typecheck  # tsc --noEmit のみ
npm run lint       # ESLint
```

DB は `supabase/migrations/0001_init.sql`（スキーマ+PostGIS）→ `0002_rls.sql`（RLS）
→ `seed.sql`（カテゴリー）の順で適用する。`supabase db push` または
ダッシュボードの SQL Editor を使用。テストフレームワークは未導入。

### 実装状況

- 実装済み: 認証（メール/Google/LINE/電話番号OTP。認証画面は Cloudflare Turnstile の
  CAPTCHA で保護。Apple ログインは廃止）、プロフィール編集、募集の一覧/検索/詳細/作成、
  参加申請・承認/拒否・キャンセル、募集ごとグループチャット、施設地域検索/詳細、
  マイページ、相互評価（開催終了→評価、`profiles.rating`/参加・主催回数を集計トリガーで
  自動更新）、施設レビュー、管理画面（ダッシュボード/利用者/募集/通報/施設登録申請/
  カテゴリー管理、CSV取り込み）、利用者向けの通報（募集詳細）と施設登録/修正申請、
  お気に入り・主催者フォロー、ブロック、アプリ内通知＋メール通知、現在地周辺検索（PostGIS）。
- 未実装（仕様の将来拡張）: 地図タイル表示（地図プロバイダ未選定）、オンライン予約・決済、
  AI推薦、LINE通知、ネイティブアプリ（仕様 §12.2 / §14）。MVP（§12.1）はおおむね充足。

### 【進行中】統合サイト化（マルチアプリ→1サイト集約）

`docs/仕様変更/`（single_site / architecture / facility_data v1.2）の方針転換に伴い、
マルチアプリ＋サブドメインを **`apps/web` 単一の統合サイト**へ集約中。設計と進捗は
`docs/仕様変更/0_移行設計_統合サイト化.md`。決定事項: 主キーは UUID 維持 / 認証はロール累積へ /
旧アプリは段階廃止（即時撤去しない）。
- **Phase 1 済**: 旧 `apps/running/app/*` を `apps/web/app/*` へ取り込み（種目ランディングは
  `/running`、events/races/facilities/mypage/profile/chat は top-level 横断）。トップの種目導線は
  running=サイト内パス、golf/outdoor=既存サブドメイン（移行期）。ログインは当面 account 集約。
- **Phase 2 済**: 施設取り込み基盤（`0031`。`facility_sources`/`normalize_name`/
  `find_duplicate_candidates`/`core.batch_runs`）。詳細は下の施設スキーマ節。
- **Phase 3 済**: OSM(Overpass) 取り込みバッチ（`apps/web/lib/osm-sync.ts` ＋
  `/api/cron/sync-osm-facilities`）。ランニング/公園系を取得→`find_duplicate_candidates` で
  重複判定→**未承認(`status='unverified'`)で登録**し、`facility_sources` に出所(ODbL帰属)と raw を記録。
  施設一覧は `status='verified'` のみ表示（公開前承認）。env は `OSM_FETCH_AREA`/`OSM_FETCH_LIMIT`/
  `OSM_USER_AGENT`/`CRON_SECRET`（`.env.production.example` 参照）。
- **承認UI 済**: 管理画面（`apps/admin`）に「取り込み施設の承認」（`/facilities`。未承認一覧＋出所＋
  重複候補表示＋承認(verified)/却下(rejected)＋**重複統合(merge)**＋**県フィルタ/ページング/一括承認**）と
  「取り込みバッチ履歴」（`/batch-runs`）。アクション: `reviewImportedFacility`/`bulkReviewImportedFacilities`/
  `mergeImportedFacility`（いずれもサービスロール＋`audit_logs`）。merge は出所・種目を既存施設へ移し
  取り込み側を削除（自動統合せず管理者が実行）。ダッシュボードに未承認件数カードを追加。
- **自治体オープンデータ取り込み 済**: `apps/web/lib/municipal-sync.ts` ＋
  `/api/cron/sync-municipal-facilities?url=&source=&pref=&license=`。CKAN/CSV を取得し列名柔軟推定・
  文字コード(UTF-8→Shift_JIS)自動判定・RFC4180 パーサで正規化→重複判定→未承認登録、
  `facility_sources(source_type='municipal_open_data')` に出所URL/ライセンス/raw 保存。出所ごとに
  ライセンス・列が異なるため URL 単位で叩く。データ源は **BODIK CKAN**（`data.bodik.jp`。多数DL
  すると IP レート制限で body 読取不能になるので巡回はゆるめに）と **東京都オープンデータカタログ**
  （`catalog.data.metro.tokyo.lg.jp`。CKAN・CC BY・BODIK と独立）。`data/municipal-sources.json` に
  50ソース（BODIK 7 + 東京都 43自治体）。注意点:
  - コード列(全国地方公共団体コード等)を県名と誤認しない（`findCol` はコード列除外）。
  - **東京都推奨データセットv2 は緯度/経度が2組あり片方が空**。`findCols`/`pickCell` で同名列を全て
    見て行ごとに非空値を採用する（片方だけ見ると全行 skip になる）。`所在地_都道府県/市区町村`・
    `分類` 等の推奨DS標準列名にも対応。県名・指定pref が無ければ住所先頭から都道府県を抽出。
  - 上限 `MUNICIPAL_FETCH_LIMIT`。スポーツ施設に限定（子育て/観光/学校/汎用公共施設は除外）。
- **cron スケジューラ 済**: docker compose の `scheduler` サービス（`docker/scheduler/`。alpine+busybox
  crond+jq）。起動時に `CRON_SECRET`（env_file）を埋め込んだ crontab/巡回スクリプトを生成し、内部
  ネットワークの `http://web:3000/api/cron/*` を叩く（TLS/Caddy 非経由）。OSM=毎週月 03:10 JST（複数県
  ループ）、自治体=毎月1日 04:00 JST、races=毎日 03:30 JST。対象上書きは `SCHED_TARGET`。
  - **自治体巡回**: ソース一覧は `data/municipal-sources.json`（`{url,source,pref,license}` 配列）を
    compose で `/sources.json` にマウント（**再ビルド不要でホット編集可**。crond 起動時に再読込）。
    `/run-municipal.sh` が jq で読み、各URLを per-URL エンドポイントへ順に流す（各リクエスト1ソース）。
  - デプロイは `docker compose up -d --build scheduler`（直列）。ソース追加は JSON 編集＋scheduler 再起動。
- **未了**: 集約ログインの web 内包、golf/outdoor の web 取り込み、ロール累積の再設計、旧アプリ撤去、
  自治体オープンデータ取り込み、施設詳細での OSM 帰属表示、重複の統合(merge)操作。

### 重要な実装メモ

- Supabase クライアントは **untyped**（`SupabaseClient`、generic なし）で使い、行は
  `src/lib/database.types.ts` のドメイン型へキャストする。手書き型が supabase-js の
  `Database` 契約と完全一致しないため。本番では `supabase gen types` で生成した型に
  置き換えること。
- セッション更新と会員専用パス保護は `src/proxy.ts`（Next 16 の proxy 規約。旧
  middleware）が担う。
- 参加承認時にチャット参加と通知レコード生成を Server Action 内で行う
  （`src/app/recruitments/actions.ts`）。
- 評価集計（`profiles.rating`・参加/主催回数）は `0003_reviews.sql` の SECURITY DEFINER
  トリガーで行う。他ユーザーの profiles 更新は RLS で阻まれるため、アプリ側ではなく
  DB トリガーで集計するのが原則。相互評価は開催日時が過去（または status='finished'）
  かつメンバーの場合のみ可能（`src/app/recruitments/[id]/review/`）。
- 管理画面（`src/app/admin/`）は `requireAdmin()`（`src/lib/auth.ts`）でガード。読み取りは
  管理者向け RLS が通る通常のセッションクライアント、書き込み（利用者停止・通報対応・
  施設申請承認等）は **サービスロールクライアント**（`src/lib/supabase/admin.ts`、
  `SUPABASE_SERVICE_ROLE_KEY` 必須）で RLS をバイパスして実行。各操作前に必ず
  `getAdminUser()` で権限検証し、`writeAuditLog()` で `audit_logs` に記録する。
- 管理者の付与は手動: `insert into user_roles (user_id, role) values ('<uuid>','admin');`
- 施設登録/修正申請（`src/app/facilities/submit/`）の `submitted_data`（jsonb）のキーは
  **必ず `facilities` のカラム名に一致**させる。管理者承認時に `reviewFacilitySubmission`
  がそのまま `facilities` へ insert/update するため。新規キーを足す際は両方を合わせること。
  CSV取り込み（`src/app/admin/facilities/import/`）の許可カラムも同様。
- **【重要・スキーマ実態】`facilities` は `0001_init.sql` ではなく `0009_schema_split.sql` の定義が
  本番の実態**（`0001` は `public.facilities` を drop して `facility` スキーマに作り直している）。
  実カラムは `id, name, facility_type, description, postal_code, prefecture, city, address,
  latitude, longitude, geog, source, status, created_at, updated_at`。
  - 取り込み元（出所）は **`source`**（enum `facility_source`、`source_type`/`source_id` は無い）。
  - 位置情報は **`geog`**（`geography(Point,4326)`、`geom` は無い）。緯度経度から
    `'SRID=4326;POINT(lng lat)'`（EWKT）で投入すれば現在地周辺検索 `nearby_facilities` が効く。
  - `status` は enum `verification_status`（既定 `verified`）。`0001` 由来の
    `nearest_station`/`phone`/`website_url`/`verification_status`/`source_id` 等のカラムは
    本番には**存在しない**。CSV/`submitted_data` のキーは上記実カラムに合わせること。
  - **【統合サイト化 Phase 2・`0031`】外部取り込み基盤を追加**（既存モデルは非破壊）。
    `facilities` に `normalized_name`/`last_checked_at` を追加。出所は単一 `source`(enum) に加え
    **`facility.facility_sources`**（複数行・`source_type`(TEXT)/`source_id`/`source_url`/`license`/
    `raw_data`(jsonb)/`fetched_at`）で多重ソース・帰属表示・再取得・重複判定を扱う。
    重複候補は RPC **`facility.find_duplicate_candidates(name,lat,lng,radius_m,lim)`**（pg_trgm
    `similarity` + PostGIS）、名称正規化は **`facility.normalize_name(text)`**。外部取得バッチの
    履歴は **`core.batch_runs`/`core.batch_run_logs`**。これら取り込み系は raw_data を含むため
    RLS で**管理者のみ select**、書き込みはサービスロール。新仕様の `facility_categories`/
    `facility_details`(平坦) は採用せず、既存 `facility_sports`(core.sports ツリー)/`facility_features`
    (key-value) を継続（より正規化が進むため＝意図的逸脱、`docs/仕様変更/0_移行設計` §5）。
- **通知作成は必ず `notifyUser()`（`src/lib/notify.ts`）経由**。notifications には INSERT
  用 RLS ポリシーが無く、セッションクライアントからの他ユーザー宛 insert は失敗する。
  `notifyUser` はサービスロールで insert し、`users.email` 宛にメール送信
  （`packages/domain-common/src/email.ts`、**Amazon SES**。`FROM_ADDRESS`/`AWS_*` 未設定ならログのみ）。
- 携帯番号認証は **Twilio Verify**（`packages/domain-common/src/sms.ts`）で OTP 送信/検証し、
  検証後にサービスロールでユーザ作成/更新＋使い捨てパスワードで `signInWithPassword` して
  Supabase セッションを発行する（`apps/account/app/phone/actions.ts`）。Supabase 組み込みの
  phone OTP は使わない。
- **ログイン後の戻り先（redirect）**: 未ログインで保護ページ（募集作成・参加申請・編集等）へ
  進んだら、ログイン/新規登録を経て**元のページへ戻す**。仕組みは全ログイン手段で `redirect` を
  一貫して引き継ぐこと。要点:
  - 種目アプリ（golf/running/outdoor）には `/login` ルートが無い（ログインは account 集約）。
    未ログイン誘導は必ず account 共通ログインの**絶対URL**へ。`packages/auth-client` の
    `loginUrlFor(path)`（リクエストの自オリジン＋ACCOUNT_URL から生成）と `updateSession`
    （proxy）を使う。相対 `/login` に飛ばすと種目アプリ側で 404 になる。
  - リバースプロキシ（Caddy）越しでは `request.nextUrl`/`Host` が内部アドレス
    `0.0.0.0:3000` になる。戻り先URLは **`X-Forwarded-Host`/`X-Forwarded-Proto`**
    （無ければ Host）から公開URLを組み立てる（middleware・`loginUrlFor`）。
  - ログイン後の遷移先は `resolvePostLogin()` で検証（相対パス or 同一 apex の絶対URLのみ許可、
    外部URLは `/profile` フォールバック＝オープンリダイレクト対策）。
  - 戻り先は全手段で保持: メール（hidden input）/ Google（`oauth_next` Cookie。Supabase OAuth は
    `redirectTo` のクエリを許可リスト次第で落とすため Cookie で持ち回す）/ LINE（`line_next`
    Cookie）/ 電話（hidden input）。新規登録は `/profile?redirect=…` を挟み、プロフィール保存後に
    元ページへ戻す。
- ブロックの双方向判定は RLS で他者の行が読めないため RPC `is_blocked_between(a,b)`
  （`0005_blocks.sql`）を使う。現在地周辺検索は RPC `nearby_facilities(lat,lng,radius_m,lim)`
  （`0006_geo.sql`、PostGIS `ST_DWithin`/`ST_Distance`）。地図タイル描画は未実装。
- ゴルフ場予約は **楽天GORA API 連携（送客モデル）**。仕様は
  `rakuten_gora_reservation_spec.md`。本システム内で予約・決済は **行わず**、楽天GORAの
  予約ページへ送客し、主催者が予約後に予約状態を **手動更新** する。実装は golf 種目のみ。
  - DB: `0020_golf_gora.sql`。`golf.golf_courses`（GORA ゴルフ場の永続記録、facilities と任意リンク）、
    `golf.golf_plans`（募集に紐づくプラン・スナップショット＋`reserve_url`/`raw_response`）、
    `golf.event_golf_details`（`golf.events` とゴルフ予約情報の関連＋`reservation_status`）。
  - 楽天API は **サーバー側のみ**（`apps/golf/lib/gora.ts`）。キーは `RAKUTEN_APPLICATION_ID`
    等（フロントに公開しない）。未設定時は検索結果を空＋通知でフォールバック。API ルートは
    `apps/golf/app/api/golf/courses`（検索/詳細）・`/api/golf/plans`（プラン検索）。
  - 導線: `/clubs`（ゴルフ場検索＝GORA）→ `/clubs/[courseId]`（詳細＋プラン一覧）→
    「このプランで募集する」→ `/events/new`（GORA 情報を引き継ぎ作成）。募集詳細で
    予約ページリンクと予約状態の手動更新（主催者）を表示。表示には楽天GORA出典・料金/空き枠
    変動・予約は楽天側で確定する旨を明示（仕様 §14、楽天Web Service 利用規約 §15）。

## このプロジェクトの概要

**スポーツ・レジャーを一緒に楽しむ仲間を募集**し、活動場所となる**施設を検索**する
Webプラットフォームです。名称に反して、これは主に施設検索アプリ*ではありません*。
中心となる導線は次のとおりです。

1. スポーツ・レジャー種別を選ぶ → 2. 地域・日時を指定する → 3. 募集中の活動または
施設を探す → 4. 募集に参加する、または自分で募集を作成する → 5. グループチャットで
連絡する → 6. 当日活動する → 7. 相互評価する。

施設検索は募集（開催場所探し）を**支える**ために存在し、目玉機能ではありません。
「現在地周辺」検索は意図的に補助機能とし、地域・駅・地図検索が施設検索の主条件です
（仕様 §3.2、§15.3）。

## 推奨スタック（仕様 §9）

- **フロントエンド**: Next.js + TypeScript + React、レスポンシブWeb、将来的にPWA。
- **バックエンド**: Supabase — Auth、PostgreSQL、**PostGIS**、Storage、Realtime。
  ビジネスロジックは Next.js Server Actions／API Routes と、必要に応じて Supabase
  Edge Functions で実装。
- **地図**: 施設の緯度経度は PostGIS の `geography`／`geometry` 型で保持。地域内検索、
  半径検索、地図範囲検索、距離順並び替えに使用（§9.4）。地図プロバイダ
  （Google Maps／Mapbox／OSM）は未定。

このスタックから外れる場合は、明示的に指摘してください。データモデルと非機能要件
（RLS、Realtimeチャット）は Supabase を前提としています。

## ドメインモデル（仕様 §8）

約21テーブル。複数テーブルにまたがり、特に重要な関係は次のとおりです。

- **users / profiles / user_sports**: `users` は非公開の認証データ（email、phone、
  各種認証タイムスタンプ）を保持し、`profiles` は*公開*ビューを保持します。
  **重要なプライバシー原則**: 本名、正確な生年月日、電話番号、メールアドレスは
  他の利用者に決して公開しません。主催者であっても参加者の連絡先は見えません
  （§6.1、§6.4、§15.6）。これらは別テーブルに分け、RLS で強制します。
- **sports**: 自己参照のカテゴリーツリー（`parent_id`、`category_type`）。管理者が
  管理（並び替え・公開停止が可能）。カテゴリー、施設設備、募集条件はすべてハード
  コードせず管理画面から変更可能にすること（§15.10）。
- **recruitments → recruitment_participants**: 中心エンティティ。募集はまだ**施設が
  未定**の場合があります（地域のみ指定、「施設は参加者と相談」）。両テーブルに
  リッチな状態遷移があります — 募集状態（下書き／募集中／満員／中止／…）と参加状態
  （申請中／承認済み／キャンセル待ち／欠席／…）。MVP では主催者承認制と先着順の参加
  フローのみを優先します。
- **facilities + facility_sports / facility_features / facility_images /
  facility_submissions / facility_owners**: 施設データには4つの取り込み経路があります
  — 外部・オープンデータ取り込み、管理者によるCSV／JSON取り込み、利用者申請、確認済み
  施設運営者による管理。利用者の申請・修正は管理者承認を経由します
  （根拠URL付きの `facility_submissions`）。重複判定は支援するのみで**自動統合せず**、
  管理者が確認します（§6.6）。
- **chat_rooms / chat_room_members / chat_messages**: 募集ごとに1つのグループチャット。
  承認済み参加者のみが参加。MVP はグループチャットのみ提供し、個別メッセージは後回し
  （§6.7、§15.7）。Supabase Realtime 上に構築します。
- **安全系テーブル — reports / blocks / user_reviews / facility_reviews**: 通報、
  ブロック、相互評価、操作ログは後付けではなく初期段階から必要です（§15.9）。個別の
  低評価コメントは公開範囲を制限し、公開するのは総合評価・参加回数・主催回数のみ
  （§6.10）。

## ロール（仕様 §4）

権限が累積する4つのアクター種別: 一般利用者 → 募集主催者 → 施設運営者 →
システム管理者。管理者権限と一般権限の分離、および RLS は譲れないセキュリティ要件
です（§11.1）。管理画面には多要素認証が必要です。

**【方針変更・§4 からの意図的な逸脱】施設運営者は別アカウント体系**（A案 / `0024`）。
当初は「施設運営者も一人の一般利用者」（ロール累積）だったが、運営者を**一般会員と
分離**する方針に変更した。同一 Supabase Auth（`auth.users`）は共用しつつ
`account.users.account_type`（`general` | `facility_owner`）で種別を持ち、
- 施設運営者は **facility アプリ専用で登録/ログイン**（`apps/facility/app/register|login`、
  種別を `signUp` の `options.data.account_type='facility_owner'` で付与。`handle_new_user`
  トリガーが `account.users.account_type` を設定）。
- 施設運営者は **一般プロフィール `account.profiles` を持たない**（トリガーが種別で出し分け）。
  → 一般機能（プロフィール・募集参加）は使えない。`requireGeneralAccount()` で弾き facility へ誘導。
- 施設運営者専用領域は `requireOwnerAccount()` でガード（`account_type='facility_owner'`
  または既存 verified オーナー）。`facility/proxy.ts` は `loginPath:"/login"` で自前ログインへ誘導。
- 既存ユーザは非破壊で `general` のまま（ロックアウト防止）。既存オーナーは当面 dual-use。
- 本番はサブドメイン間 Cookie 共有（`COOKIE_DOMAIN=.lykuro.ai`）のため、ログインは集約のまま
  種別で機能分離する。FK（`facility_owners.user_id → account.users`）は維持。
- 未対応: 運営者の Google/LINE/電話 登録（その経路は `general` になる）、一般ガードの
  golf/running/outdoor への横展開（現状でも運営者はプロフィール不在で参加は失敗する）。

## API構成（仕様 §10）

`/api/*` 配下のRESTスタイルのルートをドメイン別にグループ化（auth、profile、sports、
recruitments、facilities、chat-rooms、reviews、reports、notifications）。募集の
アクションはサブルート（`/api/recruitments/{id}/apply|approve|reject|cancel`）。
ルート／Server Actions をスキャフォールドする際の契約として使用してください。

## MVPスコープ（仕様 §12）

**含む**: メール＋Googleログイン、プロフィール、スポーツカテゴリー、募集の
一覧／検索／詳細／作成、参加申請＋承認／拒否、参加者一覧、グループチャット、施設の
一覧／検索／詳細、地域／駅／地図検索（＋現在地周辺の補助機能）、利用者による施設
登録・修正申請、管理者承認、CSV施設取り込み、アプリ内＋メール通知、通報、管理画面。

**後回し**（指示がない限り実装しない）: 施設のオンライン予約、決済／Stripe／売上分配、
LINEログイン・通知、AIマッチング／推薦、有料プラン、ネイティブアプリ、個別メッセージ、
高度な本人確認。

**【方針変更・実装済みの収益化】**「後回し」だった Stripe 決済／有料プランは依頼により実装した:
- **Phase A 施設運営者サブスク**: **廃止＝施設運営者は無料**（依頼による方針変更）。課金導線
  （`apps/facility/app/plans`・facility の Stripe Webhook・`lib/billing.ts`）は削除済み。施設の
  所有・編集は `facility_owners`(verified)＋RLS で無料提供（元々課金ゲートではない）。DB の
  `facility.subscription_plans`/`facility_subscriptions`/`facilities.promotion_rank` 等は
  非破壊のため残置（未使用）。`apps/facility/lib/stripe.ts` は `facilityOrigin` のみ残す。
- **Phase B プレミアム会員**（`0023`、`apps/account`）: 利用者単位のサブスク（¥1,500/月）。プレミアム会員のみ
  募集に**参加者条件**（性別・スキル・趣味=種目 `condition_sport_ids`・エリア=都道府県
  `condition_prefectures`）を指定でき、`approval`（承認制）募集を作成可。無料会員は
  `first_come`（自由参加・承認不要）のみ。条件は申請者の判断材料として承認画面に表示する
  だけで応募はブロックしない（§15.3）。サーバーアクションのゲートに加え、DB の
  `core.enforce_event_premium()` トリガー＋`core.is_premium()` で非会員の条件を強制クリアする。
  決済顧客 `account.billing_customers` は Phase A/B 共用、Webhook が真実源
  （account 側は冪等キーを `user:` 接頭辞で名前空間化）。

開発順序は §13 の5フェーズに従う: 基盤（認証／プロフィール／カテゴリー／権限）→
募集 → 施設 → チャット／通知／安全機能／管理画面 → 評価・お気に入り。

## 重要な設計方針（常に遵守 — 仕様 §15）

1. 仲間募集と参加をシステムの中心にする。
2. 施設検索は募集の開催場所探しのための機能。現在地周辺は補助であり主機能ではない。
3. 利用者の電話番号・メール・本名を他の利用者に公開しない。
4. MVP はグループチャット。個別メッセージは後回し。
5. 外部データ提供元の利用条件を遵守する。許可のない継続的スクレイピングは行わず、
   robots.txt・著作権・再利用条件を確認する（§6.6）。
6. 施設予約・決済・AI推薦は将来拡張とする。
