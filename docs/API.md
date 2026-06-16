# API ЕПТА — справочник эндпоинтов

Полная карта REST-эндпоинтов backend'а. Документ отражает **реально
реализованный** код (`backend/src/**/**.controller.ts`), а не план.

> Интерактивная документация (Swagger UI) с авторизацией по Bearer-токену:
> **`http://localhost:3000/api/docs`**.

---

## Содержание

- [Общие соглашения](#общие-соглашения)
- [Auth — регистрация и сессии](#auth--регистрация-и-сессии)
- [Users — аккаунт и блокировки](#users--аккаунт-и-блокировки)
- [Profiles — профили и «Топы»](#profiles--профили-и-топы)
- [Posts — посты и комментарии](#posts--посты-и-комментарии)
- [Comments — треды комментариев](#comments--треды-комментариев)
- [Reactions — лайки и реакции](#reactions--лайки-и-реакции)
- [Bookmarks — закладки](#bookmarks--закладки)
- [Follows — подписки](#follows--подписки)
- [Feeds — ленты, тренды, рекомендации](#feeds--ленты-тренды-рекомендации)
- [Media — загрузка файлов](#media--загрузка-файлов)
- [Notifications — уведомления](#notifications--уведомления)
- [Chats — чаты](#chats--чаты)
- [Subscriptions — подписки на тарифы](#subscriptions--подписки-на-тарифы)
- [Health — проверки состояния](#health--проверки-состояния)
- [Сводная таблица](#сводная-таблица)

---

## Общие соглашения

| Параметр | Значение |
|---|---|
| **Базовый URL** | `http://localhost:3000/api` (фронтенд берёт из `VITE_API_BASE_URL`) |
| **Глобальный префикс** | `/api` (`main.ts`) |
| **Версионирование** | по заголовку **`X-API-Version`** (по умолчанию `1`). Клиент отправляет его на каждый запрос. |
| **Авторизация** | `Authorization: Bearer <accessToken>` (JWT). Подробнее — [AUTHENTICATION.md](./AUTHENTICATION.md) |
| **Content-Type** | `application/json` (кроме `POST /media` — `multipart/form-data`) |
| **CORS** | разрешён origin фронтенда (`http://localhost:5173` по умолчанию), `credentials: true` |

### Доступ к маршрутам

`JwtAuthGuard` — **глобальный**, поэтому по умолчанию любой маршрут **требует
авторизации**. Исключения помечены в коде `@Public()`. В таблицах ниже:

- **Public** — доступен без токена;
- **JWT** — требует валидный access-токен;
- **Optional** — работает и без токена, но при наличии токена ответ обогащается
  контекстом просмотрящего (например, поля `liked` / `isFollowing`).

### Пагинация (курсорная)

Списочные эндпоинты принимают query-параметры:

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `cursor` | string | — | непрозрачный курсор из предыдущей страницы |
| `limit` | number | `20` | размер страницы (1–50) |

**Важно про контракт ответа.** Глобальный `PaginationInterceptor`
разворачивает результат: в теле ответа возвращается **просто массив** элементов,
а метаданные пагинации уходят в заголовки:

| Заголовок | Значение |
|---|---|
| `X-Next-Cursor` | курсор следующей страницы (пустая строка, если страниц больше нет) |
| `X-Has-More` | `true` / `false` |

```http
GET /api/posts?limit=20 HTTP/1.1
X-API-Version: 1

HTTP/1.1 200 OK
X-Next-Cursor: 0f6b...e21
X-Has-More: true
Content-Type: application/json

[ { "id": "...", "author": { ... }, ... }, ... ]
```

> Поэтому на фронтенде `getPosts()` типизирован как `Post[]` без распаковки
> `{ items }`.

### Формат ошибок

Все ошибки нормализуются `AllExceptionsFilter` в единый конверт:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Email already in use",
  "path": "/api/auth/register",
  "timestamp": "2026-06-16T10:30:00.000Z"
}
```

`message` может быть массивом строк (ошибки валидации `class-validator`).
Ошибки Prisma маппятся в HTTP-коды: `P2002` → `409`, `P2025` → `404`,
`P2003` → `400`.

### Идентификаторы

Все id сущностей (посты, комментарии, профили, медиа, чаты) — **UUID**.

---

## Auth — регистрация и сессии

Базовый путь: `/api/auth`. Все, кроме `logout-all`, помечены `@Public()`.
Подробнее о токенах и безопасности — [AUTHENTICATION.md](./AUTHENTICATION.md).

### `POST /auth/register` · Public · 201

Регистрация. Создаёт `User` + `Profile` + дефолтную подписку `FREE` в одной
транзакции и сразу выдаёт пару токенов.

> Rate limit: 5 запросов / 60 c.

**Тело (`RegisterDto`):**

| Поле | Тип | Ограничения |
|---|---|---|
| `email` | string | email, ≤ 254 символов, уникальный |
| `username` | string | 3–30 символов, `[a-zA-Z0-9_]` |
| `displayName` | string | 1–50 символов |
| `password` | string | 8–128 символов |

**Ответ `201` (`AuthResponseDto`):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "user@epta.dev",
    "username": "user",
    "displayName": "User",
    "role": "USER"
  }
}
```

### `POST /auth/login` · Public · 200

Вход по email + паролю. Тот же `AuthResponseDto`.

> Rate limit: 10 запросов / 60 c.

**Тело (`LoginDto`):** `email: string`, `password: string`.

### `POST /auth/refresh` · Public · 200

Обмен refresh-токена на **новую пару** (ротация). Старый токен отзывается.

**Тело (`RefreshTokenDto`):** `refreshToken: string`. **Ответ:**
`AuthResponseDto`.

### `POST /auth/logout` · Public · 204

Отзыв одного refresh-токена (выход на текущем устройстве).

**Тело (`RefreshTokenDto`):** `refreshToken: string`. **Ответ:** пустой.

### `POST /auth/logout-all` · JWT · 204

Отзыв **всех** активных сессий пользователя. Без тела.

---

## Users — аккаунт и блокировки

Базовый путь: `/api/users`. Все эндпоинты требуют JWT.

| Метод | Путь | Код | Описание |
|---|---|---|---|
| `POST` | `/users/me/password` | 204 | Смена пароля |
| `DELETE` | `/users/me` | 204 | Удаление аккаунта (soft-delete + анонимизация) |
| `GET` | `/users/me/blocks` | 200 | Список id заблокированных пользователей (`string[]`) |
| `POST` | `/users/:username/block` | 204 | Заблокировать пользователя |
| `DELETE` | `/users/:username/block` | 204 | Разблокировать |

**`POST /users/me/password` (`ChangePasswordDto`):**
`currentPassword: string`, `newPassword: string` (8–128).

**`DELETE /users/me` (`DeleteAccountDto`):** `password: string` —
подтверждение. Аккаунт не удаляется физически: `User.status → DELETED` +
анонимизация PII, посты/комментарии сохраняются.

---

## Profiles — профили и «Топы»

Базовый путь: `/api/profiles`.

### `GET /profiles/top` · Public · 200

Лидерборд по репутации.

**Query:** `limit?` (1–50, по умолчанию 10).

**Ответ (`TopUserDto[]`):**
```json
[
  { "id": "uuid", "rank": 1, "displayName": "Кто-то", "username": "ego_yuz", "score": 1234 }
]
```

### `GET /profiles/me` · JWT · 200

Профиль текущего пользователя.

**Ответ (`ProfileResponseDto`):**
```json
{
  "id": "uuid",
  "displayName": "User",
  "username": "user",
  "bio": "",
  "followers": 0,
  "following": 0,
  "avatarUrl": null,
  "coverUrl": null,
  "isMe": true,
  "isFollowing": false,
  "canViewPosts": true,
  "visibility": "PUBLIC"
}
```

`visibility` ∈ `PUBLIC | FOLLOWERS_ONLY | PRIVATE`.

### `PATCH /profiles/me` · JWT · 200

Редактирование профиля (все поля опциональны).

**Тело (`UpdateProfileDto`):** `displayName?` (1–50), `bio?` (≤ 280),
`avatarUrl?` (≤ 500), `coverUrl?` (≤ 500), `location?` (≤ 100),
`website?` (URL, ≤ 200). **Ответ:** `ProfileResponseDto`.

### `PATCH /profiles/me/settings/privacy` · JWT · 200

Приватность профиля. **Тело (`UpdatePrivacyDto`):** `visibility` (enum).
**Ответ:** `ProfileResponseDto`.

### `GET /profiles/:username` · Optional · 200

Публичный профиль. Без токена — публичные данные; с токеном —
обогащённые `isFollowing`, `canViewPosts` относительно просматривающего.

---

## Posts — посты и комментарии

Базовый путь: `/api/posts`.

### `GET /posts` · Optional · 200

Лента постов (курсорная пагинация — см. [соглашения](#пагинация-курсорная)).
Тело — массив `PostResponseDto`.

**`PostResponseDto`:**
```json
{
  "id": "uuid",
  "author": {
    "id": "uuid",
    "displayName": "Кто-то там",
    "username": "ego_yuz",
    "avatarUrl": null
  },
  "text": "Текст поста",
  "hashtags": ["теги", "епта"],
  "images": [{ "id": "uuid", "url": "https://...", "alt": "" }],
  "counters": { "comments": 12, "reposts": 5, "likes": 10 },
  "createdAt": "2026-06-09T10:30:00.000Z",
  "replyTo": { "id": "uuid", "authorName": "другой_юз" },
  "liked": false,
  "bookmarked": false
}
```

`liked` / `bookmarked` присутствуют только при авторизованном запросе.

### `GET /posts/:id` · Optional · 200

Один пост (`PostResponseDto`). `404`, если не найден.

### `GET /posts/:id/images` · Public · 200

Картинки поста — `PostImageDto[]` (`id`, `url`, `alt?`).

### `GET /posts/:id/counters` · Public · 200

Счётчики — `{ comments, reposts, likes }`.

### `GET /posts/:id/comments` · Public · 200

Комментарии поста (курсорная пагинация). Тело — массив `CommentResponseDto`:
```json
{
  "id": "uuid",
  "postId": "uuid",
  "author": { "id": "uuid", "displayName": "User", "username": "user", "avatarUrl": null },
  "text": "Комментарий",
  "createdAt": "2026-06-16T10:30:00.000Z",
  "parentCommentId": null,
  "repliesCount": 0
}
```

### `POST /posts` · JWT · 201

Создать пост. Нужен хотя бы `text` **или** `mediaIds`.

**Тело (`CreatePostDto`):**

| Поле | Тип | Ограничения |
|---|---|---|
| `text?` | string | ≤ 5000 |
| `hashtags?` | string[] | ≤ 30 элементов |
| `mediaIds?` | string[] | UUID, ≤ 10 |
| `replyToPostId?` | string | UUID (ответ на пост) |

**Ответ:** `PostResponseDto`.

### `PATCH /posts/:id` · JWT · 200

Редактировать свой пост. **Тело (`UpdatePostDto`):** `text?` (≤ 5000),
`hashtags?` (≤ 30). **Ответ:** `PostResponseDto`.

### `DELETE /posts/:id` · JWT · 204

Удалить пост (soft-delete). Только автор / модератор+.

### `POST /posts/:id/repost` · JWT · 201

Репост. Без `text` — обычный репост; с `text` — цитата.

**Тело (`RepostDto`):** `text?` (≤ 5000). **Ответ:** созданный
`PostResponseDto`.

### `POST /posts/:id/comments` · JWT · 201

Добавить комментарий.

**Тело (`CreateCommentDto`):** `text: string` (1–2000),
`parentCommentId?` (UUID — ответ на комментарий). **Ответ:**
`CommentResponseDto`.

---

## Comments — треды комментариев

Базовый путь: `/api/comments`.

| Метод | Путь | Доступ | Код | Описание |
|---|---|---|---|---|
| `GET` | `/comments/:id/replies` | Public | 200 | Ответы на комментарий (пагинация) → `CommentResponseDto[]` |
| `DELETE` | `/comments/:id` | JWT | 204 | Удалить комментарий (автор / модератор+) |

---

## Reactions — лайки и реакции

Базовый путь: `/api/posts/:postId`. Требуют JWT.

### `POST /posts/:postId/like` · JWT · 200

Переключение лайка (toggle). **Ответ (`ReactionStateDto`):**
```json
{ "liked": true, "likes": 1, "type": "LIKE" }
```

### `PUT /posts/:postId/reaction` · JWT · 200

Установить конкретную реакцию. **Тело (`SetReactionDto`):** `type` ∈
`LIKE | LOVE | HAHA | WOW | SAD | ANGRY`. **Ответ:** `ReactionStateDto`.

### `DELETE /posts/:postId/reaction` · JWT · 200

Снять реакцию. **Ответ:** `ReactionStateDto`.

---

## Bookmarks — закладки

Требуют JWT.

| Метод | Путь | Код | Ответ |
|---|---|---|---|
| `POST` | `/posts/:postId/bookmark` | 200 | `{ "bookmarked": true, "bookmarks": 3 }` |
| `GET` | `/bookmarks` | 200 | `PostResponseDto[]` (пагинация) |

---

## Follows — подписки

Базовый путь: `/api/users`.

| Метод | Путь | Доступ | Код | Описание |
|---|---|---|---|---|
| `POST` | `/users/:username/follow` | JWT | 204 | Подписаться |
| `DELETE` | `/users/:username/follow` | JWT | 204 | Отписаться |
| `GET` | `/users/:username/followers` | Public | 200 | Подписчики (пагинация) → `UserSummaryDto[]` |
| `GET` | `/users/:username/following` | Public | 200 | Подписки (пагинация) → `UserSummaryDto[]` |

**`UserSummaryDto`:** `id`, `username`, `displayName`, `avatarUrl?`.

---

## Feeds — ленты, тренды, рекомендации

Базовый путь: `/api/feeds`.

| Метод | Путь | Доступ | Ответ |
|---|---|---|---|
| `GET` | `/feeds/following` | JWT | `PostResponseDto[]` (пагинация) — лента подписок |
| `GET` | `/feeds/trending` | Public | `PostResponseDto[]` (`limit?` 1–50, деф. 20) |
| `GET` | `/feeds/trending/hashtags` | Public | `TrendingHashtagDto[]` (`{ tag, count }`) |
| `GET` | `/feeds/recommended` | JWT | `PostResponseDto[]` (`limit?`) |

---

## Media — загрузка файлов

Базовый путь: `/api/media`. Требуют JWT.

### `POST /media` · JWT · 201

Загрузка файла, `multipart/form-data`, поле `file` (лимит 10 МиБ).

**Ответ (`MediaResponseDto`):**
```json
{
  "id": "uuid",
  "type": "IMAGE",
  "status": "READY",
  "url": "https://.../object.webp",
  "mimeType": "image/webp",
  "sizeBytes": 12345,
  "width": 1024,
  "height": 768
}
```

`type` ∈ `IMAGE | VIDEO | AUDIO | GIF`, `status` ∈
`PENDING | PROCESSING | READY | FAILED`.

### `GET /media/:id` · JWT · 200

Метаданные медиа (только владелец). `MediaResponseDto`.

---

## Notifications — уведомления

Базовый путь: `/api/notifications`. Требуют JWT.

| Метод | Путь | Код | Описание |
|---|---|---|---|
| `GET` | `/notifications` | 200 | Список (`cursor?`, `limit?`, `unreadOnly?`) → `NotificationResponseDto[]` |
| `GET` | `/notifications/unread-count` | 200 | `{ "unread": 5 }` |
| `POST` | `/notifications/read-all` | 204 | Отметить все прочитанными |
| `POST` | `/notifications/:id/read` | 204 | Отметить одно прочитанным |

**`NotificationResponseDto`:** `id`, `type` (`FOLLOW | LIKE | COMMENT | REPLY |
REPOST | MENTION | CHAT_MESSAGE | SYSTEM`), `actor?` (`id`, `username`,
`displayName`, `avatarUrl?`), `postId?`, `data?`, `readAt` (или `null`),
`createdAt`.

---

## Chats — чаты

Базовый путь: `/api/chats`. Требуют JWT. Real-time доставка — через Socket.IO
(`ChatGateway`); REST — фолбэк и история. См.
[ARCHITECTURE.md](./ARCHITECTURE.md#websocket).

| Метод | Путь | Код | Описание |
|---|---|---|---|
| `GET` | `/chats` | 200 | Список чатов (`ChatResponseDto[]`) |
| `POST` | `/chats/direct` | 201 | Создать/открыть личный чат (`{ username }`) |
| `POST` | `/chats/group` | 201 | Создать группу (`{ name, memberUsernames[], avatarUrl? }`) |
| `GET` | `/chats/:id/messages` | 200 | Сообщения (пагинация) → `ChatMessageResponseDto[]` |
| `POST` | `/chats/:id/messages` | 201 | Отправить сообщение (`{ text?, mediaIds?, replyToId? }`) |
| `POST` | `/chats/:id/read` | 204 | Отметить чат прочитанным |

---

## Subscriptions — подписки на тарифы

Базовый путь: `/api/subscriptions`.

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| `GET` | `/subscriptions/plans` | Public | Тарифы (`PlanDto[]`: `tier`, `name`, `priceMonthly`, `features[]`) |
| `GET` | `/subscriptions/me` | JWT | Текущая подписка (`SubscriptionResponseDto`) |
| `PUT` | `/subscriptions/me` | JWT | Сменить тариф (`{ tier }`) |
| `POST` | `/subscriptions/me/cancel` | JWT | Отменить (в конце периода) |

`tier` ∈ `FREE | PRO | VIP`, `status` ∈
`ACTIVE | CANCELED | EXPIRED | PAST_DUE`.

---

## Health — проверки состояния

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| `GET` | `/health` | Public | Liveness/readiness (Terminus): проверяет PostgreSQL + Redis |
| `GET` | `/health/live` | Public | `{ status: "ok", uptime: <сек> }` |

---

## Сводная таблица

| Модуль | Метод | Путь | Доступ | Код |
|---|---|---|---|---|
| auth | POST | `/auth/register` | Public | 201 |
| auth | POST | `/auth/login` | Public | 200 |
| auth | POST | `/auth/refresh` | Public | 200 |
| auth | POST | `/auth/logout` | Public | 204 |
| auth | POST | `/auth/logout-all` | JWT | 204 |
| users | POST | `/users/me/password` | JWT | 204 |
| users | DELETE | `/users/me` | JWT | 204 |
| users | GET | `/users/me/blocks` | JWT | 200 |
| users | POST | `/users/:username/block` | JWT | 204 |
| users | DELETE | `/users/:username/block` | JWT | 204 |
| profiles | GET | `/profiles/top` | Public | 200 |
| profiles | GET | `/profiles/me` | JWT | 200 |
| profiles | PATCH | `/profiles/me` | JWT | 200 |
| profiles | PATCH | `/profiles/me/settings/privacy` | JWT | 200 |
| profiles | GET | `/profiles/:username` | Optional | 200 |
| posts | GET | `/posts` | Optional | 200 |
| posts | GET | `/posts/:id` | Optional | 200 |
| posts | GET | `/posts/:id/images` | Public | 200 |
| posts | GET | `/posts/:id/counters` | Public | 200 |
| posts | GET | `/posts/:id/comments` | Public | 200 |
| posts | POST | `/posts` | JWT | 201 |
| posts | PATCH | `/posts/:id` | JWT | 200 |
| posts | DELETE | `/posts/:id` | JWT | 204 |
| posts | POST | `/posts/:id/repost` | JWT | 201 |
| posts | POST | `/posts/:id/comments` | JWT | 201 |
| comments | GET | `/comments/:id/replies` | Public | 200 |
| comments | DELETE | `/comments/:id` | JWT | 204 |
| reactions | POST | `/posts/:postId/like` | JWT | 200 |
| reactions | PUT | `/posts/:postId/reaction` | JWT | 200 |
| reactions | DELETE | `/posts/:postId/reaction` | JWT | 200 |
| bookmarks | POST | `/posts/:postId/bookmark` | JWT | 200 |
| bookmarks | GET | `/bookmarks` | JWT | 200 |
| follows | POST | `/users/:username/follow` | JWT | 204 |
| follows | DELETE | `/users/:username/follow` | JWT | 204 |
| follows | GET | `/users/:username/followers` | Public | 200 |
| follows | GET | `/users/:username/following` | Public | 200 |
| feeds | GET | `/feeds/following` | JWT | 200 |
| feeds | GET | `/feeds/trending` | Public | 200 |
| feeds | GET | `/feeds/trending/hashtags` | Public | 200 |
| feeds | GET | `/feeds/recommended` | JWT | 200 |
| media | POST | `/media` | JWT | 201 |
| media | GET | `/media/:id` | JWT | 200 |
| notifications | GET | `/notifications` | JWT | 200 |
| notifications | GET | `/notifications/unread-count` | JWT | 200 |
| notifications | POST | `/notifications/read-all` | JWT | 204 |
| notifications | POST | `/notifications/:id/read` | JWT | 204 |
| chats | GET | `/chats` | JWT | 200 |
| chats | POST | `/chats/direct` | JWT | 201 |
| chats | POST | `/chats/group` | JWT | 201 |
| chats | GET | `/chats/:id/messages` | JWT | 200 |
| chats | POST | `/chats/:id/messages` | JWT | 201 |
| chats | POST | `/chats/:id/read` | JWT | 204 |
| subscriptions | GET | `/subscriptions/plans` | Public | 200 |
| subscriptions | GET | `/subscriptions/me` | JWT | 200 |
| subscriptions | PUT | `/subscriptions/me` | JWT | 200 |
| subscriptions | POST | `/subscriptions/me/cancel` | JWT | 200 |
| health | GET | `/health` | Public | 200 |
| health | GET | `/health/live` | Public | 200 |

---

## Что потребляет текущий фронтенд

Подключены и проверены вживую (см.
[FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)):

`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
`POST /auth/logout` · `GET /posts`, `GET /posts/:id`, `POST /posts`,
`POST /posts/:id/like`, `POST /posts/:id/repost` · `GET /posts/:id/comments`,
`POST /posts/:id/comments` · `GET /profiles/me`, `GET /profiles/:username`,
`GET /profiles/top`.

Клиентский слой: `frontend/src/api/` (`http.ts` — общий клиент, `endpoints.ts` —
константы путей).
