"""Конфигурация bot-сервиса из переменных окружения (pydantic-settings).

Расширяет общий ``epta_common.settings.Settings`` полями, специфичными для бота:
токен, режим получения апдейтов (polling/webhook), креды pyrogram-юзербота и
адрес backend для исходящих вызовов.

Все «секретные» и включающие функции поля по умолчанию ПУСТЫ — это держит сервис
в духе остального стека EPTA: без токена бот не стартует диспетчер, без
pyrogram-кредов юзербот не поднимается, без BACKEND_API_URL клиент к backend — no-op.
Так каркас поднимается и проходит health даже с пустым окружением.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache

from epta_common.settings import Settings as CommonSettings
from pydantic_settings import SettingsConfigDict


class BotMode(StrEnum):
    """Способ получения апдейтов от Telegram."""

    POLLING = "polling"
    WEBHOOK = "webhook"


class BotSettings(CommonSettings):
    """Настройки bot-сервиса (наследуют общие поля DATABASE_URL/REDIS_URL/...)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "bot"

    # ── Telegram Bot API (aiogram) ──
    # Пустой токен = диспетчер не запускается (каркас поднимается, но в Telegram не ходит).
    bot_token: str = ""
    # polling — фоновый long-polling (по умолчанию, не требует публичного URL);
    # webhook — приём апдейтов на POST /telegram/webhook (нужен доступный URL).
    bot_mode: BotMode = BotMode.POLLING

    # ── Webhook (нужно только при bot_mode=webhook) ──
    # Публичный базовый URL, на который Telegram шлёт апдейты (без пути).
    bot_webhook_url: str = ""
    bot_webhook_path: str = "/telegram/webhook"
    # Секрет проверки заголовка X-Telegram-Bot-Api-Secret-Token (рекомендуется в проде).
    bot_webhook_secret: str = ""

    # ── Pyrogram MTProto-юзербот (доп. возможности сверх Bot API) ──
    # api_id/api_hash из my.telegram.org. Пустые = юзербот не поднимается.
    pyrogram_api_id: int = 0
    pyrogram_api_hash: str = ""
    # Строка сессии (session_string). Имя сессии — для файловой сессии как фолбэк.
    pyrogram_session_string: str = ""
    pyrogram_session_name: str = "epta_userbot"

    # ── Исходящие вызовы к backend (NestJS REST) ──
    # Пустой URL = BackendClient в no-op (каркас не требует живого backend).
    # ВНУТРИ compose-сети это http://backend:3000/api.
    backend_api_url: str = ""
    backend_api_version: str = "1"
    # Опциональный общий секрет для внутренних вызовов backend → бот (если включишь).
    internal_api_token: str = ""
    # Таймаут исходящих HTTP-вызовов к backend, секунды.
    backend_timeout_seconds: float = 4.0

    @property
    def bot_enabled(self) -> bool:
        """Есть ли токен — можно ли вообще запускать aiogram-диспетчер."""
        return bool(self.bot_token)

    @property
    def userbot_enabled(self) -> bool:
        """Заданы ли pyrogram-креды — можно ли поднимать юзербот."""
        return bool(self.pyrogram_api_id and self.pyrogram_api_hash)

    @property
    def backend_enabled(self) -> bool:
        """Задан ли адрес backend — пойдут ли исходящие вызовы (иначе no-op)."""
        return bool(self.backend_api_url)


@lru_cache
def get_bot_settings() -> BotSettings:
    """Кэшированный синглтон настроек бота."""
    return BotSettings()
