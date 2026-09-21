# Dunyo Mobile — Deploy qo'llanmasi

Ushbu hujjat Dunyo Mobile Telegram Mini App'ni bitta Hetzner VPS'da (Docker
Compose bilan) noldan production'ga chiqarish uchun qadamma-qadam
buyruqlarni beradi. Texnik manba: `docs/specs/dunyo-miniapp-v1.md` (ayniqsa
"Arxitektura", "Server" va "Konfiguratsiya / Secrets" bo'limlari).

Server: Hetzner, `root@178.104.103.113` (v1 uchun CX22 — 2 vCPU, 4 GB RAM,
40 GB SSD yetarli). Barcha `<...>` ko'rinishidagi qiymatlar — haqiqiy
qiymatlaringiz bilan almashtirilishi kerakligini bildiradi. Hujjatning
o'zida haqiqiy sir (token, parol, kalit) yo'q.

---

## 1) Oldindan kerak bo'ladigan narsalar

- **Domen**: `DOMAIN` uchun A yozuvi `178.104.103.113`ga yo'naltirilgan
  bo'lishi kerak (masalan `shop.example.com`) — Caddy Let's Encrypt
  sertifikatini shu yozuv orqali tekshiradi.
- **BotFather bot**: [@BotFather](https://t.me/BotFather) → `/newbot` → bot
  tokenini saqlab qo'ying (`TELEGRAM_BOT_TOKEN`).
- **Buyurtmalar guruhi**: Telegram'da yangi guruh oching (masalan "Dunyo
  Mobile — buyurtmalar"), botni guruhga a'zo qiling. Bot guruhda bo'lishi
  **shart** — aks holda buyurtma xabarlari hech qayerga kelmaydi (§11
  jadvaliga qarang).
- **GPG kalit juftligi** (backup shifrlash uchun), lokal mashinada:

  ```powershell
  gpg --quick-generate-key "Dunyo Mobile Backup" rsa4096 encr never
  gpg --armor --export "Dunyo Mobile Backup" > dunyo-backup-public.asc
  ```

  Private kalitni **hech qayerga yuklamang** — offline, kamida ikkita
  nusxada saqlang (masalan shifrlangan USB flesh + parol menejeri). Faqat
  shu kalit bilan backup'larni ochish mumkin; yo'qolsa, barcha backup'lar
  o'qib bo'lmas holga keladi.
- **rclone remote** (Hetzner Storage Box): Storage Box'ni Hetzner Cloud
  konsolida yarating (SFTP/WebDAV), so'ng lokal yoki serverda:

  ```bash
  rclone config
  # type: sftp (yoki webdav), host/user/password — Storage Box panelidan
  # remote nomi, masalan: hetzner-storagebox
  ```

  Bu remote keyinroq `backup` konteyneri ichida ham sozlanadi (§3, §9).

---

## 2) Server hardening

SSH orqali serverga `root` sifatida kiring, so'ng:

```bash
# 1. Non-root sudo foydalanuvchi
adduser deploy
usermod -aG sudo deploy

# 2. SSH kalitini yangi foydalanuvchiga ko'chiring
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# 3. Parol bilan kirish va root orqali to'g'ridan-to'g'ri kirishni o'chiring
#    /etc/ssh/sshd_config faylida:
#      PasswordAuthentication no
#      PermitRootLogin no
sudo systemctl restart sshd

# 4. UFW — faqat 22/80/443
sudo apt update
sudo apt install -y ufw fail2ban unattended-upgrades
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 5. fail2ban — standart sshd jail yetarli (o'chirilmagan bo'lishi kerak)
sudo systemctl enable --now fail2ban

# 6. Xavfsizlik yangilanishlari avtomatik o'rnatilsin
sudo dpkg-reconfigure --priority=low unattended-upgrades

# 7. Docker + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# Shu joydan keyin `deploy` foydalanuvchi sifatida qayta ulaning
# (guruh o'zgarishi joriy sessiyaga ta'sir qilmaydi).
```

Qayta ulaning (`ssh deploy@<DOMAIN yoki IP>`) va tekshiring:

```bash
docker --version
docker compose version
```

---

## 3) Repo, `.env`, webhook secret

```bash
git clone <repo-url> dunyo-mobile
cd dunyo-mobile/deploy
cp .env.example .env
```

`.env` faylini oching va har bir qiymatni to'ldiring (`deploy/.env.example`
ichidagi izohlarga qarang — har bir o'zgaruvchi qayerdan kelishi yozilgan).
Ayniqsa:

```bash
# POSTGRES_PASSWORD
openssl rand -hex 24

# TELEGRAM_WEBHOOK_SECRET
openssl rand -hex 32
```

`DATABASE_URL` ichidagi user/password/db `POSTGRES_*` qiymatlariga mos
kelishi kerak — docker compose `.env` ichida bitta o'zgaruvchini
ikkinchisiga avtomatik almashtirmaydi, shuning uchun ikkalasini qo'lda bir
xil qilib yozing.

`deploy/.env` **git'ga tushmaydi** (root `.gitignore`da `.env` va `.env.*`
bilan mos keladi, faqat `.env.example` istisno) — buni tekshirish uchun:

```bash
git check-ignore -v deploy/.env
```

---

## 4) Frontend build

`web/dist` **host Caddy** (Mazzago bilan umumiy, 80/443 ni shu egallaydi)
tomonidan `/srv/dunyo/www` dan statik fayl sifatida beriladi. Build'dan keyin
uni shu papkaga nusxalang (§4 oxirida). Repo ildizida:

```bash
cd ~/dunyo-mobile   # repo ildiziga qayting
VITE_API_URL=/api VITE_MEDIA_URL=/media VITE_BOT_USERNAME=<bot_username> \
  npm ci && npm run build
```

`npm run build` `web/dist`ni yaratadi (root `package.json`dagi `build`
skripti `npm run build -w web`ga teng). Bot tokeni yoki DB paroli hech
qachon `VITE_*` o'zgaruvchisida bo'lmaydi — buni keyinroq (§8) tekshirasiz.

Host Caddy'ga ulash (Mazzago blokiga **tegmasdan**, faqat qo'shing):

