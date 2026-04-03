import logging

from aiogram import F, Router
from aiogram.types import Message

logger = logging.getLogger(__name__)
router = Router()


@router.message(F.text == "📞 Aloqa")
async def contact_handler(message: Message) -> None:
    await message.answer(
        "📞 <b>Aloqa</b>\n\n"
        "🤖 Bot: @dunyo_mobile_bot\n"
        "💬 Support: @dunyo_mobile_support\n"
        "📢 Kanal: @dunyo_mobile"
    )
