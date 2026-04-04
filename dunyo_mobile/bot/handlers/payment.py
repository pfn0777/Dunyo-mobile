import logging

from aiogram import F, Router
from aiogram.types import Message

logger = logging.getLogger(__name__)
router = Router()


@router.message(F.text == "📞 Aloqa")
async def contact_handler(message: Message) -> None:
    await message.answer(
        "📞 <b>Bog'lanish</b>\n\n"
        "🕐 Ish vaqti: 09:00 — 22:00\n\n"
        "💬 Savol va takliflar:\n"
        "👤 Menejer: @dunyo_mobile_support\n"
        "📢 Kanal: @dunyo_mobile\n\n"
        "📦 Buyurtma holati uchun:\n"
        "/buyurtmalarim — buyurtmalaringizni ko'ring"
    )
