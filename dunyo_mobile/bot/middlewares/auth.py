import logging
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Update

from dunyo_mobile.db.models.user import User
from dunyo_mobile.db.session import get_session

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseMiddleware):
    """Ensure every user is registered in the database."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        from_user = None

        if isinstance(event, Update):
            if event.message:
                from_user = event.message.from_user
            elif event.callback_query:
                from_user = event.callback_query.from_user

        if from_user and not from_user.is_bot:
            try:
                async with get_session() as session:
                    user = await session.get(User, from_user.id)
                    if user is None:
                        user = User(
                            id=from_user.id,
                            username=from_user.username,
                            full_name=from_user.full_name or from_user.first_name,
                        )
                        session.add(user)
                    else:
                        # Keep name/username in sync
                        user.username = from_user.username
                        user.full_name = from_user.full_name or from_user.first_name
            except Exception as e:
                logger.error("AuthMiddleware DB error: %s", e)

        return await handler(event, data)
