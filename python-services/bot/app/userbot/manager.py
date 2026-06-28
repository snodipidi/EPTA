"""Менеджер жизненного цикла pyrogram-клиента (юзербота).

Оборачивает ``pyrogram.Client``: создаёт его из кредов в настройках, поднимает на
старте сервиса и аккуратно гасит на остановке. Если креды не заданы
(``userbot_enabled == False``) — все операции no-op, ``client`` остаётся ``None``.

Сессия предпочтительно строковая (``PYROGRAM_SESSION_STRING``), чтобы не зависеть
от файла на диске; как фолбэк — именованная файловая сессия.
"""

from __future__ import annotations

import logging

from ..config import BotSettings

log = logging.getLogger("bot.userbot")

# Импорт pyrogram отложен внутрь методов: пакет тяжёлый и нужен только при включённом
# юзерботе — каркас и тесты не должны падать, если он не установлен/не настроен.


class UserbotManager:
    """Владеет опциональным pyrogram-клиентом и его жизненным циклом."""

    def __init__(self, settings: BotSettings) -> None:
        self._settings = settings
        self.client: object | None = None  # pyrogram.Client | None

    @property
    def enabled(self) -> bool:
        return self._settings.userbot_enabled

    async def start(self) -> None:
        """Поднимает юзербот, если заданы pyrogram-креды. Иначе — тихий no-op."""
        if not self._settings.userbot_enabled:
            log.info("userbot disabled (PYROGRAM_API_ID/HASH не заданы)")
            return

        from pyrogram import Client  # отложенный импорт тяжёлой зависимости

        # Строковая сессия предпочтительнее файловой (stateless-контейнеры).
        kwargs: dict[str, object] = {
            "api_id": self._settings.pyrogram_api_id,
            "api_hash": self._settings.pyrogram_api_hash,
        }
        if self._settings.pyrogram_session_string:
            kwargs["session_string"] = self._settings.pyrogram_session_string
            name = self._settings.pyrogram_session_name
        else:
            name = self._settings.pyrogram_session_name
            log.warning(
                "PYROGRAM_SESSION_STRING пуст — используется файловая сессия %r "
                "(потребует интерактивной авторизации при первом старте)",
                name,
            )

        self.client = Client(name, **kwargs)
        await self.client.start()  # type: ignore[attr-defined]
        log.info("userbot started")

    async def stop(self) -> None:
        """Останавливает юзербот, если он был поднят."""
        if self.client is not None:
            await self.client.stop()  # type: ignore[attr-defined]
            self.client = None
            log.info("userbot stopped")
