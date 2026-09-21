# Spec: Yorug' (light) tema va tema almashtirish ikonkasi

## Maqsad
Mijoz ilovasiga (Mini App) yorug' tema qo'shish, uni **default** qilish va foydalanuvchi ikonka orqali qora/yorug' temani tanlay olishi.

## Nega kerak
Hozir ilova faqat qora ("Dunyo Luxury Tech"). Stitch'da 5 ta Light ekran tayyor (`design/stitch/light/`). Ko'p foydalanuvchi yorug' interfeysni afzal ko'radi, shuning uchun default yorug', qora esa tanlov bo'ladi.

## Qamrov ICHIDA
- Ranglar CSS o'zgaruvchilariga ko'chiriladi: `:root` = light, `.dark` = dark. Tailwind shu o'zgaruvchilarni o'qiydi (alpha modifikatorlari, masalan `bg-primary/10`, ishlashi uchun RGB kanal formati: `rgb(var(--x) / <alpha-value>)`).
- Default tema: `light`. Telegram yoki telefon temasidan qat'i nazar.
- Tema ikonkasi (qora/yorug' ikonka) Bosh sahifa yuqori panelida. Profil sahifasida "Mavzu" qatori. Ikkalasi bitta holatni ko'rsatadi va boshqaradi.
- Tanlov `localStorage` da saqlanadi va Telegram CloudStorage'ga sinxronlanadi (`updatedAt` bo'yicha yangisi yutadi, savat `cart.ts` mantig'i kabi).
- Flash bo'lmasligi uchun `web/index.html` ichida React yuklanishidan oldin ishlaydigan inline skript: `localStorage` dan o'qib `<html>` ga `dark` klassini qo'yadi/olib tashlaydi va `background-color` ni o'rnatadi.
- Telegram `setHeaderColor` / `setBackgroundColor` tema bilan sinxron.
- Yangi semantik token: `--installment` (dark: mint `#43ffbb`, light: emerald `#059669`). Nasiya (0-0-12) badge/qatorlari `secondary` o'rniga shuni ishlatadi. `secondary` o'z ma'nosida qoladi (light: slate `#575e70`).
- Light ranglar manbai: `design/stitch/light/*.html` dagi `tailwind.config` (faqat ranglar).
- Ikkala tema uchun bir xil bo'lgan narsalar: shrift (Plus Jakarta Sans / Space Grotesk), spacing, borderRadius, layout.
- Qattiq (hardcode) qora-tema ranglarini tokenlarga o'tkazish: `index.css` va `index.html` dagi `#121316`, `telegram.ts` dagi `HEADER_BACKGROUND_COLOR`, `ProductSheet.tsx`/`VariantsList.tsx` dagi `#888888`, `ProductCard.tsx` dagi `text-white`, `FloatingCartPill.tsx` dagi `bg-white/15` va shunga o'xshash.
- Admin panel (`/admin/*`) doim qora: bir xil tokenlardan foydalangani uchun `/admin` o'rami `dark` klassini majburan qo'yadi.
- Testlar: token-parity (light va dark kalitlari bir xil), kontrast hisoblash, tema tanlash/saqlash/birlashtirish (sof funksiya).

## Qamrov TASHQARISIDA (bularni qilma!)
- "Tizim temasiga ergashish" rejimi (`prefers-color-scheme` / Telegram `colorScheme`) — keyingi alohida versiya.
- Admin panel Light'i va admin'da tema ikonkasi — Stitch'da admin ekranlari yo'q.
- Outfit shrifti va Light'dagi katta spacing qiymatlari (`space-md 1rem`, `space-xl 2rem`, `space-lg 1.5rem`) — ikkala temada hozirgi qiymatlar qoladi. Light ekranlar Stitch'dan shu jihatdan farq qilishi qabul qilingan.
- Serverga/DB'ga tema saqlash (`users` jadvali, migratsiya, API) — yo'q.
- Uchinchi tema yoki accent rang tanlash — faqat `light` / `dark`.
- Mavjud komponentlar layout'ini qayta dizayn qilish; Stitch Light'dagi yangi kontent (masalan "0-0-12 Foizsiz aksiya" banneri) hozirgi kodda yo'q bo'lsa qo'shilmaydi. Faqat ranglar ko'chiriladi.
- Yangi qurilmada (localStorage bo'sh) CloudStorage javobi kelguncha qisqa light→dark o'tish bo'lishi mumkin — qabul qilingan, alohida ishlov berilmaydi.

## Texnik
- Tokenlar: `web/src/theme/tokens.ts` (yangi) — `lightTokens`, `darkTokens`, RGB kanal formatida; `web/src/index.css` dagi `:root` / `.dark` bloklari shundan hosil bo'ladi yoki unga mos yoziladi (bitta manba, ikkinchisi test bilan tekshiriladi).
- `web/tailwind.config.js`: `colors` qiymatlari `rgb(var(--color-…) / <alpha-value>)` ga o'tadi. `darkMode: 'class'` qoladi. Tokenlar nomi o'zgarmaydi (komponentlar tegilmaydi).
- Sof mantiq: `web/src/lib/themeChoice.ts` (yangi) — `parseTheme`, `resolveTheme` (local + cloud → yutgan tema), `DEFAULT_THEME = 'light'`, konstantalar (`THEME_STORAGE_KEY = 'dunyo.theme.v1'`, `CLOUD_THEME_KEY = 'dunyo_theme_v1'`).
- Store: `web/src/lib/theme.ts` (yangi) — `useSyncExternalStore` (cart.ts patterni), `hydrate()`, `setTheme()`, DOM (`html.dark`) va Telegram ranglariga qo'llash.
- UI: `web/src/components/ThemeToggle.tsx` (yangi, ikonka tugma, `aria-label`, `aria-pressed`), `pages/Home.tsx` (yuqori panel), `pages/Profile.tsx` ("Mavzu" qatori).
- `web/src/lib/telegram.ts`: `initTelegram()` dagi qattiq rang o'rniga `applyTelegramTheme(theme)`.
- `web/index.html`: `<html class="dark">` olib tashlanadi, inline anti-flash skript qo'shiladi.
- `web/src/App.tsx`: `/admin/*` o'rami `dark` scope qo'yadi.
- Rasm/logo: `public/logo.webp` (oddiy gold kvadrat placeholder) ikkala temada ko'rinishi tekshiriladi. Loyihada inline `<svg>` yo'q, ammo Material Symbols va kelajakdagi SVG'lar uchun `fill`/`stroke` `currentColor` ga tayanishi shart.
- DB: yo'q. Migration: yo'q. Config/env: yo'q.
- Locale (`web/src/locales/uz.json`, tekis kalitlar): `theme.title`, `theme.light`, `theme.dark`, `theme.toggle` (Home ikonkasining `aria-label`i, holat `aria-pressed` bilan; Profil qatori `role="switch"`). Ichki (nested) JSON yo'q.

## Qoidalar (logika — EARS uslubida)
- QACHON ilova birinchi marta ochiladi VA `localStorage` da tema yo'q
  TIZIM `light` temani qo'llaydi SHART
  VA Telegram/tizim temasiga qaramaydi SHART

- QACHON ilova ochiladi VA `localStorage` da to'g'ri tema bor
  TIZIM temani React yuklanishidan oldin (inline skript) qo'llaydi SHART
  VA yorug'→qora yoki qora→yorug' flash bo'lMASLIGI SHART

- QACHON foydalanuvchi tema ikonkasini bosadi
  TIZIM temani teskarisiga almashtiradi SHART
  VA `localStorage` ga yozadi SHART
  VA CloudStorage'ga debounce bilan yozadi SHART
  VA `html.dark` klassini, Telegram header/background rangini yangilaydi SHART
  VA Bosh sahifadagi ikonka va Profil'dagi qator bir xil holatni ko'rsatadi SHART

- QACHON `hydrate()` ishlaydi VA `localStorage` va CloudStorage ikkalasida tema bor
  TIZIM `updatedAt` yangisini tanlaydi SHART (teng bo'lsa local)
- QACHON faqat birida bor
  TIZIM shuni ishlatadi SHART
- QACHON hech birida yo'q
  TIZIM `light` qoladi SHART

- QACHON CloudStorage qiymati foydalanuvchi tanlagan temadan farq qiladi VA yangi
  TIZIM temani jimgina almashtiradi SHART (yangi qurilmada qisqa light→dark o'tishi qabul qilingan)

- AGAR `localStorage` o'qish/yozish xato bersa YOKI CloudStorage ishlamasa YOKI saqlangan qiymat noto'g'ri (`'light'`/`'dark'` emas)
  TIZIM `light` bilan davom etadi SHART
  VA xatoni `console.error` bilan log qiladi SHART
  VA jim (silent) catch qilMASLIGI SHART, qiymatni "tuzatib" boshqa temaga o'tkazMASLIGI SHART

- QACHON foydalanuvchi `/admin/*` ga kiradi
  TIZIM tanlangan temadan qat'i nazar admin'ni qora ko'rsatadi SHART
  VA admin'dan chiqqach mijoz temasi tanlovi qaytadi SHART

- QACHON light tema faol VA matn `primary` (oltin) rangda chiqadi
  TIZIM AA (4.5:1) ni ta'minlovchi qoramtir oltin token (`--primary-text`) ishlatadi SHART
  (Stitch `primary #b3811e` fonda `#f8f9fa` da taxminan 3.3:1 — yetarli emas; aniq qiymat kontrast testi bilan tanlanadi)

- QACHON nasiya (0-0-12) badge/qatori chiqadi
  TIZIM `--installment` tokenini ishlatadi SHART
  VA `secondary` tokenini nasiya uchun ishlatMASLIGI SHART

## Acceptance criteria (tugadi deganda)
- [x] Birinchi ochilishda (localStorage bo'sh) ilova yorug' temada ochiladi, telefon/Telegram qora rejimda bo'lsa ham. (brauzerda: `localStorage` bo'sh, `<html>` da `dark` yo'q, fon `#f8f9fa`)
- [x] Bosh sahifa yuqori panelidagi ikonka temani almashtiradi. Profil'dagi "Mavzu" qatori ham shuni qiladi va ikkalasi bir holatni ko'rsatadi. (`ThemeToggle`, `ThemeRow`; brauzerda 390px, ikkala holat)
- [x] Sahifani qayta ochganda tanlangan tema flash'siz qo'llanadi (React yuklanishidan oldin, `index.html` inline skripti orqali). (`dist/index.html` `<head>` da inline skript, React'dan oldin ishlaydi)
- [x] Tanlov CloudStorage bilan sinxronlanadi: local bo'sh + cloud bor → cloud; ikkalasi bor → `updatedAt` bo'yicha yangisi; ikkalasi yo'q → light. (`themeHydrate.test.ts`)
- [x] localStorage yoki CloudStorage ishlamasa yoki qiymat buzuq bo'lsa ilova yorug' temada davom etadi va xato log qilinadi (silent catch yo'q). (`themeChoice.test.ts`, `themeHydrate.test.ts`: buzuq qiymat, `console.error`)
- [x] Telegram sarlavha va fon rangi (`setHeaderColor`/`setBackgroundColor`) temaga mos o'zgaradi. (`themeHydrate.test.ts`: `#121316` / `#f8f9fa`)
- [x] Mijoz komponentlarida qora temaning qattiq hex/rgba rangi qolmaydi (index.css, index.html, telegram.ts, ProductSheet, ProductCard, FloatingCartPill va boshqalar tokenlarga o'tgan). Overlay (`bg-black/40..50`) ikkala temada mos ko'rinadi. (`noHardcodedColors.test.ts`; istisnolar: `#888888` swatch, `FloatingCartPill` `bg-white/15`, `bg-black/40|50` scrim)
- [x] Light va dark token to'plamlarida kalitlar to'plami bir xil (test). Tailwind `colors` dagi har token uchun ikkala temada qiymat bor. (`themeTokens.test.ts`)
- [x] Nasiya elementlari dark'da mint, light'da `#059669`; `secondary` nasiya uchun ishlatilmaydi. (matn `installment-text` `#047857`, fon/ikonka `installment`; qarang: chetlanishlar)
- [x] `/admin/*` doim qora; mijoz temasi admin'ga ta'sir qilmaydi. (`App.tsx` `forcedThemeForPath`; admin sahifa, modal, tasdiq dialogi, toast brauzerda tekshirilgan)
- [x] **Kontrast:** light temada barcha matn/fon juftliklari WCAG AA (oddiy matn 4.5:1, katta matn/UI ikonka 3:1) ni qanoatlantiradi, ayniqsa slate `#575e70` (`secondary`), `on-surface-variant`, `outline`/kulrang yordamchi matnlar va oltin (`primary`) matn. Tekshirish: token juftliklari bo'yicha avtomatik test (nisbat hisoblash), tegishli bo'lmagan (dekorativ) juftliklar ro'yxatda aniq belgilangan. (`themeContrast.test.ts`, 90 test; 4 ta chetlanish, qarang: quyida)
- [x] **Qattiq oq/qora rasm va ikonkalar:** light temada ko'rinadi. Faqat CSS emas, SVG `fill`/`stroke`, `logo.webp` va `<img>` lar ham tekshirilgan. SVG'lar `currentColor` yoki token ishlatadi; qattiq `#fff/#000` `fill`/`stroke` yo'q (test yoki grep-tekshiruv).
- [x] **Holatlar ikkala temada to'g'ri:** bottom sheet (`ProductSheet`, `RegionPicker`), modal/tasdiqlash dialoglari, toast (`lib/toast.tsx`), skeleton loader, empty state va xato ekranlari (`States.tsx`, `AuthErrorScreen`, `SubscribeScreen`, `Placeholder`) light va dark'da ko'zda tekshirilgan (matn o'qiladi, fon/chegara ajralib turadi, skeleton fondan farq qiladi). (yangi `skeleton` tokeni va chegaralar shu tekshiruvdan keyin qo'shildi)
- [x] 5 ta Light ekran (Bosh sahifa, Katalog, Savat, Sevimlilar, Profil) `design/stitch/light/*.png` bilan ko'zda solishtirilgan (shrift va spacing farqi bundan mustasno, chunki ular qasddan o'zgarmaydi). (yonma-yon ko'rildi; qora hero banner, stories va real rasmlar spec'da "kirmaydi")
- [x] `npm run typecheck`, `npm test`, `npm run build` yashil; `web/dist` da CI'ning secret-scan'i o'tadi. (to'liq `npm test` 47 fayl yashil; `web/dist` secret-scan toza)

## Test (pul/xavfsizlikka tegmaydi — majburiy emas, lekin mantiq uchun yoziladi)
Faqat sof mantiq va tokenlar; UI render testi yo'q (loyiha qoidasi).
- `themeChoice.test.ts`: `parseThemeChoice` (noto'g'ri qiymat → xato, chaqiruvchi log qiladi va light'da qoladi), `resolveTheme` (local/cloud/`updatedAt` birlashtirish, ikkalasi bo'sh → light, teng `updatedAt` → local).
- `themeTokens.test.ts`: light va dark kalitlari bir xil; har token `R G B` formatida to'g'ri; token nomlari `tailwind.config.ts` ga to'g'ridan-to'g'ri `TOKEN_NAMES` dan o'tadi (alohida ro'yxat yo'q).
- `themeContrast.test.ts`: light (va dark) uchun asosiy matn/fon juftliklarining kontrast nisbati ≥ 4.5 (katta matn/UI uchun ≥ 3).
- `theme.hydrate` testi `cartHydrate.test.ts` andozasida (localStorage + CloudStorage almashtiruvchi).

## Implementatsiya holati (2026-09-21)
Tugadi. Commitlar: `bf0f99b` (tokenlar/store/anti-flash), `dbff3ec` (admin qulfi), `bf2e994` (toggle), `0f6f820` (text-primary/nasiya migratsiyasi), `18792ad` va `8a1bfc4` (skeleton va chegaralar). Push va deploy qilinmagan.

**Stitch Light'dan ongli chetlanishlar (hammasi AA testi talabi):**
- `on-primary` `#281900` (Stitch: oq; oltin tugmada 3.46:1, `#281900` 4.94:1).
- `outline` `#6f6353` (Stitch `#827564`, 4.26:1).
- Yangi `primary-text` `#8a6100` (5.26:1), `installment-text` `#047857` (5.2:1); `installment` fon/ikonka uchun `#059669`.
- Yangi `skeleton` (dark `#1f1f23` = eski qiymat, light `#e1e3e4`): `Skeleton` va `ImagePlaceholder`.
- Komponent chegaralari: swatch halqasi `outline` (yaxlit), light'da ErrorState tugmasi va xotira chip'i `outline/80` (dark o'zgarmagan).

**Ma'lum cheklovlar:** Telegram ichida (haqiqiy WebView) anti-flash va `setHeaderColor` tekshirilmagan (deploy yo'q). Dark'da `FloatingCartPill` chip'i (`bg-white/15`) och pill ustida ko'rinmaydi (avvalgi holat, tegilmagan). Flaky PGlite db-testlari: `docs/TODO.md`.

