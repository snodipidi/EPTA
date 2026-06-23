# EPTA — Python micro-services

Каркас Python-стороны EPTA: бизнес-логика, аналитика и всё, в чём Python сильнее
Node. Сейчас здесь **основа** — рабочая инфраструктура и эндпоинты-заглушки, точно
соответствующие контракту, который backend (NestJS) уже умеет вызывать. Реальные
алгоритмы (ML, эвристики, полнотекстовый поиск, агрегаты) добавляются поверх.

```
React + TS  →  NestJS API Gateway  →  PostgreSQL / Redis / S3
                       │
                       ▼  (HTTP, graceful degradation)
              Python micro-services
        ┌────────────┬────────────┬───────────┬───────────┐
        ▼            ▼            ▼           ▼
  recommendation  moderation    search    analytics
```

## Сервисы и контракт

Backend зовёт сервисы напрямую по HTTP (без `X-API-Version`) через
`backend/src/integrations/python/python-service.client.ts`. Если URL сервиса не задан —
вызов превращается в no-op, и монолит работает как раньше.

| Сервис | Внешний порт | Эндпоинт | Запрос | Ответ |
|---|---|---|---|---|
| recommendation | 8001 | `POST /recommendations` | `{ userId, limit }` | `{ postIds: [] }` |
| moderation | 8002 | `POST /moderate` | `{ contentId, contentType, text?, mediaUrls? }` | `{ status: "APPROVED" }` |
| search | 8003 | `POST /search` | `{ query, limit }` | `{ postIds: [] }` |
| analytics | 8004 | `POST /events` | `{ name, userId?, properties? }` | `202` |

Каждый сервис также отдаёт `GET /health/live` (liveness) и `GET /health`
(readiness: проверка БД + Redis), Swagger — на `/docs`.

> Заглушки возвращают **безопасные дефолты**: пустой список / `APPROVED` / `202`.
> Это значит, что включение сервиса не меняет поведение продукта, пока в нём нет
> реальной логики (backend применяет свои фолбэки).

## Структура

```
python-services/
├── shared/                 # пакет epta-common: общая инфраструктура
│   └── epta_common/
│       ├── settings.py     # конфиг из env (pydantic-settings)
│       ├── db.py           # async engine/session, ping, ensure_schema, Base
│       ├── redis.py        # async-клиент Redis
│       ├── logging.py      # JSON-логи в stdout
│       ├── models.py       # read-only модели public (User, Post) — зеркало Prisma
│       └── app.py          # фабрика FastAPI: lifespan, /health, конверт ошибок
├── recommendation/         # FastAPI-сервис (app/ + tests/ + Dockerfile + pyproject)
├── moderation/
├── search/
└── analytics/              # + своя схема `analytics` и таблица events
```

### Доступ к данным

- **Чтение `public`** — через SQLAlchemy 2.0 (async) + asyncpg, read-only модели в
  `epta_common/models.py`. Схемой `public` владеет **backend** (Prisma-миграции);
  Python её не мигрирует.
- **Свои таблицы Python** — в отдельной схеме `analytics`, которую создаёт сам
  analytics-service на старте (`CREATE SCHEMA IF NOT EXISTS` + `create_all`). Так
  Python-таблицы не конфликтуют с миграциями backend.

## Запуск

### Через Docker (рекомендуется)

Сервисы живут за compose-профилем `python`. Из каталога `frontend/`:

```bash
npm run python:build     # собрать и поднять recommendation/moderation/search/analytics
npm run python:logs      # логи всех четырёх
npm run python:stop      # погасить
```

Эквивалент напрямую (из корня репозитория):

```bash
docker compose -p epta -f docker-compose.yml --profile python up -d --build
```

Чтобы backend реально ходил в сервисы — задай URL в корневом `.env`
(см. `.env.example`) и пересоздай backend:

```bash
PY_RECOMMENDATION_URL=http://recommendation:8000
PY_MODERATION_URL=http://moderation:8000
PY_SEARCH_URL=http://search:8000
PY_ANALYTICS_URL=http://analytics:8000
```

Проверка:

```bash
curl http://localhost:8001/health
curl -X POST http://localhost:8001/recommendations -H 'content-type: application/json' -d '{"userId":"u-1","limit":10}'
```

### Локально (без Docker) — для разработки

Нужен Python 3.12 и [uv](https://docs.astral.sh/uv/). На примере recommendation:

```bash
cd python-services
uv venv
uv pip install -e ./shared -e "./recommendation[dev]"
# поднять (нужны доступные postgres+redis из compose-инфры):
uv run --project recommendation uvicorn app.main:app --reload --port 8001
# тесты:
uv run --project recommendation pytest
```

Конфиг берётся из env (`DATABASE_URL`, `REDIS_URL`, `SERVICE_NAME`, `LOG_LEVEL`).
Для локали дефолты в `settings.py` уже указывают на `localhost:5432` / `localhost:6379`.

## Линт и тесты

```bash
ruff check python-services      # линт всего дерева (правила в ruff.toml)
ruff format python-services     # форматирование
# pytest каждого сервиса — см. раздел «Локально»
```

Smoke-тесты проверяют liveness и контракт заглушки без живой БД (lifespan у
`TestClient` не запускается). Readiness (`/health`) проверяется в Docker.

## Как добавлять реальную логику

1. Описать вход/выход в `app/schemas.py` (контракт с backend менять только
   согласованно — клиент на стороне NestJS читает конкретные поля).
2. Реализовать в `app/service.py`, используя инфраструктуру из `request.app.state`
   (`sessionmaker`, `redis`, `engine`) — точки помечены `TODO`.
3. Тяжёлые зависимости (модели, библиотеки ML) добавлять в `pyproject.toml`
   конкретного сервиса, не в общий `epta-common`.
4. Свои таблицы — в отдельной схеме (как `analytics`), не в `public`.
