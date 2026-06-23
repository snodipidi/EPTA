"""moderation-service — точка входа (uvicorn app.main:app)."""

from __future__ import annotations

from epta_common.app import create_app
from fastapi import Request

from .schemas import ModerateRequest, ModerateResponse
from .service import moderate

app = create_app(title="EPTA moderation-service")


@app.post("/moderate", response_model=ModerateResponse)
async def moderate_endpoint(body: ModerateRequest, request: Request) -> ModerateResponse:
    """Классификация контента. Каркас → APPROVED."""
    return await moderate(body, request)
