import logging

from aiogram import F, Router
from aiogram.filters import CommandStart
from aiogram.types import CallbackQuery, Message

from dunyo_mobile.bot.keyboards.reply import main_menu_kb

logger = logging.getLogger(__name__)
router = Router()


@router.callback_query(F.data == "main_menu")
async def main_menu_callback(callback: CallbackQuery) -> None:
    await callback.message.answer("👇 Asosiy menyu:", reply_markup=main_menu_kb())
    await callback.answer()


@router.callback_query(F.data == "out_of_stock")
async def out_of_stock_callback(callback: CallbackQuery) -> None:
    await callback.answer("❌ Bu mahsulot hozirda mavjud emas.", show_alert=True)


@router.message(CommandStart())
async def start_handler(message: Message) -> None:
    try:
        text = (
            f"👋 Salom, <b>{message.from_user.first_name}</b>!\n\n"
            f"🏪 <b>Dunyo Mobile</b> — smartfonlar va aksessuarlar do'koni\n\n"
            f"✅ Original mahsulotlar\n"
            f"🚚 Toshkentda 2-4 soat yetkazib berish\n"
            f"💳 Payme va Click orqali to'lov\n"
            f"🛡️ 14 kun qaytarish kafolati\n\n"
            f"👇 Quyidan tanlang:"
        )
        await message.answer(text, reply_markup=main_menu_kb())
    except Exception as e:
        logger.error("start_handler error: %s", e)
        await message.answer("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.")
