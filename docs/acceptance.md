# Qabul qilish mezonlari — halol tekshiruv

Ushbu hujjat `docs/specs/dunyo-miniapp-v1.md`dagi "Acceptance criteria" bo'limining har bir bandini uchta toifaga ajratadi:

- **✅ Tasdiqlangan** — avtomatik test yoki men shaxsan ishga tushirgan buyruq bilan isbotlangan. Test fayli yoki buyruq ko'rsatilgan.
- **🟡 Kod tayyor, deploy kerak** — kod yozilgan va o'qib chiqilgan, lekin faqat jonli muhitda (Telegram xabarlari, guruh tugmalari, haqiqiy parallel so'rov, TLS, webhook) yoki brauzerda qo'lda tekshirish mumkin.
- **❌ Bajarilmagan** — amalga oshirilmagan yoki spec'dagi niyatdan chetga chiqadi. Sababi yozilgan.

Tekshiruv sanasi: 2026-09-19. Buyruqlar shu sessiyada ishga tushirildi: `npm run typecheck` (toza), `npm test` (**336/336, 41 fayl**, toza), `npm run build` (toza), `grep -rE "BOT_TOKEN|POSTGRES_PASSWORD|WEBHOOK_SECRET" web/dist` (hech narsa topilmadi).

**Muhim eslatma**: `git status` shu paytda barcha fayllarni `??` (untracked) deb ko'rsatadi — bu repo hali `origin`ga push qilinmagan. Demak `.github/workflows/ci.yml` haqiqiy GitHub Actions'da **hech qachon ishga tushmagan**; quyida "CI o'tadi" haqidagi har qanday band faqat lokal tekshiruvga asoslangan, CI'ning o'ziga emas.

---

## Bandlar

### 1. Bot `/start` → Mini App ochiladi, 5 ekran Stitch dizayniga mos (dark, oltin/mint)
**🟡 Kod tayyor, deploy kerak.** `api/src/routes/webhook.ts`'dagi `handleStart`/`sendShopButtons` to'liq yozilgan (`web_app` tugmasi, admin bo'lsa qo'shimcha tugma). Lekin haqiqiy botga ulanish yo'q (token yo'q) va 5 ekranning Stitch `.png`lariga piksel-piksel mosligini hech qanday avtomatik test tekshirmaydi — bu vizual solishtirish, faqat qo'lda/jonli qilinadi.

