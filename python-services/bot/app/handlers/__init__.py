"""Роутеры aiogram с обработчиками апдейтов.

Каркас: здесь собираются все роутеры бота. Сейчас подключён только ``base`` —
пустой роутер-заготовка без команд (логику авторизации и команды пишут поверх,
добавляя новые модули-роутеры рядом и включая их в ``get_routers``).
"""

from __future__ import annotations

from aiogram import Router

from .base import router as base_router


def get_routers() -> list[Router]:
    """Список роутеров для подключения к диспетчеру (порядок = приоритет).

    Добавляя новую группу обработчиков, создай модуль рядом (например
    ``handlers/auth.py`` с ``router = Router()``) и верни его здесь.
    """
    return [base_router]


__all__ = ["get_routers"]
