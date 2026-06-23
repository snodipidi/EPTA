"""Таблицы, которыми владеет Python (схема `analytics`).

Это НЕ часть Prisma-схемы backend — отдельная схема `analytics`, чтобы Python мог
создавать/мигрировать свои таблицы, не конфликтуя с миграциями backend в `public`.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, MetaData, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Имя схемы, которой владеет analytics-service.
ANALYTICS_SCHEMA = "analytics"


class AnalyticsBase(DeclarativeBase):
    """Отдельная декларативная база со своей MetaData, привязанной к схеме `analytics`.

    Не пересекается с ``epta_common.db.Base`` (та зеркалит `public`)."""

    metadata = MetaData(schema=ANALYTICS_SCHEMA)


class Event(AnalyticsBase):
    """Сырое событие аналитики (источник для последующих агрегаций)."""

    __tablename__ = "events"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String, index=True)
    user_id: Mapped[str | None] = mapped_column("user_id", String, nullable=True, index=True)
    properties: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        "created_at", DateTime(timezone=True), server_default=func.now()
    )
