# Dunyo Mobile — Telegram Bot Do'koni

Smartfonlar va aksessuarlar sotuvchi Telegram bot. Stack: Python · aiogram 3 · FastAPI · SQLAlchemy 2.0 · PostgreSQL · Amvera Cloud.

## Sozlash

```bash
cp dunyo_mobile/.env.example dunyo_mobile/.env
# .env faylini to'ldiring
```

## Migratsiyalar

```bash
cd dunyo_mobile
alembic upgrade head
python -m dunyo_mobile.db.seed   # boshlang'ich ma'lumotlar
```

## Lokal ishga tushirish (polling)

```bash
# .env da WEBHOOK_URL ni to'g'ri qiling yoki bot/main.py ni polling ga o'zgartiring
python -m dunyo_mobile.bot.main
```

## Amvera deploy

```bash
git add .
git commit -m "feat: tavsif"
git push amvera main:master.
```