### 2. initData'siz ochilganda `/api/me` → `401`, xato ekrani; `/api/public/products` ishlaydi
**🟡 Kod tayyor, deploy kerak.** `shared/src/telegramAuth.ts`'ning HMAC tekshiruvi `shared/test/telegramAuth.test.ts`da (6 test: to'g'ri imzo, bitta belgi o'zgargan, eskirgan `auth_date`, `hash` yo'q) va `extractInitData` `api/test/auth.test.ts`da (4 test) alohida-alohida tasdiqlangan. Ammo to'liq HTTP oqimi (`requireUser` → marshrut → `401 {code:"auth_invalid"}` javobi) va frontend'dagi `AuthErrorScreen.tsx` konvensiyaga ko'ra test qilinmagan (`api/src/lib/auth.ts` — DB bilan ishlaydigan modul, ataylab sinovsiz; komponent testlari umuman yo'q). Server ishga tushirilib qo'lda tekshirilmagan.

### 3. Katalog chiplari, saralash, qidiruv; faqat thumbnail yuklanadi
**🟡 Kod tayyor, deploy kerak.** Saralash/sahifalash parametrlarini tozalash mantiqi `api/test/publicProductsQuery.test.ts`da (12 test) tasdiqlangan. SQL darajasida faqat `image_thumb_path` tanlanishi (`api/src/routes/public.ts`, `PRODUCT_CARD_CTES`) kodda ko'rinadi, lekin haqiqiy DevTools Network tekshiruvi qo'lda qilinishi kerak. Chiplar/UI interaktivligi component-test yo'q konvensiyasi tufayli sinovsiz.

### 4. Mahsulot sheet'ida rang/xotira tanlash → narx/qoldiq yangilanadi, tugagan variant chipi o'chiq
**🟡 Kod tayyor, deploy kerak.** `web/src/components/ProductSheet.tsx` yozilgan, lekin loyihada component/render testlari yo'q (`testing-library` bog'liqligi yo'q — bu ataylab qilingan konvensiya). Faqat brauzerda qo'lda tekshiriladi.

### 5. Rasmsiz mahsulotda kategoriya ikonkasi ko'rinadi
**🟡 Kod tayyor, deploy kerak.** Dastlab bu band spec'dan chetlangan edi — `ProductCard.tsx` har doim qattiq kodlangan `"smartphone"` belgisini ko'rsatardi va katalog so'rovi `categories.icon`'ni umuman tanlamasdi. **Tuzatildi:** `api/src/routes/public.ts` endi barcha karta va detal so'rovlarida `categories` bilan JOIN qilib `c.icon as category_icon` tanlaydi; `web/src/lib/types.ts` (`Product`, `ProductDetail`), `mock.ts` va `ProductCard.tsx`/`ProductSheet.tsx` shu maydonni ishlatadi (`product.category_icon ?? DEFAULT_CATEGORY_ICON`). Mock rejimda brauzerda tekshirildi: placeholder ikonkalari endi kategoriya bo'yicha turlicha (`smartphone` ×5, `headphones` ×2, `watch` ×1) — avval hammasi `smartphone` edi. Real ma'lumot bilan yakuniy tasdiq deploy'dan keyin.

### 6. Nasiya qatori: 17 800 000 → 1 483 000 so'm/oy; 280 000 so'mda qator yo'q
**✅ Tasdiqlangan.** Aniq shu sonlar bilan test qilingan:
- `shared/test/installment.test.ts:6` — `installmentMonthly(17_800_000, 12)` → `1_483_000`.
- `shared/test/installment.test.ts:11` — `installmentMonthly(280_000, 12)` → `null`.
- `web/src/lib/__tests__/installmentLine.test.ts:7` — `decideInstallmentLine(17_800_000, 12)` → `{monthly: 1_483_000, months: 12}`.
- `web/src/lib/__tests__/installmentLine.test.ts:11` — `decideInstallmentLine(280_000, 12)` → `null`.

UI komponentida (`web/src/components/InstallmentLine.tsx`) qanday chizilishi qo'lda tekshirilmagan, lekin hisoblash mantig'i — spec'dagi aniq raqamlar bilan — to'liq isbotlangan.

### 7. Sevimlilar qo'shiladi/o'chiriladi, Telegram Desktop'da ham ko'rinadi
**🟡 Kod tayyor, deploy kerak.** `api/src/routes/customer.ts`'da `GET/PUT/DELETE /favorites/:productId` to'liq yozilgan (`favorites` jadvaliga yozadi — mahsulot darajasida, spec talabiga mos). Hech qanday avtomatik test yo'q (marshrut darajasidagi kod, konvensiyaga ko'ra sinovsiz); ko'p qurilmada ko'rinishi faqat jonli serverda tekshiriladi.

### 8. Savat Mini App yopib-ochilganda saqlanadi (variant bilan)
**✅ Tasdiqlangan.** `web/src/lib/__tests__/cart.test.ts` — `localStorage`ga yozish va qayta o'qishda saqlanishi ("persists to localStorage and round-trips on rehydrate"), ikkita xil variant alohida qator sifatida saqlanishi. `web/src/lib/__tests__/cartHydrate.test.ts` — `localStorage` va Telegram `CloudStorage`dan qaysi biri yangi (`updatedAt`) bo'lsa o'shani tanlashi, `CloudStorage` bo'sh bo'lsa `localStorage`ga tushishi.

