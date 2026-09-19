# Dunyo Mobile

Telefon va gadjet do'koni uchun Telegram Mini App: mijoz rang/xotira varianti bilan telefon tanlaydi, savatga soladi va O'zbekiston bo'ylab yetkazib berish bilan buyurtma beradi. Admin panel shu Mini App ichida (`/admin`). Butun tizim bitta Hetzner VPS'da, Docker Compose ostida ishlaydi (Caddy → Fastify → Postgres, RLS yo'q — API yagona DB mijozi).

To'liq spec (xatti-harakat manbasi): [`docs/specs/dunyo-miniapp-v1.md`](./docs/specs/dunyo-miniapp-v1.md).
Deploy qo'llanmasi: [`docs/deploy.md`](./docs/deploy.md).
Agentlar uchun arxitektura/invariantlar: [`CLAUDE.md`](./CLAUDE.md).
Dizayn manbasi: [`design/stitch/`](./design/stitch/) (Stitch'dan eksport qilingan `.html`/`.png` ekranlar va `DESIGN.md` tokenlar).

## Workspace tuzilmasi

```
shared/     — runtime-neytral domen logikasi (pricing, orderStatus, phone, telegramAuth, installment, importValidation)
api/        — Fastify backend (Node 26, TS strict): routes/{public,customer,admin,webhook}.ts, lib/*
web/        — React Mini App: customer sahifalari (pages/) + admin panel (admin/, lazy-load)
db/         — SQL migratsiyalar (raqamli tartibda), shu jumladan create_order/set_order_status RPC
db-tests/   — PGlite ustida SQL testlari (Postgres o'rniga in-memory)
deploy/     — docker-compose, Caddyfile, backup.sh, .env.example
design/     — Stitch dizayn eksporti
docs/       — spec va deploy hujjatlari
```

## Komandalar

```
npm install
npm run typecheck   # tsc -b (shared, api, api test, db-tests, web)
npm test            # vitest run (344 test, 42 fayl: shared/test, api/test, db-tests, web/src/**)
npm run build       # web -> web/dist
npm run dev          # web dev server (Vite, /api va /media localhost:3000'ga proksi qiladi)
```

Bitta testni ishga tushirish:
```
npx vitest run shared/test/pricing.test.ts -t "region"
```

## Backend'siz UI (mock rejim)

```
VITE_MOCK=1 npm run dev -w web
```

`web/src/lib/mock.ts` haqiqiy API'ning to'liq o'rnini bosadi (mijoz + admin, mock foydalanuvchi — owner) — backend yoki DB kerak emas. Vite dev server IPv6'da ochiladi, shuning uchun brauzerda `http://localhost:5173` oching (`http://127.0.0.1:5173` emas).

## Hozirgi holat

Barcha fazalar (`shared`, `api`, `web`, `db`, `db-tests`, `deploy`) tayyor: `npm run typecheck` va `npm run build` xatosiz, `npm test` — 344/344 o'tadi. Production'ga hali deploy qilinmagan (bot tokeni va do'kon guruhi hali tayinlanmagan) — qadamlar uchun [`docs/deploy.md`](./docs/deploy.md)ga qarang. Qabul qilish mezonlarining qay biri tasdiqlangani, qay biri faqat deploy'da tekshirilishi mumkinligi haqida: [`docs/acceptance.md`](./docs/acceptance.md).
