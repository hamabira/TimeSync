# AkiMatch

みんなの空き時間、重なるところだけすぐ見える。

AkiMatch は、予定がばらばらな学生グループ向けの日程調整アプリです。幹事が候補時間を大量に作るのではなく、対象期間を共有し、参加者が自分の空いている時間帯を回答します。集計結果は日付ごとの横バー型ヒートマップで表示し、どの日のどの時間帯に人が集まりやすいかをすばやく判断できます。

ポートフォリオとしては、認証なしで共有できる日程調整フロー、Cloudflare D1 を使った回答保存、人数順の候補抽出、スマホでも読みやすい集計 UI を実装したプロダクトです。

## 主な機能

- 認証なしでイベント URL を共有できる
- 幹事がイベント名と対象期間を入力してイベントを作成できる
- 参加者が名前と空き時間を回答できる
- 同じイベント内で同じ名前が再回答された場合、前回の回答を上書きする
- 参加可能人数が多い順に上位 3 件の候補時間を表示する
- 日付ごとの横バー型ヒートマップで時間帯の重なりを確認できる
- 1 時間単位、0:00 から 24:00 までの時間帯を集計する

## プロダクト方針

### 対象ユーザー

- 大学生の少人数グループ幹事
- ゼミ、グループ課題、サークル、友達グループなどで集まる時間を決めたい人
- 授業、バイト、サークル、通学時間で予定がばらけやすく、日付だけでは調整しきれないグループ

### 解決したい課題

丸バツ表だけでは、みんなの空き時間がどこで重なっているのか分かりにくいことがあります。

会社の飲み会のように「日付だけ決まれば、時間はだいたい終業後」で済むケースではなく、AkiMatch は「同じ日でも空いている時間が人によって違う」ケースを重視しています。

### 既存の日程調整ツールとの差分

調整さんに近いシンプルな日程調整体験を保ちつつ、AkiMatch では候補時間を幹事が細かく作り込まなくても、回答結果から重なりやすい時間帯を見つけられることを重視しています。

- 幹事は対象期間を決めて URL を共有する
- 参加者は自分が空いている日と時間帯を入力する
- 集計結果は日付ごとの横バー型ヒートマップで表示する
- 上位候補時間を人数順に表示し、最適な時間帯をすぐ判断できるようにする

### MVP で含めないもの

- 大規模イベントの出欠管理
- 店予約、会費、場所決めなどの飲み会幹事機能
- Google Calendar などの外部カレンダー連携
- 認証、アカウント、パスワード付きイベント
- イベント編集、削除、LINE 共有
- 30 分単位の詳細調整

## 技術構成

- Next.js App Router
- React
- Tailwind CSS v4
- shadcn / Base UI
- Drizzle ORM
- Cloudflare Workers / Pages 想定
- Cloudflare D1
- OpenNext Cloudflare adapter
- Wrangler

アプリケーションは Cloudflare Workers runtime、Cloudflare D1、Drizzle ORM を前提にしています。Cloudflare への Next.js デプロイには OpenNext Cloudflare adapter を使います。

## 開発手順

依存関係をインストールします。

```bash
pnpm install
```

開発サーバーを起動します。

```bash
pnpm dev
```

`pnpm dev` はローカル D1 のマイグレーションを適用してから Next.js を起動します。初回起動時も、開発用のデータベーススキーマが用意された状態で作業できます。

ログを `logs/dev.log` に残しながら起動したい場合は、次のコマンドを使います。

```bash
pnpm run dev:log
```

## 品質チェック

通常の確認では次のコマンドを使います。

```bash
pnpm lint
pnpm build
```

Cloudflare Workers 向けのビルド結果まで確認する場合は、OpenNext Cloudflare adapter のビルドも実行します。

```bash
pnpm exec opennextjs-cloudflare build
```

ローカルで Workers runtime のプレビューを確認する場合は、次のコマンドを使います。

```bash
pnpm run preview
```

## 回答保存の上限

イベント単位の保存上限は、参加者 `100` 人、slot `2,000` 件です。1 回の回答は既存どおり最大 `20` slot とし、`20 slot × 100 人 = 2,000 slot` になるようにしています。これはMVPの共有イベントで扱うデータ量を bounded に保ちつつ、通常の少人数グループには十分な余裕を持たせるためです。

