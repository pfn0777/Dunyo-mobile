import logging

from aiogram import F, Router
from aiogram.types import CallbackQuery, Message
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy import select

from dunyo_mobile.bot.keyboards.inline import product_card_kb
from dunyo_mobile.db.models.product import Category, Product
from dunyo_mobile.db.session import get_session

logger = logging.getLogger(__name__)
router = Router()


@router.message(F.text == "📱 Katalog")
async def catalog_handler(message: Message) -> None:
    try:
        async with get_session() as session:
            result = await session.execute(
                select(Category)
                .where(Category.is_active == True)  # noqa: E712
                .order_by(Category.order)
            )
            categories = result.scalars().all()

        if not categories:
            await message.answer("Hozircha kategoriyalar mavjud emas.")
            return

        builder = InlineKeyboardBuilder()
        for cat in categories:
            emoji = cat.emoji or ""
            builder.button(
                text=f"{emoji} {cat.name_uz}",
                callback_data=f"cat_{cat.id}",
            )
        builder.adjust(2)
        await message.answer("📂 Kategoriyani tanlang:", reply_markup=builder.as_markup())
    except Exception as e:
        logger.error("catalog_handler error: %s", e, exc_info=True)
        await message.answer("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.")


@router.callback_query(F.data == "back_catalog")
async def back_to_catalog(callback: CallbackQuery) -> None:
    try:
        async with get_session() as session:
            result = await session.execute(
                select(Category)
                .where(Category.is_active == True)  # noqa: E712
                .order_by(Category.order)
            )
            categories = result.scalars().all()

        builder = InlineKeyboardBuilder()
        for cat in categories:
            emoji = cat.emoji or ""
            builder.button(
                text=f"{emoji} {cat.name_uz}",
                callback_data=f"cat_{cat.id}",
            )
        builder.adjust(2)
        await callback.message.edit_text(
            "📂 Kategoriyani tanlang:", reply_markup=builder.as_markup()
        )
        await callback.answer()
    except Exception as e:
        logger.error("back_to_catalog error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)


@router.callback_query(F.data.startswith("cat_"))
async def category_products(callback: CallbackQuery) -> None:
    try:
        cat_id = int(callback.data.split("_")[1])

        async with get_session() as session:
            result = await session.execute(
                select(Product).where(
                    Product.category_id == cat_id,
                    Product.is_active == True,  # noqa: E712
                )
            )
            products = result.scalars().all()

        if not products:
            await callback.message.edit_text(
                "Bu kategoriyada hozircha mahsulot yo'q.",
                reply_markup=InlineKeyboardBuilder()
                .button(text="⬅️ Orqaga", callback_data="back_catalog")
                .as_markup(),
            )
            await callback.answer()
            return

        builder = InlineKeyboardBuilder()
        for p in products:
            old = f" (eski: {p.old_price:,})" if p.old_price else ""
            builder.button(
                text=f"{p.name} — {p.price:,} UZS{old}",
                callback_data=f"prod_{p.id}",
            )
        builder.adjust(1)
        builder.button(text="⬅️ Orqaga", callback_data="back_catalog")

        await callback.message.edit_text("📱 Mahsulotlar:", reply_markup=builder.as_markup())
        await callback.answer()
    except Exception as e:
        logger.error("category_products error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)


@router.callback_query(F.data.startswith("prod_"))
async def product_card(callback: CallbackQuery) -> None:
    try:
        product_id = int(callback.data.split("_")[1])

        async with get_session() as session:
            product = await session.get(Product, product_id)

        if not product:
            await callback.answer("Mahsulot topilmadi.", show_alert=True)
            return

        stock_label = "✅ Mavjud" if product.stock > 0 else "❌ Tugagan"
        old_price_line = (
            f"🏷 Eski narx: <s>{product.old_price:,} UZS</s>\n" if product.old_price else ""
        )
        text = (
            f"📱 <b>{product.name}</b>\n\n"
            f"{product.description or ''}\n\n"
            f"💰 Narx: <b>{product.price:,} UZS</b>\n"
            f"{old_price_line}"
            f"📦 {stock_label}"
        )

        kb = product_card_kb(product_id)
        if product.photo_id:
            await callback.message.answer_photo(
                photo=product.photo_id, caption=text, reply_markup=kb
            )
            await callback.message.delete()
        else:
            await callback.message.edit_text(text, reply_markup=kb)

        await callback.answer()
    except Exception as e:
        logger.error("product_card error: %s", e)
        await callback.answer("Xatolik yuz berdi.", show_alert=True)
