"""recommendation-service — точка входа (uvicorn app.main:app)."""

from __future__ import annotations

from epta_common.app import create_app
from fastapi import Request

from .schemas import RecommendRequest, RecommendResponse
from .service import recommend

app = create_app(title="EPTA recommendation-service")


@app.post("/recommendations", response_model=RecommendResponse, response_model_by_alias=True)
async def recommendations(body: RecommendRequest, request: Request) -> RecommendResponse:
    """Персональная выдача post_ids для пользователя. Каркас → пустой список."""
    return await recommend(body, request)
