import logging
import time
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import Message, TelegramObject

logger = logging.getLogger(__name__)

_last_call: dict[int, float] = {}
RATE_LIMIT = 1.0  # seconds between allowed messages per user


class ThrottlingMiddleware(BaseMiddleware):
    """Allow at most 1 message per second per user."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        if isinstance(event, Message) and event.from_user:
            user_id = event.from_user.id
            now = time.monotonic()
            last = _last_call.get(user_id, 0.0)
            if now - last < RATE_LIMIT:
                logger.debug("Throttled user %s", user_id)
                return None
            _last_call[user_id] = now

        return await handler(event, data)
