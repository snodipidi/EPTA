"""Структурная middleware: внедрение общих зависимостей в обработчики.

aiogram передаёт всё, что middleware кладёт в ``data``, как именованные аргументы
обработчика. Каркас прокидывает ``settings``; здесь же — место, куда добавить
``backend`` (BackendClient), ``sessionmaker``/``redis`` и прочие сервисы, чтобы
хендлеры получали их без глобалей.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject

from ..config import BotSettings


class DependenciesMiddleware(BaseMiddleware):
    """Кладёт общие зависимости в ``data`` каждого апдейта."""

    def __init__(self, settings: BotSettings) -> None:
        self._settings = settings

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        data["settings"] = self._settings
        # TODO(bot): пробросить дополнительные зависимости, например:
        #   data["backend"] = ...   # BackendClient из app.state
        #   data["userbot"] = ...   # pyrogram Client, если поднят
        return await handler(event, data)
