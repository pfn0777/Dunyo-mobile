# Dunyo Mobile — Telegram Internet Do'koni

## Loyiha haqida

**Do'kon nomi:** Dunyo Mobile  
**Platform:** Telegram (Bot + Kanal + Mini App)  
**Mahsulotlar:** Smartfonlar va aksessuarlar  
**Maqsad bozor:** O'zbekiston (UZS to'lovlar, o'zbek tili)  
**Stack:** Python · aiogram 3 · FastAPI · SQLAlchemy · PostgreSQL · Amvera Cloud

---

## Loyiha strukturasi

```
dunyo_mobile/
├── bot/
│   ├── __init__.py
│   ├── main.py                  # Bot va webhook ishga tushirish
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── start.py             # /start, /help
│   │   ├── catalog.py           # Katalog ko'rish
│   │   ├── product.py           # Mahsulot kartochkasi
│   │   ├── cart.py              # Savat (korzina)
│   │   ├── order.py             # Buyurtma berish (FSM)
│   │   ├── payment.py           # To'lov Payme/Click
│   │   └── admin.py             # Admin boshqaruv
│   ├── keyboards/
│   │   ├── __init__.py
│   │   ├── inline.py            # Inline tugmalar
│   │   └── reply.py             # Reply tugmalar
│   ├── states/
│   │   └── order_states.py      # FSM holatlari
│   └── middlewares/
│       ├── auth.py              # Foydalanuvchi tekshirish
│       └── throttle.py          # Rate limiting
├── api/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app
│   ├── routers/
│   │   ├── products.py          # Mahsulotlar CRUD
│   │   ├── orders.py            # Buyurtmalar CRUD
│   │   ├── payment_webhook.py   # Payme/Click webhook
│   │   └── admin.py             # Admin API
│   └── schemas/
│       ├── product.py
│       └── order.py
├── db/
│   ├── __init__.py
│   ├── base.py                  # SQLAlchemy Base
│   ├── session.py               # DB sessiya
│   └── models/
│       ├── user.py
│       ├── product.py
│       ├── category.py
│       ├── cart.py
│       ├── order.py
│       └── payment.py
├── services/
│   ├── payment/
│   │   ├── payme.py             # Payme integratsiya
│   │   └── click.py             # Click integratsiya
│   ├── notification.py          # Xabar yuborish
│   └── delivery.py              # Yetkazib berish
├── config.py                    # Sozlamalar
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## Bosqich 1 — Loyiha sozlamalari

### `.env.example`
```env
BOT_TOKEN=your_telegram_bot_token
ADMIN_IDS=123456789,987654321
CHANNEL_ID=@dunyo_mobile

DATABASE_URL=postgresql+asyncpg://user:password@localhost/dunyo_mobile

PAYME_MERCHANT_ID=your_payme_merchant_id
PAYME_SECRET_KEY=your_payme_secret_key
PAYME_TEST_MODE=true

CLICK_MERCHANT_ID=your_click_merchant_id
CLICK_SECRET_KEY=your_click_secret_key

WEBHOOK_URL=https://your-domain.amvera.io
WEBHOOK_PATH=/webhook

DELIVERY_TASHKENT_PRICE=15000
DELIVERY_REGION_PRICE=35000
```

### `config.py`
```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    BOT_TOKEN: str
    ADMIN_IDS: List[int]
    CHANNEL_ID: str

    DATABASE_URL: str

    PAYME_MERCHANT_ID: str
    PAYME_SECRET_KEY: str
    PAYME_TEST_MODE: bool = True

    CLICK_MERCHANT_ID: str
    CLICK_SECRET_KEY: str

    WEBHOOK_URL: str
    WEBHOOK_PATH: str = "/webhook"

    DELIVERY_TASHKENT_PRICE: int = 15000
    DELIVERY_REGION_PRICE: int = 35000

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## Bosqich 2 — Ma'lumotlar bazasi modellari

### `db/models/user.py`
```python
from sqlalchemy import Column, BigInteger, String, Boolean, DateTime, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True)          # Telegram user_id
    username = Column(String(64), nullable=True)
    full_name = Column(String(128))
    phone = Column(String(20), nullable=True)
    language = Column(String(4), default="uz")
    is_banned = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    orders = relationship("Order", back_populates="user")
    cart_items = relationship("CartItem", back_populates="user")
```

