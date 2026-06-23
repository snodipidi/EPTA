"""analytics-service — точка входа (uvicorn app.main:app).

На старте создаёт собственную схему `analytics` и таблицу `events` (идемпотентно),
демонстрируя, что Python владеет своими таблицами отдельно от Prisma/`public`.
"""

from __future__ import annotations

from epta_common.app import create_app
from epta_common.db import ensure_schema
from epta_common.settings import Settings
from fastapi import FastAPI, Request, status

from .models import ANALYTICS_SCHEMA, AnalyticsBase
from .schemas import EventAccepted, EventIn
from .service import ingest


async def _startup(app: FastAPI, _settings: Settings) -> None:
    """Создаёт схему `analytics` и её таблицы (идемпотентно)."""
    engine = app.state.engine
    await ensure_schema(engine, ANALYTICS_SCHEMA)
    async with engine.begin() as conn:
        await conn.run_sync(AnalyticsBase.metadata.create_all)


app = create_app(title="EPTA analytics-service", on_startup=_startup)


@app.post("/events", status_code=status.HTTP_202_ACCEPTED, response_model=EventAccepted)
async def events(body: EventIn, request: Request) -> EventAccepted:
    """Приём события (fire-and-forget). Каркас → 202 Accepted."""
    return await ingest(body, request)
