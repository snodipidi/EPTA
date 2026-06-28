# Python-сервисы ЕПТА

Справочник по Python-стороне EPTA: бизнес-логика и аналитика, в которых Python
сильнее Node (рекомендации, модерация, поиск, аналитика). Сейчас это **каркас** —
рабочая инфраструктура и эндпоинты-заглушки, точно соответствующие контракту,
который backend (NestJS) уже умеет вызывать. Реальные алгоритмы наращиваются поверх.

Дополняет: [`python-services/README.md`](../python-services/README.md) (быстрый
старт и локальная разработка) и раздел
[«Интеграции с Python-сервисами»](./ARCHITECTURE.md#интеграции-с-python-сервисами)
в архитектуре backend.

---

## Содержание

- [Состояние и принципы](#состояние-и-принципы)
- [Архитектура и поток данных](#архитектура-и-поток-данных)
- [Контракт эндпоинтов](#контракт-эндпоинтов)
- [Telegram-бот (bot-service)](#telegram-бот-bot-service)
- [Структура каталога](#структура-каталога)
- [Общий пакет `epta-common`](#общий-пакет-epta-common)
- [Доступ к данным](#доступ-к-данным)
- [Конфигурация и окружение](#конфигурация-и-окружение)
- [Запуск](#запуск)
- [Здоровье, линт, тесты](#здоровье-линт-тесты)
- [Как backend вызывает сервисы](#как-backend-вызывает-сервисы)
- [Как добавлять реальную логику](#как-добавлять-реальную-логику)
- [Дорожная карта и вне области](#дорожная-карта-и-вне-области)

---

## Состояние и принципы

- **Сейчас — каркас.** Каждый сервис поднимается, проходит health-чек, читает БД и
  Redis, отдаёт Swagger и обрабатывает запрос — но возвращает **безопасный дефолт**
  (пустой список / `APPROVED` / `202`), а не результат реального алгоритма.
- **Опциональность.** Backend ходит в сервис, только если задан его `PY_*_URL`.
  Если переменная пуста — вызов превращается в no-op, и продукт работает как раньше
  (применяются собственные фолбэки backend). «Включение» сервиса = установка env.
- **Graceful degradation.** Все вызовы со стороны backend ограничены по времени
  (`PY_SERVICE_TIMEOUT_MS`, по умолчанию 4с): медленный/упавший сервис деградирует
  к фолбэку, а не вешает запрос.
- **Стек.** Python 3.12 · FastAPI · uvicorn · Pydantic v2 · SQLAlchemy 2.0 (async)
  + asyncpg · redis-py (async) · ruff · pytest. Пакетный менеджер — `uv`.

---

## Архитектура и поток данных

```
React + TS  →  NestJS API Gateway  →  PostgreSQL / Redis / S3
                       │
                       ▼  HTTP (X-API-Version НЕ нужен), таймаут, graceful no-op
              Python micro-services (FastAPI)
        ┌────────────┬────────────┬───────────┬───────────┐
        ▼            ▼            ▼           ▼
  recommendation  moderation    search    analytics
        │            │            │           │
        └────────────┴─────┬──────┴───────────┘
                           ▼
              PostgreSQL (public — read-only;
                          analytics — своя схема)  +  Redis
```

Интеграция идёт **двумя путями** (оба уже реализованы на стороне backend):

1. **Синхронно по HTTP** — когда результат нужен прямо в ответе. Пример:
   `feeds.service.ts → PythonServiceClient.getRecommendedPostIds()` зовёт
   `POST /recommendations`; если сервис недоступен/выключен — backend применяет
   собственную эвристическую ленту.

2. **Асинхронно через очередь** — для фоновой/тяжёлой работы. Backend кладёт job в
   BullMQ-очередь `python-integration`; её потребляет **сам NestJS**
   (`queues/processors/python.processor.ts`) и уже оттуда зовёт Python по HTTP.
   Так модерация и аналитика не блокируют пользовательский запрос.

   | Job (`PYTHON_JOB`) | Кто кладёт | Что делает процессор |
   |---|---|---|
   | `moderate-content` | `posts.service.ts`, `media.processor.ts` | зовёт `POST /moderate`, пишет вердикт в `Post/Comment/MediaAsset.moderationStatus` |
   | `track-analytics-event` | `posts.service.ts` | зовёт `POST /events` (fire-and-forget, 1 попытка) |
   | `reindex-search` | — (зарезервировано) | переиндексация в search-сервисе |

> Важно: Python-сервисы — это **HTTP-серверы**. Очередь BullMQ потребляет NestJS, а
> не Python. Поэтому для подключения нового сценария достаточно реализовать
> HTTP-эндпоинт по контракту ниже.

---

## Контракт эндпоинтов

Backend обращается к сервисам напрямую по HTTP через
`backend/src/integrations/python/python-service.client.ts`. Заголовок версии
(`X-API-Version`) здесь **не нужен** — он только для публичного API NestJS.

| Сервис | Внешний порт | Эндпоинт | Запрос (JSON) | Ответ-заглушка |
|---|---|---|---|---|
| recommendation | 8001 | `POST /recommendations` | `{ "userId": str, "limit": int }` | `{ "postIds": [] }` |
| moderation | 8002 | `POST /moderate` | `{ "contentId": str, "contentType": "post"\|"comment"\|"media", "text"?: str, "mediaUrls"?: str[] }` | `{ "status": "APPROVED" }` |
| search | 8003 | `POST /search` | `{ "query": str, "limit": int }` | `{ "postIds": [] }` |
| analytics | 8004 | `POST /events` | `{ "name": str, "userId"?: str, "properties"?: object }` | `202 Accepted` |

Поля ответа фиксированы тем, что **читает клиент на стороне NestJS**:

- `recommendation` / `search` — клиент берёт ровно поле `postIds` (массив id постов
  в порядке релевантности; пустой массив → backend применит свой фолбэк).
- `moderation` — `status` обязан совпадать со значениями enum `ModerationStatus`
  из Prisma (`APPROVED` / `FLAGGED` / `REJECTED`), опционально `reason`.
- `analytics` — тело ответа игнорируется (fire-and-forget), важен только код 2xx.

Менять контракт можно **только согласованно** с
`python-service.client.ts` — иначе backend перестанет читать ответ.

Каждый сервис дополнительно отдаёт `GET /health/live`, `GET /health` и Swagger на
`/docs` (см. [«Здоровье, линт, тесты»](#здоровье-линт-тесты)).

---

## Telegram-бот (bot-service)

`bot` (внешний порт **8005**) стоит особняком от четырёх сервисов выше: это не
«запрос-ответ», а **долгоживущий процесс** — Telegram-бот на **aiogram** (Bot API) +
опциональном **pyrogram** (MTProto-юзербот). Он живёт в том же compose-профиле
`python` и переиспользует обвязку `epta-common` (health, БД/Redis в `app.state`,
JSON-логи, конверт ошибок), но FastAPI здесь нужен ради инфраструктуры и двух
служебных роутов, а не публичного REST.

**Состояние — каркас.** Инфраструктура бота готова и поднимается, но обработчиков
команд и логики авторизации намеренно нет (их пишут поверх). Полный справочник —
[`python-services/bot/README.md`](../python-services/bot/README.md).

**Всё включается через env (как и интеграции backend).** Каждая «включающая»
переменная по умолчанию пуста, и фича выключена:

| Не задано | Поведение |
|---|---|
| `BOT_TOKEN` | aiogram-диспетчер не стартует (в Telegram бот не ходит) |
| `PYROGRAM_API_ID` / `PYROGRAM_API_HASH` | pyrogram-юзербот не поднимается |
| `BACKEND_API_URL` | клиент к backend — no-op |

Поэтому каркас поднимается и тестируется без токена и без живой инфраструктуры.

**Режимы получения апдейтов** (env `BOT_MODE`):

- `polling` (по умолчанию) — диспетчер крутится фоновой asyncio-задачей внутри
  процесса; публичный URL не нужен.
- `webhook` — на старте регистрируется webhook; апдейты приходят на
  `POST /telegram/webhook` (нужен доступный `BOT_WEBHOOK_URL`, рекомендуется
  `BOT_WEBHOOK_SECRET`).

**Связь с остальным EPTA — двунаправленная** (обе стороны на стороне бота — каркас):

| Направление | Точка | Что это |
|---|---|---|
| бот → backend | `app/services/backend_client.py` | httpx-клиент к REST API NestJS; шлёт обязательный `X-API-Version: 1` (см. [грабли §3 CLAUDE.md](../CLAUDE.md)). Методы под эндпоинты авторизации намечены `TODO`. |
| backend → бот | `POST /internal/notify` | команда «доставить сообщение пользователю». Каркас подтверждает приём (`202 { accepted: true }`), реальная отправка — `TODO`. Клиента к боту на стороне NestJS пока нет — контракт задаётся моделями бота и согласуется по мере реализации. |

> В отличие от четырёх сервисов выше, у бота нет фиксированного контракта с уже
> существующим клиентом NestJS — backend пока не знает о боте. Поэтому формы запросов
> здесь — заготовки, которые согласуются при реализации, а не «нерушимый» контракт.

---

## Структура каталога

```
python-services/
├── README.md               # быстрый старт и локальная разработка
├── ruff.toml               # единые правила линта/формата для всего дерева
├── shared/                 # пакет epta-common: общая инфраструктура
│   └── epta_common/
│       ├── settings.py     # конфиг из env (pydantic-settings)
│       ├── db.py           # async engine/session, ping, ensure_schema, Base, нормализация DSN
│       ├── redis.py        # async-клиент Redis
│       ├── logging.py      # JSON-логи в stdout
│       ├── models.py       # read-only модели public (User, Post) — зеркало Prisma
│       └── app.py          # фабрика FastAPI: lifespan, /health, конверт ошибок
├── recommendation/         # FastAPI-сервис (app/ + tests/ + Dockerfile + pyproject)
├── moderation/
├── search/
├── analytics/              # + своя схема `analytics` и таблица `events`
└── bot/                    # Telegram-бот (aiogram+pyrogram), долгоживущий процесс
```

Четыре «запрос-ответ»-сервиса устроены одинаково: `app/main.py` (эндпоинт + сборка
приложения через `create_app`), `app/schemas.py` (Pydantic-контракт),
`app/service.py` (логика — сейчас заглушка с пометками `TODO`), `tests/`
(smoke-тесты), `Dockerfile`, `pyproject.toml` (зависит от `epta-common` по
относительному пути).

`bot/` богаче из-за природы бота: к этому набору добавлены `app/config.py`
(настройки бота поверх общих), `app/bot/` (ядро aiogram: `factory` + `runner`),
`app/handlers/` (роутеры), `app/middlewares/` (внедрение зависимостей),
`app/userbot/` (pyrogram-менеджер) и `app/services/` (клиент к backend). Подробно —
в [`bot/README.md`](../python-services/bot/README.md).

---

## Общий пакет `epta-common`

Даёт всем сервисам одинаковую обвязку, чтобы не дублировать инфраструктуру:

| Модуль | Назначение |
|---|---|
| `settings.py` | `Settings(BaseSettings)` — конфиг из env (`SERVICE_NAME`, `DATABASE_URL`, `REDIS_URL`, `LOG_LEVEL`, размеры пула). Кэш через `get_settings()`. |
| `db.py` | `create_engine` / `create_session_factory` (SQLAlchemy 2.0 async), `ping`, `ensure_schema`, `Base`. `normalize_async_dsn` приводит «призмовый» `postgresql://…?schema=public` к `postgresql+asyncpg://…`. |
| `redis.py` | `create_redis` / `ping` (redis-py asyncio). |
| `logging.py` | Структурный JSON-лог в stdout (удобно для Docker/агрегаторов). |
| `models.py` | Read-only ORM-модели `public` (`User`, `Post`) с точными `@map`-именами колонок — примеры для рекомендаций/поиска. |
| `app.py` | `create_app(...)` — lifespan (поднимает engine/sessionmaker/redis в `app.state`, корректно закрывает), health-эндпоинты, единый конверт ошибок `{ statusCode, error, message }` (как у `AllExceptionsFilter` backend). |

---

## Доступ к данным

- **Чтение `public`.** SQLAlchemy 2.0 (async) + asyncpg, read-only модели в
  `epta_common/models.py`. Схемой `public` владеет **backend** (Prisma-миграции) —
  Python её **не мигрирует**. Добавляя новую read-модель, повторяй имена колонок из
  `backend/prisma/schema.prisma` (`@map`).
- **Свои таблицы Python.** Создаются в **отдельной схеме** (`analytics`), чтобы не
  конфликтовать с Prisma. `analytics`-сервис на старте делает
  `CREATE SCHEMA IF NOT EXISTS analytics` + `create_all` для своей `MetaData`
  (см. `analytics/app/models.py`, класс `Event`). Это эталон для будущих
  Python-владеемых таблиц: своя схема, своя декларативная база, идемпотентное
  создание на старте.

> В режиме каркаса `analytics`-сервис **принимает** события (`202`), но запись в БД
> пока выключена (заготовка помечена `TODO` в `analytics/app/service.py`) — чтобы
> тесты и health не требовали живой БД. Схема и таблица при этом уже создаются.

---

## Конфигурация и окружение

**Переменные сервиса** (читает `epta_common/settings.py`):

| Env | По умолчанию | Назначение |
|---|---|---|
| `SERVICE_NAME` | `epta-python-service` | имя сервиса в логах |
| `DATABASE_URL` | `postgresql+asyncpg://epta:…@localhost:5432/epta` | строка БД (async-форма; принимается и «призмовая») |
| `REDIS_URL` | `redis://localhost:6379` | строка Redis |
| `LOG_LEVEL` | `INFO` | уровень логирования |

В `docker-compose.yml` эти значения проставлены для каждого сервиса (БД/Redis —
по именам сервисов `postgres`/`redis` в compose-сети).

**Переменные bot-сервиса** (поверх общих; читает `bot/app/config.py`): `BOT_TOKEN`,
`BOT_MODE`, `BOT_WEBHOOK_URL`/`BOT_WEBHOOK_SECRET`, `PYROGRAM_API_ID`/
`PYROGRAM_API_HASH`/`PYROGRAM_SESSION_STRING`, `BACKEND_API_URL`,
`INTERNAL_API_TOKEN`. Все «включающие» по умолчанию пусты — полный список и смысл в
[`bot/README.md`](../python-services/bot/README.md), шаблон — в корневом
[`.env.example`](../.env.example).

**Переменные backend** (включают интеграцию; читает `backend/src/config/configuration.ts`):

| Env | Назначение |
|---|---|
| `PY_RECOMMENDATION_URL` | базовый URL recommendation-сервиса (напр. `http://recommendation:8000`) |
| `PY_MODERATION_URL` | базовый URL moderation-сервиса |
| `PY_SEARCH_URL` | базовый URL search-сервиса |
| `PY_ANALYTICS_URL` | базовый URL analytics-сервиса |
| `PY_SERVICE_TIMEOUT_MS` | таймаут вызова, по умолчанию `4000` |

По умолчанию `PY_*_URL` **пусты** — backend не ходит в Python (no-op, без
таймаутов). Шаблон включения — в корневом [`.env.example`](../.env.example).

---

## Запуск

### Через Docker (профиль `python`)

Из каталога `frontend/` (скрипты пиннят `-p epta -f ../docker-compose.yml`):

```bash
npm run python:build     # собрать и поднять все сервисы (порты 8001..8004 + bot на 8005)
npm run python:logs      # логи всех (включая bot)
npm run python:stop      # погасить
```

Эквивалент напрямую из корня репозитория:

```bash
docker compose -p epta -f docker-compose.yml --profile python up -d --build
```

Чтобы backend реально ходил в сервисы — задай `PY_*_URL` в корневом `.env` и
пересоздай backend:

```bash
PY_RECOMMENDATION_URL=http://recommendation:8000
PY_MODERATION_URL=http://moderation:8000
PY_SEARCH_URL=http://search:8000
PY_ANALYTICS_URL=http://analytics:8000
```

Проверка:

```bash
curl http://localhost:8001/health
curl -X POST http://localhost:8001/recommendations \
  -H 'content-type: application/json' -d '{"userId":"u-1","limit":10}'
# → {"postIds":[]}
```

### Локально (без Docker)

Нужен Python 3.12 и [uv](https://docs.astral.sh/uv/). Пример для recommendation:

```bash
cd python-services
uv venv --python 3.12
uv pip install -e ./shared -e "./recommendation[dev]"
uv run --project recommendation uvicorn app.main:app --reload --port 8001
```

Дефолты в `settings.py` указывают на `localhost:5432` / `localhost:6379` —
подойдёт инфраструктура из `npm run backend` (postgres + redis в Docker).

---

## Здоровье, линт, тесты

- **Health:** `GET /health/live` — liveness (процесс жив, без БД/Redis);
  `GET /health` — readiness (пингует БД и Redis, `503` при недоступности).
  Docker-healthcheck каждого сервиса дёргает `/health/live`.
- **Swagger:** `GET /docs` у каждого сервиса.
- **Линт/формат** (правила в `python-services/ruff.toml`):

  ```bash
  uvx ruff check python-services
  uvx ruff format python-services
  ```

- **Тесты:** smoke-тесты на сервис проверяют liveness и контракт заглушки без
  живой БД (lifespan у `TestClient` не запускается). Запуск — из каталога сервиса:

  ```bash
  cd python-services/recommendation && uv run pytest
  ```

  Readiness (`/health`) и запись в БД проверяются на поднятом стеке (Docker).

---

## Как backend вызывает сервисы

Клиент `PythonServiceClient` (`backend/src/integrations/python/`) — единая точка
исходящих вызовов, со встроенной деградацией:

| Метод клиента | Эндпоинт | Точка вызова в backend | Поведение при выключенном/недоступном сервисе |
|---|---|---|---|
| `getRecommendedPostIds()` | `POST /recommendations` | `feeds.service.ts` (`recommended`) | `null` → эвристическая лента backend |
| `moderate()` | `POST /moderate` | `python.processor.ts`, `media.processor.ts` | `null` → статус контента не меняется |
| `search()` | `POST /search` | (пока нет call-site) | `[]` |
| `trackEvent()` | `POST /events` | `python.processor.ts` (из `posts.service.ts`) | тихий no-op |

Подробнее о слое интеграции и очередях — в
[`docs/ARCHITECTURE.md`](./ARCHITECTURE.md#интеграции-с-python-сервисами).

---

## Как добавлять реальную логику

1. Описать вход/выход в `app/schemas.py`. Контракт с backend менять **только**
   согласованно (клиент NestJS читает конкретные поля — см. таблицу контракта).
2. Реализовать в `app/service.py`, используя инфраструктуру из `request.app.state`
   (`sessionmaker`, `redis`, `engine`) — точки расширения помечены `TODO`.
3. Тяжёлые зависимости (ML-библиотеки, модели) добавлять в `pyproject.toml`
   **конкретного** сервиса, не в общий `epta-common`.
4. Свои таблицы — в отдельной схеме (как `analytics`), не в `public`.
5. Дописать тест на новый контракт/поведение рядом, в `tests/`.

---

## Дорожная карта и вне области

Сейчас намеренно **не** делается (следующие этапы):

- Реальные алгоритмы: рекомендации (эвристики → ML), модерация (правила → модель
  токсичности/NSFW), поиск (Postgres FTS → pgvector + эмбеддинги), агрегаты
  аналитики (DAU, воронки) поверх `analytics.events`.
- Привязка search к backend (эндпоинт `POST /search` готов, но call-site на стороне
  NestJS ещё не подключён).
- Потребление Python-ом очередей BullMQ напрямую (сейчас контракт — HTTP, этого
  достаточно; очередь потребляет NestJS).
- Разнесение сервисов по разным образам уже сделано — каждый имеет свой `Dockerfile`
  и контейнер; общий код переиспользуется через пакет `epta-common`.
