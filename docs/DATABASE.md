# Модель данных ЕПТА

Карта схемы PostgreSQL (Prisma). Источник истины —
[`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma); там же —
подробные комментарии `// DECISION:` с обоснованиями.

**Итого:** 12 enum'ов, 23 модели. Все первичные ключи — `UUID`. Имена колонок в
БД — `snake_case` (через `@map`), имена полей в коде — `camelCase`.

---

## Содержание

- [Перечисления (enums)](#перечисления-enums)
- [Сущности](#сущности)
  - [Идентичность: User, Profile, RefreshToken](#идентичность)
  - [Граф связей: Follow, UserBlock](#граф-связей)
  - [Контент: Post, Comment](#контент)
  - [Взаимодействия: Reaction, Bookmark](#взаимодействия)
  - [Медиа: MediaAsset, PostMedia, Story, StoryMedia](#медиа)
  - [Коммуникация: Notification, Chat, ChatMember, ChatMessage, MessageReceipt](#коммуникация)
  - [Биллинг: Subscription](#биллинг)
- [Ключевые архитектурные решения](#ключевые-архитектурные-решения)
- [История миграций](#история-миграций)

---

## Перечисления (enums)

| Enum | Значения |
|---|---|
| `UserRole` | `USER`, `MODERATOR`, `ADMIN`, `OWNER` |
| `UserStatus` | `ACTIVE`, `SUSPENDED`, `DEACTIVATED`, `DELETED` |
| `ProfileVisibility` | `PUBLIC`, `FOLLOWERS_ONLY`, `PRIVATE` |
| `ModerationStatus` | `PENDING`, `APPROVED`, `FLAGGED`, `REJECTED` |
| `PostType` | `ORIGINAL`, `REPOST`, `QUOTE` |
| `ReactionType` | `LIKE`, `LOVE`, `HAHA`, `WOW`, `SAD`, `ANGRY` |
| `NotificationType` | `FOLLOW`, `LIKE`, `COMMENT`, `REPLY`, `REPOST`, `MENTION`, `CHAT_MESSAGE`, `SYSTEM` |
| `ChatType` | `DIRECT`, `GROUP` |
| `ChatMemberRole` | `MEMBER`, `ADMIN`, `OWNER` |
| `SubscriptionTier` | `FREE`, `PRO`, `VIP` |
| `SubscriptionStatus` | `ACTIVE`, `CANCELED`, `EXPIRED`, `PAST_DUE` |
| `MediaType` | `IMAGE`, `VIDEO`, `AUDIO`, `GIF` |
| `MediaStatus` | `PENDING`, `PROCESSING`, `READY`, `FAILED` |

---

## Сущности

### Идентичность

#### `User` (`users`)

Учётная запись: только идентичность и безопасность; публичная презентация
вынесена в `Profile`.

Ключевые поля: `id`, `email` (unique), `username` (unique), `passwordHash`,
`role` (`UserRole`, деф. `USER`), `status` (`UserStatus`, деф. `ACTIVE`),
`emailVerifiedAt?`, `createdAt`, `updatedAt`, `deletedAt?` (soft-delete).

Индексы: `status`, `role`. Пользователь **никогда не удаляется физически**
(см. [решение #1](#1-soft-delete--restrict)).

#### `Profile` (`profiles`)

Связь с `User` — 1:1 (`userId` unique, `onDelete: Cascade`).

Поля: `displayName`, `bio?`, `avatarUrl?`, `coverUrl?`, `location?`, `website?`,
`visibility` (`ProfileVisibility`, деф. `PUBLIC`). **Денормализованные
счётчики:** `followersCount`, `followingCount`, `postsCount`,
`reputationScore` (деф. 0).

Индекс: `reputationScore DESC` — для лидерборда («Топы»).

#### `RefreshToken` (`refresh_tokens`)

Ротация refresh-токенов, обнаружение повторного использования, удалённый выход.

Поля: `tokenHash` (unique — хранится **только SHA-256 хеш**, не сырой токен),
`family` (UUID — группирует токены одного логина для каскадного отзыва),
`replacedById?` (аудит ротации), `userAgent?`, `ip?`, `expiresAt`, `revokedAt?`.
Индексы: `userId`, `family`. Подробно — [AUTHENTICATION.md](./AUTHENTICATION.md).

### Граф связей

#### `Follow` (`follows`)

`followerId`, `followingId`, оба → `User` (`onDelete: Cascade`).
`@@unique([followerId, followingId])`. Индекс `followingId` (запрос «кто на меня
подписан»). Подписку на себя запрещает сервисный слой.

#### `UserBlock` (`user_blocks`)

`blockerId`, `blockedId`. `@@unique([blockerId, blockedId])`. Скрывает контент в
обе стороны, запрещает ЛС/подписки. Отдельная сущность от `Follow`.

### Контент

#### `Post` (`posts`)

| Поле | Тип | Заметки |
|---|---|---|
| `type` | `PostType` | деф. `ORIGINAL` |
| `authorId` | UUID | **NOT NULL**, `onDelete: Restrict` |
| `text?` | text | |
| `hashtags` | text[] | массив Postgres |
| `parentPostId?` | UUID | self-relation для репостов/цитат (`onDelete: SetNull`) |
| `replyToPostId?` | UUID | ответ на пост (`onDelete: SetNull`) |
| `moderationStatus` | `ModerationStatus` | деф. `APPROVED` |
| `likesCount`/`commentsCount`/`repostsCount`/`bookmarksCount`/`viewsCount` | int | денормализованные счётчики |
| `publishedAt`/`createdAt`/`updatedAt`/`editedAt?`/`deletedAt?` | datetime | `deletedAt` — soft-delete |

Индексы: `(authorId, publishedAt DESC)`, `publishedAt DESC`, `parentPostId`,
`replyToPostId`, `moderationStatus`. Объект `counters` во фронтенд-контракте
читается прямо из этих счётчиков.

#### `Comment` (`comments`)

Треды через self-relation `parentCommentId`.

Поля: `postId`, `authorId` (`onDelete: Restrict`), `parentCommentId?`
(`onDelete: Cascade` — ответы каскадно удаляются с родителем), `text`,
`moderationStatus`, `likesCount`, `repliesCount`, `deletedAt?`. Удаление
верхнеуровневого комментария — soft, чтобы не осиротить ответы.
Индексы: `(postId, createdAt)`, `parentCommentId`, `authorId`.

### Взаимодействия

#### `Reaction` (`reactions`)

Полиморфная: целью является **или** пост, **или** комментарий (ровно одно поле
не-null, проверяет сервис).

Поля: `userId`, `type` (`ReactionType`, деф. `LIKE`), `postId?`, `commentId?`.
`@@unique([userId, postId])`, `@@unique([userId, commentId])` — одна реакция на
цель от пользователя. Смена `LIKE → LOVE` — это `UPDATE`, а не миграция.

#### `Bookmark` (`bookmarks`)

`userId`, `postId`. `@@unique([userId, postId])`. Индекс
`(userId, createdAt DESC)`.

### Медиа

#### `MediaAsset` (`media_assets`)

Медиа — **первоклассная сущность** (не URL-колонка на посте): переиспользуется
для аватара/поста/истории, несёт статус обработки, прячет ключи S3 из бизнес-
таблиц.

Поля: `ownerId`, `type` (`MediaType`), `status` (`MediaStatus`, деф. `PENDING`),
`storageKey` (ключ объекта в S3/MinIO), `bucket`, `mimeType`, `sizeBytes`,
`width?`, `height?`, `durationMs?`, `variants?` (Json — ключи превью/вариантов,
заполняет job), `altText?`. Публичный URL выводится из `storageKey` + CDN-базы.
Индексы: `ownerId`, `status`.

#### `PostMedia` (`post_media`) и `StoryMedia` (`story_media`)

Join-таблицы (упорядоченный набор медиа) с полем `position`.
`@@unique([postId, mediaId])` / `@@unique([storyId, mediaId])`. У `StoryMedia`
есть `durationMs` (деф. 5000) — длительность показа слайда.

#### `Story` (`stories`)

Заложена на будущее (API может появиться позже). Поля: `authorId`, `caption?`,
`expiresAt` (индексируется для запроса «активные истории»), `viewsCount`,
`deletedAt?`.

### Коммуникация

#### `Notification` (`notifications`)

`recipientId` (`onDelete: Cascade`), `actorId?` (`onDelete: SetNull` — актёр
может быть удалён, уведомление выживает), `type` (`NotificationType`), `postId?`,
`data?` (Json — payload под конкретный тип), `readAt?`. Индекс
`(recipientId, readAt, createdAt DESC)` — горячий запрос «мои непрочитанные,
новые сверху».

#### `Chat` (`chats`)

`type` (`ChatType`), `name?` / `avatarUrl?` (только для групп),
`directKey?` (unique — канонический ключ пары `"uidA:uidB"`, не даёт создать
дубликат ЛС), `lastMessageAt?`. Индекс `lastMessageAt DESC`.

#### `ChatMember` (`chat_members`)

`chatId`, `userId`, `role` (`ChatMemberRole`, деф. `MEMBER`),
`lastReadMessageId?` (указатель прочитанного для бейджа непрочитанных),
`mutedUntil?`, `joinedAt`, `leftAt?`. `@@unique([chatId, userId])`.

#### `ChatMessage` (`chat_messages`)

`chatId`, `senderId` (`onDelete: Restrict`), `text?`, `mediaIds` (text[]),
`replyToId?` (`onDelete: SetNull`), `editedAt?`, `deletedAt?`. Индекс
`(chatId, createdAt DESC)` — keyset-пагинация сообщений.

#### `MessageReceipt` (`message_receipts`)

Получатель-ориентированные квитанции доставки/прочтения (отдельная таблица, а не
колонка) — масштабируется на группы, поддерживает «прочитано N».
`messageId`, `userId`, `deliveredAt?`, `readAt?`. `@@unique([messageId, userId])`.

### Биллинг

#### `Subscription` (`subscriptions`)

Одна активная строка на пользователя (`userId` unique, 1:1). Моделирует только
право доступа; история/инвойсы — отдельно, когда появится биллинг.

Поля: `tier` (`SubscriptionTier`, деф. `FREE`), `status` (`SubscriptionStatus`,
деф. `ACTIVE`), `externalCustomerId?` (линковка со Stripe и т.п.),
`currentPeriodEnd?`, `cancelAtPeriodEnd` (деф. `false`). Индекс `tier`.

---

## Ключевые архитектурные решения

### 1. Soft-delete + Restrict

В SQL `author_id NOT NULL` и `ON DELETE SET NULL` взаимоисключающи. Решение:
`authorId` остаётся `NOT NULL` с `onDelete: Restrict`, а «удаление» аккаунта —
это `User.status → DELETED` + анонимизация PII. Посты, комментарии и сообщения
сохраняются, UI показывает «удалённого пользователя» вместо падения на `null`.
(`Post.author`, `Comment.author`, `ChatMessage.sender`.)

### 2. Денормализованные счётчики

`followersCount`/`postsCount`/`likesCount`/… хранятся на сущностях и
поддерживаются транзакционно (или через очередь `counters`). Лента и профиль не
делают `COUNT()` на каждый запрос.

### 3. Расширяемые реакции

Реакция — одна строка `(user, target)` с полем `type`. Добавление новых эмодзи —
изменение данных, а не миграция; API остаётся «toggle»-совместимым с фронтендом.

### 4. Модерация как seam

`ModerationStatus` на `Post`/`Comment`. Контент создаётся `PENDING` (или
`APPROVED`, если модерация выключена), job вызывает Python-сервис и пишет вердикт
обратно. Лента фильтрует по статусу; включение модерации не требует миграции.

### 5. Refresh-token rotation + reuse detection

Хранится только хеш; токены сгруппированы в «семьи». При обновлении старый токен
отзывается; повторное предъявление отозванного — признак кражи → отзывается вся
семья. Детали — [AUTHENTICATION.md](./AUTHENTICATION.md).

### 6. Медиа как первоклассная сущность; 7. Дедуп ЛС через `directKey`; 8. Квитанции в отдельной таблице; 9. Истории заложены наперёд

См. соответствующие модели выше и комментарии `// DECISION:` в схеме.

---

## История миграций

```
backend/prisma/migrations/
└── 20260614000000_init      # инициализация схемы
```

> На Windows миграции должны быть в **UTF-8** (не UTF-16): Prisma падает на
> UTF-16 с `string contains embedded null`. PowerShell-редирект `>` пишет
> UTF-16 — перекодируйте файл при ручной генерации.
