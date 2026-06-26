# 仕様変更まとめ（2026-06-26）

一般利用者による**施設登録（申請）機能**を実装し、登録時の**種別を種目ツリー（大分類/
小分類）選択**に変更した。全変更は本番（同一サーバの docker compose）へ web→admin の順で
直列デプロイ・検証済み（[[deploy-serial-no-concurrent-compose]] / [[deploy-local-docker-from-main]]）。

---

## 1. 一般利用者の施設登録申請（`/facilities/register`）

施設運営者専用の `/facilities/submit`（`requireOwnerAccount` ガード）とは別に、**一般会員が
施設の新規登録を申請できる導線**を新設した。owner/general アカウント分離の方針を維持するため
ルートを分けている。

| 項目 | 内容 |
|---|---|
| ルート | `apps/web/app/facilities/register`（**一般会員専用**。`requireGeneralAccount` でガード） |
| 未ログイン | proxy の `GENERAL_PREFIXES` に追加。`/login?redirect=/facilities/register` へ誘導し、ログイン後に戻す |
| 運営者アカウント | 一般機能を持たないため運営者領域へリダイレクト（`requireGeneralAccount` の挙動） |
| 保存先 | `facility.facility_submissions`（`submission_type='new'`、RLS `user_id = auth.uid()`） |
| 承認 | 管理画面（admin）の既存 `reviewFacilitySubmission` で `facilities` へ insert。重複は自動統合せず管理者が確認（仕様 §6.6） |
| 入口 | 施設検索（`/facilities`）に「施設を登録する」ボタン（結果ゼロ時）＋「施設が見つからない場合は登録する →」常設リンク。「募集を作成する→施設をさがす→見つからない→登録」導線上に配置 |

> フォームは運営者申請と共有（`apps/web/app/facilities/_components/facility-submit-form.tsx`）。
> サーバーアクションを props で受け取り、`submitFacility`（運営者）/`registerFacility`（一般）を共用する。

---

## 2. 登録時の種別を種目ツリー（大分類/小分類）選択に変更

従来 `facility_type` の自由入力だった種別を、**種目（`core.sports`）の大分類/小分類の
カスケード選択**に変更した（一般登録 `/facilities/register` のみ。運営者申請は自由入力のまま非破壊）。

| 項目 | 内容 |
|---|---|
| UI | 「種別（大分類）」必須セレクト＋「種別（小分類）」任意セレクト（大分類選択で小分類が連動絞り込み） |
| 種目解決 | 小分類があればそれ、無ければ大分類を採用。サーバー側（`registerFacility`）で公開種目を再検証 |
| 保存 | `submitted_data.facility_type` に選択種目名（表示用）＋ `submitted_data.sport_ids`（facilities のカラムではない・種目紐付け用） |
| 承認時の展開 | admin `reviewFacilitySubmission` が `sport_ids` を取り出し **`facility.facility_sports` を作成**（修正申請は upsert・重複無視）。残りキーのみ `facilities` へ insert |

> **理由**：施設検索（`/facilities`）は `facility_sports!inner` で種目絞り込みするため、`facility_sports`
> を作らないと登録施設が種目別一覧に出ない。承認時に種目紐付けを行うことで、登録施設が選んだ
> 種目の検索結果に表示される。

---

## 3. 影響範囲

- **web**: `app/facilities/register/{page,actions}.ts`、`app/facilities/_components/{facility-submit-form.tsx,types.ts}`（フォーム共有化）、`app/facilities/submit/{page,actions}.ts`（共有フォームへ移行）、`app/facilities/page.tsx`（導線）、`proxy.ts`（`GENERAL_PREFIXES`）。
- **admin**: `app/actions.ts` の `reviewFacilitySubmission`（`sport_ids` 抽出→`facility_sports` 作成、insert は id 取得のため `.select("id")`）。
- **DB**: スキーマ変更なし（既存 `facility_submissions`/`facility_sports` を利用）。`submitted_data` に `sport_ids` キーを追加した運用上の規約。
