# ЕПТА — Frontend

## Запуск

```bash
npm install
npm run dev
```

Откроется на `http://localhost:5173`.

## Структура

```
src/
├── api/           # эндпоинты и клиент
├── components/    # Header, Sidebar, Feed, PostCard, PostCreator, Icons
├── data/          # мок-данные
├── styles/        # variables.css (брейкпоинты), global.css
└── types/         # TypeScript типы
```

## Документация

- [Брейкпоинты](../docs/BREAKPOINTS.md)
- [API эндпоинты](../docs/API.md)

## Переменные окружения

Скопируй `.env.example` → `.env`:

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_USE_MOCK=true
```
