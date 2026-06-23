"""Контракт search-service. Совпадает с ``PythonServiceClient.search``
(``POST /search`` → ``{ postIds: string[] }``)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str
    limit: int = Field(default=20, ge=1, le=100)


class SearchResponse(BaseModel):
    post_ids: list[str] = Field(default_factory=list, serialization_alias="postIds")
