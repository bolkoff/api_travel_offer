/**
 * ETag Helper для клиента (Chrome Extension)
 * Копируйте в ваш background script
 * 
 * ВАЖНО: Используйте ТОЧНО такую же логику как на сервере
 */

// Функция создания ETag - ТОЧНО как на сервере
function createOfferETag(offer) {
  console.log('createOfferETag input:', offer);
  
  // ТОЧНО такая же логика как ETag.forOffer на сервере
  const content = {
    title: offer.title || '',
    content: offer.content || {},
    status: offer.status || 'draft'
  };
  
  // ТОЧНО такая же сортировка ключей как на сервере
  const contentString = JSON.stringify(content, Object.keys(content).sort());
  
  console.log('createOfferETag processing:', {
    content,
    contentString
  });
  
  // Используем тот же crypto.createHash что и на сервере
  // НО в браузере crypto.createHash не работает!
  // Поэтому нужно использовать готовую библиотеку MD5 или получать ETag с сервера
  
  console.error('WARNING: createOfferETag cannot generate hash in browser!');
  console.error('Use ETag from server response instead');
  
  return null; // Не можем генерить в браузере - используйте ETag с сервера!
}

// Функция сравнения ETag - ТОЧНО как на сервере
function compareETags(etag1, etag2) {
  console.log('compareETags:', { etag1, etag2 });
  
  if (!etag1 || !etag2) {
    console.log('compareETags: one of ETags is empty');
    return false;
  }

  // ТОЧНО такая же нормализация как ETag.normalize на сервере
  function normalize(etag) {
    if (!etag || typeof etag !== 'string') {
      return null;
    }
    const trimmed = etag.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed;
    }
    return `"${trimmed}"`;
  }

  const normalized1 = normalize(etag1);
  const normalized2 = normalize(etag2);
  const result = normalized1 === normalized2;
  
  console.log('compareETags result:', {
    original: { etag1, etag2 },
    normalized: { normalized1, normalized2 },
    result
  });
  
  return result;
}

// Функция очистки ETag от кавычек
function cleanETag(etag) {
  if (!etag) return '';
  return String(etag).replace(/^"/, '').replace(/"$/, '').trim();
}

// РЕКОМЕНДУЕМЫЙ WORKFLOW:
console.log(`
=== ETag Workflow для клиента ===

1. При получении offer с сервера - сохраняйте ETag:
   const offer = response.data; // GET /api/offers/123
   const etag = response.headers['etag']; // Используйте ETag с сервера!
   
2. При обновлении - отправляйте тот же ETag:
   fetch('/api/offers/123', {
     method: 'PUT',
     headers: {
       'If-Match': etag, // Тот же ETag что получили с сервера
       'Content-Type': 'application/json'
     },
     body: JSON.stringify(updatedOffer)
   });

3. НЕ генерируйте ETag на клиенте - используйте с сервера!
`);

// Экспорт функций
if (typeof globalThis !== 'undefined') {
  globalThis.createOfferETag = createOfferETag;
  globalThis.compareETags = compareETags;
  globalThis.cleanETag = cleanETag;
}