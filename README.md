# AkiMatch

みんなの空き時間、重なるところだけすぐ見える。

AkiMatch は、予定がバラバラな学生グループ向けの日程調整アプリです。幹事が候補時間を細かく作り込むのではなく、対象期間だけを決め、参加者が自分の空いている時間帯を入力します。結果は横バー型ヒートマップで表示し、どの日のどの時間帯に人が集まりやすいかをすばやく判断できます。

## Product Positioning

### Primary Persona

- 大学生の少人数グループ幹事。
- ゼミ、グループ課題、サークル、友達グループなどで集まる時間を決めたい人。
- 授業、バイト、サークル、通学時間で予定がばらけやすく、日付だけでは調整しきれないグループ。

### Core Problem

丸バツ表だけでは、みんなの空き時間がどこで重なっているのか分かりにくい。

会社の飲み会のように「日付だけ決まれば、時間はだいたい終業後」で済むケースではなく、AkiMatch は「同じ日でも空いている時間が人によって違う」ケースを重視します。

### Differentiation

調整さんに近い日程調整体験を保ちつつ、以下を差別化の中心にします。

- 幹事は候補時間を大量に作らず、対象期間だけを決める。
- 参加者は空いている日と時間帯を入力する。
- 結果は日付ごとの横バー型ヒートマップで表示する。
- 上位候補時間を人数順に表示し、最適な時間帯をすぐ判断できる。

### Non-Goals for MVP

- 大規模イベントの出欠管理。
- 店予約、会費、場所決めなどの飲み会幹事機能。
- Google Calendar などの外部カレンダー連携。
- 認証、アカウント、パスワード付きイベント。
- 30分単位の詳細調整。

## Development

```bash
pnpm install
pnpm dev
```

The app uses Next.js App Router, Cloudflare Workers runtime, Cloudflare D1, and Drizzle.

## Quality Checks

```bash
pnpm lint
pnpm build
pnpm exec opennextjs-cloudflare build
```

## Cloudflare Workers Deployment

This project deploys full-stack Next.js through the OpenNext Cloudflare adapter.

### 1. Log in to Cloudflare

```bash
pnpm wrangler login
pnpm wrangler whoami
```

### 2. Create the production D1 database

```bash
pnpm wrangler d1 create akimatch_db
```

Copy the returned database UUID into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "akimatch_db"
database_id = "<returned database_id>"
migrations_dir = "drizzle"
```

### 3. Apply D1 migrations

```bash
pnpm wrangler d1 migrations apply akimatch_db --remote
```

### 4. Preview in the Workers runtime

```bash
pnpm run preview
```

### 5. Deploy

```bash
pnpm run deploy
```

After deployment, verify the generated Workers URL:

- Create an event.
- Open the shared `/e/{uuid}` URL.
- Submit a participant response.
- Submit again with the same participant name and confirm the previous response is overwritten.
- Confirm top candidates and the horizontal heatmap update.
