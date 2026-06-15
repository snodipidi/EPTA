# EPTA — Backend

Масштабируемый backend социальной сети **EPTA** на NestJS. Спроектирован как
система (feature-first модули, SOLID, очереди, кэш, WebSocket), а не набор
CRUD-контроллеров, с расчётом на многолетнее развитие без переписывания
архитектуры.

---

## Содержание

- [Технологии](#технологии)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [Структура проекта](#структура-проекта)
- [Архитектурные решения](#архитектурные-решения)
- [API и документация](#api-и-документация)
- [Очереди и Python-сервисы](#очереди-и-python-сервисы)
- [WebSocket](#websocket)
- [Тесты](#тесты)
- [Скрипты](#скрипты)

---

## Технологии

NestJS 11 · TypeScript · PostgreSQL · Prisma 6 · Redis (ioredis) · BullMQ ·
Socket.IO · JWT (access + refresh с ротацией) · argon2 · class-validator ·
Swagger/OpenAPI · Pino · Helmet · Throttler · Jest · Docker.

---

## Быстрый старт

### Вариант A — всё в Docker (рекомендуется)

Из **корня репозитория** (где лежит `docker-compose.yml`):

```bash
# 1. Поднять Postgres + Redis + backend (миграции применяются автоматически)
docker compose up --build backend

# backend стартует на http://localhost:3000/api
# Swagger:                http://localhost:3000/api/docs
```

Засеять демо-данные (в отдельном терминале, после старта):

```bash
# В prod-образе нет ts-node, поэтому seed запускается из скомпилированного JS.
docker compose exec backend npm run db:seed:prod
```

### Вариант B — инфраструктура в Docker, backend локально

```bash
# 1. Только базы
docker compose up -d postgres redis

# 2. Backend
cd backend
cp .env.example .env          # при необходимости поправить
npm install
npm run prisma:generate
npm run prisma:deploy         # применить миграции
npm run db:seed               # демо-данные (необязательно)
npm run start:dev             # watch-режим
```

> **MinIO (S3-совместимое хранилище)** поднимается профилем:
> `docker compose --profile storage up -d minio`
> (консоль: http://localhost:9001, API: http://localhost:9000).

После старта фронтенд можно переключить на реальный API:
в `frontend/.env` выставить `VITE_USE_MOCK=false` — seed специально повторяет
мок-данные, поэтому UI выглядит так же.

**Демо-логин после сидинга:** `snodipidi@epta.dev` / `Password123!`
(роль `OWNER`, подписка VIP).

---

## Переменные окружения

Полный список — в [`.env.example`](./.env.example). Ключевые:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Строка подключения PostgreSQL |
| `REDIS_HOST` / `REDIS_PORT` | Redis (кэш, BullMQ, Socket.IO adapter) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Секреты JWT (в проде — `openssl rand -hex 32`) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Время жизни токенов (`900s`, `30d`) |
| `CORS_ORIGINS` | Разрешённые origin (по умолчанию Vite: `http://localhost:5173`) |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | Глобальный rate limit |
| `S3_*` / `MEDIA_PUBLIC_URL` | Хранилище медиа (MinIO/S3) |
| `PY_*_URL` | URL Python-сервисов (пусто = выключено, без ошибок) |

Конфигурация **валидируется при старте** (`src/config/env.validation.ts`) —
приложение не поднимется с некорректным окружением.

---

## Структура проекта

```
src/
├── common/         # кросс-каттинг: guards, decorators, filters, interceptors, DTO
├── config/         # типизированная конфигурация + валидация env
├── prisma/         # PrismaService (lifecycle)
├── redis/          # общий ioredis-клиент + cache-хелперы
├── auth/           # регистрация, логин, refresh-ротация, JWT-стратегия
├── users/          # аккаунт, смена пароля, soft-delete, блокировки
├── profiles/       # публичный профиль, приватность, лидерборд («Топы»)
├── posts/          # посты + комментарии (отдельные сервисы, не god-service)
├── reactions/      # лайки и расширяемые реакции
├── bookmarks/      # закладки
├── follows/        # граф подписок
├── feeds/          # лента подписок, тренды, рекомендации
├── media/          # загрузка + валидация + абстракция хранилища (S3-ready)
├── notifications/  # уведомления (+ real-time через Redis pub/sub)
├── chats/          # личные/групповые чаты + Socket.IO gateway
├── subscriptions/  # free / pro / vip
├── queues/         # BullMQ: producer + processors
├── integrations/   # PythonServiceClient (recommendation/moderation/...)
├── websocket/      # Redis-adapter для масштабирования Socket.IO
├── health/         # liveness / readiness
└── app.module.ts
```

Каждый модуль содержит controller, service(ы), dto, типы, а где нужно —
guards/decorators и тесты.

---

## Архитектурные решения

Подробные пояснения — в комментариях `// DECISION:` по коду и в
[`prisma/schema.prisma`](./prisma/schema.prisma). Главное:

### 1. Конфликт `author_id NOT NULL` + `ON DELETE SET NULL`

В SQL это взаимоисключающие требования. Решение — **soft-delete пользователя**:
`Post.authorId` остаётся `NOT NULL` с `onDelete: Restrict`, а «удаление»
аккаунта переводит `User.status → DELETED` и анонимизирует PII
(`UsersService.deleteAccount`). Посты и треды-ответы сохраняются, UI показывает
«удалённого пользователя» вместо падения на `null`.

### 2. Роли и иерархия

`UserRole` = USER / MODERATOR / ADMIN / OWNER. `RolesGuard` реализует
**иерархию**: старшая роль удовлетворяет требованию младшей — не нужно
перечислять все вышестоящие роли на каждом маршруте.

### 3. Безопасность по умолчанию

`JwtAuthGuard` — глобальный (`APP_GUARD`). Доступ **opt-out**: публичные
маршруты помечаются `@Public()`. Забыть декоратор = маршрут останется
защищённым (fail-safe). Плюс Helmet, CORS, ValidationPipe (whitelist),
Throttler, argon2id, централизованный `AllExceptionsFilter`.

### 4. Refresh-token rotation + reuse detection

Токены хранятся как **хеши**, сгруппированы в «семьи». При обновлении старый
токен отзывается; повторное предъявление отозванного токена трактуется как
кража и отзывает всю семью (`TokenService`).

### 5. Денормализованные счётчики

`likesCount/commentsCount/...` хранятся на сущности и поддерживаются
транзакционно на горячем пути; `CountersProcessor` пересчитывает их из
источника истины как self-healing. Лента и профиль не делают `COUNT()` на
каждый запрос.

### 6. Расширяемые реакции

Реакция — одна строка `(user, target)` с полем `type`. Добавление 😂/❤️/😮 —
изменение данных, а не миграция счётчиков; API остаётся «toggle»-совместимым с
фронтендом.

### 7. Контракт с фронтендом

Ответы сериализуются **точно** под типы фронтенда (`frontend/src/types/*`):
`PostMapper`/`comment`/`profile` отдают `Post`, `Comment`, `UserProfile`,
`TopUser` 1:1. Списки отдаются **массивом** в теле (как ждёт `getPosts()`), а
курсор пагинации — в заголовках `X-Next-Cursor` / `X-Has-More`
(`PaginationInterceptor`).

### 8. Готовность к будущему

`stories` / `story_media`, `moderationStatus` на контенте, заделы под
Python-сервисы и billing — заложены в схему сейчас, даже где API ещё нет.

---

## API и документация

- Базовый префикс: **`/api`**
- Swagger UI: **`/api/docs`** (с авторизацией по Bearer-токену)
- Версионирование — по заголовку `X-API-Version` (default `1`)

Эндпоинты, которые потребляет текущий фронтенд, реализованы один в один:
`GET /posts`, `GET /posts/:id`, `GET /posts/:id/images`,
`GET /posts/:id/counters`, `POST /posts`, `POST /posts/:id/like`,
`POST /posts/:id/repost`, `POST /posts/:id/bookmark`, плюс лидерборд
`GET /profiles/top`.

---

## Очереди и Python-сервисы

**BullMQ** (`src/queues`) выносит вторичную работу из запроса:

| Очередь | Задачи |
|---|---|
| `counters` | пересчёт счётчиков поста, репутации (лидерборд) |
| `notifications` | фоновый fan-out уведомлений |
| `media-processing` | обработка медиа (thumbnails/transcode) + модерация |
| `python-integration` | модерация контента, аналитика, реиндексация поиска |

**Python-сервисы пока не реализованы** — есть только интеграционный слой
(`PythonServiceClient`). Если `PY_*_URL` не заданы, вызовы — безопасные no-op
(возвращают fallback), и монолит полностью работает без Python. «Включение»
сервиса = установка переменной окружения. Интеграция идёт двумя путями:
синхронно по HTTP (с таймаутом) и асинхронно через очередь (чтобы медленный
сервис не блокировал запрос).

Будущие сервисы: `recommendation-service`, `moderation-service`,
`analytics-service`, `search-service` (заготовки в `docker-compose.yml` под
профилем `python`).

---

## WebSocket

Чаты и real-time уведомления — через Socket.IO (`ChatGateway`):

- аутентификация JWT в handshake (`auth.token` или заголовок `Authorization`);
- комнаты `user:<id>` (уведомления) и `chat:<id>` (сообщения);
- события: `chat:join/leave/message/typing/read`, входящее `notification`;
- **масштабирование** — `@socket.io/redis-adapter` (`RedisIoAdapter`): событие,
  отправленное на одном инстансе, доходит до сокетов на других;
- уведомления доставляются через Redis pub/sub, поэтому модуль уведомлений не
  зависит от WebSocket-слоя.

---

## Тесты

```bash
npm test          # unit (Jest)
npm run test:cov  # с покрытием
npm run test:e2e  # e2e (нужны запущенные Postgres + Redis; иначе авто-skip)
```

Покрыты ключевые места: auth-флоу, иерархия `RolesGuard`, контракт `PostMapper`
с фронтендом, e2e на регистрацию → логин → refresh-ротацию.

---

## Скрипты

| Команда | Действие |
|---|---|
| `npm run start:dev` | запуск в watch-режиме |
| `npm run build` | сборка в `dist/` |
| `npm run start:prod` | запуск собранного приложения |
| `npm run prisma:generate` | генерация Prisma Client |
| `npm run prisma:migrate` | создать/применить миграцию (dev) |
| `npm run prisma:deploy` | применить миграции (prod) |
| `npm run prisma:studio` | Prisma Studio |
| `npm run db:seed` | заполнить демо-данными (локально, через ts-node) |
| `npm run db:seed:prod` | то же из скомпилированного JS (внутри Docker-образа) |
| `npm run lint` | ESLint --fix |
```
