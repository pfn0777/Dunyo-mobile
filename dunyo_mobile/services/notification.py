import logging

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError

from dunyo_mobile.config import settings

logger = logging.getLogger(__name__)


def _format_price(amount: int) -> str:
    return f"{amount:,} UZS".replace(",", " ")


async def notify_admins_new_order(bot: Bot, order) -> None:
    item_count = sum(item.quantity for item in order.items) if order.items else 0
    text = (
        f"🆕 <b>Yangi buyurtma #{order.id}</b>\n\n"
        f"👤 {order.full_name}\n"
        f"📞 {order.phone}\n"
        f"📍 {order.address}\n"
        f"💰 {_format_price(order.total_price)}\n"
        f"💳 {order.payment_method}\n"
        f"📦 {item_count} ta mahsulot"
    )
    from dunyo_mobile.bot.keyboards.inline import order_status_kb

    for admin_id in settings.ADMIN_IDS:
        try:
            await bot.send_message(
                admin_id, text, parse_mode="HTML", reply_markup=order_status_kb(order.id)
            )
        except TelegramAPIError as e:
            logger.warning("Could not notify admin %s: %s", admin_id, e)


async def notify_order_status(bot: Bot, order, status_text: str) -> None:
    text = (
        f"📦 <b>Buyurtma #{order.id} holati yangilandi</b>\n\n"
        f"✅ {status_text}"
    )
    try:
        await bot.send_message(order.user_id, text, parse_mode="HTML")
    except TelegramAPIError as e:
        logger.warning("Could not notify user %s: %s", order.user_id, e)
