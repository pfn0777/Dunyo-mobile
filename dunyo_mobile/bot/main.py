import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web

from dunyo_mobile.config import settings

logger = logging.getLogger(__name__)

# Exposed so payment webhook handlers can send notifications
_bot_instance: Bot | None = None


async def on_startup(bot: Bot) -> None:
    global _bot_instance
    _bot_instance = bot
    await bot.set_webhook(
        url=f"{settings.WEBHOOK_URL}{settings.WEBHOOK_PATH}",
        secret_token=settings.WEBHOOK_SECRET_TOKEN or None,
        drop_pending_updates=True,
    )
    logger.info("Webhook set: %s%s", settings.WEBHOOK_URL, settings.WEBHOOK_PATH)


async def on_shutdown(bot: Bot) -> None:
    await bot.delete_webhook()
    logger.info("Webhook deleted")


def create_dp() -> Dispatcher:
    from dunyo_mobile.bot.handlers import admin, cart, catalog, order, payment, start
    from dunyo_mobile.bot.middlewares.auth import AuthMiddleware
    from dunyo_mobile.bot.middlewares.throttle import ThrottlingMiddleware

    dp = Dispatcher()

    # Middlewares
    dp.update.middleware(AuthMiddleware())
    dp.message.middleware(ThrottlingMiddleware())

    # Routers
    dp.include_router(start.router)
    dp.include_router(catalog.router)
    dp.include_router(cart.router)
    dp.include_router(order.router)
    dp.include_router(admin.router)
    dp.include_router(payment.router)

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)
    return dp


def main() -> None:
    logging.basicConfig(level=logging.INFO)

    bot = Bot(token=settings.BOT_TOKEN, parse_mode=ParseMode.HTML)
    dp = create_dp()

    app = web.Application()
    handler = SimpleRequestHandler(dispatcher=dp, bot=bot)
    handler.register(app, path=settings.WEBHOOK_PATH)
    setup_application(app, dp, bot=bot)

    web.run_app(app, host="0.0.0.0", port=8080)


if __name__ == "__main__":
    main()
