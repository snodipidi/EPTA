# Интеграция фронтенда с backend

Как React-SPA (`frontend/`) подключается к реальному NestJS API и как
переключаться между моками и живым бэкендом.

Контракт эндпоинтов — [API.md](./API.md); устройство сервера —
[ARCHITECTURE.md](./ARCHITECTURE.md); токены — [AUTHENTICATION.md](./AUTHENTICATION.md).

---

## Переключатель: моки ⇄ реальный API

Источник данных управляется переменной окружения. Файл `frontend/.env.local`
(в git **не** попадает — подходит под `*.local` в `.gitignore`):

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_USE_MOCK=false      # true — рендерить из src/data/* без сети
```

В коде флаг реэкспортируется из `src/api/config.ts`:

```ts
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
```

Каждый api-метод и завязанный на данные компонент ветвится на `USE_MOCK`:
`true` → мок-данные из `src/data/`, `false` → запрос в API. Значение по
умолчанию (если переменной нет) — **моки** (безопасно для офлайн-разработки).

---

## Клиентский слой (`frontend/src/api/`)

| Файл | Назначение |
|---|---|
| `config.ts` | `API_BASE_URL`, `USE_MOCK` |
| `endpoints.ts` | константы путей (`/auth/login`, `/posts/:id/like`, …) |
| `http.ts` | общий fetch-клиент: версия, токен, refresh-on-401, ошибки |
| `tokenStore.ts` | access/refresh/user в localStorage |
| `auth.ts` | `login`, `register`, `logout` |
| `posts.ts` | `getPosts`, `getPost`, `createPost`, `toggleLike`, `repost` |
| `comments.ts` | `getComments`, `createComment` |
| `profiles.ts` | `getMyProfile`, `getProfileByUsername` |

### `http.ts` — общий клиент

`request<T>(path, options)` инкапсулирует всё общение с API:

1. **Версионирование.** На каждый запрос ставит заголовок `X-API-Version: 1`
   (бэкенд использует header-версионирование).
2. **Авторизация.** Если в `tokenStore` есть access-токен — добавляет
   `Authorization: Bearer <token>`.
3. **Refresh-on-401.** При ответе `401` один раз дёргает `POST /auth/refresh`
   с refresh-токеном, сохраняет новую пару и **повторяет** исходный запрос.
   Если refresh не удался — чистит сессию. Сами auth-запросы идут с
   `skipAuthRefresh`, чтобы не зациклиться.
4. **Ошибки.** Конверт бэкенда `{ statusCode, error, message }` превращается в
   `ApiError` (с полем `status` и человекочитаемым `message`; массив сообщений
   валидации склеивается через запятую).
5. **`204 No Content`** и пустое тело → `undefined`.

### `tokenStore.ts` — хранилище сессии

Ключи в localStorage: `epta.accessToken`, `epta.refreshToken`, `epta.user`.
`saveSession`, `saveTokens`, `clearSession`, `getAccessToken`,
`getRefreshToken`, `getStoredUser`.

### `auth/AuthContext.tsx` — контекст авторизации

`AuthProvider` оборачивает приложение (`main.tsx`). Хук `useAuth()` отдаёт
`{ user, isAuthenticated, login, register, logout }`. Пользователь
восстанавливается из localStorage при старте; `login`/`register` сохраняют
сессию, `logout` отзывает refresh-токен и чистит хранилище.

---

## Что подключено

Проверено вживую через браузер:

| Поток | Эндпоинт(ы) | Где |
|---|---|---|
| Регистрация | `POST /auth/register` | `RegisterPage` |
| Вход | `POST /auth/login` | `LoginPage` |
| Выход | `POST /auth/logout` | `ProfilePage` |
| Обновление токенов | `POST /auth/refresh` | `http.ts` (авто, на 401) |
| Лента | `GET /posts` | `Feed` |
| Создание поста | `POST /posts` | `PostCreator` → `Feed` |
| Лайк | `POST /posts/:id/like` | `PostCard` |
| Репост | `POST /posts/:id/repost` | `PostCard` |
| Комментарии (чтение) | `GET /posts/:id/comments` | `CommentsModal` |
| Комментарий (создание) | `POST /posts/:id/comments` | `CommentsModal` |
| Мой профиль | `GET /profiles/me` | `ProfilePage` |

---

## Что пока на моках/заглушках

Вне объёма текущей интеграции (UI есть частично или нет): Google OAuth (нет
эндпоинта), загрузка изображений (`POST /media`), закладки, подписки/фолловы,
чаты, уведомления, «Топы», поиск, настройки тарифов.

> В форме регистрации нет поля «отображаемое имя» → `displayName`
> подставляется из `username`.

---

## Особенности контракта (на которые легко наступить)

- **Списки — это массив, а не `{ items }`.** `PaginationInterceptor` кладёт
  элементы прямо в тело, а курсор — в заголовки `X-Next-Cursor` / `X-Has-More`.
  Поэтому `getPosts()` типизирован как `Post[]`. См.
  [ARCHITECTURE.md → PaginationInterceptor](./ARCHITECTURE.md#paginationinterceptor--контракт-пагинации).
- **`X-API-Version` обязателен** — клиент шлёт его автоматически.
- **id постов — UUID**, не порядковые числа.
- **Лишние поля в теле → `400`** (`forbidNonWhitelisted`): отправляйте только
  то, что описано в DTO.
- **`liked` / `bookmarked`** приходят в посте только для авторизованного
  запроса (контекст просмотрящего).

---

## Локальный запуск

```bash
# 1. backend + инфраструктура (из корня репозитория)
docker compose up --build backend
docker compose exec backend npm run db:seed:prod   # демо-данные

# 2. фронтенд
cd frontend
npm install
# создать .env.local с VITE_USE_MOCK=false (см. выше)
npm run dev        # http://localhost:5173
```

Демо-логин после сидинга: `snodipidi@epta.dev` / `Password123!`.