```bash
sudo mkdir -p /srv/dunyo/www /srv/dunyo/media
sudo cp -r web/dist/. /srv/dunyo/www/
sudo sh -c 'cat deploy/Caddyfile >> /etc/caddy/Caddyfile'
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

`deploy/Caddyfile` dagi domen (`dunyo.mazzago.uz`) `.env` dagi `DOMAIN` bilan
bir xil bo'lishi kerak. API `127.0.0.1:3010` da tinglaydi.

---

## 5) Konteynerlarni ishga tushirish va migratsiya

```bash
cd ~/dunyo-mobile/deploy
docker compose up -d --build
```

Bu `postgres`, `api` (build qilib) va `backup` xizmatlarini ishga
tushiradi. `docker compose ps` bilan barchasi `healthy`/`running` ekanini
tekshiring.

So'ng migratsiyalarni qo'llang:

```bash
./migrate.sh
```

Chiqishda `apply: 0001_init.sql`, `0002_search_index.sql`, `0003_rpc.sql`,
`0004_seed.sql` ko'rinishi kerak. **Seed tekshiruvi** (14 ta viloyat kirgan
bo'lishi kerak):

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "select count(*) from public.regions;"
# natija: 14
```

---

## 6) Birinchi owner va do'kon guruhi

**Telegram ID'ingizni bilib oling**: [@userinfobot](https://t.me/userinfobot)
bilan chatlashing, u sizga raqamli ID qaytaradi.

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "insert into public.admin_users (telegram_id, role) values (<SIZNING_TELEGRAM_ID>, 'owner');"
```

**Guruh chat ID'sini toping**: botni guruhga qo'shgandan so'ng guruhga
istalgan xabar yozing, so'ng brauzerda oching:

```
https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
```

Javobdagi JSON'dan `"chat":{"id":-100XXXXXXXXXX, ...}` qatorini toping.
**Supergroup'larda ID har doim `-100` bilan boshlanadi** (manfiy son,
masalan `-1001234567890`). Shu butun sonni `settings`ga yozing:

```bash
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "update public.settings set shop_group_chat_id = <GURUH_CHAT_ID> where id = 1;"
```

---

## 7) Webhook

Lokal Windows mashinada (PowerShell), repo ildizida:

```powershell
.\scripts\set-webhook.ps1 -Domain <DOMAIN>
```

Skript bot tokeni va `TELEGRAM_WEBHOOK_SECRET`ni so'raydi (ikkalasi ham
ekranga chiqmaydi), `https://<DOMAIN>/tg/webhook`ga `setWebhook` chaqiradi
(`allowed_updates = [message, callback_query]`), so'ng `getWebhookInfo`
bilan tekshiradi va agar `callback_query` ro'yxatda bo'lmasa xatolik bilan
to'xtaydi. Muvaffaqiyatli bo'lsa "OK: webhook message + callback_query
bilan o'rnatildi." chiqadi.

