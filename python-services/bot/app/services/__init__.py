"""Сервисный слой бота: исходящие интеграции и переиспользуемая логика.

Сейчас здесь ``BackendClient`` — клиент к REST API backend (NestJS). Бизнес-логику
бота (например, поток авторизации) удобно складывать сюда же отдельными модулями,
чтобы обработчики оставались тонкими.
"""

from __future__ import annotations

from .backend_client import BackendClient

__all__ = ["BackendClient"]
