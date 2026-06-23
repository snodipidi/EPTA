"""Логика модерации.

КАРКАС: всегда возвращает APPROVED (безопасный дефолт — backend оставит контент
видимым). Реальные правила/модель добавляются здесь.
"""

from __future__ import annotations

from fastapi import Request

from .schemas import ModerateRequest, ModerateResponse


async def moderate(req: ModerateRequest, request: Request) -> ModerateResponse:
    # Инфраструктура доступна через request.app.state (engine/sessionmaker/redis).
    #
    # TODO(moderation): реальная логика — например:
    #   • text: словари/regex стоп-слов → позже ML-классификатор токсичности;
    #   • media_urls: проверка NSFW/насилия (внешняя модель);
    #   • вернуть FLAGGED (на ручную проверку) или REJECTED (скрыть) с reason.
    return ModerateResponse(status="APPROVED")
