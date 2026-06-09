# API Endpoints — ЕПТА

Базовый URL: `http://localhost:3000/api` (настраивается через `VITE_API_BASE_URL`).

---

## Посты

### `GET /posts`

Список постов для ленты.

**Response `200`:**
```json
[
  {
    "id": "1",
    "author": {
      "id": "u1",
      "displayName": "Ктото там",
      "username": "его_юз",
      "avatarUrl": "https://..."
    },
    "text": "Текст поста",
    "hashtags": ["теги", "епта"],
    "images": [
      { "id": "img1", "url": "https://...", "alt": "описание" }
    ],
    "counters": { "comments": 12, "reposts": 5, "likes": 10 },
    "createdAt": "2026-06-09T10:30:00Z",
    "replyTo": { "id": "0", "authorName": "другой_юз" }
  }
]
```

---

### `GET /posts/:id`

Один пост по ID.

**Response `200`:** объект поста (как выше).

**Response `404`:** `{ "error": "Post not found" }`

---

## Картинки постов

### `GET /posts/:id/images`

Картинки конкретного поста.

**Response `200`:**
```json
[
  { "id": "img1", "url": "https://cdn.epta.ru/posts/1/img1.webp", "alt": "описание" },
  { "id": "img2", "url": "https://cdn.epta.ru/posts/1/img2.webp", "alt": "" }
]
```

**Response `404`:** пост не найден.

> Загрузка картинок (POST) — отдельный эндпоинт, TBD:
> `POST /posts/:id/images` — multipart/form-data

---

## Счётчики

### `GET /posts/:id/counters`

Счётчики взаимодействий поста.

**Response `200`:**
```json
{
  "comments": 12,
  "reposts": 5,
  "likes": 10
}
```

---

## Действия (TBD)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `POST` | `/posts` | Создать пост |
| `POST` | `/posts/:id/like` | Лайк / анлайк |
| `POST` | `/posts/:id/repost` | Репост |
| `POST` | `/posts/:id/bookmark` | Закладка |

---

## Клиент

Фронтенд-заготовки: `frontend/src/api/`

- `endpoints.ts` — константы путей
- `posts.ts` — `getPosts()`, `getPostImages()`, `getPostCounters()`
- По умолчанию `VITE_USE_MOCK=true` — данные из `src/data/mockPosts.ts`
