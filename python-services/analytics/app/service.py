"""Логика приёма событий.

КАРКАС: эндпоинт принимает событие и подтверждает (202). Запись в БД пока НЕ делается
(чтобы тесты/health не требовали живой БД), но фундамент готов — схема `analytics` и
таблица `events` создаются на старте (см. ``_startup`` в main). Включение записи —
раскомментировать заготовку ниже.
"""

from __future__ import annotations

from fastapi import Request

from .schemas import EventAccepted, EventIn

# from .models import Event  # для реальной записи


async def ingest(event: EventIn, request: Request) -> EventAccepted:
    # TODO(analytics): сохранить событие. Заготовка (раскомментировать):
    #   sessionmaker = request.app.state.sessionmaker
    #   async with sessionmaker() as session:
    #       session.add(Event(name=event.name, user_id=event.user_id,
    #                          properties=event.properties))
    #       await session.commit()
    # Позже поверх `analytics.events` строятся агрегаты (DAU, воронки и т.п.).
    return EventAccepted()
