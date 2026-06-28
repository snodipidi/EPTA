"""Pydantic-контракты внутреннего HTTP-API бота (направление «backend → бот»).

Это вход для команд от backend (NestJS): «отправь пользователю сообщение/код» и т.п.
Контракт каркасный и согласуется с backend по мере реализации (на стороне NestJS
своего клиента к боту пока нет — эти модели задают форму будущего контракта).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class NotifyRequest(BaseModel):
    """Запрос backend «доставить сообщение в Telegram»."""

    # Telegram chat id получателя (для пользователя обычно = его telegram user id).
    chat_id: int = Field(alias="chatId")
    text: str
    # Опциональный режим разбора (HTML/Markdown) — по умолчанию берётся из бота.
    parse_mode: str | None = Field(default=None, alias="parseMode")


class NotifyResponse(BaseModel):
    """Ответ на запрос доставки."""

    # Каркас подтверждает приём, не доставку (реальная отправка — TODO в service).
    accepted: bool = True
