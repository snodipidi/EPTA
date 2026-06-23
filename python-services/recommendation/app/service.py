"""Бизнес-логика рекомендаций.

КАРКАС: сейчас возвращает пустой список (безопасный дефолт — backend в этом случае
честно падает на свою эвристику, см. `feeds.service.ts`). Инфраструктура (доступ к БД
через sessionmaker, Redis) уже проброшена в ``app.state`` lifespan-ом и готова —
точки расширения помечены TODO.
"""

from __future__ import annotations

from fastapi import Request

from .schemas import RecommendRequest, RecommendResponse


async def recommend(req: RecommendRequest, request: Request) -> RecommendResponse:
    # Инфраструктура, поднятая в lifespan, доступна так (раскомментировать в реальной логике):
    #   sessionmaker = request.app.state.sessionmaker  # async_sessionmaker[AsyncSession]
    #   redis = request.app.state.redis
    #
    # TODO(recommendation): реальная логика — например:
    #   1) собрать сигналы пользователя (подписки, лайки, недавние просмотры) из БД;
    #   2) проранжировать кандидатов (эвристика → позже ML-модель);
    #   3) вернуть post_ids в порядке убывания релевантности.
    # Пока — пустой список: backend применит свою эвристическую выдачу.
    return RecommendResponse(post_ids=[])
