"""Сборка aiogram ``Bot`` и ``Dispatcher``.

Здесь — единственное место, где собирается граф бота: создаётся клиент Bot API,
к диспетчеру подключаются middleware и роутеры с обработчиками. Сами обработчики
живут в ``app/handlers`` (сейчас — каркасный роутер без команд).

FSM-хранилище — в Redis (общий с остальным стеком), чтобы состояния диалогов
переживали рестарт и масштабировались на несколько реплик бота.
"""

from __future__ import annotations

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.base import BaseStorage
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.fsm.storage.redis import RedisStorage
from redis.asyncio import Redis

from ..config import BotSettings
from ..handlers import get_routers
from ..middlewares import setup_middlewares


def build_bot(settings: BotSettings) -> Bot:
    """Создаёт клиент Telegram Bot API.

    Вызывать только когда ``settings.bot_enabled`` — иначе токен пуст и Bot бесполезен.
    """
    return Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


def _build_storage(redis: Redis | None) -> BaseStorage:
    """FSM-хранилище: Redis, если доступен; иначе in-memory (для тестов/локалки)."""
    if redis is not None:
        return RedisStorage(redis)
    return MemoryStorage()


def build_dispatcher(settings: BotSettings, *, redis: Redis | None = None) -> Dispatcher:
    """Собирает диспетчер: FSM-хранилище, middleware и роутеры обработчиков.

    ``redis`` пробрасывается из ``app.state`` (поднимается общим lifespan). Если он
    недоступен — диспетчер всё равно собирается на in-memory хранилище.
    """
    dp = Dispatcher(storage=_build_storage(redis))

    # Прокидываем настройки в хендлеры через workflow data (доступно как аргумент
    # обработчика ``settings: BotSettings``). Сюда же позже добавляются BackendClient,
    # sessionmaker и т.п. — точки внедрения зависимостей.
    dp["settings"] = settings

    setup_middlewares(dp, settings)
    for router in get_routers():
        dp.include_router(router)

    return dp