### 9. Checkout: viloyat tanlash → narx/muddat darhol; pickup=0; chegaradan yuqorida bepul; min summadan kam bo'lsa tugma o'chiq
**🟡 Kod tayyor, deploy kerak.** Hisoblash formulasining o'zi (`calcTotals`) `shared/test/pricing.test.ts`da juda keng qamrovda tasdiqlangan (chegaradan past/teng/yuqori, pickup har doim bepul, viloyat o'z chegarasi globalni ustidan yozishi, `belowMinimum`/`amountToMinimum` bayrog'i). Lekin `web/src/pages/Checkout.tsx`da viloyat tanlanganda ekranning **darhol** yangilanishi va tugmaning **o'chib qolishi** — UI xatti-harakati, component-test yo'qligi sababli sinovsiz, faqat qo'lda tekshiriladi.

### 10. Buyurtma berilgach: guruhga to'liq xabar (viloyat, rang/xotira, lokatsiya havolasi), mijozga tasdiq, qoldiq kamayadi
**🟡 Kod tayyor, deploy kerak.** Qismlarga bo'lib:
- Qoldiq kamayishi/`sold_count` oshishi — **tasdiqlangan**: `db-tests/create-order.test.ts` ("happy path: decrements the right variant, increments sold_count...").
- Guruh xabari matni (viloyat nomi, har bir band uchun rang/xotira, lokatsiya bo'lsa ikkala xarita havolasi, bo'lmasa yo'q) — **tasdiqlangan**: `api/test/messages.test.ts` (`buildGroupOrderMessage`: "includes region name and per-item color/storage", "omits map links when lat/lng are absent", "includes both map links when lat/lng are present").
- Bu xabarning haqiqatan Telegram'ga yetib borishi va mijozga tasdiq kelishi — `api/src/lib/orderNotify.ts`/`telegram.ts` konvensiyaga ko'ra sinovsiz (Telegram'ni hech narsa mock qilmaydi), faqat jonli muhitda tekshiriladi.

Yig'indida band **🟡**, chunki eng talabchan qismi (haqiqiy Telegram yetkazish) isbotlanmagan.

### 11. Nasiya bilan buyurtma → guruh xabarida "⚠️ NASIYA SO'ROVI"
**✅ Tasdiqlangan.** `api/test/messages.test.ts:112` — "prefixes an installment_request order with the nasiya warning and shows the monthly figure". Xabar matnini generatsiya qiluvchi mantiq to'g'ridan-to'g'ri shu aniq stsenariy bilan test qilingan. (Xabarning jo'natilishi — 10-band bilan bir xil sababga ko'ra — jonli tekshiruv talab qiladi, lekin bandning o'zagi — "guruh xabarida shu sarlavha chiqishi kerak" — test bilan isbotlangan.)

### 12. "Rasmiylashtirish"ni tez ikki marta bosish → bitta buyurtma
**✅ Tasdiqlangan.** Ikki qatlamda:
- Frontend: `web/src/lib/__tests__/idempotency.test.ts` — bir xil savat holati uchun bir xil kalit qaytishi.
- Backend/SQL: `db-tests/create-order.test.ts` — "the same idempotency_key twice creates exactly one order; the second call reports duplicate:true" — ikkinchi chaqiruv `duplicate:true` qaytaradi, qoldiq faqat bir marta kamayadi, `orders` jadvalida shu kalit bilan aynan bitta qator qolishi tekshirilgan.

### 13. Qoldiq=1 variantni 2 akkaunt bir vaqtda buyurtma qilsa — biri muvaffaqiyatli, biri `stock_changed`
**🟡 Kod tayyor, deploy kerak.** `db-tests/create-order.test.ts`da bu stsenariy bor, lekin testning o'z izohi buni ochiq tan oladi: *"a second order against a stock=1 variant sees the decremented stock and gets stock_changed (PGlite is single-connection, so this proves sequential consistency after a committed order, not a true concurrent race)"*. Ya'ni ketma-ket ikkita chaqiruv to'g'ri natija berishi isbotlangan, lekin **haqiqiy parallel** (bir vaqtda, `FOR UPDATE` qulfida kutish) holat faqat real Postgres'da, real deploy'da tekshirilishi mumkin. `create_order`ning `variant_id` tartibida qulflashi va qulflardan keyin idempotency'ni qayta tekshirishi (`db/migrations/0003_rpc.sql`) kodda to'g'ri yozilgan, lekin bu band uchun "haqiqiy race" hali sinalmagan.

### 14. Admin `confirmed → shipped`, `tracking_note` → mijozga izohli xabar, guruh xabari joyida tahrirlanadi
**🟡 Kod tayyor, deploy kerak.** DB qatlami tasdiqlangan: `db-tests/set-order-status.test.ts` — "tracking_note is written on shipped, and a later status change without a note does not erase it". Mijoz xabari matni ham tasdiqlangan: `api/test/messages.test.ts` — "includes the tracking note when the status is shipped" / "omits...for non-shipped". Lekin guruh xabarining **Telegram'da joyida tahrirlanishi** (`editTelegramMessage`, `api/src/lib/orderNotify.ts`'dagi `refreshGroupOrderMessage`) — `telegram.ts` konvensiyaga ko'ra sinovsiz, faqat jonli botda ko'riladi.

### 15. `cancelled` → qoldiq qaytadi; qayta bekor qilish rad etiladi
**✅ Tasdiqlangan.** `db-tests/set-order-status.test.ts` — "cancel restores variant stock and decrements sold_count exactly once; cancelling twice does not restore stock twice": birinchi bekor qilish qoldiqni to'liq qaytaradi, ikkinchi urinish `{code:'invalid_transition'}` bilan rad etiladi va qoldiq ikkinchi marta o'zgarmaydi. Ikki xil variantli buyurtma uchun ham alohida test bor ("the aggregation trap").

### 16. Whitelist'da yo'q foydalanuvchi `/api/admin/*`ga to'g'ridan-to'g'ri so'rov → `403`
**🟡 Kod tayyor, deploy kerak.** `api/src/lib/auth.ts`'dagi `requireAdmin` mantig'i (har so'rovda `admin_users`ni qayta tekshirish, topilmasa `{ok:false, reason:'forbidden'}`) DB bilan ishlaydigan modul bo'lgani uchun ataylab birlik-test qilinmagan (konvensiya: hech narsa DB'ni mock qilmaydi). Haqiqiy `initData` bilan haqiqiy HTTP so'rov yuborib `403` kelishini tekshiruvchi integratsion test yo'q — faqat jonli serverda yoki `docs/deploy.md` §8'dagi qo'lda tekshiruv ro'yxati orqali isbotlanadi.

### 17. Owner admin qo'shadi/o'chiradi; oddiy admin qila olmaydi; oxirgi owner o'chmaydi
**🟡 Qisman tasdiqlangan — qaror mantig'i test bilan qoplangan, HTTP qatlami deploy kerak.** Dastlab bu mantiq to'g'ridan-to'g'ri marshrut ichida yozilgan va umuman testsiz edi. **Tuzatildi:** qaror `api/src/lib/adminDeletion.ts`dagi sof `decideAdminDeletion()` funksiyasiga ajratildi va `api/test/adminDeletion.test.ts` (8 ta test) uni qoplaydi: o'zini o'chirish rad etiladi (boshqa owner'lar bo'lsa ham), o'zini o'chirish mavjudlik tekshiruvidan oldin ko'riladi, mavjud bo'lmagan admin → `not_found`, oxirgi owner → `cannot_delete_last_owner`, ikkinchi owner bo'lsa ruxsat, oddiy admin uchun owner soni umuman so'ralmaydi. **Muhim xavfsizlik tuzatishi:** avvalgi kod owner sonini o'qish so'rovi qator qaytarmasa qo'riqni **o'tkazib yuborardi** (`countRow !== null && ...`) — ya'ni oxirgi owner o'chib ketishi mumkin edi. Endi noma'lum son **fail-closed** ishlaydi: o'chirish rad etiladi. `requireOwnerHook`ning HTTP darajasidagi `403` javobi hamon deploy'da tekshirilishi kerak.

### 18. Excel import: 50 qator/3 xato → 47 variant, xatolar qator raqami bilan; qayta import dublikat yaratmaydi
**🟡 Kod tayyor, deploy kerak.** Qatlamlar alohida-alohida yaxshi test qilingan:
- Qator validatsiyasi (bo'sh nom, manfiy narx, noma'lum brend/kategoriya, bir nechta xato birgalikda) — `shared/test/importValidation.test.ts` (12 test).
- Bitta qatorni yozish (mavjud variantni yangilash, yangisini qo'shish, xatolarni qaytarish) — `api/test/productImport.test.ts` (5 test).
- Batch'larga bo'lish va natijalarni yig'ish (absolyut qator raqamiga moslash) — `web/src/admin/__tests__/importHelpers.test.ts` ("sums created/updated and concatenates errors across batches, remapped to absolute row numbers").

Lekin spec'dagi **aniq stsenariy** — 50 qatorli, 3 xatoli namuna fayl → "47 ta variant kiritiladi, 3 ta xato" — end-to-end birorta testda ishga tushirilmagan; bu faqat qismlarning to'g'riligidan xulosa chiqarish, to'liq stsenariyning o'zi sinalmagan.

### 19. Rasm yuklash: 4 MB JPG → ~400px/~1000px WebP, har biri < 150 KB, `/media/...`dan `immutable` header bilan
**🟡 Kod tayyor, deploy kerak.** O'lchamlarni hisoblash (`computeResizedDimensions` — uzun tomonni maqsadga qisqartirish, hech qachon kattalashtirmaslik) `web/src/lib/__tests__/image.test.ts`da (7 test) tasdiqlangan; sifat konstantalari kodda mavjud (`THUMB_QUALITY=0.8`, `MAIN_QUALITY=0.82`, `web/src/lib/image.ts`). Server tomonidagi WebP magic-byte tekshiruvi (`isWebpMagicBytes`) va maydon darajasidagi qaror (`decideFieldUpload`) mos ravishda `api/test/validators.test.ts` va `api/test/uploadField.test.ts`da tasdiqlangan. Fayl yo'li xavfsizligi (`writeWebp`, `deleteFiles` — path traversal rad etilishi) `api/test/storage.test.ts`da tasdiqlangan. Lekin: haqiqiy 4 MB JPG'ni brauzer canvas'ida encode qilib chiqqan WebP fayl hajmi < 150 KB bo'lishi va Caddy'ning `immutable` header bilan berishi (`deploy/Caddyfile`) — ikkalasi ham faqat jonli brauzer/serverda tekshiriladi.

### 20. `required_channel` qo'yilganda obuna bo'lmagan mijoz `403 channel_required`; fail-open ishlaydi
**🟡 Kod tayyor, deploy kerak.** Qaror mantig'i o'ta keng test qilingan: `api/test/channelGate.test.ts` (`decideGate` — kanal yo'q → off, yangi kesh ishonchli, hech qachon tekshirilmagan → recheck, TTL aynan tugaganda → recheck, buzilgan timestamp → recheck; `isSubscribedStatus`, `isUserNotFoundDescription`), `api/test/channelGateExempt.test.ts` (`/me`, `/me/contact`, `/me/channel-check` ozod), `api/test/meResponse.test.ts` (bloklangan mijoz `channel_required` oladi, adminlar ozod, raqamli kanal ID link sifatida chiqarilmaydi). Bu — loyihadagi eng yaxshi test qilingan qismlardan biri. Lekin haqiqiy Telegram `getChatMember` javobi (bot admin emasligi, kanal o'chirilgani va h.k.) va HTTP darajasida `403` kelishi — `channelCheck.ts`/`telegram.ts` konvensiyaga ko'ra sinovsiz, jonli tekshiruv kerak.

### 21. Noto'g'ri qo'lda kiritilgan raqam (`90 123`) rad etiladi; to'g'ri raqam `+998901234567` saqlanadi
**✅ Tasdiqlangan.** Uch qatlamda: `shared/test/phone.test.ts` (`normalizePhone` — formatlangan `+998`, `998`-prefiksli, 9 xonali mahalliy, noto'g'ri davlat kodi rad, 8 xonali rad), `api/test/validators.test.ts` (`validateOrderCreateBody`'ning telefonni normalizatsiya qilishi/rad etishi), va SQL darajasida `db-tests/create-order.test.ts` — "accepts a correctly formatted +998 phone number and rejects malformed ones" (`create_order`ning o'z regex tekshiruvi `^\+998\d{9}$`).

### 22. `grep -rE "BOT_TOKEN|POSTGRES_PASSWORD|WEBHOOK_SECRET" web/dist` hech narsa topmaydi
**✅ Tasdiqlangan.** Shu sessiyada `npm run build`dan keyin men shaxsan ishga tushirdim: natija bo'sh (exit code 1 — mos kelish topilmadi). CI'dagi versiya (`.github/workflows/ci.yml`) yana `DATABASE_URL`ni ham tekshiradi — men ham xuddi shu kengaytirilgan pattern bilan tekshirdim, natija bir xil: toza.

### 23. Hetzner'da `docker compose up -d` → sayt HTTPS'da ochiladi, webhook `getWebhookInfo`da to'g'ri
**🟡 Kod tayyor, deploy kerak.** `deploy/docker-compose.yml`, `deploy/Caddyfile`, `scripts/set-webhook.ps1` men tomonimdan o'qib chiqildi va spec bilan mos (Postgres tashqariga ochilmagan, Caddy Let's Encrypt + `frame-ancestors` orqali Telegram iframe'ga ruxsat, `X-Frame-Options` ataylab qo'shilmagan). Ammo **hech qanday deploy hali bo'lmagan**: `deploy/.env.example`dagi barcha qiymatlar placeholder (`shop.example.com`, `changeme-...`), haqiqiy domen/bot tokeni yo'q, va serverga (`178.104.103.113`) birorta ham `docker compose up` chaqirilmagan. Bu — 🟡ning eng "boshlanmagan" holati: kod tayyor, lekin birinchi urinish ham qilinmagan.

### 24. Backup: qo'lda ishga tushirish → shifrlangan fayl Storage Box'da, `gpg -d | pg_restore` bilan tiklanadi
**🟡 Kod tayyor, deploy kerak.** `deploy/backup.sh` o'qib chiqildi: `pg_dump --format=custom | gpg --encrypt` to'g'ridan-to'g'ri quvurlangan (plaintext diskka yozilmaydi), muvaffaqiyatsizlikda Telegram xabari, hajm tekshiruvi (`MIN_BYTES=1024`), `rclone`ga yuklash va 14 kunlik saqlash muddati — bari spec bilan mos. Lekin GPG kalit jufti, rclone remote va `RCLONE_REMOTE`/`BACKUP_GPG_RECIPIENT` sozlamalari real muhitda hali sozlanmagan, shuning uchun na backup, na tiklash birorta ham marta ishga tushirilmagan.

### 25. TypeScript `strict`, `tsc` xatosiz; CI'da typecheck+test+build o'tadi
**🟡 Kod tayyor, deploy kerak (qisman tasdiqlangan).** Bo'lib ko'rib chiqamiz:
- `strict: true`, `noUncheckedIndexedAccess: true` — `tsconfig.base.json`da o'rnatilgan, hamma workspace shundan meros oladi.
- `npm run typecheck` (`tsc -b`) — **men shaxsan ishga tushirdim shu sessiyada, xatosiz, toza chiqdi.** Bu qism ✅ darajasida ishonchli.
- "CI'da o'tadi" qismi — 🟡: `.github/workflows/ci.yml` to'g'ri sozlangan (typecheck → test → build → secret-scan), lekin repo hali `origin`ga push qilinmagani sababli GitHub Actions bu workflow'ni hali birorta ham marta ishga tushirmagan. Demak "CI o'tadi" degan da'vo hozircha faqat "lokal ekvivalenti o'tadi" darajasida — CI'ning o'zi sinalmagan.

---

## Yig'indi

| Toifa | Son |
|---|---|
| ✅ Tasdiqlangan | 7 |
| 🟡 Kod tayyor, deploy kerak | 18 |
| ❌ Bajarilmagan | 0 |
| **Jami** | **25** |

✅: 6, 8, 11, 12, 15, 21, 22.
🟡: 1, 2, 3, 4, 5, 7, 9, 10, 13, 14, 16, 17, 18, 19, 20, 23, 24, 25.

---

## Ochiq ishlar

1. **Logo placeholder.** `web/public/logo.webp` — 386 baytli, 256×256 generatsiya qilingan WebP (`RIFF/WEBP` magic bytes bilan tasdiqlandi), haqiqiy brend belgisi emas. Production'ga chiqishdan oldin haqiqiy logo bilan almashtirilishi kerak.
2. **Spec'dagi 5 ta ochiq savol** (`docs/specs/dunyo-miniapp-v1.md`, "Ochiq savollar" bo'limi) hali tasdiqlanmagan:
   - Domen nomi (Mini App qaysi domenda turadi).
   - Bot username va do'kon guruhi — yangi yaratiladimi yoki mavjudi ishlatiladimi.
   - Boshlang'ich viloyat ro'yxati va narxlari (seed uchun).
   - Pickup manzili — "Samarqand Darvoza filiali" to'g'rimi.
   - Kafolat matni — barcha mahsulotga umumiymi yoki har biriga alohida (`warranty_months`).
3. ~~**Kategoriya ikonkasi nomuvofiqligi**~~ — **hal qilindi** (5-bandga qarang): `category_icon` API'dan UI'gacha ulandi va brauzerda tekshirildi.
4. ~~**Owner/admin boshqaruvi sinovsiz**~~ — **hal qilindi** (17-bandga qarang): `decideAdminDeletion()` ajratildi, 8 ta test yozildi va oxirgi owner qo'rig'idagi fail-open xatosi tuzatildi.
5. **Hech qanday deploy bo'lmagan.** Bot tokeni, do'kon guruhi chat ID'si, domen, GPG kalit jufti, rclone remote — barchasi hali sozlanmagan. `docs/deploy.md`dagi qadamlar birortasi ham bajarilmagan.
6. **CI hali ishlamagan.** Repo `origin`ga push qilinmagan (`git status` — hammasi untracked); `.github/workflows/ci.yml` to'g'ri yozilgan, lekin real GitHub Actions muhitida hali sinalmagan.
7. **`docs/deploy.md` §8dagi qo'lda tekshiruv ro'yxati** — o'n ikkita band (bot `/start`, `401 auth_invalid`, variant tanlash, nasiya qatori, checkout viloyat, buyurtma xabari, ikki marta bosish, parallel buyurtma, admin holat o'zgarishi, `cancelled` qoldiq, `403 admin`) — aslida yuqoridagi 🟡 bandlarning aksariyati bilan bir xil ro'yxat. Birinchi deploy'dan keyin shu ro'yxat bo'yicha qo'lda o'tib chiqish tavsiya etiladi.
