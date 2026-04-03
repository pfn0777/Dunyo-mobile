from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


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


def cart_kb() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Buyurtma berish", callback_data="checkout")
    builder.button(text="🗑 Savatni tozalash", callback_data="clear_cart")
    builder.adjust(1)
    return builder.as_markup()


def order_status_kb(order_id: int) -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    builder.button(text="✅ Tasdiqlash", callback_data=f"order_confirm_{order_id}")
    builder.button(text="🚚 Yetkazilmoqda", callback_data=f"order_deliver_{order_id}")
    builder.button(text="❌ Bekor qilish", callback_data=f"order_cancel_{order_id}")
    builder.adjust(2, 1)
    return builder.as_markup()
