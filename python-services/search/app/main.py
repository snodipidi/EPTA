"""search-service — точка входа (uvicorn app.main:app)."""

from __future__ import annotations

from epta_common.app import create_app
from fastapi import Request

from .schemas import SearchRequest, SearchResponse
from .service import search

app = create_app(title="EPTA search-service")


@app.post("/search", response_model=SearchResponse, response_model_by_alias=True)
async def search_endpoint(body: SearchRequest, request: Request) -> SearchResponse:
    """Полнотекстовый/семантический поиск постов. Каркас → пустой список."""
    return await search(body, request)
