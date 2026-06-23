"""Доступ к PostgreSQL через SQLAlchemy 2.0 (async) + asyncpg.

Важно: схемой `public` владеет backend через Prisma-миграции. Python работает с ней
**только на чтение** (read-only модели в ``models.py``). Свои таблицы Python создаёт в
ОТДЕЛЬНЫХ схемах (например `analytics`) — см. ``ensure_schema``.
"""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Базовый класс ORM-моделей, зеркалящих таблицы `public` (read-only)."""


# Query-параметры, которые asyncpg-драйвер SQLAlchemy не принимает в DSN.
_DROP_QUERY_KEYS = {"schema", "sslmode"}


def normalize_async_dsn(url: str) -> str:
    """Приводит DSN к async-драйверу asyncpg и убирает несовместимые query-параметры.

    Примеры::

        postgresql://u:p@host/db?schema=public  ->  postgresql+asyncpg://u:p@host/db
        postgres://u:p@host/db                   ->  postgresql+asyncpg://u:p@host/db
    """
    parts = urlsplit(url)
    scheme = parts.scheme
    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+asyncpg"
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if k not in _DROP_QUERY_KEYS])
    return urlunsplit((scheme, parts.netloc, parts.path, query, parts.fragment))


def create_engine(
    url: str,
    *,
    pool_size: int = 5,
    max_overflow: int = 5,
) -> AsyncEngine:
    """Создаёт async-движок. Соединение ленивое — устанавливается при первом запросе."""
    return create_async_engine(
        normalize_async_dsn(url),
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_pre_ping=True,
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Фабрика async-сессий для зависимостей сервисов."""
    return async_sessionmaker(engine, expire_on_commit=False)


async def ping(engine: AsyncEngine) -> bool:
    """Проверка доступности БД (используется в /health)."""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return True


async def ensure_schema(engine: AsyncEngine, name: str) -> None:
    """Создаёт схему, которой владеет Python (идемпотентно). Не трогает `public`/Prisma."""
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{name}"'))
