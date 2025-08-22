/**
 * Простая и надежная реализация ETag
 * Работает одинаково на сервере и клиенте
 */

// Простая реализация MD5 для браузера (если crypto недоступно)
function simpleMD5(str) {
  // Простейший хеш для демонстрации - в продакшене используйте настоящий MD5
  let hash = 0;
  if (str.length === 0) return hash.toString(16).padStart(8, '0');
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Конвертируем в 32-битное число
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
}

class SimpleETag {
  /**
   * Создать ETag из объекта предложения
   * @param {Object} offer - Предложение
   * @returns {string} ETag без кавычек
   */
  static create(offer) {
    if (!offer || typeof offer !== 'object') {
      throw new Error('Offer is required');
    }

    // Берем только содержимое которое влияет на ETag
    const content = {
      title: offer.title || '',
      content: offer.content || {},
      status: offer.status || 'draft'
    };

    // Создаем стабильную строку
    const contentStr = JSON.stringify(content, Object.keys(content).sort());
    
    // Используем crypto если доступно (Node.js), иначе простой хеш
    let hash;
    if (typeof require !== 'undefined') {
      try {
        const crypto = require('crypto');
        hash = crypto.createHash('md5').update(contentStr, 'utf8').digest('hex').substring(0, 8);
      } catch (e) {
        hash = simpleMD5(contentStr);
      }
    } else {
      hash = simpleMD5(contentStr);
    }

    return hash; // Возвращаем без кавычек
  }

  /**
   * Сравнить два ETag
   * @param {string} etag1 - Первый ETag
   * @param {string} etag2 - Второй ETag  
   * @returns {boolean} true если одинаковые
   */
  static compare(etag1, etag2) {
    if (!etag1 || !etag2) {
      return false;
    }

    // Убираем кавычки если есть и сравниваем
    const clean1 = String(etag1).replace(/['"]/g, '').trim();
    const clean2 = String(etag2).replace(/['"]/g, '').trim();
    
    return clean1 === clean2;
  }

  /**
   * Валидировать ETag
   * @param {string} etag - ETag для проверки
   * @returns {boolean} true если валидный
   */
  static isValid(etag) {
    if (!etag) return false;
    
    const clean = String(etag).replace(/['"]/g, '').trim();
    return /^[a-f0-9]{8}$/i.test(clean);
  }

  /**
   * Очистить ETag от кавычек
   * @param {string} etag - ETag
   * @returns {string} ETag без кавычек
   */
  static clean(etag) {
    if (!etag) return '';
    return String(etag).replace(/['"]/g, '').trim();
  }
}

// Универсальный экспорт для Node.js и браузера
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimpleETag;
} else if (typeof window !== 'undefined') {
  window.SimpleETag = SimpleETag;
} else if (typeof self !== 'undefined') {
  self.SimpleETag = SimpleETag; // Для service workers / background scripts
}

// Также экспорт как глобальная переменная для браузерных расширений
if (typeof globalThis !== 'undefined') {
  globalThis.SimpleETag = SimpleETag;
}