### `db/models/product.py`
```python
from sqlalchemy import Column, Integer, String, Text, BigInteger, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from db.base import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name_uz = Column(String(64))
    name_ru = Column(String(64))
    emoji = Column(String(8), default="📱")
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    products = relationship("Product", back_populates="category")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    name = Column(String(128))
    description = Column(Text, nullable=True)
    price = Column(BigInteger)                # UZS
    old_price = Column(BigInteger, nullable=True)
    stock = Column(Integer, default=0)
    photo_id = Column(String(256), nullable=True)   # Telegram file_id
    is_active = Column(Boolean, default=True)

    category = relationship("Category", back_populates="products")
    cart_items = relationship("CartItem", back_populates="product")
    order_items = relationship("OrderItem", back_populates="product")
```

### `db/models/order.py`
```python
from sqlalchemy import Column, Integer, String, BigInteger, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.base import Base
import enum

class OrderStatus(str, enum.Enum):
    PENDING = "pending"           # Kutilmoqda
    CONFIRMED = "confirmed"       # Tasdiqlangan
    DELIVERING = "delivering"     # Yetkazilmoqda
    DELIVERED = "delivered"       # Yetkazildi
    CANCELLED = "cancelled"       # Bekor qilindi

class PaymentStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PAID = "paid"
    REFUNDED = "refunded"

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    user_id = Column(BigInteger, ForeignKey("users.id"))
    full_name = Column(String(128))
    phone = Column(String(20))
    address = Column(String(256))
    comment = Column(String(512), nullable=True)
    delivery_price = Column(BigInteger, default=15000)
    total_price = Column(BigInteger)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.UNPAID)
    payment_method = Column(String(20), nullable=True)   # payme | click | cash
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, default=1)
    price = Column(BigInteger)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
```

---

## Bosqich 3 — Bot handlers

### `bot/states/order_states.py`
```python
from aiogram.fsm.state import State, StatesGroup

class OrderStates(StatesGroup):
    waiting_name = State()
    waiting_phone = State()
    waiting_address = State()
    waiting_comment = State()
    waiting_payment = State()
```

### `bot/handlers/start.py`
```python
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import CommandStart
from bot.keyboards.reply import main_menu_kb

router = Router()

@router.message(CommandStart())
async def start_handler(message: Message):
    text = (
        f"👋 Salom, <b>{message.from_user.first_name}</b>!\n\n"
        f"📱 <b>Dunyo Mobile</b> ga xush kelibsiz!\n\n"
        f"Bizda eng sifatli smartfonlar va aksessuarlar mavjud.\n"
        f"Tanlang 👇"
    )
    await message.answer(text, parse_mode="HTML", reply_markup=main_menu_kb())
```

### `bot/handlers/catalog.py`
```python
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder
from db.session import get_session
from db.models.product import Category, Product
from sqlalchemy import select

router = Router()

@router.message(F.text == "📱 Katalog")
async def catalog_handler(message: Message):
    async with get_session() as session:
        result = await session.execute(
            select(Category).where(Category.is_active == True).order_by(Category.order)
        )
        categories = result.scalars().all()

    builder = InlineKeyboardBuilder()
    for cat in categories:
        builder.button(
            text=f"{cat.emoji} {cat.name_uz}",
            callback_data=f"cat_{cat.id}"
        )
    builder.adjust(2)

    await message.answer("📂 Kategoriyani tanlang:", reply_markup=builder.as_markup())

@router.callback_query(F.data.startswith("cat_"))
async def category_products(callback: CallbackQuery):
    cat_id = int(callback.data.split("_")[1])

    async with get_session() as session:
        result = await session.execute(
            select(Product)
            .where(Product.category_id == cat_id, Product.is_active == True)
        )
        products = result.scalars().all()

    builder = InlineKeyboardBuilder()
    for p in products:
        old = f" (was {p.old_price:,})" if p.old_price else ""
        builder.button(
            text=f"{p.name} — {p.price:,} UZS{old}",
            callback_data=f"prod_{p.id}"
        )
    builder.adjust(1)
    builder.button(text="⬅️ Orqaga", callback_data="back_catalog")

    await callback.message.edit_text("📱 Mahsulotlar:", reply_markup=builder.as_markup())
```

