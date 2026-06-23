"""Логика поиска.

КАРКАС: возвращает пустой список (backend получит [] и применит свой фолбэк).
Реальный поиск добавляется здесь.
"""

from __future__ import annotations

from fastapi import Request

from .schemas import SearchRequest, SearchResponse


async def search(req: SearchRequest, request: Request) -> SearchResponse:
    # Инфраструктура доступна через request.app.state (engine/sessionmaker/redis).
    #
    # TODO(search): реальная логика — например:
    #   • Postgres FTS (tsvector/tsquery) по `posts.text`/`hashtags`;
    #   • позже семантика через pgvector + эмбеддинги;
    #   • вернуть post_ids в порядке релевантности.
    return SearchResponse(post_ids=[])
