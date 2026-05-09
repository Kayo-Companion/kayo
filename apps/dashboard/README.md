# Kayo Dashboard (LP)

Landing page + dashboard scaffold for Kayo (シニア向け電話AIコンパニオン).

## Getting started

```bash
cd apps/dashboard
npm install
npm run dev
```

Open http://localhost:3000.

## Hero photo

Place the senior-couple photo at `public/hero-couple.webp`. Without it the hero
still renders with the warm pink/peach gradient — the photo is opacity-55 over
the gradient, so a missing file is graceful.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS (custom warm palette: cream / peach / coral / rose / warm-orange)
- Noto Sans JP / Noto Serif JP via `next/font`
- lucide-react (icons), framer-motion (VoiceChat animations)
