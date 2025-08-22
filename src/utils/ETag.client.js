/**
 * Утилита для работы с ETag - версия для клиента (браузер)
 * Использует Web Crypto API вместо Node.js crypto
 */
class ETag {
  /**
   * Генерация MD5 хеша в браузере
   * @param {string} data - Данные для хеширования
   * @returns {Promise<string>} Хеш в hex формате
   */
  static async _generateHash(data) {
    // Для браузера - используем SHA-256 вместо MD5 (более безопасно)
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Берем первые 8 символов для совместимости
    return hashHex.substring(0, 8);
  }

  /**
   * Генерация ETag из содержимого объекта
   * @param {Object} content - Объект для хеширования
   * @returns {Promise<string>} ETag в формате "abc12345"
   */
  static async generate(content) {
    if (!content || typeof content !== 'object') {
      throw new Error('Content must be an object');
    }

    // Создаем стабильную JSON строку для хеширования
    const contentString = JSON.stringify(content, Object.keys(content).sort());
    
    const hash = await ETag._generateHash(contentString);
    
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
      return false;
    }

    const normalized1 = ETag.normalize(etag1);
    const normalized2 = ETag.normalize(etag2);
    
    return normalized1 === normalized2;
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
   * @returns {Promise<string>} ETag
   */
  static async forOffer(offer) {
    if (!offer) {
      throw new Error('Offer is required');
    }

    // Используем только поля, которые влияют на содержимое
    const content = {
      title: offer.title || '',
      content: offer.content || {},
      status: offer.status || 'draft'
    };

    return await ETag.generate(content);
  }
}

// Экспорт для браузера
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ETag;
} else if (typeof window !== 'undefined') {
  window.ETag = ETag;
}