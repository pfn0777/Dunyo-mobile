import logging

from aiogram import F, Router
from aiogram.types import CallbackQuery, Message
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from dunyo_mobile.bot.keyboards.inline import cart_kb
from dunyo_mobile.db.models.cart import CartItem
from dunyo_mobile.db.models.product import Product
from dunyo_mobile.db.session import get_session
from dunyo_mobile.utils.formatters import format_price

logger = logging.getLogger(__name__)
router = Router()


@router.callback_query(F.data.startswith("add_cart_"))
async def add_to_cart(callback: CallbackQuery) -> None:
    try:
        product_id = int(callback.data.split("_")[2])
        user_id = callback.from_user.id

        async with get_session() as session:
            product = await session.get(Product, product_id)
            if not product or product.stock < 1:
                await callback.answer("❌ Mahsulot mavjud emas!", show_alert=True)
                return

            result = await session.execute(
                select(CartItem).where(
                    CartItem.user_id == user_id,
                    CartItem.product_id == product_id,
                )
            )
            item = result.scalar_one_or_none()
            if item:
                item.quantity += 1
                answer_text = f"🔄 Miqdor oshirildi! ({item.quantity} ta)"
            else:
                session.add(CartItem(user_id=user_id, product_id=product_id, quantity=1))
                answer_text = "✅ Savatga qo'shildi!"

        await callback.answer(answer_text, show_alert=False)
    except Exception as e:
        logger.error("add_to_cart error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)


@router.message(F.text == "🛒 Savat")
async def cart_handler(message: Message) -> None:
    try:
        user_id = message.from_user.id
        async with get_session() as session:
            result = await session.execute(
                select(CartItem)
                .options(selectinload(CartItem.product))
                .where(CartItem.user_id == user_id)
            )
            items = result.scalars().all()

        if not items:
            await message.answer(
                "🛒 <b>Savat bo'sh</b>\n\n"
                "Hali hech narsa qo'shilmagan.\n"
                "📱 Katalogdan mahsulot tanlang!"
            )
            return

        subtotal = sum(item.product.price * item.quantity for item in items)
        delivery = 15_000
        total = subtotal + delivery
        text = (
            "🛒 <b>Sizning savatingiz</b>\n\n"
            + "\n".join([
                f"{i + 1}. {item.product.name}\n"
                f"   {item.quantity} ta × {format_price(item.product.price)} = "
                f"<b>{format_price(item.product.price * item.quantity)}</b>"
                for i, item in enumerate(items)
            ])
            + f"\n\n{'─' * 20}\n"
            + f"📦 Mahsulotlar: {format_price(subtotal)}\n"
            + f"🚚 Yetkazib berish: {format_price(delivery)}\n"
            + f"💰 <b>Jami: {format_price(total)}</b>"
        )

        await message.answer(text, reply_markup=cart_kb())
    except Exception as e:
        logger.error("cart_handler error: %s", e)
        await message.answer("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.")


@router.callback_query(F.data == "clear_cart")
async def clear_cart(callback: CallbackQuery) -> None:
    try:
        user_id = callback.from_user.id
        async with get_session() as session:
            await session.execute(
                delete(CartItem).where(CartItem.user_id == user_id)
            )
        await callback.message.edit_text("🗑 Savat tozalandi.")
        await callback.answer()
    except Exception as e:
        logger.error("clear_cart error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)
