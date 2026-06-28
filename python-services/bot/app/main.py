"""bot-service — точка входа (uvicorn app.main:app).

Сервис устроен иначе, чем соседние Python-сервисы EPTA: это не «запрос-ответ», а
долгоживущий Telegram-бот. Поэтому поверх общей фабрики ``create_app`` мы:

  * на старте поднимаем aiogram-бота (polling по умолчанию / webhook), опциональный
    pyrogram-юзербот и (если задан) клиент к backend — всё кладём в ``app.state``;
  * на остановке аккуратно гасим их через симметричный ``on_shutdown``-хук;
  * добавляем два HTTP-роута: webhook от Telegram и внутренний ``/internal/notify``
    для команд backend → бот.

FastAPI-обвязка нужна не ради REST, а чтобы переиспользовать инфраструктуру стека
(health, БД/Redis в ``app.state``, JSON-логи, единый конверт ошибок) и жить в том
же compose-профиле ``python`` рядом с остальными сервисами.
"""

from __future__ import annotations

from epta_common.app import create_app
from epta_common.settings import Settings
from fastapi import FastAPI, Header, HTTPException, Request, status

from .bot import BotRunner
from .config import BotMode, get_bot_settings
from .schemas import NotifyRequest, NotifyResponse
from .service import notify
from .services import BackendClient
from .userbot import UserbotManager

# Настройки бота (расширяют общие). Берём один раз — кэшировано.
bot_settings = get_bot_settings()


async def _startup(app: FastAPI, _settings: Settings) -> None:
    """Поднимает бота, юзербот и backend-клиент, складывает их в ``app.state``."""
    redis = getattr(app.state, "redis", None)

    runner = BotRunner(bot_settings, redis=redis)
    await runner.start()
    app.state.bot_runner = runner

    userbot = UserbotManager(bot_settings)
    await userbot.start()
    app.state.userbot = userbot

    # Может быть None (если BACKEND_API_URL пуст) — вызовы тогда деградируют на месте.
    app.state.backend_client = BackendClient.from_settings(bot_settings)


async def _shutdown(app: FastAPI, _settings: Settings) -> None:
    """Симметричная остановка: гасим бота/юзербот, закрываем backend-клиент."""
    runner: BotRunner | None = getattr(app.state, "bot_runner", None)
    if runner is not None:
        await runner.stop()

    userbot: UserbotManager | None = getattr(app.state, "userbot", None)
    if userbot is not None:
        await userbot.stop()

    backend: BackendClient | None = getattr(app.state, "backend_client", None)
    if backend is not None:
        await backend.aclose()


app = create_app(
    title="EPTA bot-service",
    on_startup=_startup,
    on_shutdown=_shutdown,
)


@app.post(bot_settings.bot_webhook_path, include_in_schema=False)
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, bool]:
    """Приём апдейтов от Telegram (режим webhook).

    В режиме polling этот роут не используется. Секрет проверяется, если задан
    ``BOT_WEBHOOK_SECRET`` — Telegram присылает его в заголовке.
    """
    runner: BotRunner | None = getattr(request.app.state, "bot_runner", None)
    if runner is None or runner.bot is None or bot_settings.bot_mode is not BotMode.WEBHOOK:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="webhook disabled")

    if bot_settings.bot_webhook_secret and (
        x_telegram_bot_api_secret_token != bot_settings.bot_webhook_secret
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="bad secret")

    # Импорт здесь, чтобы каркас/тесты не требовали aiogram-типов на уровне модуля.
    from aiogram.types import Update

    update = Update.model_validate(await request.json())
    await runner.feed_webhook_update(update)
    return {"ok": True}


@app.post(
    "/internal/notify",
    response_model=NotifyResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["internal"],
)
async def internal_notify(body: NotifyRequest, request: Request) -> NotifyResponse:
    """Внутренний API «backend → бот»: доставить сообщение пользователю.

    Каркас подтверждает приём (202), реальная отправка — ``TODO`` в ``service.notify``.
    """
    return await notify(body, request)
