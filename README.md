# ЕПТА

Социальная сеть EPTA — монорепозиторий: **frontend** (React + TypeScript) и
**backend** (NestJS).

```
EPTA/
├── frontend/           # React 19 + Vite SPA
├── backend/            # NestJS API (REST + WebSocket)
├── python-services/    # FastAPI: рекомендации/модерация/поиск/аналитика (каркас)
├── docs/               # документация
└── docker-compose.yml  # Postgres + Redis + backend (+ MinIO и Python профилями)
```

---

## Быстрый старт

Всё запускается из `frontend/` через `npm` — Docker-команды backend обёрнуты в
скрипты, помнить `docker compose` не нужно.

```bash
cd frontend
npm install

# только UI на моках (Docker не нужен):
npm run dev:mock          # http://localhost:5173

# или полный стек против реального API:
npm run backend           # backend + postgres + redis в Docker (фон)
npm run seed              # один раз: демо-данные
npm run dev               # http://localhost:5173 (ходит в API)
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

Демо-логин: `snodipidi@epta.dev` / `Password123!`. Режим mock/real задаёт сам
скрипт (`dev:mock` vs `dev`). Подробнее —
[frontend/README.md](./frontend/README.md) и
[docs/FRONTEND_INTEGRATION.md](./docs/FRONTEND_INTEGRATION.md).

---

## Frontend

Все команды и подробности — [frontend/README.md](./frontend/README.md).

```bash
cd frontend
npm install
npm run dev:mock     # UI на моках, http://localhost:5173
npm run dev          # против реального API (предварительно `npm run backend`)
```

```
frontend/src/
├── api/           # эндпоинты и HTTP-клиент (http.ts, tokenStore.ts, …)
├── auth/          # AuthContext / useAuth
├── components/    # Header, Sidebar, Feed, PostCard, PostCreator, Icons
├── data/          # мок-данные
├── styles/        # variables.css (брейкпоинты), global.css
└── types/         # TypeScript типы
```

Режим mock/real задаёт сам скрипт (`dev:mock` vs `dev`). Файл
`frontend/.env.local` (не коммитится, попадает под `*.local` в `.gitignore`)
нужен лишь для оверрайдов вроде `VITE_API_BASE_URL`. Как фронт подключён к API —
в [docs/FRONTEND_INTEGRATION.md](./docs/FRONTEND_INTEGRATION.md).

## Backend

Подробности, архитектурные решения и инструкции — в
[`backend/README.md`](./backend/README.md).

Кратко: NestJS 11 · PostgreSQL + Prisma · Redis · BullMQ · Socket.IO ·
JWT (access + refresh с ротацией) · Swagger · Docker. Модульная feature-first
архитектура (auth, users, profiles, posts, reactions, bookmarks, follows, feeds,
media, notifications, chats, subscriptions, queues, health).

---

## Python-сервисы

Бизнес-логика и аналитика, в которых Python сильнее: **recommendation · moderation ·
search · analytics**. Сейчас это **каркас** (FastAPI 3.12 · SQLAlchemy 2.0 async ·
Redis) с рабочей инфраструктурой и эндпоинтами-заглушками по контракту, который
backend уже умеет вызывать. Подробности — [`python-services/README.md`](./python-services/README.md).

Живут за compose-профилем `python`; backend ходит в них, только если заданы
`PY_*_URL` (иначе — graceful no-op, поведение не меняется). Из `frontend/`:

```bash
npm run python:build     # собрать и поднять 4 сервиса (порты 8001..8004)
npm run python:logs      # логи
npm run python:stop      # погасить
```

---

## Документация

Backend:

- [Запуск и архитектурные решения backend](./backend/README.md)
- [Архитектура backend](./docs/ARCHITECTURE.md) — модули, жизненный цикл запроса, очереди, WebSocket
- [Модель данных](./docs/DATABASE.md) — схема Prisma: сущности, enum'ы, связи
- [Аутентификация и безопасность](./docs/AUTHENTICATION.md) — токены, ротация, роли
- [API эндпоинты](./docs/API.md) — полный справочник REST

Frontend:

- [Запуск фронтенда (npm-команды)](./frontend/README.md) — установка, dev/dev:mock, backend, seed
- [Интеграция фронтенда с backend](./docs/FRONTEND_INTEGRATION.md) — моки ⇄ API, клиент, что подключено
- [Брейкпоинты](./docs/BREAKPOINTS.md) — адаптив десктопной вёрстки

Python-сервисы:

- [Документация Python-сервисов](./docs/PYTHON_SERVICES.md) — контракт, поток данных, доступ к данным, запуск, дорожная карта
- [Каркас Python-сервисов](./python-services/README.md) — быстрый старт и локальная разработка
