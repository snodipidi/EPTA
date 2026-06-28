"""HTTP-клиент к REST API backend (NestJS) — исходящее направление «бот → backend».

Зачем: бот должен ходить в монолит EPTA (например, в потоке авторизации —
связать Telegram-аккаунт с пользователем, выдать/проверить код). Это единая точка
исходящих вызовов с правильной обвязкой.

Грабли контракта (см. CLAUDE.md §3):
  * backend версионируется заголовком ``X-API-Version`` — клиент шлёт его на КАЖДЫЙ
    запрос, иначе возможен 404;
  * все маршруты под глобальным префиксом ``/api`` — он уже входит в BACKEND_API_URL
    (``http://backend:3000/api``).

Каркас: методы под конкретные эндпоинты намеренно не реализованы — есть общий
``request`` и заглушки-ориентиры с пометками ``TODO``. Без BACKEND_API_URL клиент
не создаётся (см. ``from_settings``) — вызовы в духе стека деградируют в no-op на
стороне вызова.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import BotSettings

log = logging.getLogger("bot.backend")


class BackendClient:
    """Тонкая обёртка над httpx.AsyncClient с заголовками контракта EPTA."""

    def __init__(
        self,
        base_url: str,
        *,
        api_version: str = "1",
        internal_token: str = "",
        timeout: float = 4.0,
    ) -> None:
        headers = {"X-API-Version": api_version}
        # Внутренний токен для приватных backend-маршрутов (если ты их добавишь).
        if internal_token:
            headers["X-Internal-Token"] = internal_token
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers=headers,
            timeout=timeout,
        )

    @classmethod
    def from_settings(cls, settings: BotSettings) -> BackendClient | None:
        """Создаёт клиент, только если задан BACKEND_API_URL. Иначе ``None`` (no-op)."""
        if not settings.backend_enabled:
            log.info("backend client disabled (BACKEND_API_URL пуст)")
            return None
        return cls(
            settings.backend_api_url,
            api_version=settings.backend_api_version,
            internal_token=settings.internal_api_token,
            timeout=settings.backend_timeout_seconds,
        )

    async def request(
        self,
        method: str,
        path: str,
        *,
        json: Any | None = None,
        params: dict[str, Any] | None = None,
    ) -> httpx.Response:
        """Базовый вызов backend. ``path`` — относительный (например ``/auth/me``)."""
        response = await self._client.request(method, path, json=json, params=params)
        response.raise_for_status()
        return response

    # ── Ориентиры под будущие эндпоинты авторизации (реализуются поверх каркаса) ──
    #
    # async def link_telegram(self, telegram_id: int, code: str) -> dict[str, Any]:
    #     """Связать Telegram-аккаунт с пользователем EPTA по коду."""
    #     # TODO(bot): согласовать эндпоинт с backend, затем:
    #     #   resp = await self.request("POST", "/auth/telegram/link",
    #     #                             json={"telegramId": telegram_id, "code": code})
    #     #   return resp.json()
    #     raise NotImplementedError

    async def aclose(self) -> None:
        """Закрывает HTTP-клиент (вызывается на остановке сервиса)."""
        await self._client.aclose()
