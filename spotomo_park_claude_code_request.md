# スポともパーク仕様変更依頼：共通ユーザ管理と種目別ドメイン分離

既存のスポともパーク仕様に、以下の設計方針を追加・変更してください。

## 目的

スポともパークでは、ゴルフ、ランニング、登山、キャンプ、テニスなど複数のスポーツ・レジャー種目を扱う予定です。

そのため、ユーザ管理は一か所に集約し、各種目の機能は独立したドメインとして管理できる構成に変更したいです。

## 基本方針

以下の構成にしてください。

```text
ユーザ管理：共通基盤として一か所に集約
種目機能：ゴルフ、ランニング、アウトドア等を独立ドメインとして管理
ログイン：全種目で共通アカウントを利用
データ連携：各種目サービスは共通 user_id を参照
```

## ドメイン構成案

以下のような構成を前提にしてください。

```text
spotomo-park.jp              トップページ
account.spotomo-park.jp      共通ユーザ管理
app.spotomo-park.jp          共通アプリ入口
golf.spotomo-park.jp         ゴルフ
running.spotomo-park.jp      ランニング
outdoor.spotomo-park.jp      登山・キャンプ・アウトドア
facility.spotomo-park.jp     施設管理者向け
admin.spotomo-park.jp        運営管理画面
```

将来的に種目を追加しやすいように、種目別機能は疎結合にしてください。

## ソースコード構成方針

ソースコードは、分類ごとにサブプロジェクトとして構築してください。

モノレポ構成を前提にしつつ、共通基盤、種目別サービス、管理画面、施設管理者向け機能を分離してください。

想定構成例：

```text
spotomo-park/
  apps/
    web/                 # トップページ・共通入口
    account/             # 共通ユーザ管理
    golf/                # ゴルフ用サブプロジェクト
    running/             # ランニング用サブプロジェクト
    outdoor/             # 登山・キャンプ・アウトドア用サブプロジェクト
    facility/            # 施設管理者向けサブプロジェクト
    admin/               # 運営管理画面
  packages/
    shared-ui/           # 共通UI部品
    shared-types/        # 共通型定義
    auth-client/         # 共通認証クライアント
    api-client/          # APIクライアント
    domain-common/       # 共通ドメインロジック
  services/
    account-api/         # 共通ユーザ・認証API
    golf-api/            # ゴルフAPI
    running-api/         # ランニングAPI
    outdoor-api/         # アウトドアAPI
    facility-api/        # 施設管理API
    admin-api/           # 管理API
  docs/
    requirements.md
    database_schema.md
    api_design.md
```

## サブプロジェクト分離ルール

以下のルールで分離してください。

```text
共通ユーザ管理は account サブプロジェクトに集約する
ゴルフ、ランニング、アウトドアなどの種目は、それぞれ独立したサブプロジェクトにする
施設管理者向け機能は facility サブプロジェクトに分離する
運営管理画面は admin サブプロジェクトに分離する
共通UI、型定義、認証処理、APIクライアントは packages 配下で共有する
各種目サブプロジェクトは共通 user_id を参照する
各種目サブプロジェクトにログイン・認証情報を直接持たせない
```

## サブプロジェクト追加方針

将来、新しい種目を追加する場合は、既存ソースに直接混ぜ込まず、独立したサブプロジェクトとして追加してください。

例：

```text
apps/tennis/
services/tennis-api/
```

または：

```text
apps/cycling/
services/cycling-api/
```

追加時の基本ルール：

```text
共通ユーザ管理は変更しない
共通 user_id を利用する
種目固有プロフィールは新しい種目用テーブルに作成する
共通テーブルに種目固有項目を追加しない
共通UIや共通APIクライアントは packages で再利用する
```


## 共通ユーザ管理の役割

共通ユーザ管理では、以下を管理してください。

```text
会員登録
ログイン
プロフィール管理
本人確認
通知設定
決済情報
利用規約同意
退会処理
```

共通ユーザ管理側では、全種目で共通して利用する情報だけを保持してください。

例：