上記の値は `src/lib/limits.ts` の `MAX_EVENT_PARTICIPANTS` と `MAX_EVENT_SLOTS` に定義し、`drizzle/20260904120000_event_limits.sql` のSQLite triggerでも強制します。数値を変更するときは、TypeScript定数とmigration SQLのリテラルを同時に更新してください。`MAX_EVENT_SLOTS` は `MAX_RESPONSE_SLOTS (20) × MAX_EVENT_PARTICIPANTS (100)` と一致させます。

## Cloudflare デプロイ手順

このプロジェクトは、OpenNext Cloudflare adapter を使って Next.js アプリを Cloudflare Workers にデプロイします。

本番デプロイは GitHub Actions で行います。`main` へのプルリクエストではチェックのみを実行し、プルリクエストがマージされて `main` に push されたときに、同じチェックを通したうえで既存の `akimatch` Worker にデプロイします。

### 1. Cloudflare にログインする

```bash
pnpm wrangler login
pnpm wrangler whoami
```

### 2. 本番用 D1 データベースを作成する

```bash
pnpm wrangler d1 create akimatch_db
```

返ってきたデータベース UUID を `wrangler.toml` の `database_id` に設定します。

```toml
[[d1_databases]]
binding = "DB"
database_name = "akimatch_db"
database_id = "<returned database_id>"
migrations_dir = "drizzle"
```

### 3. D1 マイグレーションを適用する

D1 マイグレーションはデプロイワークフローでは自動適用しません。マイグレーションが必要なときは、手動で本番 D1 に適用します。

```bash
pnpm wrangler d1 migrations apply akimatch_db --remote
```

### 4. Workers runtime でプレビューする

```bash
pnpm run preview
```

### 5. GitHub Actions の secrets を設定する

デプロイ変更を `main` にマージする前に、リポジトリ secrets に次の値を設定します。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

ワークフローは `wrangler.toml` を使うため、本番 Worker は `akimatch`、本番 D1 データベースは `akimatch_db` として扱われます。

### 6. Cloudflare の濫用対策と Rate Limiting Rule

#### リポジトリで確認できる範囲

- アプリ側は Server Actions の body size を `100kb` に制限し、回答は1件あたり最大 `20 slot`、イベントは最大 `100` 参加者・`2,000` slotです。
- 参加者数とslot数のイベント単位上限は、D1 migrationのSQLite triggerでも強制します。
- GitHub Actionsの `Check` job は、main向けのPull Requestとmainへのpushで `pnpm lint`、`pnpm test`、`pnpm build`、OpenNext Cloudflare build、`wrangler deploy --dry-run` を実行します。
- D1 migrationの本番適用は自動ではなく、次の手動手順で行います。

```bash
pnpm wrangler d1 migrations apply akimatch_db --remote
```

#### Dashboardでの手動設定手順

Cloudflare DashboardでRate Limiting Ruleを作成し、次を初期値の目安にします。

- 対象パスは `/` と `/e/*` のorigin到達リクエスト
- 同一IPから1分あたり30〜60リクエスト超を目安にする
- まず `Log` で24〜48時間確認し、その後 `Managed Challenge` または `Block` に変更する
- mitigation durationは10分程度から始める
- Cloudflare planによりmethodやheader条件が使えない場合は、pathベースの緩めの設定から始める

Dashboard上の `Block` / `Managed Challenge` の有効化状態はリポジトリから保証できず、本PRでは本番のRate Limiting設定を変更しません。

### 7. デプロイする

プルリクエストを `main` にマージするか、GitHub Actions から `Deploy` ワークフローを手動実行します。ワークフローでは次の確認を行います。

```bash
pnpm lint
pnpm build
pnpm exec opennextjs-cloudflare build
```

`wrangler deploy` まで進むのは、`main` への `push` と `workflow_dispatch` のみです。プルリクエストではデプロイしません。

緊急時のローカルデプロイ用に `pnpm run deploy` も残しています。ただし通常の本番デプロイは、デプロイされたコミットを追跡できるように GitHub Actions 経由で行います。

必要に応じて、デプロイ後に最新の Worker デプロイ状態を確認します。

```bash
pnpm wrangler deployments status --name akimatch --json
```

## デプロイ後の動作確認

デプロイ後は、生成された Workers URL で次の流れを確認します。

- イベントを作成する
- 共有用の `/e/{uuid}` URL を開く
- 参加者として空き時間を回答する
- 同じ参加者名でもう一度回答し、前回の回答が上書きされることを確認する
- 上位候補と横バー型ヒートマップが更新されることを確認する
