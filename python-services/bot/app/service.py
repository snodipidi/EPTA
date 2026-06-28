"""Логика внутреннего API бота (направление «backend → бот»).

КАРКАС: эндпоинт принимает команду и подтверждает приём (``accepted: true``), но
реальную отправку в Telegram не делает — точка расширения помечена ``TODO``.
Так каркас и тесты не требуют живого бота/токена.
"""

from __future__ import annotations

import logging

from fastapi import Request

from .schemas import NotifyRequest, NotifyResponse

log = logging.getLogger("bot.service")


async def notify(req: NotifyRequest, request: Request) -> NotifyResponse:
    """Принимает команду доставки от backend. Каркас → подтверждает приём."""
    runner = getattr(request.app.state, "bot_runner", None)
    # TODO(bot): реальная отправка, когда бот включён:
    #   if runner is not None and runner.bot is not None:
    #       await runner.bot.send_message(req.chat_id, req.text, parse_mode=req.parse_mode)
    if runner is None or not getattr(runner, "enabled", False):
        log.info("notify принят, но бот выключен — сообщение не отправлено (каркас)")
    return NotifyResponse()