```text
user_id
email
phone_number
nickname
gender
birthdate
profile_image
area
verification_status
notification_settings
payment_customer_id
terms_agreement_status
created_at
updated_at
```

## 種目別ドメインの役割

各種目ドメインでは、種目固有の情報だけを管理してください。

ゴルフ例：

```text
golf_user_profiles
golf_facilities
golf_events
golf_reservations
golf_participants
golf_scores
```

ランニング例：

```text
running_user_profiles
running_events
running_courses
running_participants
running_records
```

アウトドア例：

```text
outdoor_user_profiles
outdoor_spots
outdoor_events
outdoor_participants
outdoor_gear
```

各種目のテーブルにはログイン情報や認証情報を持たせず、共通ユーザIDである `user_id` のみを参照してください。

## プロフィール設計

共通プロフィールと種目別プロフィールを分けてください。

### 共通プロフィール

```text
user_id
nickname
gender
age_range
profile_image
area
introduction
verification_status
```

### ゴルフ用プロフィール

```text
user_id
average_score
handicap
preferred_area
available_days
club_owned
beginner_friendly
```

### ランニング用プロフィール

```text
user_id
pace
distance_preference
race_experience
preferred_time
```

### アウトドア用プロフィール

```text
user_id
activity_type
experience_level
gear_owned
transportation
solo_participation_ok
```

## 設計上の注意点

以下のように、共通ユーザテーブルに種目固有情報を入れないでください。

悪い例：

```text
users テーブルに golf_level, tennis_level, camp_experience などを直接追加する
```

良い例：

```text
users
golf_user_profiles
running_user_profiles
outdoor_user_profiles
```

共通ユーザ情報と種目別情報を明確に分離してください。

## ログイン・認証方針

ログインは共通化してください。

想定ログイン方式：

```text
メールログイン
Googleログイン
Appleログイン
LINEログイン
電話番号認証
```

ログイン後は共通 `user_id` を発行し、各種目ドメインではその `user_id` を利用してください。

処理イメージ：

```text
ログイン
  ↓
共通ユーザID発行
  ↓
各種目サービスへ遷移
  ↓
各種目サービスは user_id を参照して利用者情報を取得
```

## 追加してほしい仕様内容

既存仕様書に以下を追加してください。

```text
本サービスは、共通ユーザ管理基盤を中心に、ゴルフ、ランニング、アウトドア等の種目別サービスを独立したドメインとして構成する。

ユーザは一つのアカウントで複数の種目サービスを利用できる。

各種目サービスは共通ユーザIDを参照しつつ、種目固有のプロフィール、施設、イベント、参加募集、予約情報を独立して管理する。

共通ユーザ管理にはログイン、本人確認、通知、決済、利用規約同意などの共通機能を集約する。

種目別サービスには、種目固有の施設、イベント、募集、予約、スコア、参加履歴などを管理する。
```

## 修正対象

以下を確認し、必要な修正案を作成してください。

```text
requirements.md
database schema
API設計
画面遷移
認証設計
管理画面設計
施設管理者向け機能
種目追加時の拡張方針
```

## 期待する成果物

以下を作成・修正してください。

```text
1. 既存 requirements.md への追記案
2. 共通ユーザ管理と種目別ドメイン分離後の全体構成図
3. DBテーブル設計案
4. API設計案
5. 画面構成案
6. 将来、種目を追加する場合の拡張ルール
7. 分類ごとのサブプロジェクト構成案
8. モノレポ構成案
```

## 重要条件

```text
ユーザ管理は一か所に集約すること
種目ごとに独立して機能追加できること
各種目は共通 user_id を参照すること
共通ユーザテーブルに種目固有項目を直接追加しないこと
施設情報、イベント情報、募集情報、予約情報は種目別に拡張できること
将来、ゴルフ以外の種目追加を前提にすること
ソースコードは分類ごとのサブプロジェクトとして構築すること
新しい種目を追加する場合は、既存種目のソースに混在させず独立したサブプロジェクトとして追加すること
```

## 依頼

まずは実装前に、仕様書・DB設計・API設計の変更案を提示してください。

コード修正を始める前に、既存設計への影響範囲と変更方針を整理してください。
