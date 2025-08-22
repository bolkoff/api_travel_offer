const crypto = require('crypto');

/**
 * Утилита для работы с ETag
 * Универсальный класс для сервера и клиента
 */
class ETag {
  /**
   * Рекурсивная сортировка ключей объекта на всех уровнях вложенности
   * @param {any} obj - Объект для сортировки
   * @returns {any} Объект с отсортированными ключами
   */
  static _deepSortKeys(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      // Для массивов рекурсивно сортируем элементы
      return obj.map(item => ETag._deepSortKeys(item));
    }
    
    if (typeof obj === 'object') {
      // Для объектов сортируем ключи и рекурсивно обрабатываем значения
      const sorted = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = ETag._deepSortKeys(obj[key]);
      });
      return sorted;
    }
    
    // Примитивные типы возвращаем как есть
    return obj;
  }

  /**
   * Генерация ETag из содержимого объекта
   * @param {Object} content - Объект для хеширования
   * @returns {string} ETag в формате "abc12345"
   */
  static generate(content) {
    if (!content || typeof content !== 'object') {
      throw new Error('Content must be an object');
    }

    // Рекурсивно сортируем все ключи для стабильного хеширования
    const sortedContent = ETag._deepSortKeys(content);
    const contentString = JSON.stringify(sortedContent);
    
    const hash = crypto.createHash('md5')
      .update(contentString, 'utf8')
      .digest('hex')
      .substring(0, 8);
    
    return `"${hash}"`; // RFC 7232: ETag в кавычках
  }

  /**
   * Нормализация ETag (убирает/добавляет кавычки при необходимости)
   * @param {string} etag - ETag для нормализации
   * @returns {string} Нормализованный ETag
   */
  static normalize(etag) {
    if (!etag || typeof etag !== 'string') {
      return null;
    }

    const trimmed = etag.trim();
    
    // Если уже в кавычках - возвращаем как есть
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed;
    }
    
    // Добавляем кавычки
    return `"${trimmed}"`;
  }

  /**
   * Сравнение двух ETag
   * @param {string} etag1 - Первый ETag
   * @param {string} etag2 - Второй ETag
   * @returns {boolean} true если ETag одинаковые
   */
  static compare(etag1, etag2) {
    if (!etag1 || !etag2) {
      console.log('ETag.compare: one of ETags is empty', { etag1, etag2 });
      return false;
    }

    const normalized1 = ETag.normalize(etag1);
    const normalized2 = ETag.normalize(etag2);
    const result = normalized1 === normalized2;
    
    // Отладочный вывод
    console.log('ETag.compare:', {
      original: { etag1, etag2 },
      normalized: { normalized1, normalized2 },
      result
    });
    
    return result;
  }

  /**
   * Извлечение хеша из ETag (без кавычек)
   * @param {string} etag - ETag
   * @returns {string} Хеш без кавычек
   */
  static extractHash(etag) {
    const normalized = ETag.normalize(etag);
    if (!normalized) {
      return null;
    }
    
    return normalized.slice(1, -1); // Убираем кавычки
  }

  /**
   * Проверка валидности ETag
   * @param {string} etag - ETag для проверки
   * @returns {boolean} true если ETag валидный
   */
  static isValid(etag) {
    if (!etag || typeof etag !== 'string') {
      return false;
    }

    const normalized = ETag.normalize(etag);
    if (!normalized) {
      return false;
    }

    const hash = ETag.extractHash(normalized);
    
    // Проверяем что хеш состоит из 8 hex символов
    return /^[a-f0-9]{8}$/i.test(hash);
  }

  /**
   * Генерация ETag для предложения (offer)
   * @param {Object} offer - Объект предложения
   * @returns {string} ETag
   */
  static forOffer(offer) {
    if (!offer) {
      throw new Error('Offer is required');
    }

    // Используем только поля, которые влияют на содержимое
    const content = {
      title: offer.title || '',
      content: offer.content || {},
      status: offer.status || 'draft'
    };

    const etag = ETag.generate(content);
    
    // Отладочный вывод
    const sortedContent = ETag._deepSortKeys(content);
    const finalString = JSON.stringify(sortedContent);
    
    console.log('ETag.forOffer:', {
      inputOffer: {
        title: offer.title,
        content: offer.content,
        status: offer.status
      },
      contentForHashing: content,
      sortedContent: sortedContent,
      contentString: finalString,
      stringLength: finalString.length,
      generatedETag: etag
    });

    return etag;
  }
}

module.exports = ETag;