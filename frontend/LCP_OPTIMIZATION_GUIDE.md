# Руководство по оптимизации LCP для проекта EPTA

## Что было реализовано

### 1. Обновление типов данных
- **Файл:** `frontend/src/types/post.ts`
- **Изменения:** Добавлены опциональные поля `width` и `height` в интерфейс `PostImage`
- **Зачем:** Для предотвращения Cumulative Layout Shift (CLS) и ускорения рендеринга

### 2. Оптимизация компонента PostCard
- **Файл:** `frontend/src/components/PostCard/PostCard.tsx`
- **Изменения:**
  - Добавлен параметр `isFirstInFeed` для идентификации LCP-элемента
  - Первое изображение первого поста получает `fetchPriority="high"` и `loading="eager"`
  - Остальные изображения получают `loading="lazy"`
  - Все изображения используют явные `width` и `height`
  
### 3. Обновление Feed компонента
- **Файл:** `frontend/src/components/Feed/Feed.tsx`
- **Изменения:** Передача индекса поста для определения первого поста в ленте

## Как тестировать

### 1. Локальное тестирование
```bash
# Сборка проекта
npm run build

# Запуск preview режима
npm run preview
```

### 2. Использование Chrome DevTools

#### Вкладка Performance:
1. Откройте DevTools (F12)
2. Перейдите во вкладку "Performance"
3. Нажмите "Record"
4. Перезагрузите страницу (Ctrl+R)
5. Остановите запись
6. Найдите метку "Largest Contentful Paint" на временной шкале

#### Вкладка Network:
1. Очистите кэш (Ctrl+Shift+R)
2. Перейдите во вкладку "Network"
3. Включите колонку "Priority"
4. Проверьте:
   - LCP элемент должен иметь Priority: **High**
   - Остальные изображения: **Low**
   - Изображения ниже первого экрана должны загружаться при скролле

### 3. Lighthouse Audit
1. Откройте DevTools
2. Перейдите во вкладку "Lighthouse"
3. Выберите "Mobile" и "Desktop"
4. Нажмите "Analyze page load"
5. Проверьте показатели в разделе "Performance":
   - **LCP (Largest Contentful Paint):** ≤ 2.5 секунд
   - **CLS (Cumulative Layout Shift):** ≤ 0.1

### 4. WebPageTest (онлайн)
1. Перейдите на [webpagetest.org](https://webpagetest.org)
2. Введите URL вашего приложения
3. Выберите "Lighthouse" в опциях тестирования
4. Проанализируйте полученные результаты

## Целевые показатели

| Метрика | Отлично | Нужны улучшения | Плохо |
|---------|---------|-----------------|-------|
| **LCP** | ≤ 2.5 сек | 2.5–4.0 сек | > 4.0 сек |
| **CLS** | ≤ 0.1 | 0.1–0.25 | > 0.25 |

## Дополнительные рекомендации

### 1. Форматы изображений
Убедитесь, что бэкенд отдает изображения в современных форматах:
- **WebP** - поддержка ~98% браузеров
- **AVIF** - лучшая компрессия, но меньше поддержки

### 2. Кэширование
Настройте правильные заголовки кэширования для статических ресурсов:
```nginx
location ~* \.(jpg|jpeg|png|gif|webp|avif)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. Preload для критических ресурсов
Для критически важных изображений можно использовать:
```html
<link rel="preload" as="image" href="critical-image.jpg" fetchpriority="high">
```

### 4. Мониторинг в продакшене
- Настройте **Real User Monitoring (RUM)**
- Используйте **Google Analytics 4** с метриками Core Web Vitals
- Мониторьте 75-й процентиль значений LCP

## Устранение проблем

### Если LCP все еще высокий:
1. **Оптимизируйте размер изображений:** Используйте компрессию без потерь
2. **Используйте CDN:** Для географически распределенной доставки
3. **Оптимизируйте серверное время ответа:** Убедитесь, что TTFB (Time to First Byte) < 500ms
4. **Рассмотрите Server-Side Rendering (SSR):** Для сложных React-приложений

### Проверка внедренных изменений:
```typescript
// Убедитесь, что API возвращает width и height
interface PostImage {
  id: string;
  url: string;
  alt?: string;
  width?: number;   // ✅ Должен быть с бэкенда
  height?: number;  // ✅ Должен быть с бэкенда
}

// Проверьте рендеринг в PostCard
const isLcpElement = isFirstInFeed && index === 0;
<img
  width={img.width}
  height={img.height}
  fetchPriority={isLcpElement ? "high" : undefined}
  loading={isLcpElement ? "eager" : "lazy"}
/>
```

## Полезные ссылки

1. [Google Core Web Vitals](https://web.dev/vitals/)
2. [LCP Optimization Guide](https://web.dev/optimize-lcp/)
3. [Chrome DevTools Documentation](https://developer.chrome.com/docs/devtools/)
4. [Lighthouse Scoring Calculator](https://googlechrome.github.io/lighthouse/scorecalc/)

---

**Статус реализации:** ✅ Завершено  
**Последнее обновление:** 1 июля 2026  
**Ответственный:** Frontend-разработчик EPTA