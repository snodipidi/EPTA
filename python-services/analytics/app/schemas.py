"""Контракт analytics-service. Совпадает с ``PythonServiceClient.trackEvent``
(``POST /events``, fire-and-forget). Тело — произвольное событие; backend шлёт
как минимум ``{ name, userId?, properties? }``."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class EventIn(BaseModel):
    # Разрешаем лишние поля: события эволюционируют, аналитика не должна их терять.
    model_config = ConfigDict(extra="allow")

    name: str
    user_id: str | None = Field(default=None, alias="userId")
    properties: dict[str, object] = Field(default_factory=dict)


class EventAccepted(BaseModel):
    accepted: bool = True