Qo'lda qayta tekshirish:

```
https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
```

`url` to'g'ri ko'rinishi, `last_error_message` bo'sh bo'lishi kerak.

---

## 8) Qo'lda post-deploy tekshiruv ro'yxati

Bular avtomatik test yoki CI orqali tekshirib bo'lmaydigan, faqat real
muhitda tasdiqlanadigan bandlar (spec "Acceptance criteria"dan):

- [ ] Botda `/start` → "Do'konni ochish" tugmasi haqiqiy Mini App'ni
      ochadi (real Telegram, Desktop yoki mobil).
- [ ] Mini App havolasini oddiy brauzerda (Telegram tashqarisida,
      `initData`siz) ochganda API `401 {code:"auth_invalid"}` qaytaradi va
      frontend xato ekranini ko'rsatadi.
- [ ] Mahsulot sheet'ida rang/xotira variantini tanlash narx va qoldiqni
      darhol yangilaydi; tugagan variant chipi o'chiq.
- [ ] Nasiya qatori 1 mln so'mdan yuqori mahsulotlarda ko'rinadi, undan
      past mahsulotlarda umuman chiqmaydi.
- [ ] Checkout'da viloyat o'zgartirilganda yetkazib berish narxi/muddati
      darhol yangilanadi.
- [ ] Buyurtma berilgach: guruhga to'liq xabar keladi, mijozga tasdiq
      keladi, variant qoldig'i kamayadi.
- [ ] "Rasmiylashtirish" tugmasini tez ikki marta bosish bitta buyurtma
      yaratadi (idempotency key ishlayapti).
- [ ] **Parallel buyurtma**: qoldig'i 1 ta bo'lgan variantni ikkita
      akkauntdan deyarli bir vaqtda buyurtma qilinganda faqat bittasi
      muvaffaqiyatli bo'ladi, ikkinchisi `409 {code:"stock_changed"}`
      oladi.
- [ ] Admin buyurtma holatini o'zgartirganda mijozga bot orqali xabar
      keladi va guruhdagi xabar **joyida tahrirlanadi** (yangi xabar
      yuborilmaydi).
- [ ] `cancelled` holatiga o'tkazilganda variant qoldig'i qaytariladi.
- [ ] `admin_users`da bo'lmagan oddiy foydalanuvchi haqiqiy `initData`si
      bilan `/api/admin/*`ga to'g'ridan-to'g'ri so'rov yuborsa `403`
      qaytadi (frontendda tugma yashirilgani himoya hisoblanmaydi).

Qo'shimcha: `grep -rE "BOT_TOKEN|POSTGRES_PASSWORD|WEBHOOK_SECRET" web/dist`
hech narsa topmasligini tekshiring.

---

## 9) Backup: sinash va tiklash

