"""Контракт moderation-service. Совпадает с ``PythonServiceClient.moderate``
(``POST /moderate``) и enum ``ModerationStatus`` в Prisma-схеме backend."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ContentType = Literal["post", "comment", "media"]
# Должно совпадать с prisma enum ModerationStatus (значимые для записи вердикты).
Verdict = Literal["APPROVED", "FLAGGED", "REJECTED"]


class ModerateRequest(BaseModel):
    content_id: str = Field(alias="contentId")
    content_type: ContentType = Field(alias="contentType")
    text: str | None = None
    media_urls: list[str] | None = Field(default=None, alias="mediaUrls")


class ModerateResponse(BaseModel):
    status: Verdict
    reason: str | None = None