### `bot/handlers/cart.py`
```python
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder

router = Router()

@router.callback_query(F.data.startswith("add_cart_"))
async def add_to_cart(callback: CallbackQuery):
    product_id = int(callback.data.split("_")[2])
    user_id = callback.from_user.id

    async with get_session() as session:
        # Savatga qo'shish yoki miqdorni oshirish
        existing = await session.execute(
            select(CartItem).where(
                CartItem.user_id == user_id,
                CartItem.product_id == product_id
            )
        )
        item = existing.scalar_one_or_none()
        if item:
            item.quantity += 1
        else:
            session.add(CartItem(user_id=user_id, product_id=product_id, quantity=1))
        await session.commit()

    await callback.answer("✅ Savatga qo'shildi!", show_alert=False)

@router.message(F.text == "🛒 Savat")
async def cart_handler(message: Message):
    user_id = message.from_user.id
    async with get_session() as session:
        items = await get_cart_items(session, user_id)

    if not items:
        await message.answer("🛒 Savatingiz bo'sh.\n\n📱 Katalogdan mahsulot tanlang!")
        return

    total = sum(item.product.price * item.quantity for item in items)
    text = "🛒 <b>Sizning savatingiz:</b>\n\n"
    for item in items:
        text += f"• {item.product.name} × {item.quantity} = {item.product.price * item.quantity:,} UZS\n"
    text += f"\n💰 <b>Jami: {total:,} UZS</b>"

    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Buyurtma berish", callback_data="checkout")
    builder.button(text="🗑 Savatni tozalash", callback_data="clear_cart")
    builder.adjust(1)

    await message.answer(text, parse_mode="HTML", reply_markup=builder.as_markup())
```

### `bot/handlers/order.py`
```python
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from bot.states.order_states import OrderStates
from bot.keyboards.inline import payment_methods_kb

router = Router()

@router.callback_query(F.data == "checkout")
async def checkout_start(callback: CallbackQuery, state: FSMContext):
    await callback.message.answer(
        "📝 Buyurtmani rasmiylashtirish\n\n"
        "👤 Ismingizni kiriting:"
    )
    await state.set_state(OrderStates.waiting_name)

@router.message(OrderStates.waiting_name)
async def get_name(message: Message, state: FSMContext):
    await state.update_data(full_name=message.text)
    await message.answer(
        "📞 Telefon raqamingizni kiriting:\n"
        "Misol: +998901234567"
    )
    await state.set_state(OrderStates.waiting_phone)

@router.message(OrderStates.waiting_phone)
async def get_phone(message: Message, state: FSMContext):
    await state.update_data(phone=message.text)
    await message.answer("📍 Yetkazib berish manzilingizni kiriting:")
    await state.set_state(OrderStates.waiting_address)

@router.message(OrderStates.waiting_address)
async def get_address(message: Message, state: FSMContext):
    await state.update_data(address=message.text)
    await message.answer(
        "💳 To'lov usulini tanlang:",
        reply_markup=payment_methods_kb()
    )
    await state.set_state(OrderStates.waiting_payment)

@router.callback_query(OrderStates.waiting_payment, F.data.startswith("pay_"))
async def select_payment(callback: CallbackQuery, state: FSMContext):
    method = callback.data.split("_")[1]   # payme | click | cash
    data = await state.get_data()

    # Buyurtmani DB ga saqlash
    order = await create_order(
        user_id=callback.from_user.id,
        full_name=data["full_name"],
        phone=data["phone"],
        address=data["address"],
        payment_method=method
    )

    await state.clear()

    if method == "cash":
        await callback.message.answer(
            f"✅ Buyurtmangiz #{order.id} qabul qilindi!\n\n"
            f"🚚 Tez orada kuryer siz bilan bog'lanadi.\n"
            f"📞 Savollar uchun: @dunyo_mobile_support"
        )
    else:
        # Payme yoki Click to'lov havolasi
        payment_url = await generate_payment_url(method, order)
        await callback.message.answer(
            f"💳 To'lov qilish uchun:\n{payment_url}"
        )

    # Adminga xabar
    await notify_admins_new_order(order)
```

---

## Bosqich 4 — To'lov integratsiya

### `services/payment/payme.py`
```python
import hashlib
import base64
from config import settings

class PaymeService:
    BASE_URL = "https://checkout.paycom.uz"
    TEST_URL = "https://test.paycom.uz"

    def generate_payment_url(self, order_id: int, amount: int) -> str:
        """
        amount — tiyin (UZS * 100)
        """
        url = self.TEST_URL if settings.PAYME_TEST_MODE else self.BASE_URL
        merchant_id = settings.PAYME_MERCHANT_ID

        params = (
            f"m={merchant_id};"
            f"ac.order_id={order_id};"
            f"a={amount * 100};"
            f"l=uz"
        )
        encoded = base64.b64encode(params.encode()).decode()
        return f"{url}/{encoded}"

    def verify_signature(self, data: dict, signature: str) -> bool:
        key = f"{settings.PAYME_SECRET_KEY}"
        computed = hashlib.sha1(
            (data.get("id", "") + key).encode()
        ).hexdigest()
        return computed == signature

payme_service = PaymeService()
```

