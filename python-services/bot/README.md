# EPTA bot-service — Telegram-бот (aiogram + pyrogram)

**Каркас** Telegram-бота EPTA. Здесь готова инфраструктура — но обработчиков команд
и логики авторизации намеренно **нет**: их пишут поверх этой основы. Сервис
поднимается, проходит health и корректно гасится даже с пустым окружением.

В отличие от соседних Python-сервисов (recommendation/moderation/search/analytics),
которые работают по схеме «запрос-ответ», бот — **долгоживущий процесс**. Он
оборачивается в ту же FastAPI-обвязку (`epta-common`), чтобы переиспользовать
health, БД/Redis в `app.state`, JSON-логи и единый конверт ошибок и жить в том же
compose-профиле `python`. FastAPI здесь — не ради REST, а ради инфраструктуры и
двух служебных роутов (webhook + внутренний API).

## Что внутри

```
bot/
├── app/
│   ├── config.py          # настройки бота (env): токен, режим, pyrogram, backend
│   ├── main.py            # FastAPI + lifespan: поднимает/гасит бота, роуты webhook/internal
│   ├── schemas.py         # контракт внутреннего API (backend → бот)
│   ├── service.py         # логика внутреннего API (каркас: подтверждает приём)
│   ├── bot/               # ядро aiogram
│   │   ├── factory.py     # сборка Bot/Dispatcher, FSM в Redis, подключение роутеров/middleware
│   │   └── runner.py      # запуск/остановка диспетчера (polling | webhook)
│   ├── handlers/          # роутеры aiogram (каркас: пустой base-роутер)
│   ├── middlewares/       # сквозная обвязка (внедрение зависимостей в хендлеры)
│   ├── userbot/           # pyrogram MTProto-юзербот (опционален, lifecycle-менеджер)
│   └── services/          # backend_client.py — исходящие вызовы к NestJS REST
├── tests/                 # smoke-тесты (liveness, контракт, инварианты конфига)
├── Dockerfile
└── pyproject.toml
```

## Принцип: всё включается через env (graceful degradation)

В духе остального стека EPTA каждая «включающая» переменная по умолчанию **пуста**,
и фича просто выключена:

| Не задано | Поведение |
|---|---|
| `BOT_TOKEN` | aiogram-диспетчер не стартует (в Telegram бот не ходит) |
| `PYROGRAM_API_ID` / `PYROGRAM_API_HASH` | pyrogram-юзербот не поднимается |
| `BACKEND_API_URL` | клиент к backend — no-op (исходящих вызовов нет) |

Поэтому каркас поднимается и тестируется без токена и без живой инфраструктуры.

## Конфигурация (env)

Читает `app/config.py` (расширяет общие `DATABASE_URL`/`REDIS_URL`/`LOG_LEVEL`):

| Env | По умолчанию | Назначение |
|---|---|---|
| `BOT_TOKEN` | `""` | токен Bot API от @BotFather; пусто = бот выключен |
| `BOT_MODE` | `polling` | `polling` (long-polling, фоновая задача) или `webhook` |
| `BOT_WEBHOOK_URL` | `""` | публичный базовый URL для webhook (без пути) |
| `BOT_WEBHOOK_PATH` | `/telegram/webhook` | путь приёма апдейтов |
| `BOT_WEBHOOK_SECRET` | `""` | секрет проверки заголовка Telegram |
| `PYROGRAM_API_ID` | `0` | api_id с my.telegram.org |
| `PYROGRAM_API_HASH` | `""` | api_hash с my.telegram.org |
| `PYROGRAM_SESSION_STRING` | `""` | строковая сессия юзербота (предпочтительно) |
| `BACKEND_API_URL` | `http://backend:3000/api` | базовый URL backend для исходящих вызовов |
| `INTERNAL_API_TOKEN` | `""` | общий секрет для приватных вызовов backend → бот |

## Связь с остальным EPTA (двунаправленная)

- **Бот → backend** (исходящее): `app/services/backend_client.py` — httpx-клиент к
  REST API NestJS. Шлёт обязательный заголовок `X-API-Version: 1` на каждый запрос
  (см. CLAUDE.md §3); `/api`-префикс уже входит в `BACKEND_API_URL`. Пример
  использования (поток авторизации) намечен заглушками с `TODO`.
- **backend → бот** (входящее): `POST /internal/notify` — команда «доставить
  сообщение пользователю». Каркас подтверждает приём (202), реальная отправка —
  `TODO` в `app/service.py`. На стороне NestJS клиента к боту пока нет — контракт
  задаётся этими моделями и согласуется по мере реализации.

## Режимы получения апдейтов

- **polling** (по умолчанию) — `BotRunner` крутит `dp.start_polling` фоновой
  asyncio-задачей внутри процесса FastAPI. Публичный URL не нужен — удобно локально.
- **webhook** — на старте регистрируется webhook в Telegram; апдейты приходят на
  `POST /telegram/webhook` и скармливаются диспетчеру. Нужен доступный
  `BOT_WEBHOOK_URL`; рекомендуется `BOT_WEBHOOK_SECRET`.

## Запуск

### Через Docker (профиль `python`)

Из каталога `frontend/`:

```bash
npm run python:build     # соберёт и поднимет все Python-сервисы, включая bot
npm run python:logs      # логи (в т.ч. bot)
npm run python:stop
```

Напрямую только бот:

```bash
docker compose -p epta -f docker-compose.yml --profile python up -d --build bot
```

Снаружи сервис на `:8005` (health/webhook/internal API), внутри сети — `bot:8000`.
Чтобы бот реально заработал — задай `BOT_TOKEN` в корневом `.env` (см. `.env.example`)
и пересоздай контейнер.

### Локально (без Docker)

Нужен Python 3.12 и [uv](https://docs.astral.sh/uv/):

```bash
cd python-services
uv venv --python 3.12
uv pip install -e ./shared -e "./bot[dev]"
uv run --project bot uvicorn app.main:app --reload --port 8005
uv run --project bot pytest        # smoke-тесты
```

Опциональный ускоритель крипто pyrogram (C-расширение, нужен компилятор):
`uv pip install -e "./bot[fast]"`.

## Проверка

```bash
curl http://localhost:8005/health/live          # {"status":"ok"}
curl http://localhost:8005/health               # readiness: db + redis
curl -X POST http://localhost:8005/internal/notify \
  -H 'content-type: application/json' -d '{"chatId":12345,"text":"привет"}'
# → 202 {"accepted":true}  (каркас подтверждает приём)
```

Swagger — на `/docs`.

## Как наращивать логику

1. **Команды/диалоги** — добавляй роутеры в `app/handlers/` (новый модуль с
   `router = Router()`, верни его из `get_routers`). Зависимости (`settings`,
   позже `backend`/`userbot`) приходят в хендлер из middleware — см.
   `app/middlewares/dependencies.py`.
2. **Авторизация** — реализуй поток поверх каркаса: хендлеры в `handlers/`,
   вызовы к backend через `BackendClient` (методы-ориентиры намечены в
   `backend_client.py`), при необходимости FSM (хранилище уже на Redis).
3. **Возможности сверх Bot API** (вступление в чаты, чтение истории) — через
   pyrogram-юзербот: `app/userbot/manager.py`, клиент в `app.state.userbot`.
4. **Команды от backend** — расширяй внутренний API (`schemas.py` + `service.py`),
   согласуя контракт с NestJS.
5. Тяжёлые зависимости — в `pyproject.toml` бота, не в общий `epta-common`.
