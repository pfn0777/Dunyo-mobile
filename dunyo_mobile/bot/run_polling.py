import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from dunyo_mobile.config import settings
from dunyo_mobile.bot.handlers import admin, cart, catalog, order, payment, start
from dunyo_mobile.bot.middlewares.auth import AuthMiddleware
from dunyo_mobile.bot.middlewares.throttle import ThrottlingMiddleware


async def main() -> None:
    logging.basicConfig(level=logging.INFO)

    bot = Bot(token=settings.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher(storage=MemoryStorage())

    dp.update.middleware(AuthMiddleware())
    dp.message.middleware(ThrottlingMiddleware())

    dp.include_router(start.router)
    dp.include_router(catalog.router)
    dp.include_router(cart.router)
    dp.include_router(order.router)
    dp.include_router(admin.router)
    dp.include_router(payment.router)

    await bot.delete_webhook(drop_pending_updates=True)
    print("Bot ishga tushdi (polling mode)...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