### `services/payment/click.py`
```python
import hashlib
from config import settings

class ClickService:
    BASE_URL = "https://my.click.uz/services/pay"

    def generate_payment_url(self, order_id: int, amount: int) -> str:
        return (
            f"{self.BASE_URL}"
            f"?service_id={settings.CLICK_MERCHANT_ID}"
            f"&merchant_id={settings.CLICK_MERCHANT_ID}"
            f"&amount={amount}"
            f"&transaction_param={order_id}"
            f"&return_url=https://t.me/dunyo_mobile_bot"
        )

    def verify_signature(self, click_trans_id, service_id, secret_key,
                         merchant_trans_id, amount, action, sign_time) -> str:
        sign_string = (
            f"{click_trans_id}{service_id}{secret_key}"
            f"{merchant_trans_id}{amount}{action}{sign_time}"
        )
        return hashlib.md5(sign_string.encode()).hexdigest()

click_service = ClickService()
```

---

## Bosqich 5 — Admin funksiyalar

### `bot/handlers/admin.py`
```python
from aiogram import Router, F
from aiogram.types import Message
from aiogram.filters import Command
from config import settings

router = Router()

def is_admin(user_id: int) -> bool:
    return user_id in settings.ADMIN_IDS

@router.message(Command("admin"))
async def admin_panel(message: Message):
    if not is_admin(message.from_user.id):
        return

    from aiogram.utils.keyboard import InlineKeyboardBuilder
    builder = InlineKeyboardBuilder()
    builder.button(text="📦 Buyurtmalar", callback_data="admin_orders")
    builder.button(text="📱 Mahsulotlar", callback_data="admin_products")
    builder.button(text="📊 Statistika", callback_data="admin_stats")
    builder.button(text="📢 Xabar yuborish", callback_data="admin_broadcast")
    builder.adjust(2)

    await message.answer(
        "🔧 <b>Admin panel — Dunyo Mobile</b>",
        parse_mode="HTML",
        reply_markup=builder.as_markup()
    )

@router.message(Command("add_product"))
async def add_product_start(message: Message):
    """
    Yangi mahsulot qo'shish:
    /add_product <name>|<price>|<category_id>|<stock>
    """
    if not is_admin(message.from_user.id):
        return
    # FSM orqali kengaytiring
    await message.answer("Mahsulot ma'lumotlarini kiriting...")
```

---

## Bosqich 6 — Notification service

### `services/notification.py`
```python
from aiogram import Bot
from config import settings

async def notify_admins_new_order(bot: Bot, order) -> None:
    text = (
        f"🆕 <b>Yangi buyurtma #{order.id}</b>\n\n"
        f"👤 {order.full_name}\n"
        f"📞 {order.phone}\n"
        f"📍 {order.address}\n"
        f"💰 {order.total_price:,} UZS\n"
        f"💳 {order.payment_method}\n"
    )
    for admin_id in settings.ADMIN_IDS:
        try:
            await bot.send_message(admin_id, text, parse_mode="HTML")
        except Exception:
            pass

async def notify_order_status(bot: Bot, order, status_text: str) -> None:
    text = (
        f"📦 <b>Buyurtma #{order.id} holati yangilandi</b>\n\n"
        f"✅ {status_text}"
    )
    await bot.send_message(order.user_id, text, parse_mode="HTML")
```

---

## Bosqich 7 — Tugmalar (keyboards)

### `bot/keyboards/reply.py`
```python
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton

def main_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📱 Katalog"), KeyboardButton(text="🛒 Savat")],
            [KeyboardButton(text="📦 Buyurtmalarim"), KeyboardButton(text="📞 Aloqa")],
        ],
        resize_keyboard=True
    )
```

### `bot/keyboards/inline.py`
```python
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.types import InlineKeyboardMarkup

def payment_methods_kb() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="💳 Payme", callback_data="pay_payme")
    builder.button(text="💳 Click", callback_data="pay_click")
    builder.button(text="💵 Naqd (kuryer kelganda)", callback_data="pay_cash")
    builder.adjust(2, 1)
    return builder.as_markup()

def product_card_kb(product_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="🛒 Savatga qo'shish", callback_data=f"add_cart_{product_id}")
    builder.button(text="⬅️ Orqaga", callback_data="back_catalog")
    builder.adjust(1)
    return builder.as_markup()
```

---

## Bosqich 8 — Main va webhook

