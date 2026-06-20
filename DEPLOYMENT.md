# 開発・デプロイ環境ガイド

スタック: **pnpm + Turborepo モノレポ（apps×7）/ Next.js 16 / Supabase**。
デプロイ: **自前サーバ / EC2（Docker Compose + Caddy）+ Supabase（ホスティング or セルフホスト）**、
CI/CD: **GitHub Actions**。

---

## 1. 環境の全体像

| 環境 | アプリ | DB | 用途 |
|---|---|---|---|
| ローカル開発 | `pnpm dev`（:3000–3006） | Supabase ローカル（Docker） | 日常開発 |
| 本番 | EC2/自前サーバ（Docker Compose・Caddy） | Supabase | 公開 |
| 本番 | Vercel Production（各サブドメイン） | Supabase 本番 | 公開 |

---

## 2. ローカル開発

前提: Docker 稼働、Node 20+、`pnpm`（`corepack` か `npm i -g pnpm`）。

```bash
make install     # 依存インストール
make up          # ローカル Supabase 起動 → apps/*/.env.local 生成 → サンプルデータ投入
make dev         # 全 app 起動（web:3000 account:3001 golf:3002 running:3003
                 #              outdoor:3004 facility:3005 admin:3006）
make down        # 停止（DB + dev サーバ）
make check       # lint + typecheck + build（CI 相当）
```

- `make help` で全タスク一覧。
- ローカル Supabase Studio: http://127.0.0.1:54323
- テストユーザ: `taro@example.com` / `password123`
- `supabase/config.toml` の `[api] schemas` に種目スキーマを登録済み（ローカルは自動公開）。
- ⚠️ 各 app は別ポート＝別オリジンのため、ローカルではアプリ間で session Cookie を共有しない。
  アプリ跨ぎの SSO を試すには `*.lvh.me`（127.0.0.1 に解決）＋ `NEXT_PUBLIC_COOKIE_DOMAIN=.lvh.me` を使う。

---

## 3. Supabase ホスティング設定

1. **プロジェクト作成**（本番／staging）。リージョンは日本近郊（例: Tokyo）。
2. **マイグレーション適用**: GitHub Actions `DB Migrate`（`supabase db push`）が `main` push で自動適用。
   手動は `supabase link --project-ref <ref>` → `supabase db push`。
3. **★ Exposed schemas**（Settings → API → Exposed schemas）に
   `account, core, facility, golf, running, outdoor` を追加（ホスティングは Dashboard 設定。
   `config.toml` はローカル専用）。
4. **カテゴリ seed**: `supabase/seed.sql` を本番に一度だけ適用（`core.sports` 等）。
   `psql "$DB_URL" -f supabase/seed.sql` など。
5. **Auth プロバイダ**:
   - Google / Apple: Authentication → Providers で有効化（Client ID/Secret、Apple は Service ID/Key）。
     リダイレクト URL に `https://account-spotomo.lykuro.ai/auth/callback`。
   - 電話番号: OTP 送信/検証はアプリが **Twilio Verify** を直接利用するため、Supabase の
     SMS プロバイダ設定は不要。ただし phone+password でのセッション発行を許可するため
     Authentication → Phone で **Phone provider を有効化**しておくこと（SMS 送信は使わない）。
     `TWILIO_ACCOUNT_SID/AUTH_TOKEN/VERIFY_SERVICE_SID` を account の env に設定。
   - LINE: Supabase 非対応のため自前実装。LINE Developers で Channel を作成し、
     Callback に `https://account-spotomo.lykuro.ai/auth/line/callback` を登録、
     `LINE_CHANNEL_ID/SECRET` を account プロジェクトの env に設定。
6. **Realtime**: チャットは `0013` で publication 登録済み。Database → Replication で有効を確認。

---

## 4. 自前サーバ / EC2（Docker Compose + Caddy）

7 app をコンテナ化（Next.js standalone）し、Caddy リバースプロキシでサブドメインへ振り分ける。
Caddy が Let's Encrypt で**自動 HTTPS** を取得する。

| サービス | コンテナ | 本番ドメイン |
|---|---|---|
| web | `web:3000` | spotomo.lykuro.ai |
| account | `account:3000` | account-spotomo.lykuro.ai |
| golf | `golf:3000` | golf-spotomo.lykuro.ai |
| running | `running:3000` | running-spotomo.lykuro.ai |
| outdoor | `outdoor:3000` | outdoor-spotomo.lykuro.ai |
| facility | `facility:3000` | facility-spotomo.lykuro.ai |
| admin | `admin:3000` | admin-spotomo.lykuro.ai |

