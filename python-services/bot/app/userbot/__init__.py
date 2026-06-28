"""Pyrogram MTProto-юзербот — доп. возможности сверх Bot API.

Юзербот (аккаунт пользователя, не бот) нужен там, где Bot API недостаточно:
вступление в чаты, чтение истории, работа от имени пользователя и т.п. Это
ОТДЕЛЬНЫЙ от aiogram клиент со своими кредами (api_id/api_hash, сессия).

Опционален: без pyrogram-кредов менеджер — no-op (как и весь стек EPTA, фича
включается заданием окружения).
"""

from __future__ import annotations

from .manager import UserbotManager

__all__ = ["UserbotManager"]
