# Интеграция фронтенда с backend

Как React-SPA (`frontend/`) подключается к реальному NestJS API и как
переключаться между моками и живым бэкендом.

Контракт эндпоинтов — [API.md](./API.md); устройство сервера —
[ARCHITECTURE.md](./ARCHITECTURE.md); токены — [AUTHENTICATION.md](./AUTHENTICATION.md).

---

## Переключатель: моки ⇄ реальный API

Источник данных управляется переменной `VITE_USE_MOCK`. Проще всего — через
npm-скрипты, которые сами её выставляют (см. [Локальный запуск](#локальный-запуск)):

- `npm run dev:mock` → `VITE_USE_MOCK=true` — рендер из `src/data/*` без сети;
- `npm run dev` → `VITE_USE_MOCK=false` — запросы в реальный API.

В коде флаг реэкспортируется из `src/api/config.ts`:

```ts
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
```

Каждый api-метод и завязанный на данные компонент ветвится на `USE_MOCK`:
`true` → мок-данные из `src/data/`, `false` → запрос в API. Значение по
умолчанию (если переменной нет) — **моки** (безопасно для офлайн-разработки).

Файл `frontend/.env.local` (в git **не** попадает — подходит под `*.local`)
нужен только для личных оверрайдов, например другого адреса API:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

> Inline-переменная из npm-скрипта имеет в Vite высший приоритет, поэтому
> `dev` / `dev:mock` задают режим независимо от содержимого `.env.local`.

---

## Клиентский слой (`frontend/src/api/`)

| Файл | Назначение |
|---|---|
| `config.ts` | `API_BASE_URL`, `USE_MOCK` |
| `endpoints.ts` | константы путей (`/auth/login`, `/posts/:id/like`, …) |
| `http.ts` | общий fetch-клиент: версия, токен, refresh-on-401, ошибки |
| `tokenStore.ts` | access/refresh/user в localStorage |
| `auth.ts` | `login`, `register`, `logout`, `getMe`, `verifyEmail`, `resendCode` |
| `posts.ts` | `getPosts`, `getPost`, `createPost`, `toggleLike` |
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
| Вход через Google | `GET /auth/google` → `/auth/callback` | `LoginPage`/`RegisterPage` → `AuthCallbackPage` |
| Подтверждение почты | `POST /auth/verify-email`, `POST /auth/resend-code` | `VerifyEmailPage`, `VerifyEmailBanner` |
| Восстановление сессии | `GET /auth/me` | `AuthContext` (на старте) |
| Выход | `POST /auth/logout` | `ProfilePage` |
| Обновление токенов | `POST /auth/refresh` | `http.ts` (авто, на 401) |
| Лента | `GET /posts` | `Feed` |
| Создание поста | `POST /posts` | `PostCreator` → `Feed` |
| Лайк | `POST /posts/:id/like` | `PostCard` |
| Комментарии (чтение) | `GET /posts/:id/comments` | `CommentsModal` |
| Комментарий (создание) | `POST /posts/:id/comments` | `CommentsModal` |
| Мой профиль | `GET /profiles/me` | `ProfilePage` |

---

## Аутентификация: верификация, Google, сессия

- **Подтверждение почты.** После регистрации почта не подтверждена и фронт ведёт
  на `/verify-email` (ввод 6-значного кода). До подтверждения действия записи
  заблокированы и в UI (`Feed`/`CommentsModal` уводят на `/verify-email`), и на
  бэке (`403`). Напоминание показывает `VerifyEmailBanner` (в ленте и профиле).
  Флаг — `user.emailVerified` из `AuthUser`.
- **Вход через Google.** Кнопка уводит браузер на `GET /auth/google` (серверный
  redirect-флоу). Бэкенд возвращает на `/auth/callback` с токенами во фрагменте
  URL — `AuthCallbackPage` сохраняет сессию и тянет `GET /auth/me`. Если на
  сервере нет Google-кредов — эндпоинт отдаёт `503`.
- **Сессия на устройстве.** `AuthContext` на старте валидирует токен через
  `GET /auth/me` (при `401` — авто-`refresh`), поэтому повторно входить не нужно,
  пока жив refresh-токен (30 дней). Флаг `bootstrapping` блокирует
  преждевременные редиректы на `/login`.

---

## Что пока на моках/заглушках

Вне объёма текущей интеграции (UI есть частично или нет): загрузка изображений
(`POST /media`), закладки, подписки/фолловы, чаты, уведомления, «Топы», поиск,
настройки тарифов.

> **Репост** намеренно не ходит в бэкенд: кнопка работает как лайк — локальный
> тоггл со счётчиком, настоящий пост-репост в ленте не создаётся. Эндпоинт
> `POST /posts/:id/repost` на бэке остаётся, но фронтом не вызывается.

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

Всё запускается из каталога `frontend/` (подробнее —
[frontend/README.md](../frontend/README.md)).

```bash
cd frontend
npm install

# Вариант 1 — только UI на моках (Docker не нужен):
npm run dev:mock        # http://localhost:5173

# Вариант 2 — против реального API:
npm run backend         # терминал 1: backend + postgres + redis в Docker
npm run seed            # один раз: демо-данные
npm run dev             # терминал 2: http://localhost:5173 (ходит в API)
```

Демо-логин после сидинга: `snodipidi@epta.dev` / `Password123!`.

Вспомогательное: `npm run backend:logs` (логи API), `npm run backend:stop`
(погасить стек), `npm run backend:build` (пересобрать образ после изменений в
`backend/`).
