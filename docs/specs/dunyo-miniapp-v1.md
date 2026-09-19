# Spec: Dunyo Mobile — Telegram Mini App v1

## Maqsad
Dunyo Mobile — smartfon va gadjet do'koni uchun Telegram bot ichida ishlaydigan Mini App: mijoz original telefonlarni rang/xotira varianti bilan tanlaydi, savatga soladi va O'zbekistonning istalgan viloyatiga yetkazib berish bilan buyurtma beradi. Admin shu Mini App ichidagi panel orqali mahsulot, variant, buyurtma va sozlamalarni boshqaradi. Butun tizim bitta Hetzner VPS'da, Docker Compose ostida ishlaydi.

## Nega kerak
- Mijoz alohida ilova o'rnatmasdan, Telegram ichida telefonni rangi va xotirasi bilan tanlab buyurtma beradi.
- Do'kon egasi buyurtmalarni Telegram guruhda darhol ko'radi va holatini bitta tugma bilan boshqaradi.
- O'zbekiston bo'ylab yetkazish — har viloyat o'z narxi va muddati bilan, admin paneldan tahrirlanadi.
- Barcha ma'lumot o'z serverimizda: tashqi SaaS limiti yo'q, xarajat oldindan ma'lum (bitta VPS).

## Dizayn manbasi
- Stitch loyiha: `Dunyo Mobile Store Logo` (ID `6696673799348030460`)
- Mahalliy nusxa: `design/stitch/` — `home`, `catalog`, `cart`, `favorites`, `profile` (`.html` + `.png`, 390px kenglik), logo `logo-reference.jpg`, tokenlar `DESIGN.md`
- Design tizimi: **"Dunyo Luxury Tech"** — dark mode majburiy, `surface #121316`, `primary #ffd682` (oltin), `primary-container #e5b95c`, `secondary #43ffbb` (mint — narx va tasdiq), `error #ffb4ab`
- Shriftlar: **Plus Jakarta Sans** (matn/sarlavha), **Space Grotesk** (narx va yorliqlar). Radius: karta `xl` 12px, tugma `full`. Pastki navigatsiya 5 tab: Asosiy / Katalog / Savat / Sevimlilar / Profil.
- Dizayn **ko'rinish uchun asos**. Qamrovdan tashqaridagi elementlar (keshbek, promokod, reels, reyting, VIP, saqlangan kartalar, jonli xarita) UI'dan **olib tashlanadi**.

---

## Qamrov ICHIDA

### Mijoz (Mini App)

