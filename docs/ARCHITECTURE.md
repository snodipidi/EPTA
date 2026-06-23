# Архитектура backend ЕПТА

Обзор устройства серверной части: модули, жизненный цикл запроса, сквозная
инфраструктура (guards, interceptors, filters), очереди, WebSocket.

Дополняет [`backend/README.md`](../backend/README.md) (быстрый старт и
архитектурные решения) и [`docs/API.md`](./API.md) (контракт эндпоинтов).

---

## Содержание

- [Технологии](#технологии)
- [Карта модулей](#карта-модулей)
- [Жизненный цикл запроса](#жизненный-цикл-запроса)
- [Сквозная инфраструктура](#сквозная-инфраструктура)
- [Конфигурация и окружение](#конфигурация-и-окружение)
- [Очереди (BullMQ)](#очереди-bullmq)
- [WebSocket](#websocket)
- [Интеграции с Python-сервисами](#интеграции-с-python-сервисами)

---

## Технологии

NestJS 11 · TypeScript · PostgreSQL + Prisma 6 · Redis (ioredis) · BullMQ ·
Socket.IO · JWT (access + refresh с ротацией) · argon2 · class-validator ·
Swagger/OpenAPI · Pino · Helmet · Throttler · Jest · Docker.

Архитектура **feature-first**: каждый домен — отдельный модуль с собственными
controller / service(ами) / dto / типами. Кросс-каттинг вынесен в `common/`.

---

## Карта модулей

```
backend/src/
├── common/         # guards, decorators, filters, interceptors, общие DTO
├── config/         # типизированная конфигурация + валидация env
├── prisma/         # PrismaService (подключение, lifecycle)
├── redis/          # общий ioredis-клиент + cache-хелперы
├── auth/           # регистрация, логин, refresh-ротация, JWT-стратегия
├── users/          # аккаунт, смена пароля, soft-delete, блокировки
├── profiles/       # публичный профиль, приватность, лидерборд («Топы»)
├── posts/          # посты + комментарии (отдельные сервисы)
├── reactions/      # лайки и расширяемые реакции
├── bookmarks/      # закладки
├── follows/        # граф подписок
├── feeds/          # лента подписок, тренды, рекомендации
├── media/          # загрузка + валидация + абстракция хранилища (S3-ready)
├── notifications/  # уведомления (+ real-time через Redis pub/sub)
├── chats/          # личные/групповые чаты + Socket.IO gateway
├── subscriptions/  # тарифы free / pro / vip
├── queues/         # BullMQ: producer + processors
├── integrations/   # PythonServiceClient (recommendation/moderation/...)
├── websocket/      # Redis-adapter для масштабирования Socket.IO
├── health/         # liveness / readiness (Terminus)
└── app.module.ts   # сборка модулей + глобальные провайдеры
```

Связь домена с базой данных — в [DATABASE.md](./DATABASE.md). Перечень
эндпоинтов каждого модуля — в [API.md](./API.md).

---

## Жизненный цикл запроса

`main.ts` поднимает приложение со следующей конфигурацией:

| Шаг | Что делает | Где задано |
|---|---|---|
| Глобальный префикс | `/api` | `main.ts` |
| Версионирование | `VersioningType.HEADER`, заголовок `X-API-Version`, версия по умолчанию `1` | `main.ts` |
| Helmet | базовые security-заголовки | `main.ts` |
| CORS | origin из конфига, методы `GET/POST/PATCH/PUT/DELETE/OPTIONS`, `credentials: true` | `main.ts` |
| ValidationPipe | `whitelist`, `forbidNonWhitelisted`, `transform`, `enableImplicitConversion` | `main.ts` |
| Swagger | `GET /api/docs`, схема Bearer `access-token` | `main.ts` |
| WS-адаптер | `RedisIoAdapter` для Socket.IO | `main.ts` |

Порядок прохождения входящего запроса (глобальные провайдеры из
`app.module.ts`):

```
HTTP-запрос
   │
   ▼
Helmet ──► CORS ──► ValidationPipe (whitelist + transform)
   │
   ▼
APP_GUARD #1  JwtAuthGuard      — аутентификация (skip на @Public)
   │
   ▼
APP_GUARD #2  ThrottlerGuard    — rate limiting
   │
   ▼
APP_GUARD #3  RolesGuard        — авторизация по @Roles (иерархия)
   │
   ▼
Controller → Service → Prisma / Redis / Queue
   │
   ▼
APP_INTERCEPTOR  PaginationInterceptor  — PaginatedResult → массив + заголовки
   │
   ▼
APP_FILTER  AllExceptionsFilter — единый конверт ошибок
   │
   ▼
HTTP-ответ
```

> `forbidNonWhitelisted: true` означает: запрос с **лишними** полями в теле
> отклоняется (`400`). Отправляйте только поля, описанные в DTO.

---

## Сквозная инфраструктура

Всё лежит в `backend/src/common/`.

### Guards

| Guard | Назначение |
|---|---|
| `JwtAuthGuard` | Глобальный. По умолчанию **все маршруты защищены**; публичные помечаются `@Public()` (fail-safe: забыли декоратор — маршрут остался закрытым). |
| `OptionalJwtAuthGuard` | Пытается распарсить токен; нет токена — пускает анонимно (`request.user` пуст). Для маршрутов, видимых разлогиненным, но с персональным контекстом (профили, лента). |
| `RolesGuard` | Глобальный. Проверяет `@Roles(...)`. Реализует **иерархию ролей**: `USER(0) < MODERATOR(1) < ADMIN(2) < OWNER(3)` — старшая роль удовлетворяет требованию младшей. |
| `ThrottlerGuard` | Глобальный rate limit (по умолчанию 120 запросов / 60 c; на auth-маршрутах строже). |

### Декораторы

- `@Public()` — снять требование авторизации.
- `@Roles(UserRole.MODERATOR)` — минимальная роль для маршрута.
- `@CurrentUser()` / `@CurrentUser('id')` — достать пользователя (или его поле)
  из `request.user`.

### PaginationInterceptor — контракт пагинации

Сервис возвращает `PaginatedResult<T> = { items, nextCursor, hasMore }`.
Интерцептор разворачивает его:

- **тело ответа** → просто `T[]` (массив `items`);
- `nextCursor` → заголовок `X-Next-Cursor` (пустая строка, если страниц нет);
- `hasMore` → заголовок `X-Has-More` (`true`/`false`);
- оба заголовка добавляются в `Access-Control-Expose-Headers`, чтобы их видел
  браузерный клиент.

Хелпер `buildCursorPage(rows, limit)` запрашивает `limit + 1` строку: если
вернулось больше `limit`, лишняя строка отбрасывается, а её `id` становится
курсором. Query-параметры — `CursorPaginationDto` (`cursor?`, `limit` 1–50,
деф. 20).

### AllExceptionsFilter — конверт ошибок

Единый формат для всех ошибок:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Post not found",
  "path": "/api/posts/uuid",
  "timestamp": "2026-06-16T10:30:00.000Z"
}
```

Маппинг ошибок Prisma: `P2002` (unique) → `409`, `P2025` (не найдено) → `404`,
`P2003` (FK) → `400`; ошибки валидации Prisma → `400`. Ошибки `≥ 500` логируются
со стеком; наружу детали не утекают.

---

## Конфигурация и окружение

Конфиг типизирован (`config/configuration.ts`) и **валидируется при старте**
(`config/env.validation.ts`) — приложение не поднимется с некорректным
окружением. Полный список — в [`backend/.env.example`](../backend/.env.example).

**Обязательные переменные:** `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`.

**С дефолтами (ключевые):**

| Переменная | Дефолт | Назначение |
|---|---|---|
| `NODE_ENV` | `development` | окружение |
| `PORT` | `3000` | порт API |
| `CORS_ORIGINS` | `http://localhost:5173` | разрешённые origin |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Redis |
| `JWT_ACCESS_TTL` | `900s` | время жизни access-токена |
| `JWT_REFRESH_TTL` | `30d` | время жизни refresh-токена |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60` / `120` | окно и лимит rate limit |
| `S3_REGION` / `S3_BUCKET` / `MEDIA_PUBLIC_URL` | `us-east-1` / `epta-media` / `…/epta-media` | хранилище медиа |
| `PY_*_URL` | (пусто) | URL Python-сервисов; пусто = выключено |

> Структурное логирование (Pino) **редактирует** заголовки `authorization` и
> `cookie` — секреты не попадают в логи.

---

## Очереди (BullMQ)

`src/queues` выносит вторичную работу из горячего пути запроса:

| Очередь | Задачи |
|---|---|
| `counters` | пересчёт денормализованных счётчиков поста, репутации (лидерборд) |
| `notifications` | фоновый fan-out уведомлений |
| `media-processing` | обработка медиа (thumbnails/transcode) + модерация |
| `python-integration` | модерация контента, аналитика, реиндексация поиска |

Счётчики (`likesCount`, `commentsCount`, …) обновляются транзакционно на горячем
пути, а `CountersProcessor` периодически пересчитывает их из источника истины
(self-healing) — лента и профиль не делают `COUNT()` на каждый запрос.

---

## WebSocket

Чаты и real-time уведомления — через Socket.IO (`ChatGateway`):

- аутентификация JWT в handshake (`auth.token` или заголовок `Authorization`);
- комнаты `user:<id>` (уведомления) и `chat:<id>` (сообщения);
- события: `chat:join/leave/message/typing/read`, входящее `notification`;
- **масштабирование** — `@socket.io/redis-adapter` (`RedisIoAdapter`): событие с
  одного инстанса доходит до сокетов на других;
- уведомления доставляются через Redis pub/sub, поэтому модуль уведомлений не
  зависит от WebSocket-слоя.

REST-эндпоинты чатов (`POST /chats/:id/messages` и др.) — фолбэк и история; см.
[API.md → Chats](./API.md#chats--чаты).

---

## Интеграции с Python-сервисами

Со стороны backend есть интеграционный слой (`integrations/PythonServiceClient`).
Если `PY_*_URL` не заданы, вызовы — безопасные no-op (возвращают fallback), и
монолит полностью работает без Python. «Включение» сервиса = установка переменной
окружения.

Интеграция идёт двумя путями: синхронно по HTTP (с таймаутом) и асинхронно через
очередь (медленный сервис не блокирует запрос). Сами сервисы (`recommendation`,
`moderation`, `search`, `analytics`) — это **каркас FastAPI** в `python-services/`,
поднимаются профилем `python` в `docker-compose.yml`. Эндпоинты пока возвращают
безопасные дефолты (пустой список / `APPROVED` / `202`).

Полный справочник по Python-стороне (контракт эндпоинтов, поток данных, доступ к
данным, запуск, как добавлять логику) — в [`docs/PYTHON_SERVICES.md`](./PYTHON_SERVICES.md).
