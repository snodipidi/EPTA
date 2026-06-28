"""Middleware aiogram: сквозная обвязка для всех апдейтов.

Каркас подключает одну структурную middleware (``DependenciesMiddleware``),
которая внедряет общие зависимости в обработчики. Сюда же добавляются троттлинг,
логирование, проверка прав и т.п.
"""

from __future__ import annotations

from aiogram import Dispatcher

from ..config import BotSettings
from .dependencies import DependenciesMiddleware


def setup_middlewares(dp: Dispatcher, settings: BotSettings) -> None:
    """Регистрирует middleware на уровне сообщений и колбэков.

    Порядок регистрации = порядок выполнения (внешние раньше внутренних).
    """
    deps = DependenciesMiddleware(settings)
    dp.message.middleware(deps)
    dp.callback_query.middleware(deps)


__all__ = ["DependenciesMiddleware", "setup_middlewares"]