### `bot/main.py`
```python
import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web
from config import settings
from bot.handlers import start, catalog, cart, order, admin

async def main():
    logging.basicConfig(level=logging.INFO)

    bot = Bot(token=settings.BOT_TOKEN)
    dp = Dispatcher()

    dp.include_router(start.router)
    dp.include_router(catalog.router)
    dp.include_router(cart.router)
    dp.include_router(order.router)
    dp.include_router(admin.router)

    await bot.set_webhook(
        url=f"{settings.WEBHOOK_URL}{settings.WEBHOOK_PATH}",
        drop_pending_updates=True
    )

    app = web.Application()
    handler = SimpleRequestHandler(dispatcher=dp, bot=bot)
    handler.register(app, path=settings.WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()

    await asyncio.Event().wait()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Bosqich 9 — Deploy (Amvera)

### `Dockerfile`
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "bot.main"]
```

### `requirements.txt`
```
aiogram==3.7.0
fastapi==0.111.0
uvicorn==0.30.0
sqlalchemy==2.0.30
asyncpg==0.29.0
alembic==1.13.1
pydantic-settings==2.3.0
aiohttp==3.9.5
python-dotenv==1.0.1
```

### Amvera deploy buyruqlari
```bash
# Birinchi marta
git init
git remote add amvera https://git.amvera.ru/username/dunyo-mobile
git add .
git commit -m "init: Dunyo Mobile bot"
git push amvera main:master

# Keyingi yangilanishlar
git add .
git commit -m "feat: yangi funksiya"
git push amvera main:master
```

---

## Kategoriyalar va boshlang'ich mahsulotlar (seed data)

```python
# db/seed.py
CATEGORIES = [
    {"name_uz": "Smartfonlar", "emoji": "📱", "order": 1},
    {"name_uz": "Aksessuarlar", "emoji": "🎧", "order": 2},
    {"name_uz": "Zaryadlovchilar", "emoji": "🔋", "order": 3},
    {"name_uz": "Qopqoqlar", "emoji": "🛡️", "order": 4},
    {"name_uz": "Smart soatlar", "emoji": "⌚", "order": 5},
    {"name_uz": "Power bank", "emoji": "🔌", "order": 6},
]

SAMPLE_PRODUCTS = [
    {
        "name": "Samsung Galaxy A55",
        "price": 4_990_000,
        "old_price": 5_500_000,
        "category": "Smartfonlar",
        "stock": 10,
    },
    {
        "name": "iPhone 15 128GB",
        "price": 12_500_000,
        "category": "Smartfonlar",
        "stock": 5,
    },
    {
        "name": "AirPods Pro 2",
        "price": 2_200_000,
        "category": "Aksessuarlar",
        "stock": 20,
    },
    {
        "name": "Samsung 65W Zaryadlovchi",
        "price": 180_000,
        "category": "Zaryadlovchilar",
        "stock": 50,
    },
]
```

---

## Xavfsizlik tekshiruvi

| # | Muammo | Yechim |
|---|--------|--------|
| 1 | Webhook token yo'q | `secret_token` parametr qo'shing |
| 2 | Admin ID tekshiruvi | Har bir admin handlerda `is_admin()` chaqiring |
| 3 | To'lov signature | Payme/Click signature tekshiruvini o'tkazing |
| 4 | SQL injection | SQLAlchemy ORM ishlatilgan — xavfsiz |
| 5 | Rate limiting | `ThrottlingMiddleware` qo'shing |
| 6 | Fayl hajmi | Rasm yuklashda `max_size` tekshiring |

---

## Claude Code uchun keyingi buyruqlar

```
Dunyo Mobile bot uchun quyidagilarni implement qil:

1. db/models/ papkasidagi barcha modellarni yaratib,
   Alembic migration ishga tushir.

2. bot/handlers/catalog.py da mahsulot kartochkasini
   photo_id bilan ko'rsatuvchi handler yoz.

3. services/payment/payme.py da webhook handler yoz —
   to'lov tasdiqlanganda order.payment_status = "paid"
   ga o'zgartirilsin va foydalanuvchiga xabar yuborilsin.

4. bot/handlers/admin.py da /stats buyrug'ini yoz —
   bugungi buyurtmalar soni va jami summa ko'rsatilsin.

5. Barcha handlerlarni bot/main.py ga ulang va
   Amvera uchun Dockerfile to'g'riligini tekshiring.
```

---

*Dunyo Mobile — Telegram do'kon loyihasi. Powered by Python + aiogram 3 + PostgreSQL.*