**GPG public kalitni backup konteyneriga import qiling** (bir martalik
sozlash, `backup_gnupg` volume'da saqlanadi):

```bash
docker compose cp dunyo-backup-public.asc backup:/tmp/pub.asc
docker compose exec backup gpg --import /tmp/pub.asc
```

**rclone remote'ni backup konteyneriga sozlang** (bir martalik, `rclone
config` interaktiv — konteyner ichida ishga tushiring, `backup_rclone_config`
volume'da saqlanadi):

```bash
docker compose exec backup rclone config
```

**Qo'lda ishga tushiring**:

```bash
docker compose exec backup bash /usr/local/bin/backup.sh db
```

Storage Box'da shifrlangan fayl paydo bo'lganini tekshiring:

```bash
docker compose exec backup rclone ls "$RCLONE_REMOTE/db/"
```

**Tiklashni albatta sinab ko'ring** — hech qachon tiklanmagan backup,
backup emas:

```bash
docker compose exec backup rclone copy "$RCLONE_REMOTE/db/dunyo-<stamp>.dump.gpg" /tmp/
docker compose exec backup gpg --decrypt /tmp/dunyo-<stamp>.dump.gpg > /tmp/dunyo.dump
docker compose exec backup pg_restore --list /tmp/dunyo.dump   # tarkibni ko'rish

# To'liq tiklash — lokal/skretch bazaga, PRODUCTION'GA EMAS:
docker compose exec backup pg_restore --no-owner --no-privileges \
  -d "<lokal yoki skretch DB URI>" /tmp/dunyo.dump
```

---

## 10) Yangilash va rollback

**Yangilash:**

```bash
cd ~/dunyo-mobile
git pull
npm ci && VITE_API_URL=/api VITE_MEDIA_URL=/media VITE_BOT_USERNAME=<bot_username> npm run build
cd deploy
docker compose build api
docker compose up -d
./migrate.sh
```

**Rollback** (oldingi commit'ga qaytish):

```bash
cd ~/dunyo-mobile
git checkout <oldingi-commit-yoki-tag>
npm ci && VITE_API_URL=/api VITE_MEDIA_URL=/media VITE_BOT_USERNAME=<bot_username> npm run build
cd deploy
docker compose build api
docker compose up -d
```

Migratsiyalar faqat qo'shiladi, hech qachon orqaga qaytarilmaydi — agar
oldingi versiya yangi migratsiya qo'shgan commit'dan **oldingi** bo'lsa,
schema mos kelmasligi mumkin; bunday holatda avval DB'ni backup'dan tiklab,
keyin rollback qiling.

---

## 11) Nosozliklarni bartaraf etish (Troubleshooting)

| Muammo | Sabab | Yechim |
|---|---|---|
| Sertifikat olinmayapti (Caddy loglarida ACME xatosi) | `DOMAIN`ning A yozuvi serverga yo'naltirilmagan yoki 80/443 port yopiq | `dig <DOMAIN>` bilan A yozuvni tekshiring; `sudo ufw status` bilan 80/443 ochiqligini tasdiqlang |
| Caddy `502 Bad Gateway` qaytaryapti | `api` konteyneri ishlamayapti yoki hali sog'lom emas | `docker compose ps`, `docker compose logs api` — odatda `Missing required environment variable(s)` yoki DB ulanish xatosi |
| Webhook `401` (Telegram qayta-qayta urinadi) | `X-Telegram-Bot-Api-Secret-Token` `TELEGRAM_WEBHOOK_SECRET`ga mos kelmayapti | `getWebhookInfo` bilan hozirgi holatni ko'ring, `.\scripts\set-webhook.ps1`ni to'g'ri secret bilan qayta ishga tushiring |
| Guruhga buyurtma xabari kelmayapti | Bot guruhga a'zo emas yoki `shop_group_chat_id` noto'g'ri/bo'sh | Botni guruhga qayta qo'shing; `settings.shop_group_chat_id`ni §6 bo'yicha qayta tekshiring |
| Mini App Telegram ichida ochilmayapti (bo'sh ekran, browser konsolida frame xatosi) | `deploy/Caddyfile`dagi `Content-Security-Policy: frame-ancestors` noto'g'ri o'zgartirilgan yoki `X-Frame-Options` qo'shib qo'yilgan | Caddyfile'dagi izohni o'qing — `X-Frame-Options` **hech qachon** qo'shilmasin, faqat `frame-ancestors` orqali Telegram domenlari ruxsat etiladi |
| Rasmlar `404` qaytaryapti | `MEDIA_DIR` va Caddy'ning `/srv/dunyo/media` mount nuqtasi mos kelmayapti, yoki `media` volume bo'sh | `ls /srv/dunyo/media` (host) va `docker compose exec api ls /srv/dunyo/media` bir xil fayllarni ko'rsatishi kerak (host papka bind mount) |
