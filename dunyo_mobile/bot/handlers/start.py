import logging

from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

from dunyo_mobile.bot.keyboards.reply import main_menu_kb

logger = logging.getLogger(__name__)
router = Router()


@router.message(CommandStart())
async def start_handler(message: Message) -> None:
    try:
        text = (
            f"👋 Salom, <b>{message.from_user.first_name}</b>!\n\n"
            f"📱 <b>Dunyo Mobile</b> ga xush kelibsiz!\n\n"
            f"Bizda eng sifatli smartfonlar va aksessuarlar mavjud.\n"
            f"Tanlang 👇"
        )
        await message.answer(text, reply_markup=main_menu_kb())
    except Exception as e:
        logger.error("start_handler error: %s", e)
        await message.answer("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.")
