from __future__ import annotations

from app.config import BotMode, BotSettings


def test_defaults_are_disabled() -> None:
    # Пустое окружение → все «включающие» фичи выключены: каркас поднимается,
    # но в Telegram/backend не ходит (в духе graceful degradation стека EPTA).
    s = BotSettings()
    assert s.bot_enabled is False
    assert s.userbot_enabled is False
    assert s.backend_enabled is False
    assert s.bot_mode is BotMode.POLLING


def test_enabled_flags_react_to_env() -> None:
    s = BotSettings(
        bot_token="123:abc",
        pyrogram_api_id=42,
        pyrogram_api_hash="hash",
        backend_api_url="http://backend:3000/api",
    )
    assert s.bot_enabled is True
    assert s.userbot_enabled is True
    assert s.backend_enabled is True


def test_webhook_mode_parsed() -> None:
    s = BotSettings(bot_mode="webhook")
    assert s.bot_mode is BotMode.WEBHOOK
