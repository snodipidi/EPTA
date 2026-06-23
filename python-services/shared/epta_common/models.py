"""Read-only ORM-модели, зеркалящие таблицы `public` из Prisma-схемы backend.

Это ПРИМЕРЫ нужных Python-сервисам сущностей (рекомендации/поиск читают посты и
пользователей). Имена колонок совпадают с Prisma `@map`. Python НЕ мигрирует эти
таблицы — миграциями владеет backend (`backend/prisma/schema.prisma`).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    """Зеркало таблицы `users` (read-only)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    email: Mapped[str] = mapped_column(String)
    username: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True))


class Post(Base):
    """Зеркало таблицы `posts` (read-only)."""

    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    author_id: Mapped[str] = mapped_column("author_id", UUID(as_uuid=False))
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashtags: Mapped[list[str]] = mapped_column(ARRAY(String))
    moderation_status: Mapped[str] = mapped_column("moderation_status", String)
    likes_count: Mapped[int] = mapped_column("likes_count", Integer)
    comments_count: Mapped[int] = mapped_column("comments_count", Integer)
    published_at: Mapped[datetime] = mapped_column("published_at", DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True))
