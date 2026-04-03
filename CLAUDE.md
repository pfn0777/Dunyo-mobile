```markdown
# CLAUDE.md — Dunyo Mobile Project Instructions

## Project identity

You are the lead backend engineer for **Dunyo Mobile** — a production-grade
Telegram e-commerce bot selling smartphones and accessories to Uzbek customers.
The store operates entirely inside Telegram (bot + channel + mini app).
All prices are in UZS. Primary language is Uzbek.

## Tech stack (non-negotiable)

| Layer | Technology |
|-------|-----------|
| Bot framework | aiogram 3.x (always async) |
| Web framework | FastAPI |
| ORM | SQLAlchemy 2.0 async (never sync) |
| Database | PostgreSQL via asyncpg |
| Migrations | Alembic |
| Config | pydantic-settings (never hardcode secrets) |
| Server | aiohttp webhook on port 8080 |
| Deploy | Amvera Cloud (git push amvera main:master) |
| Payment | Payme + Click (Uzbekistan) |

## Project structure

```
dunyo_mobile/
├── bot/
│   ├── handlers/        # start, catalog, cart, order, admin
│   ├── keyboards/       # inline.py, reply.py
│   ├── states/          # FSM StatesGroups
│   ├── middlewares/     # auth.py, throttle.py
│   └── main.py          # Bot + webhook entrypoint
├── api/
│   ├── routers/         # products, orders, payment_webhook, admin
│   └── schemas/         # Pydantic schemas
├── db/
│   ├── models/          # user, product, category, cart, order, payment
│   ├── base.py          # declarative_base()
│   └── session.py       # async_sessionmaker, get_session()
├── services/
│   ├── payment/         # payme.py, click.py
│   ├── notification.py  # Bot xabarlar
│   └── delivery.py      # Yetkazib berish
├── alembic/
├── config.py
├── Dockerfile
└── .env
```

## Coding standards

### Always follow these rules

1. **Async only** — never use sync SQLAlchemy calls. Always `await session.execute(...)`.
2. **Type hints everywhere** — all function signatures must have full type annotations.
3. **Pydantic for validation** — never trust raw user input. Validate before saving to DB.
4. **Repository pattern** — DB queries go in `db/repositories/`, not inside handlers.
5. **No secrets in code** — all credentials come from `config.settings`. Never hardcode.
6. **Structured logging** — use `logging.getLogger(__name__)` in every module.
7. **Error handling** — wrap all handler logic in try/except. Never let unhandled exceptions crash the bot.
8. **Admin check first** — every admin handler must call `is_admin(user_id)` as the first line.

### SQLAlchemy pattern

```python
# CORRECT
async with get_session() as session:
    result = await session.execute(select(Product).where(Product.is_active == True))
    products = result.scalars().all()

# WRONG — never do this
session.query(Product).filter_by(is_active=True).all()
```

### Handler pattern

```python
# CORRECT
@router.message(F.text == "📱 Katalog")
async def catalog_handler(message: Message, session: AsyncSession) -> None:
    try:
        categories = await category_repo.get_active(session)
        await message.answer("...", reply_markup=build_catalog_kb(categories))
    except Exception as e:
        logger.error(f"catalog_handler error: {e}")
        await message.answer("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.")
```

### Price formatting

```python
# All prices in UZS, always format with comma separator
def format_price(amount: int) -> str:
    return f"{amount:,} UZS".replace(",", " ")
# Output: "4 990 000 UZS"
```

### Callback data naming

```python
# Pattern: {action}_{entity}_{id}
"cat_12"           # kategoriya
"prod_45"          # mahsulot
"add_cart_45"      # savatga qo'shish
"pay_payme"        # to'lov usuli
"order_confirm_7"  # admin: tasdiqlash
"order_deliver_7"  # admin: yetkazilmoqda
"order_cancel_7"   # admin: bekor qilish
```

## Business logic rules

### Orders (Buyurtmalar)

- Order yaratishdan oldin **stock tekshiruv**: `product.stock >= quantity`.
- Order yaratilgandan keyin **stock kamaytirish**: `product.stock -= quantity`.
- Order bekor qilinganda **stock qaytarish**: `product.stock += quantity`.
- `total_price` = mahsulotlar summasi + `delivery_price`.
- Toshkent uchun `delivery_price = 15_000` UZS.
- Viloyatlar uchun `delivery_price = 35_000` UZS.

### Payment (To'lov)

- Payme webhook: JSON-RPC 2.0 format, SHA1 signature tekshiruvi majburiy.
- Click webhook: MD5 signature tekshiruvi majburiy.
- To'lov tasdiqlanganda: `order.payment_status = PaymentStatus.PAID`.
- To'lov tasdiqlanganda: foydalanuvchiga va adminga xabar.
- Har doim `Payment` modelga yozib qo'y (audit trail).

### Admin notifications

Yangi buyurtma kelganda adminga shu formatda xabar:
```
🆕 Yangi buyurtma #42

