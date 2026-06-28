"""Фабрика FastAPI-приложения для Python-сервисов EPTA.

Даёт каждому сервису одинаковую обвязку:
  * lifespan, который поднимает async-движок БД и клиент Redis и кладёт их в
    ``app.state`` (engine / sessionmaker / redis), а на остановке аккуратно закрывает;
  * health-эндпоинты: ``/health/live`` (liveness) и ``/health`` (readiness: db + redis);
  * единый конверт ошибок ``{ statusCode, error, message }`` — как у backend.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import db as db_mod
from . import redis as redis_mod
from .logging import configure_logging
from .settings import Settings, get_settings

# Хук, вызываемый на старте после создания engine/redis (например, создать схему)
# или поднять фоновую задачу — и симметричный ему хук остановки (закрыть ресурсы).
StartupHook = Callable[[FastAPI, Settings], Awaitable[None]]
ShutdownHook = Callable[[FastAPI, Settings], Awaitable[None]]


def create_app(
    *,
    title: str,
    with_db: bool = True,
    with_redis: bool = True,
    on_startup: StartupHook | None = None,
    on_shutdown: ShutdownHook | None = None,
) -> FastAPI:
    """Собирает FastAPI-приложение с общей инфраструктурой EPTA."""
    settings = get_settings()
    configure_logging(settings.log_level)
    log = logging.getLogger(settings.service_name)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if with_db:
            app.state.engine = db_mod.create_engine(
                settings.database_url,
                pool_size=settings.db_pool_size,
                max_overflow=settings.db_pool_max_overflow,
            )
            app.state.sessionmaker = db_mod.create_session_factory(app.state.engine)
        if with_redis:
            app.state.redis = redis_mod.create_redis(settings.redis_url)
        if on_startup is not None:
            await on_startup(app, settings)
        log.info("%s started", title)
        try:
            yield
        finally:
            # Хук остановки вызывается ДО закрытия engine/redis — чтобы фоновые
            # задачи успели корректно завершиться, пока инфраструктура ещё жива.
            if on_shutdown is not None:
                await on_shutdown(app, settings)
            if with_redis and getattr(app.state, "redis", None) is not None:
                await app.state.redis.aclose()
            if with_db and getattr(app.state, "engine", None) is not None:
                await app.state.engine.dispose()
            log.info("%s stopped", title)

    app = FastAPI(title=title, lifespan=lifespan)

    @app.exception_handler(StarletteHTTPException)
    async def _http_exc(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Конверт ошибки в том же виде, что отдаёт backend (AllExceptionsFilter).
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "statusCode": exc.status_code,
                "error": exc.detail,
                "message": exc.detail,
            },
        )

    @app.get("/health/live", tags=["health"])
    async def live() -> dict[str, str]:
        """Liveness — процесс жив. Не зависит от БД/Redis."""
        return {"status": "ok"}

    @app.get("/health", tags=["health"])
    async def ready() -> JSONResponse:
        """Readiness — проверяет доступность БД и Redis."""
        checks: dict[str, str] = {}
        ok = True
        if with_db:
            try:
                await db_mod.ping(app.state.engine)
                checks["db"] = "up"
            except Exception:  # noqa: BLE001 — health не должен падать, только сообщать
                checks["db"] = "down"
                ok = False
        if with_redis:
            try:
                await redis_mod.ping(app.state.redis)
                checks["redis"] = "up"
            except Exception:  # noqa: BLE001
                checks["redis"] = "down"
                ok = False
        body = {"status": "ok" if ok else "degraded", **checks}
        return JSONResponse(status_code=200 if ok else 503, content=body)

    return app
