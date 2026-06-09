# Брейкпоинты — ЕПТА

Адаптив только под **десктопные мониторы**. Мобильная вёрстка не предусмотрена — минимальная ширина `1024px`.

## Таблица брейкпоинтов

| Имя | min-width | Типичное устройство | Layout max | Sidebar | Gap | Padding |
|-----|-----------|---------------------|------------|---------|-----|---------|
| `sm` (base) | **1024px** | Ноутбук 13" | 720px | 120px | 20px | 24px |
| `md` | **1280px** | Стандартный монитор | 840px | 130px | 24px | 32px |
| `lg` | **1440px** | Большой монитор | 960px | 140px | 28px | 40px |
| `xl` | **1920px** | Full HD+ | 1080px | 150px | 32px | 48px |

## CSS-переменные

Все значения живут в `frontend/src/styles/variables.css` и меняются через `@media (min-width: …)`:

```css
--layout-max-width    /* весь блок (sidebar + лента) по центру экрана */
--sidebar-width
--sidebar-feed-gap    /* расстояние между меню и лентой */
--page-padding
--font-size-logo
--font-size-base   /* только xl */
--font-size-lg     /* только xl */
```

## Сетка

```
        ┌──── layout-container (max-width, margin: auto) ────┐
        │  Header: logo | search | actions                    │
        ├──────────┬──────────────────────────────────────────┤
        │ Sidebar  │  Feed (1fr)                              │
        │          │  [PostCreator]                           │
        │          │  [PostCard]                              │
        └──────────┴──────────────────────────────────────────┘
```

- Весь контент в **одном центрированном контейнере** (`--layout-max-width`)
- **Header** и **body** используют одинаковую сетку: `sidebar-width | 1fr`
- Между сайдбаром и лентой — `--sidebar-feed-gap` (~20px)

## Использование в коде

```css
/* Базовые стили — 1024px+ */
.component { ... }

@media (min-width: 1280px) { ... }
@media (min-width: 1440px) { ... }
@media (min-width: 1920px) { ... }
```
