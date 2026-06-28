"""Базовый роутер-заготовка.

Намеренно пуст: в каркасе нет ни команд, ни логики авторизации — только готовая
точка, куда подключаются обработчики. Пример (НЕ включать в каркас), показывающий
доступные зависимости::

    from aiogram import F
    from aiogram.filters import CommandStart
    from aiogram.types import Message

    from ..config import BotSettings

    @router.message(CommandStart())
    async def start(message: Message, settings: BotSettings) -> None:
        # ``settings`` приходит из workflow data диспетчера (см. factory.build_dispatcher).
        # Здесь же будут доступны BackendClient / sessionmaker, когда их пробросят.
        await message.answer("EPTA bot")

Обработчики авторизации и команды реализуются поверх этого каркаса.
"""

from __future__ import annotations

from aiogram import Router

# Единственный роутер модуля. Обработчики (@router.message(...), @router.callback_query(...))
# добавляются здесь или в соседних модулях-роутерах.
router = Router(name="base")
