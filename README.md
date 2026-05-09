# Kayo

シニア向け電話AIコンパニオン。毎日決まった時間にカヨから電話します。

## モノレポ構成

```
kayo/
├── apps/
│   ├── dashboard/   # Next.js 15 — ランディング + 家族向けダッシュボード (Vercel)
│   └── voice/       # FastAPI — Twilio ↔ OpenAI Realtime ブリッジ (Railway)
├── supabase/
│   └── migrations/  # families / seniors / calls / alerts + RLS
└── README.md
```

## クイックスタート

### 1. ダッシュボード（フロント）

```bash
cd apps/dashboard
npm install
npm run dev
# http://localhost:3000
```

### 2. ボイスサービス（バックエンド）

```bash
cd apps/voice
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 編集
uvicorn src.main:app --reload --port 8000
```

ローカルでTwilioに公開する場合は cloudflared / ngrok 経由。詳細は
[apps/voice/README.md](apps/voice/README.md)。

### 3. Supabase

```bash
supabase link --project-ref xxx
supabase db push   # supabase/migrations/ を適用
```

## 全体の動き

1. 家族が `/sign-up` で申込（自分用 / 大切な人用 を選んで分岐入力）
2. Stripe で月額3,980円を決済
3. `seniors` 行が作成される
4. APScheduler が毎分ティックし、`call_time` が一致するシニアへ outbound call
5. Twilio から FastAPI の `/twilio/incoming` に Webhook
6. TwiML で `<Stream>` を `/twilio/stream` (WS) に接続
7. WebSocket で OpenAI Realtime API と双方向音声ブリッジ
8. 通話終了後、Whisper transcript → GPT-4o-mini で要約 → Supabase
9. distress 検知時は家族の緊急連絡先に SMS

## ドメイン

- `kayo.me`, `app.kayo.me` → Vercel（apps/dashboard）
- `voice.kayo.me` → Railway（apps/voice）

## デプロイ

- ダッシュボード: GitHub → Vercel 自動デプロイ
- ボイス: GitHub → Railway 自動デプロイ（Dockerfile）
- Supabase migrations: `supabase db push` を CI で

## 安全設計

- システムプロンプトに「お金」「個人情報」「緊急性を煽る言葉」「医療診断」を絶対禁止として明記
- 通話冒頭で必ず紹介者の名前を名乗る（オレオレ詐欺対策）
- distress 検知（健康・精神）→ 即座に家族へSMS
- Supabase RLS で各家族は自分のデータのみ参照可能

詳細は [apps/voice/README.md](apps/voice/README.md) と
[supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql) を参照。
