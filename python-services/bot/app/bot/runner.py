"""Runner диспетчера aiogram — запуск и остановка в выбранном режиме.

Инкапсулирует жизненный цикл бота, чтобы ``main.py`` (FastAPI lifespan) не знал
деталей aiogram:

* **polling** — диспетчер крутится фоновой asyncio-задачей внутри процесса FastAPI;
  публичный URL не нужен. Режим по умолчанию, удобен для разработки.
* **webhook** — на старте регистрируется webhook в Telegram; апдейты приходят
  HTTP-ом на ``POST {bot_webhook_path}`` и скармливаются диспетчеру (см. handlers
  вебхука в ``app/main.py``). Нужен доступный из интернета ``bot_webhook_url``.

Runner безопасен к «выключенному» боту: если токен не задан, ``start`` —  no-op,
и health-эндпоинты сервиса всё равно работают.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging

from aiogram import Bot, Dispatcher
from aiogram.types import Update
from redis.asyncio import Redis

from ..config import BotMode, BotSettings
from .factory import build_bot, build_dispatcher

log = logging.getLogger("bot.runner")


class BotRunner:
    """Владеет ``Bot`` и ``Dispatcher`` и управляет их жизненным циклом."""

    def __init__(self, settings: BotSettings, *, redis: Redis | None = None) -> None:
        self._settings = settings
        self._redis = redis
        self.bot: Bot | None = None
        self.dispatcher: Dispatcher | None = None
        self._polling_task: asyncio.Task[None] | None = None

    @property
    def enabled(self) -> bool:
        return self._settings.bot_enabled

    async def start(self) -> None:
        """Поднимает бота согласно режиму. Без токена — тихий no-op."""
        if not self._settings.bot_enabled:
            log.info("bot disabled (BOT_TOKEN пуст) — диспетчер не запускается")
            return

        self.bot = build_bot(self._settings)
        self.dispatcher = build_dispatcher(self._settings, redis=self._redis)

        if self._settings.bot_mode is BotMode.WEBHOOK:
            await self._start_webhook()
        else:
            await self._start_polling()

    async def _start_polling(self) -> None:
        assert self.bot is not None and self.dispatcher is not None
        # На всякий случай снимаем возможный остаточный webhook и копим апдейты заново.
        await self.bot.delete_webhook(drop_pending_updates=False)
        self._polling_task = asyncio.create_task(
            self.dispatcher.start_polling(self.bot, handle_signals=False),
            name="aiogram-polling",
        )
        log.info("bot started in polling mode")

    async def _start_webhook(self) -> None:
        assert self.bot is not None
        if not self._settings.bot_webhook_url:
            log.warning("BOT_MODE=webhook, но BOT_WEBHOOK_URL пуст — webhook не зарегистрирован")
            return
        url = self._settings.bot_webhook_url.rstrip("/") + self._settings.bot_webhook_path
        await self.bot.set_webhook(
            url=url,
            secret_token=self._settings.bot_webhook_secret or None,
            drop_pending_updates=False,
        )
        log.info("bot started in webhook mode: %s", url)

    async def feed_webhook_update(self, update: Update) -> None:
        """Скармливает апдейт из webhook-роута диспетчеру."""
        if self.bot is None or self.dispatcher is None:
            return
        await self.dispatcher.feed_update(self.bot, update)

    async def stop(self) -> None:
        """Корректно останавливает бота: гасит polling/webhook и закрывает сессию."""
        if self._polling_task is not None:
            if self.dispatcher is not None:
                await self.dispatcher.stop_polling()
            self._polling_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._polling_task
            self._polling_task = None
        if self.bot is not None:
            if self._settings.bot_mode is BotMode.WEBHOOK and self._settings.bot_webhook_url:
                with contextlib.suppress(Exception):
                    await self.bot.delete_webhook(drop_pending_updates=False)
            await self.bot.session.close()
        log.info("bot stopped")
