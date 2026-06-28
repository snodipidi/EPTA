"""Ядро aiogram: фабрика Bot/Dispatcher, регистрация роутеров и middleware,
а также runner — запуск/остановка диспетчера в выбранном режиме (polling/webhook).
"""

from __future__ import annotations

from .factory import build_bot, build_dispatcher
from .runner import BotRunner

__all__ = ["BotRunner", "build_bot", "build_dispatcher"]
