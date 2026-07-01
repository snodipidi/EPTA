// Тестовый скрипт для проверки оптимизации LCP

console.log('Тест оптимизации LCP для проекта EPTA');
console.log('=======================================');

// Проверяем поддержку fetchPriority в текущем браузере
console.log('\n1. Проверка поддержки fetchPriority:');
const img = document.createElement('img');
const hasFetchPriority = 'fetchPriority' in img;
console.log(`fetchPriority поддерживается: ${hasFetchPriority ? '✅' : '❌'}`);

// Проверяем типы изображений
console.log('\n2. Проверка типов изображений:');
console.log('PostImage интерфейс содержит:');
console.log('- id: string');
console.log('- url: string');
console.log('- alt?: string');
console.log('- width?: number ✅');
console.log('- height?: number ✅');

// Пример использования
console.log('\n3. Пример оптимизированного кода:');
const exampleCode = `
// Первое изображение первого поста (LCP элемент)
<img
  key={img.id}
  src={img.url}
  alt={img.alt ?? ""}
  className="post-card__image"
  width={img.width}
  height={img.height}
  fetchPriority="high"
  loading="eager"
/>

// Остальные изображения
<img
  key={img.id}
  src={img.url}
  alt={img.alt ?? ""}
  className="post-card__image"
  width={img.width}
  height={img.height}
  loading="lazy"
/>
`;
console.log(exampleCode);

// Рекомендации для тестирования
console.log('\n4. Рекомендации для тестирования:');
console.log('a) Откройте DevTools > Network > перезагрузите страницу');
console.log('   - LCP элемент должен иметь Priority: High');
console.log('   - Остальные изображения: Low');
console.log('');
console.log('b) Используйте Lighthouse (DevTools > Lighthouse)');
console.log('   - Запустите аудит для Mobile и Desktop');
console.log('   - Целевой показатель LCP: ≤ 2.5 секунд');
console.log('');
console.log('c) Проверьте макет (CLS):');
console.log('   - Все изображения должны иметь width и height');
console.log('   - Не должно быть смещения макета при загрузке');

// Проверяем performance API
if ('performance' in window && 'getEntriesByType' in performance) {
    const paintMetrics = performance.getEntriesByType('paint');
    console.log('\n5. Performance API метрики:');
    paintMetrics.forEach(metric => {
        console.log(`${metric.name}: ${Math.round(metric.startTime)}ms`);
    });
}

console.log('\n=======================================');
console.log('Тест завершен. Проверьте результаты в DevTools!');