1. **Bosh sahifa** — logo + tasdiqlangan belgisi, yetkazish viloyati tanlagichi (sarlavhada), qidiruv, aksiya banneri (admin boshqaradi), kategoriya grid'i, "Trenddagi smartfonlar" (`sold_count` bo'yicha), "Nega aynan Dunyo Mobile?" ishonch bloki (statik), rasmiy kanal havolasi.
2. **Katalog** — brend chiplari (Barchasi / Apple / Samsung / Xiaomi / …) + kategoriya chiplari (Smartfonlar / Planshetlar / Soatlar / Audiotexnika / Aksessuarlar), saralash (ommabop / arzon / qimmat / eng katta chegirma), topilganlar soni, sahifalab yuklash (20 ta).
3. **Qidiruv** — mahsulot nomi va brend bo'yicha (Postgres `ILIKE` + `pg_trgm` indeks), debounce 300 ms.
4. **Mahsulot kartasi** — thumbnail, brend yorlig'i, nom, arzon variant narxi, `old_price` bo'lsa ustidan chizilgan narx va `-N%` badge, **"X so'm/oy" taxminiy nasiya qatori**, yurakcha, "Savatga" tugmasi.
5. **Mahsulot varaqasi (bottom sheet)** — katta rasm, nom, **rang tanlash** (rang nuqtalari), **xotira tanlash** (128/256/512 GB chiplari), tanlangan variantning narxi va qoldig'i, kafolat muddati, qisqa xususiyatlar (`specs`), stepper, "Savatga".
6. **Variant qoldig'i 0** — o'sha variant chipi o'chiq va "Tugagan" deb belgilanadi; barcha variantlar tugagan bo'lsa karta "Tugagan" holatida, tugma o'chiq.
7. **Rasm yo'q mahsulot** — kategoriya ikonkasi placeholder sifatida chiqadi.
8. **Sevimlilar** — yurakcha toggle, serverda saqlanadi (mahsulot darajasida, variant emas). Kategoriya bo'yicha filtr, "Barchasini savatga qo'shish" (har mahsulotning default varianti), bo'sh holat ekrani.
9. **Savatcha** — variant qatorlari (nom + rang + xotira), stepper, o'chirish, "Tozalash", summa bloki (mahsulotlar summasi, chegirma, yetkazish narxi, jami) va "yoki X so'm/oy (12 oy)" taxminiy qatori. Savat `localStorage` + Telegram `CloudStorage` da (serverda emas).
10. **Checkout** —
    - Yetkazish turi: **Kuryer orqali yetkazish** / **Do'kondan olib ketish** (pickup → narx 0)
    - **Viloyat/shahar tanlash** (`regions` ro'yxatidan) → narx va taxminiy muddat darhol ko'rinadi
    - Manzil: saqlangan manzillardan tanlash yoki yangi qo'shish (erkin matn + ixtiyoriy Telegram lokatsiya)
    - Ism, telefon (`requestContact` yoki qo'lda `+998XXXXXXXXX`)
    - To'lov usuli: **Naqd** / **Kuryerga karta orqali** / **0-0-12 muddatli to'lov (so'rov)**
    - Izoh (ixtiyoriy)
    - Minimal summa va "yetkazish o'chirilgan" holatlari tekshiriladi
11. **Buyurtma muvaffaqiyatli** ekrani — buyurtma raqami (`DM-000123`), holati, nasiya tanlangan bo'lsa "Operator 30 daqiqa ichida bog'lanadi" matni.
12. **Profil** — ism, telefon, "Ma'lumotlarni o'zgartirish", **Mening buyurtmalarim** (ro'yxat + holat + tracking izohi), **Mening manzillarim** (CRUD), **Faol buyurtma kartasi** (oxirgi yakunlanmagan buyurtma holati), "Kafolat va servis" (statik matn), "24/7 yordam" (operator havolasi), rasmiy kanal havolasi, ilova versiyasi.

### Nasiya (0-0-12) — faqat ko'rsatish

13. Har bir narx yonida **taxminiy oylik to'lov** hisoblanadi va `0-0-12` badge bilan ko'rsatiladi. Bu **hisob-kitob**, shartnoma emas.
14. Checkout'da "0-0-12 muddatli to'lov" tanlansa, buyurtma `payment_method='installment_request'` bilan tushadi; guruh xabarida **"⚠️ NASIYA SO'ROVI"** sarlavhasi chiqadi va operator qo'ng'iroq qilib Uzum Nasiya / Alif orqali qo'lda rasmiylashtiradi.
15. UI'da majburiy **ogohlantirish matni**: "Taxminiy hisob. Aniq oylik to'lov va shartlar nasiya hamkori tomonidan belgilanadi."

### Bot

16. `/start` — salom xabari + "Do'konni ochish" (`web_app`) tugmasi. Admin whitelist'da bo'lsa, qo'shimcha "Admin panel" tugmasi.
17. Kontakt xabarini qabul qilish va `users.phone` ni tasdiqlangan qilib saqlash.
18. Mijozga xabarlar: buyurtma qabul qilindi, har bir holat o'zgarishi.
19. Do'kon guruhiga xabar: buyurtma raqami, mijoz ismi, telefoni, **viloyat**, manzil yoki "Olib ketish", lokatsiya bo'lsa Google/Yandex xarita havolasi, mahsulotlar ro'yxati (**nom + rang + xotira** × soni = summa), yetkazish narxi, jami, to'lov usuli (nasiya bo'lsa ajratib), izoh. Xabar ostida **holatni o'zgartiruvchi inline tugma** (joyida tahrirlanadi, qayta yuborilmaydi).

### Admin panel (Mini App ichida, `/admin` route)

20. **Mahsulotlar** — ro'yxat, qidiruv, CRUD (soft delete `is_active=false`). Maydonlar: nom, brend, kategoriya, tavsif, kafolat oyi, xususiyatlar (`specs`), faol.
21. **Variantlar** — mahsulot ichida: rang nomi + rang kodi (hex), xotira (GB), narx, eski narx, qoldiq, SKU, rasm, tartib, faol.
22. **Excel import (.xlsx)** — ustunlar: `nomi`, `brend`, `kategoriya`, `rang`, `xotira`, `narxi`, `eski_narxi`, `qoldigi`, `kafolat_oyi`, ixtiyoriy `artikul`. Fayl brauzerda SheetJS bilan o'qiladi, oldindan ko'rish jadvali va xatolar ro'yxati chiqadi, keyin 200 talik batch'lar bilan API'ga yuboriladi. Upsert kaliti: `artikul` bo'lsa shu, bo'lmasa `(nom, brend, rang, xotira)`. Mavjud bo'lmagan brend/kategoriya avtomatik yaratilmaydi — xato qatori sifatida ko'rsatiladi.
23. **Rasm yuklash** — brauzerda canvas → WebP: thumbnail 400px (q=0.80), asosiy 1000px (q=0.82). Server faqat WebP magic bytes va < 1 MB qabul qiladi, fayl nomi kontent hash'i bo'yicha.
24. **Brendlar va kategoriyalar** — CRUD, tartib, ikonka/logotip.
25. **Bannerlar** — CRUD: rasm, sarlavha, matn, havola (kategoriya/brend/mahsulot), faol, tartib.
26. **Viloyatlar** — CRUD: nom, yetkazish narxi, taxminiy muddat matni, faol. Bepul yetkazish chegarasi viloyatga alohida qo'yilishi mumkin.
27. **Buyurtmalar** — ro'yxat (holat va viloyat bo'yicha filtr), tafsilot, holatni o'zgartirish, **jo'natma izohi** (`tracking_note`) yozish.
28. **Sozlamalar** — minimal buyurtma summasi, umumiy bepul yetkazish chegarasi, "Yetkazish yoqilgan" toggle, do'kon guruhi chat ID, pickup manzili matni, majburiy kanal (`required_channel`, `null` = o'chiq), nasiya oylari soni (default 12), operator username.
29. **Adminlar** — faqat `role='owner'`: admin qo'shish/o'chirish (Telegram ID bo'yicha).
30. **Audit log** — ko'rish (kim, qachon, amal, eski → yangi qiymat).

### Kanalga obuna (marketing filtri)

31. `settings.required_channel` bo'sh bo'lmasa: bot `/start` da `web_app` tugmasini bermaydi, kanal havolasi + "Tekshirish" tugmasini beradi; API mijoz endpoint'lariga `403 channel_required` qaytaradi (`/me`, `/me/contact`, `/me/channel-check` dan tashqari).
32. **Fail-open**: aniq "a'zo emas" javobidan boshqa har qanday holat (bot kanalda admin emas, Telegram javob bermadi, DB xatosi) foydalanuvchini o'tkazadi va log qilinadi. Javob `users.channel_subscribed` da 10 daqiqaga keshlanadi. Adminlar hamma joyda ozod.

### Infratuzilma

33. Bitta Hetzner VPS, Docker Compose: `caddy` (TLS + statik + reverse proxy), `api` (Fastify), `postgres`, `backup` (cron).
34. Kunlik backup: `pg_dump --format=custom` → `gpg --encrypt` → Hetzner Storage Box (rclone), 14 kun saqlanadi. Media papkasi haftalik.
35. i18n tayyorgarligi: barcha UI matnlari `web/src/locales/uz.json` da, hozir faqat `uz`.

---

## Qamrov TASHQARISIDA (bularni qilma!)

- **Onlayn to'lov (Click, Payme, Uzcard/Humo, Telegram Stars)** — v2. `orders.payment_method/payment_status` maydonlari hozirdan bor, UI'da "Click / Payme" yozuvlari **olib tashlanadi**.
- **Nasiya API integratsiyasi (Uzum Nasiya, Alif skoring, limit, shartnoma)** — v2+, merchant shartnomasi kerak. v1'da faqat hisob-kitob va operator so'rovi. Profildagi "Tasdiqlangan nasiya limiti" bloki olib tashlanadi.
- **Promokod / vaucher** — v2. Savatdagi "Promokod yoki vaucher" bloki olib tashlanadi.
- **Reyting va sharhlar (★5.0 (318))** — v2. Kartalardagi yulduzchalar olib tashlanadi (yangi do'konda sharh yo'q, bo'sh ko'rinadi).
- **Svayplar & Obzorlar (video reels/stories)** — v2. Bosh sahifadagi widget olib tashlanadi.
- **Keshbek, "Dunyo Gold VIP", sodiqlik darajasi, VIP chegirma** — v2+, pul bilan bog'liq, alohida spec kerak. Profildagi keshbek va VIP bloklari olib tashlanadi.
- **Saqlangan bank kartalari** — onlayn to'lov bilan birga v2.
- **Kuryerni xaritada jonli kuzatish, ETA progress bar** — v2. Holat matni + `tracking_note` yetarli.
- **Shtrix-kod / QR skaner va ovozli qidiruv** (qidiruv maydonidagi ikonkalar) — olib tashlanadi.
- **IMEI / seriya raqami bo'yicha birlik hisobi** — v1'da qoldiq faqat son. IMEI kuzatuvi v2.
- **Trade-in (eski telefonni almashtirish)** — v2+.
- **ru/en tillari** — i18n tayyor, tarjima v2. Sarlavhadagi til tanlagich v1'da o'chiq (faqat UZ).
- **Bildirishnoma sozlamalari, "Narx tushishi xabari" toggle** — v2.
- **"Hisobdan chiqish"** — Telegram Mini App'da ma'nosiz, olib tashlanadi.
- **Alohida mahsulot sahifasi (route)** — v1'da bottom sheet.
- **Analitika/hisobot grafiklari (admin dashboard)** — v2.
- **1C / kassa sinxronizatsiyasi** — v2+.

---

## Texnik

### Arxitektura

```
Telegram client
  └─ Mini App (React 18 + Vite + TS strict)      statik fayllar
        │
        ▼
  Caddy (TLS, HTTP/2, avtomatik Let's Encrypt)
        ├─ /            → statik (web/dist)
        ├─ /media/*     → media volume (immutable cache)
        └─ /api/*       → api:3000
        │
        ▼
  Fastify (Node 22 + TS strict)
    ├─ /api/public/*    — auth'siz katalog o'qishlari (kesh bilan)
    ├─ /api/*           — mijoz API, `Authorization: tma <initData>`
    ├─ /api/admin/*     — admin API, har so'rovda `admin_users` tekshiriladi
    └─ /tg/webhook      — Telegram webhook (X-Telegram-Bot-Api-Secret-Token)
        │
        ▼
  Postgres 16 (pg_trgm) + media volume (/srv/dunyo/media)

  Cron konteyner ── pg_dump → gpg → rclone → Hetzner Storage Box
```

**XUMO'dan farqlar va sabablari:**

| XUMO MARKET | Dunyo Mobile | Sabab |
|---|---|---|
| Supabase Edge Functions (Deno) | Fastify (Node) bitta konteyner | O'z serverimiz, Deno runtime kerak emas |
| PostgREST + anon key public o'qish | `/api/public/*` endpoint'lari | PostgREST yo'q; bitta DB mijozi — API |
| RLS + `anon`/`service_role` rollari | RLS yo'q, **API yagona DB mijozi** | Brauzer bazaga to'g'ridan-to'g'ri ulanmaydi, RLS ortiqcha qatlam |
| Supabase Storage bucket | Caddy'dan beriladigan disk volume | Bitta VPS, S3 kerak emas |
| Cloudflare Pages | Caddy statik | Bitta domen, CORS muammosi yo'q |
| GitHub Actions backup | Konteyner cron → Storage Box | DB tashqi tarmoqqa ochilmaydi |

**XUMO'dan 1:1 ko'chiriladigan mantiq** (o'zgarishsiz yoki minimal moslashtirish bilan):
`shared/src/{pricing,orderStatus,phone,telegramAuth,format,importValidation}.ts`, `_shared/{auth,validators,router,channelGate,channelCheck,orderErrors,meResponse,orderNotify,telegram,messages.uz}.ts`, `web/src/lib/{cart,idempotency,image,apiError,checkoutErrors,subscriptionGate,contactResponse,i18n}.ts` va butun `web/src/admin/*` karkasi.

### Repozitoriya tuzilmasi

```
shared/src/          — runtime-neytral domen (pricing, orderStatus, phone, telegramAuth, installment)
api/src/
  index.ts           — Fastify bootstrap
  routes/{public,customer,admin,webhook}.ts
  lib/{auth,db,telegram,validators,orderNotify,messages.uz,channelCheck,storage}.ts
web/src/
  pages/{Home,Catalog,Products,Favorites,Cart,Checkout,Profile,OrderSuccess,OrderDetail,Addresses}.tsx
  admin/*            — lazy-load, xlsx alohida chunk
  components/*  lib/*  locales/uz.json
db/migrations/*.sql  — raqamli tartibda
db-tests/            — PGlite ustida SQL testlari
deploy/
  docker-compose.yml  Caddyfile  backup.sh  .env.example
design/stitch/       — dizayn manbasi
docs/specs/          — shu fayl
```

### Stack
- Frontend: React 18, Vite, TypeScript strict, Tailwind (Stitch tokenlari), TanStack Query, `window.Telegram.WebApp`, SheetJS (faqat admin chunk'ida)
- Backend: Node 22, Fastify, `postgres` (porsager) yoki `pg`, TypeScript strict
- DB: Postgres 16, `pg_trgm`
- Test: vitest (shared, web, api unit) + PGlite (SQL)

### DB (jadvallar)

| Jadval | Asosiy maydonlar |
|---|---|
| `users` | `id bigint PK` (Telegram ID), `first_name`, `last_name`, `username`, `phone`, `phone_verified bool`, `channel_subscribed bool`, `channel_checked_at`, `created_at` |
| `regions` | `id`, `name`, `delivery_fee int`, `eta_text` (masalan "1-3 kun"), `free_delivery_threshold int null`, `sort_order`, `is_active` |
| `addresses` | `id`, `user_id FK`, `region_id FK`, `label`, `text`, `lat numeric null`, `lng numeric null`, `is_default`, `created_at` |
| `brands` | `id`, `name`, `logo_path`, `sort_order`, `is_active` |
| `categories` | `id`, `name`, `icon`, `image_path`, `sort_order`, `is_active` |
| `products` | `id`, `name`, `brand_id FK`, `category_id FK`, `description`, `warranty_months int`, `specs jsonb`, `is_active`, `sold_count int`, `created_at`, `updated_at`; `unique (name, brand_id)` |
| `product_variants` | `id`, `product_id FK`, `sku text unique null`, `color_name`, `color_hex`, `storage_gb int null`, `price bigint`, `old_price bigint null`, `stock int check (stock >= 0)`, `image_thumb_path`, `image_path`, `sort_order`, `is_active`; `unique (product_id, color_name, storage_gb)` |
| `favorites` | `user_id`, `product_id`, `created_at`, PK `(user_id, product_id)` |
| `banners` | `id`, `image_path`, `title`, `subtitle`, `link_type`, `link_id`, `sort_order`, `is_active` |
| `orders` | `id bigint`, `order_no text unique` (`DM-000123`), `user_id`, `status` enum(`new`,`confirmed`,`shipped`,`on_the_way`,`delivered`,`cancelled`), `delivery_type` enum(`delivery`,`pickup`), `region_id FK null`, `address_text`, `lat`, `lng`, `customer_name`, `customer_phone`, `comment`, `tracking_note text null`, `payment_method` enum(`cash`,`card_to_courier`,`installment_request`), `payment_status` enum(`unpaid`,`paid`,`refunded`) default `unpaid`, `installment_months int null`, `items_total bigint`, `discount_total bigint`, `delivery_fee int`, `grand_total bigint`, `idempotency_key uuid unique`, `group_chat_id`, `group_message_id`, `created_at`, `updated_at` |
| `order_items` | `order_id`, `variant_id`, `product_id`, `name_snapshot`, `color_snapshot`, `storage_snapshot`, `price_snapshot`, `old_price_snapshot`, `warranty_snapshot int`, `qty` |
| `order_status_history` | `order_id`, `from_status`, `to_status`, `changed_by`, `created_at` |
| `settings` | bitta qator: `min_order_amount`, `free_delivery_threshold`, `delivery_enabled`, `shop_group_chat_id`, `pickup_address`, `required_channel`, `installment_months int default 12`, `support_username` |
| `admin_users` | `telegram_id PK`, `role` enum(`owner`,`admin`), `added_by`, `created_at` |
| `audit_log` | `id`, `admin_id`, `action`, `entity`, `entity_id`, `before jsonb`, `after jsonb`, `created_at` |

**Postgres funksiyalari (RPC, `security definer`):**
- `create_order(p_user_id, p_payload jsonb)` — bitta tranzaksiyada: sozlama va viloyatni o'qish, `product_variants ... FOR UPDATE` (id tartibida), narx/qoldiq tekshirish, summalarni **serverda** hisoblash, `orders` + `order_items` yozish, `stock` kamaytirish, `products.sold_count` oshirish, `order_no` generatsiya.
- `set_order_status(p_order_id, p_to, p_admin_id, p_tracking_note)` — ruxsat etilgan o'tishni tekshiradi, `cancelled` bo'lsa qoldiqni qaytaradi, tarix va audit yozadi.

**Domen mantig'i TypeScript va SQL'da ataylab takrorlanadi:** `shared/src/pricing.ts` (`calcTotals`) va `shared/src/orderStatus.ts` (`canTransition`) — `db/migrations/*_rpc.sql` ichidagi `create_order` / `set_order_status` bilan oyna. Ikkalasini va testlarini birga o'zgartir.

### Konfiguratsiya / Secrets

`deploy/.env` (serverda, git'da yo'q):
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `WEBAPP_URL`, `INIT_DATA_MAX_AGE_SEC=86400`, `BACKUP_GPG_RECIPIENT`, `RCLONE_CONFIG_*`

Build vaqtidagi public qiymatlar (inline, `.env` fayl yaratilmaydi):
`VITE_API_URL=/api`, `VITE_MEDIA_URL=/media`, `VITE_BOT_USERNAME`, `VITE_SUPPORT_USERNAME`

Bot tokeni va DB paroli **hech qachon** `web/` ichida yoki `VITE_*` o'zgaruvchida bo'lmaydi.

### Server
- Hetzner CX22 (2 vCPU, 4 GB RAM, 40 GB SSD) — v1 uchun yetarli.
- Xavfsizlik: UFW faqat 22/80/443; Postgres porti tashqariga ochilmaydi (faqat Docker tarmog'i); SSH parol bilan kirish o'chiq; `fail2ban`.
- Media: `/srv/dunyo/media` volume. Variant rasmi ~115 KB (thumb + asosiy) → 40 GB'da amalda cheksiz.

### Locale
- `web/src/locales/uz.json` (tekis, nuqta bilan birlashtirilgan kalitlar). Bot matnlari `api/src/lib/messages.uz.ts` da.
- Narx formati: `17 800 000 so'm`. Nasiya: `1 483 000 so'm/oy`.
- Holat nomlari ikki joyda takrorlanadi (`messages.uz.ts` va `uz.json`) — birga o'zgartiriladi.

---

## Qoidalar (EARS)

### Autentifikatsiya
- QACHON Mini App'dan `/api/*` so'rovi kelsa
  TIZIM `Authorization: tma <initData>` ni bot tokenidan olingan HMAC-SHA256 (`WebAppData` kaliti) bilan tekshirishi SHART
  VA `auth_date` `INIT_DATA_MAX_AGE_SEC` dan eski bo'lsa `401` qaytarishi SHART
  VA `users` jadvaliga `upsert` qilishi SHART.

- AGAR initData yo'q, imzo noto'g'ri yoki eskirgan bo'lsa
  TIZIM `401 {code:"auth_invalid"}` qaytarishi SHART
  VA frontend "Iltimos, ilovani bot orqali qayta oching" ekranini ko'rsatishi SHART
  VA hech qanday ma'lumot yozMASLIGI SHART.

- QACHON `/api/admin/*` so'rovi kelsa
  TIZIM `user.id` ni `admin_users` da **har bir so'rovda serverda** tekshirishi SHART
  VA topilmasa `403` qaytarishi SHART (frontenddagi tugma yashirilgani himoya hisoblanMAYDI).

- QACHON admin qo'shish/o'chirish so'ralsa
  TIZIM so'rovchining `role='owner'` ekanini tekshirishi SHART
  VA owner o'zini o'chira OLMASLIGI SHART
  VA oxirgi owner o'chirilishi MUMKIN EMAS.

- `/api/public/*` endpoint'lari auth talab qilMASLIGI SHART
  VA faqat `is_active` katalog ma'lumotini qaytarishi SHART
  VA hech qanday shaxsiy ma'lumot (users, orders, addresses, settings maxfiy ustunlari) bermasligi SHART.

### Telefon raqam
- QACHON mijoz `WebApp.requestContact` orqali raqam ulashsa
  TIZIM frontenddan kelgan imzolangan `response` qatorini initData bilan bir xil algoritmda tekshirishi SHART
  VA `contact.user_id` so'rovchining Telegram ID'siga teng bo'lsagina `phone_verified=true` bilan saqlashi SHART.
- QACHON webhook'ga `message.contact` kelsa
  TIZIM `contact.user_id == message.from.id` bo'lsagina tasdiqlangan deb saqlashi SHART.
- AGAR mijoz rad etsa
  TIZIM qo'lda kiritishni ko'rsatishi va serverda `^\+998\d{9}$` ni tekshirishi SHART
  VA `phone_verified=false` saqlashi SHART.

### Variant va qoldiq
- QACHON mahsulot kartasi ko'rsatilsa
  TIZIM narx sifatida **faol variantlar orasidagi eng arzonini** ko'rsatishi SHART
  VA barcha variantlar `stock=0` bo'lsa kartani "Tugagan" holatida ko'rsatishi SHART.
- QACHON mijoz savatga qo'shsa
  TIZIM savatga **`variant_id`** ni saqlashi SHART (`product_id` emas)
  VA rang yoki xotira tanlanmagan bo'lsa tugmani o'chiq qoldirishi SHART.
- AGAR variant `is_active=false` bo'lsa
  TIZIM uni tanlash chipidan olib tashlashi SHART.

### Nasiya (0-0-12) ko'rsatish
- QACHON oylik to'lov ko'rsatilsa
  TIZIM `monthly = floor(price / settings.installment_months / 1000) * 1000` formulasidan foydalanishi SHART
  VA `price < 1 000 000` bo'lsa oylik qatorni ko'rsatMASLIGI SHART (arzon aksessuarga nasiya ma'nosiz)
  VA yonida "taxminiy" ogohlantirishini ko'rsatishi SHART.
- QACHON `payment_method='installment_request'` bilan buyurtma kelsa
  TIZIM `installment_months` ni `settings` dan yozishi SHART
  VA guruh xabarini "⚠️ NASIYA SO'ROVI" sarlavhasi bilan yuborishi SHART
  VA mijozga "Operator siz bilan bog'lanadi" xabarini yuborishi SHART
  VA hech qanday moliyaviy majburiyat yaratMASLIGI SHART (shartnoma tizimdan tashqarida).

### Buyurtma yaratish
- QACHON mijoz "Rasmiylashtirish"ni bossa
  TIZIM `idempotency_key` (savat holati hash'i bo'yicha bir marta generatsiya) bilan `POST /api/orders` yuborishi SHART
  VA server faqat `variant_id` + `qty` + `expected_price` ni qabul qilishi, summalarni **bazadagi qiymatlardan** hisoblashi SHART
  VA `create_order` RPC bitta tranzaksiyada qoldiqni kamaytirishi SHART
  VA tranzaksiya muvaffaqiyatli bo'lgach, guruhga va mijozga Telegram xabar yuborishi SHART.

- AGAR bir xil `idempotency_key` bilan qayta so'rov kelsa
  TIZIM yangi buyurtma yaratMASLIGI va avvalgisini qaytarishi SHART.

- AGAR variant qoldig'i `qty` dan kam yoki `is_active=false` bo'lsa
  TIZIM butun tranzaksiyani bekor qilishi SHART
  VA `409 {code:"stock_changed", items:[{variant_id, available}]}` qaytarishi SHART
  VA frontend savatni yangilab, qaysi variant o'zgarganini ko'rsatishi SHART.

- AGAR bazadagi narx savatdagidan farq qilsa
  TIZIM `409 {code:"price_changed", items:[...]}` qaytarishi SHART
  VA mijoz yangi summani ko'rib qayta tasdiqlashi SHART.

- AGAR `delivery_type='delivery'` VA `settings.delivery_enabled=false` bo'lsa
  TIZIM `422 {code:"delivery_disabled"}` qaytarishi SHART.

- AGAR `delivery_type='delivery'` VA `region_id` bo'sh yoki `is_active=false` bo'lsa
  TIZIM `422 {code:"region_invalid"}` qaytarishi SHART.

- AGAR `items_total` `settings.min_order_amount` dan kam bo'lsa
  TIZIM `422 {code:"min_order"}` qaytarishi SHART.

- QACHON summa hisoblanayotganda
  TIZIM quyidagi formuladan foydalanishi SHART:
  `items_total = Σ price × qty`;
  `discount_total = Σ (old_price − price) × qty` (faqat ma'lumot uchun);
  `threshold = region.free_delivery_threshold ?? settings.free_delivery_threshold`;
  `delivery_fee = pickup ? 0 : (items_total >= threshold ? 0 : region.delivery_fee)`;
  `grand_total = items_total + delivery_fee`.

- AGAR Telegram xabar yuborish muvaffaqiyatsiz bo'lsa
  TIZIM buyurtmani bekor qilMASLIGI SHART
  VA xatoni log qilishi SHART (v1'da navbat/qayta urinish yo'q).

- QACHON mijoz lokatsiya yuborgan bo'lsa
  TIZIM guruh xabariga `https://maps.google.com/?q=<lat>,<lng>` va `https://yandex.uz/maps/?pt=<lng>,<lat>&z=17` havolalarini qo'shishi SHART.

### Buyurtma holatlari
- Ruxsat etilgan o'tishlar:
  `new → confirmed | cancelled`
  `confirmed → shipped | on_the_way | delivered | cancelled`
  `shipped → on_the_way | delivered | cancelled`
  `on_the_way → delivered | cancelled`
  `delivered` va `cancelled` — yakuniy.
  `shipped` ("Jo'natildi") faqat `delivery_type='delivery'` uchun ma'noli; pickup'da `confirmed → delivered` ishlatiladi.
- QACHON admin holatni o'zgartirsa
  TIZIM o'tish ruxsat etilganini tekshirishi SHART
  VA `order_status_history` va `audit_log` ga yozishi SHART
  VA mijozga botda holat xabarini yuborishi SHART
  VA guruhdagi xabarni **joyida tahrirlashi** SHART (qayta yubormaydi).
- AGAR holat `shipped` bo'lsa VA `tracking_note` berilgan bo'lsa
  TIZIM uni mijoz xabariga qo'shishi SHART.
- AGAR yangi holat `cancelled` bo'lsa
  TIZIM `order_items` bo'yicha qoldiqni **o'sha tranzaksiyada** qaytarishi SHART
  VA `sold_count` ni kamaytirishi SHART.
- AGAR ruxsat etilmagan o'tish so'ralsa
  TIZIM `422 {code:"invalid_transition"}` qaytarishi va qoldiqni o'zgartirMASLIGI SHART.
- Guruh tugmalari himoya chegarasi EMAS: webhook har `callback_query` uchun `admin_users` ni qayta tekshirishi SHART.
- v1'da mijoz buyurtmani o'zi bekor qila OLMAYDI (operatorga yozadi).

### Admin: mahsulot, variant va import
- QACHON admin narx, qoldiq yoki faollikni o'zgartirsa yoki o'chirsa
  TIZIM `audit_log` ga `before`/`after` bilan yozishi SHART.
- QACHON Excel import qilinsa
  TIZIM har qatorni tekshirishi SHART: nom bo'sh emas; brend va kategoriya mavjud; narx butun son > 0; qoldiq ≥ 0; xotira bo'sh yoki butun son; rang bo'sh emas
  VA xatoli qatorlarni o'tkazib yuborib, qator raqami + sababi bilan hisobot berishi SHART
  VA natijani ko'rsatishi SHART: yaratildi N, yangilandi M, xato K
  VA bitta import uchun `audit_log` ga bitta umumiy yozuv qo'shishi SHART.
- AGAR fayl 5 MB yoki 5 000 qatordan katta bo'lsa
  TIZIM importni boshlamasligi va sababini ko'rsatishi SHART.
- QACHON rasm yuklansa
  TIZIM brauzerda thumbnail (400px, q=0.80) va asosiy (1000px, q=0.82) WebP yaratishi SHART
  VA server faqat `image/webp` magic bytes va < 1 MB faylni qabul qilishi SHART
  VA eski rasm fayllarini o'chirishi SHART.
- AGAR brauzer WebP encode'ni qo'llamasa
  TIZIM yuklashni to'xtatib "Brauzeringiz WebP'ni qo'llamaydi, Telegram Desktop'dan foydalaning" deb ko'rsatishi SHART.

### Bot webhook
- QACHON `/tg/webhook` ga so'rov kelsa
  TIZIM `X-Telegram-Bot-Api-Secret-Token` sarlavhasi `TELEGRAM_WEBHOOK_SECRET` ga tengligini tekshirishi SHART
  VA teng bo'lmasa `401` qaytarib, hech narsa qilmasligi SHART.
- `setWebhook` da `allowed_updates` **`message` va `callback_query` ni ikkalasini ham** sanashi SHART.

### Kanal gate
- QACHON `settings.required_channel` bo'sh bo'lmasa
  TIZIM mijoz endpoint'lariga (`/me`, `/me/contact`, `/me/channel-check` dan tashqari) `403 {code:"channel_required"}` qaytarishi SHART
  VA bot `/start` da `web_app` tugmasi o'rniga kanal havolasi + tekshirish tugmasini berishi SHART.
- AGAR Telegram aniq "a'zo emas" javobini berMASA (bot admin emas, kanal yo'q, tarmoq xatosi)
  TIZIM foydalanuvchini **o'tkazishi** SHART (fail-open)
  VA natijani keshlaMASLIGI SHART
  VA xatoni log qilishi SHART.
- Adminlar gate'dan ozod bo'lishi SHART.

### Backup
- QACHON har kuni 21:00 UTC (Toshkent 02:00) bo'lsa
  TIZIM `pg_dump --format=custom` olishi, `gpg --encrypt` bilan shifrlashi va Storage Box'ga yuklashi SHART, 14 kun saqlanadi.
- AGAR dump yoki yuklash muvaffaqiyatsiz bo'lsa
  TIZIM admin guruhiga Telegram xabar yuborishi SHART.
- Shifrlanmagan dump serverda yoki repozitoriyada qolMASLIGI SHART.

---

## Acceptance criteria (tugadi deganda)

- [ ] Bot `/start` → "Do'konni ochish" Mini App'ni ochadi. 5 ta ekran Stitch dizayniga mos (390px kenglikda solishtiriladi), dark tema, oltin/mint tokenlar.
- [ ] Mini App'ni oddiy brauzerda (initData'siz) ochganda `/api/me` `401` qaytaradi va xato ekrani chiqadi; `/api/public/products` esa ishlaydi.
- [ ] Katalog → brend/kategoriya chiplari → saralash va qidiruv ishlaydi. Faqat thumbnail yuklanadi (DevTools Network'da tekshiriladi).
- [ ] Mahsulot sheet'ida rang va xotira tanlanadi; narx va qoldiq tanlovga qarab o'zgaradi; tugagan variant chipi o'chiq.
- [ ] Rasmsiz mahsulotda kategoriya ikonkasi ko'rinadi.
- [ ] Nasiya qatori: 17 800 000 so'm → `1 483 000 so'm/oy` ko'rinadi; 280 000 so'mlik adapterda oylik qator umuman chiqmaydi.
- [ ] Sevimlilar qo'shiladi/o'chiriladi va Telegram Desktop'da ham ko'rinadi.
- [ ] Savat Mini App yopib-ochilganda saqlanib qoladi (variant bilan birga).
- [ ] Checkout: viloyat tanlanganda narx va muddat darhol yangilanadi; pickup → 0; chegaradan yuqorida bepul; minimal summadan kam bo'lsa tugma o'chiq.
- [ ] Buyurtma berilgach: guruhga to'liq xabar keladi (viloyat, rang/xotira, lokatsiya havolasi bilan), mijozga tasdiq keladi, variant qoldig'i kamayadi.
- [ ] Nasiya tanlab buyurtma berilganda guruh xabarida "⚠️ NASIYA SO'ROVI" chiqadi.
- [ ] "Rasmiylashtirish"ni tez 2 marta bosish bitta buyurtma yaratadi.
- [ ] Qoldiq 1 bo'lgan variantni 2 ta akkaunt bir vaqtda buyurtma qilganda faqat bittasi muvaffaqiyatli, ikkinchisi `stock_changed` oladi.
- [ ] Admin `confirmed → shipped` qiladi, `tracking_note` yozadi → mijozga izoh bilan xabar keladi, guruh xabari joyida tahrirlanadi.
- [ ] `cancelled` → qoldiq qaytadi. Qayta bekor qilish rad etiladi.
- [ ] Whitelist'da bo'lmagan foydalanuvchi `/api/admin/*` ga to'g'ridan-to'g'ri so'rov yuborsa `403` oladi.
- [ ] Owner admin qo'shadi/o'chiradi. Oddiy admin qila olmaydi. Oxirgi owner o'chmaydi.
- [ ] Excel import: namuna fayl (50 qator, 3 ta xato) → 47 ta variant kiritiladi, 3 ta xato qator raqami bilan ko'rsatiladi. Qayta import dublikat yaratmaydi.
- [ ] Rasm yuklash: 4 MB JPG → ~400px va ~1000px WebP, har biri < 150 KB, `/media/...` dan `immutable` header bilan beriladi.
- [ ] `required_channel` qo'yilganda obuna bo'lmagan mijoz `403 channel_required` oladi; bot kanaldan chiqarilganda (fail-open) hamma o'tadi.
- [ ] Qo'lda kiritilgan noto'g'ri raqam (`90 123`) rad etiladi. To'g'ri raqam `+998901234567` ko'rinishida saqlanadi.
- [ ] `grep -rE "BOT_TOKEN|POSTGRES_PASSWORD|WEBHOOK_SECRET" web/dist` hech narsa topmaydi.
- [ ] Hetzner'da `docker compose up -d` dan keyin sayt HTTPS'da ochiladi (Caddy sertifikat oladi), webhook `getWebhookInfo` da to'g'ri ko'rinadi.
- [ ] Backup qo'lda ishga tushiriladi → shifrlangan fayl Storage Box'da paydo bo'ladi va `gpg -d | pg_restore` bilan lokal bazaga tiklanadi.
- [ ] TypeScript `strict`, `tsc --noEmit` xatosiz. CI'da typecheck + test + build o'tadi.

---

## Test (MAJBURIY — pul, qoldiq va xavfsizlik)

**Unit (vitest, `shared/` va `api/`):**
- `telegramAuth`: to'g'ri imzo → OK; bitta belgi o'zgargan hash → rad; `auth_date` 24 soat + 1 s → rad; `hash` yo'q → rad.
- `requestContact` response: boshqa `user_id` → `phone_verified` o'rnatilMAYDI.
- Telefon: `+998 90 123-45-67` → `+998901234567`; `998901234567` → normalizatsiya; `+7...`, 8 raqam → rad.
- `calcTotals`: chegaradan past/teng/yuqori; pickup; viloyat chegarasi umumiysini ustidan yozadi; `old_price` null.
- `installmentMonthly`: 17 800 000 / 12 → 1 483 000; 280 000 → `null` (chegaradan past); `months=0` → `null` (nolga bo'lish yo'q).
- `canTransition`: har bir ruxsatsiz o'tish rad; `delivered → new` rad; pickup'da `confirmed → delivered` ruxsat.
- Admin guard: whitelist'da yo'q → 403; `admin` roli bilan admin qo'shish → 403; oxirgi owner'ni o'chirish → rad.
- Webhook secret noto'g'ri → 401.
- `channelGate.decideGate`: a'zo emas → blok; noaniq javob → o'tkazadi va keshlamaydi; admin → hamisha o'tadi.
- Import validatsiyasi: bo'sh nom, manfiy narx, yo'q brend, `xotira="katta"`, takroriy `(nom, brend, rang, xotira)`.

**SQL (PGlite, `db-tests/`):**
- `create_order`: qoldiq yetarli → `stock` kamayadi, `sold_count` oshadi; yetarli emas → rollback, hech narsa yozilmaydi.
- Frontend yuborgan `price` e'tiborga olinMAYDI — bazadagisi ishlatiladi.
- Bir xil `idempotency_key` → bitta buyurtma.
- Parallel: 2 sessiya `stock=1` variantga → bittasi muvaffaqiyatli.
- Bir mahsulotning ikki varianti bitta buyurtmada → ikkisining ham qoldig'i to'g'ri kamayadi.
- `region_id` noto'g'ri/faol emas → `region_invalid`.
- `set_order_status`: ruxsatsiz o'tish rad; `cancelled` → stock qaytadi; ikki marta `cancelled` → stock ikki marta qaytmaydi.
- `installment_request` buyurtma `payment_status='unpaid'` bilan yaratiladi va hech qanday summa o'zgarmaydi.

---

## Ochiq savollar (implementatsiyadan oldin tasdiqlash kerak)
1. **Domen nomi** — Mini App qaysi domenda turadi (masalan `shop.dunyomobile.uz`)? Caddy sertifikati va `WEBAPP_URL` shunga bog'liq.
2. **Bot username va do'kon guruhi** — yangi bot yaratiladimi yoki mavjudi ishlatiladimi?
3. **Boshlang'ich viloyat ro'yxati va narxlari** — Toshkent shahri 0 so'm / 3 soat, qolganlari? Seed uchun kerak.
4. **Pickup manzili** — dizaynda "Samarqand Darvoza filiali (10:00–22:00)". To'g'rimi?
5. **Kafolat matni** — "1 yil rasmiy kafolat" hamma mahsulotga tegishlimi yoki `warranty_months` har mahsulotda alohidami (spec ikkinchisini oldi)?
