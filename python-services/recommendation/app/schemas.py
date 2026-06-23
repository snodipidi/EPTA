"""Контракт recommendation-service. Совпадает с тем, что шлёт backend
(``PythonServiceClient.getRecommendedPostIds`` → ``POST /recommendations``)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    user_id: str = Field(alias="userId")
    limit: int = Field(default=20, ge=1, le=100)


class RecommendResponse(BaseModel):
    # backend читает ровно поле `postIds`.
    post_ids: list[str] = Field(default_factory=list, serialization_alias="postIds")