### サーバ前提
- Docker + docker compose 導入済み（EC2 は t3.medium 以上推奨。ビルドにメモリを使う）
- セキュリティグループ/ファイアウォールで **80/443 を開放**
- 各サブドメインの DNS A レコードをサーバ IP へ向ける

### 初回セットアップ（サーバ上）
```bash
git clone <repo> /opt/spotomo && cd /opt/spotomo
cp .env.production.example .env.production   # 値を設定（下表）
vim docker/Caddyfile                          # ドメイン/メールを自社用に編集
docker compose up -d --build                  # = make docker-up
```
ローカルからのビルド確認は `make docker-build`。

### 環境変数（`.env.production`。全 app コンテナへ env_file で渡す）

| 変数 | 使う app |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 全 app |
| `SUPABASE_SERVICE_ROLE_KEY` | account / golf / running / outdoor / facility / admin（web 不要） |
| `NEXT_PUBLIC_ACCOUNT_URL` | 全 app（ヘッダ導線・ログイン誘導） |
| `NEXT_PUBLIC_COOKIE_DOMAIN`（`.lykuro.ai`） | 全 app（サブドメイン SSO） |
| `NEXT_PUBLIC_FACILITY_URL` | facility（Stripe 戻り先） |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `MAIL_PROVIDER` / `FROM_ADDRESS` / `FROM_NAME`（Amazon SES） | 通知を送る app（account/golf/running/outdoor/facility/admin） |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SERVICE_SID`（携帯認証 OTP） | account |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | facility |
| `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` | account |
| `RAKUTEN_APPLICATION_ID` / `RAKUTEN_ACCESS_KEY` / `RAKUTEN_AFFILIATE_ID`（任意） / `RAKUTEN_GORA_API_BASE_URL`（楽天GORA：ゴルフ場・プラン検索） | golf |

> 単一 `env_file` で全コンテナに渡す簡易構成。`SUPABASE_SERVICE_ROLE_KEY` を web から
> 厳密に分離したい場合は、compose の `environment:` で per-service に切り替える。
> Stripe Webhook 宛先: `https://facility-spotomo.lykuro.ai/api/stripe/webhook`。

### スケール時の選択肢（任意）
サーバでのビルドが重い場合は、CI で GHCR にイメージを push し、compose を `image:` 参照に
切り替える運用も可能（`docker-compose.yml` の `build:` を `image:` に置換）。

---

## 5. GitHub Actions

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `ci.yml` | PR / main push | `pnpm install` → `lint` → `build`（型チェック込み） |
| `db-migrate.yml` | main の `supabase/migrations/**` 変更 | `supabase db push` で本番 DB に適用 |
| `deploy.yml` | main push / 手動 | サーバへ SSH → `git pull` → `docker compose up -d --build` |

### 必要な GitHub Secrets

- DB: `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` / `SUPABASE_DB_PASSWORD`
- Deploy: `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` / `DEPLOY_PATH`（例: `/opt/spotomo`）

> サーバ側に repo clone と `.env.production` を事前配置しておくこと（`deploy.yml` は pull→rebuild のみ）。

---

## 6. DNS / サブドメイン

`spotomo.lykuro.ai` と各サブドメインの A レコードをサーバ IP へ向ける。Caddy が 80/443 で受け、
`docker/Caddyfile` の定義に従って各コンテナへプロキシ＋自動 TLS。
全 app で `NEXT_PUBLIC_COOKIE_DOMAIN=.lykuro.ai` を設定すると、account でログイン後に
全種目サブドメインで session Cookie を共有できる（共通 user_id の SSO）。

---

## 7. 本番デプロイ チェックリスト

- [ ] Supabase 本番プロジェクト作成・`db push` 適用
- [ ] **Exposed schemas に 6 スキーマ追加**（ホスティングは Dashboard、セルフホストは Kong 設定）
- [ ] `seed.sql`（カテゴリ）適用
- [ ] Auth プロバイダ（Google/Apple/LINE/SMS）設定・リダイレクト URL 登録
- [ ] サーバ: Docker 導入・80/443 開放・repo clone・`.env.production` 設定・`Caddyfile` 編集
- [ ] DNS: 各サブドメインをサーバ IP へ
- [ ] `docker compose up -d --build`（または `deploy.yml` 経由）
- [ ] `NEXT_PUBLIC_COOKIE_DOMAIN` を設定（SSO）
- [ ] Stripe（price 設定・Webhook 登録）
- [ ] GitHub Secrets 登録（DB マイグレーション + SSH デプロイ）
- [ ] 管理者付与: `insert into account.user_roles (user_id, role) values ('<uuid>','admin');`
