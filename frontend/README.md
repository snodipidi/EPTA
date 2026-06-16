# EPTA — Frontend

React 19 + Vite SPA. Всё запускается отсюда через `npm` — Docker-команды для
backend обёрнуты в скрипты, чтобы не держать в голове `docker compose`.

## Установка (один раз)

```bash
cd frontend
npm install
```

Нужен установленный **Node 20+** и (для работы с реальным API) **Docker
Desktop**.

## Запуск

### Вариант 1 — только UI на моках (Docker не нужен)

Для вёрстки и работы над интерфейсом. Данные берутся из `src/data/*`, сеть не
дёргается.

```bash
npm run dev:mock          # http://localhost:5173
```

### Вариант 2 — против реального backend

Два терминала: в одном поднят backend в Docker, в другом — dev-сервер фронта.

```bash
# терминал 1 — backend + postgres + redis (в фоне)
npm run backend
npm run seed              # один раз: демо-данные

# терминал 2 — фронт против API
npm run dev               # http://localhost:5173
```

Демо-логин после сидинга: `snodipidi@epta.dev` / `Password123!`.
- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер против **реального** API (`VITE_USE_MOCK=false`) |
| `npm run dev:mock` | dev-сервер на **моках**, без Docker (`VITE_USE_MOCK=true`) |
| `npm run build` | production-сборка (`tsc -b && vite build`) |
| `npm run preview` | предпросмотр собранного билда |
| `npm run lint` | ESLint |
| `npm run backend` | поднять backend + postgres + redis в Docker (фон) |
| `npm run backend:build` | то же с пересборкой образа (после изменений в `backend/`) |
| `npm run backend:logs` | логи backend (`Ctrl+C` — выйти из просмотра) |
| `npm run backend:stop` | погасить стек (данные в Docker-volume сохраняются) |
| `npm run seed` | залить демо-данные в БД |

> Режим mock/real задаёт сам скрипт (`dev` vs `dev:mock`), файл `.env.local` для
> этого не нужен. `.env.local` (в git не попадает) — только для личных
> оверрайдов, например `VITE_API_BASE_URL`.

## Структура

```
src/
├── api/         # HTTP-клиент и эндпоинты (http.ts, config.ts, tokenStore.ts, …)
├── auth/        # AuthContext / useAuth
├── components/  # Header, Sidebar, Feed, PostCard, PostCreator, Icons …
├── data/        # мок-данные
├── pages/       # Login, Register, Profile …
├── styles/      # variables.css (брейкпоинты), global.css
└── types/       # TypeScript-типы
```

## Дальше

- Как фронт подключён к API, что уже работает, грабли контракта —
  [../docs/FRONTEND_INTEGRATION.md](../docs/FRONTEND_INTEGRATION.md)
- Справочник эндпоинтов — [../docs/API.md](../docs/API.md)
- Брейкпоинты вёрстки — [../docs/BREAKPOINTS.md](../docs/BREAKPOINTS.md)
- Backend (запуск, архитектура) — [../backend/README.md](../backend/README.md)
