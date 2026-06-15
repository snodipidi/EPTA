# ЕПТА

Социальная сеть EPTA — монорепозиторий: **frontend** (React + TypeScript) и
**backend** (NestJS).

```
EPTA/
├── frontend/           # React 19 + Vite SPA
├── backend/            # NestJS API (REST + WebSocket)
├── docs/               # документация
└── docker-compose.yml  # Postgres + Redis + backend (+ MinIO профилем)
```

---

## Быстрый старт (полный стек)

```bash
# 1. Поднять Postgres + Redis + backend (миграции применятся автоматически)
docker compose up --build backend

# 2. Засеять демо-данными (совпадают с мок-данными фронтенда)
docker compose exec backend npm run db:seed:prod

# 3. Запустить фронтенд
cd frontend
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

Чтобы фронтенд ходил в реальный API вместо моков — в `frontend/.env`:
`VITE_USE_MOCK=false`. Демо-логин: `snodipidi@epta.dev` / `Password123!`.

---

## Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

```
frontend/src/
├── api/           # эндпоинты и клиент
├── components/    # Header, Sidebar, Feed, PostCard, PostCreator, Icons
├── data/          # мок-данные
├── styles/        # variables.css (брейкпоинты), global.css
└── types/         # TypeScript типы
```

Переменные окружения (`frontend/.env`, скопировать из `.env.example`):

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_USE_MOCK=true   # false — ходить в реальный backend
```

## Backend

Подробности, архитектурные решения и инструкции — в
[`backend/README.md`](./backend/README.md).

Кратко: NestJS 11 · PostgreSQL + Prisma · Redis · BullMQ · Socket.IO ·
JWT (access + refresh с ротацией) · Swagger · Docker. Модульная feature-first
архитектура (auth, users, profiles, posts, reactions, bookmarks, follows, feeds,
media, notifications, chats, subscriptions, queues, health).

---

## Документация

- [Архитектура и запуск backend](./backend/README.md)
- [Брейкпоинты](./docs/BREAKPOINTS.md)
- [API эндпоинты (frontend-контракт)](./docs/API.md)
