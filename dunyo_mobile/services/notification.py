import logging

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError

from dunyo_mobile.config import settings
from dunyo_mobile.utils.formatters import format_price

logger = logging.getLogger(__name__)


async def notify_admins_new_order(bot: Bot, order) -> None:
    items_lines = "\n".join([
        f"  • {item.product.name} × {item.quantity} = "
        f"{format_price(item.price * item.quantity)}"
        for item in order.items
    ]) if order.items else "  —"
    text = (
        f"🆕 <b>Yangi buyurtma #{order.id}</b>\n\n"
        f"👤 {order.full_name}\n"
        f"📞 {order.phone}\n"
        f"📍 {order.address}\n\n"
        f"🛍 Mahsulotlar:\n{items_lines}\n\n"
        f"{'─' * 20}\n"
        f"💰 Jami: <b>{format_price(order.total_price)}</b>\n"
        f"💳 To'lov: {order.payment_method.value}\n"
        f"📅 {order.created_at.strftime('%d.%m.%Y %H:%M')}"
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