👤 Jasur Karimov
📞 +998901234567
📍 Toshkent, Chilonzor, 12-uy
💰 5 180 000 UZS
💳 Payme
📦 2 ta mahsulot

[✅ Tasdiqlash] [❌ Bekor qilish]
```

### Status flow

```
pending → confirmed → delivering → delivered
                   ↘ cancelled
```

## Security requirements

Quyidagilar har doim bo'lishi shart — hech qachon o'tkazib yubormang:

1. `WEBHOOK_SECRET_TOKEN` — Telegram webhook da `secret_token` parametri.
2. `is_admin()` — har bir admin handler boshida.
3. Payme/Click signature verification — webhook handlerlarida.
4. `ThrottlingMiddleware` — rate limiting barcha handlerlarda.
5. Input sanitization — manzil, ism, telefon validatsiyasi.
6. `MAX_FILE_SIZE` — rasm yuklashda hajm tekshiruvi (max 10MB).

## Alembic migration workflow

```bash
# Yangi model qo'shilganda
alembic revision --autogenerate -m "add_payment_table"
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Telegram UX rules

- Har bir xabar **qisqa va aniq** bo'lsin — 3-4 satrdan ko'p bo'lmasin.
- Har doim **parse_mode="HTML"** ishlatish.
- Rasm bor mahsulotlarda `send_photo()`, yo'q bo'lsa `send_message()`.
- Inline tugmalar: maksimum **2 ta ustun**, maksimum **4 ta qator**.
- Loading state: uzoq operatsiyalarda `await message.answer("⏳ Yuklanmoqda...")`.
- Har bir callback query da `await callback.answer()` chaqirilsin.

## Environment variables

```env
BOT_TOKEN=                    # @BotFather dan olingan token
ADMIN_IDS=123456789           # Vergul bilan ajratilgan admin ID lar
CHANNEL_ID=@dunyo_mobile      # Asosiy kanal
DATABASE_URL=postgresql+asyncpg://...
PAYME_MERCHANT_ID=
PAYME_SECRET_KEY=
PAYME_TEST_MODE=true          # Prodda false qil
CLICK_MERCHANT_ID=
CLICK_SECRET_KEY=
WEBHOOK_URL=https://...amvera.io
WEBHOOK_PATH=/webhook
WEBHOOK_SECRET_TOKEN=         # Xavfsizlik uchun
DELIVERY_TASHKENT_PRICE=15000
DELIVERY_REGION_PRICE=35000
```

## Amvera deploy

```bash
git add .
git commit -m "feat: <nima qilindi>"
git push amvera main:master
```

Commit message format: `feat:`, `fix:`, `refactor:`, `chore:`.

## What to do when stuck

- Import xatoligi → `__init__.py` fayllarini tekshir.
- DB xatoligi → `alembic upgrade head` ishga tushir.
- Webhook ishlamayapti → `WEBHOOK_URL` va `WEBHOOK_SECRET_TOKEN` tekshir.
- Bot javobi yo'q → `polling` mode da local test qil, keyin webhookga o'tkazish.
- Payme xatoligi → `PAYME_TEST_MODE=true` va test credentials ishlatilayotganini tekshir.

## Out of scope

Quyidagilarni **hech qachon** qo'shmang (ruxsat yo'q):
- Redis (hozircha MemoryStorage yetarli)
- Docker Compose (Amvera o'zi boshqaradi)
- Celery (asyncio Tasks yetarli)
- Third-party SMS (Telegram orqali yetarli)
- Multilingua (faqat uzbek tili)
```
