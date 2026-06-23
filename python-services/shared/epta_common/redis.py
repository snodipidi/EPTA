"""Async-клиент Redis (общий кэш/координация). Тонкая обёртка над redis-py.

Примечание: импорт ``from redis.asyncio import ...`` ссылается на установленный пакет
``redis`` (абсолютный импорт), а не на этот модуль ``epta_common.redis``.
"""

from __future__ import annotations

from redis.asyncio import Redis, from_url


def create_redis(url: str) -> Redis:
    """Создаёт клиент Redis. Соединение ленивое — устанавливается при первой команде."""
    return from_url(url, encoding="utf-8", decode_responses=True)


async def ping(client: Redis) -> bool:
    """Проверка доступности Redis (используется в /health)."""
    return bool(await client.ping())
