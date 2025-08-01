# Стандарты кодирования

## Общие принципы

### Читаемость кода
- Код должен быть самодокументируемым
- Используйте понятные имена переменных и функций
- Добавляйте комментарии для сложной логики
- Следуйте принципу DRY (Don't Repeat Yourself)

### Производительность
- Оптимизируйте критические пути
- Избегайте блокирующих операций
- Используйте кэширование где это уместно
- Минимизируйте использование памяти

### Безопасность
- Всегда валидируйте входные данные
- Используйте параметризованные запросы
- Санитизируйте HTML контент
- Логируйте события безопасности

## JavaScript/Node.js

### Стиль кодирования

#### Именование

```javascript
// ✅ Правильно
const hotelName = 'Grand Hotel Paris';
const extractHotelData = (html) => { /* ... */ };
const HOTEL_SELECTORS = { name: '.hotel-name' };

// ❌ Неправильно
const hn = 'Grand Hotel Paris';
const extract = (html) => { /* ... */ };
const selectors = { name: '.hotel-name' };
```

#### Функции

```javascript
// ✅ Правильно - стрелочные функции для коротких операций
const formatPrice = (price) => `$${price}`;

// ✅ Правильно - function declaration для сложных функций
function analyzeHTML(html, options = {}) {
  const { extractImages = true, extractPrices = true } = options;
  
  // Валидация входных данных
  if (!html || typeof html !== 'string') {
    throw new Error('HTML content is required and must be a string');
  }
  
  // Основная логика
  const result = {
    contentType: detectContentType(html),
    extractedData: extractData(html, options),
    confidence: calculateConfidence(html)
  };
  
  return result;
}

// ✅ Правильно - async/await для асинхронных операций
async function processHTMLContent(html) {
  try {
    const sanitizedHTML = await sanitizeHTML(html);
    const analysis = await analyzeHTML(sanitizedHTML);
    return analysis;
  } catch (error) {
    logger.error('Failed to process HTML content', { error });
    throw error;
  }
}
```

#### Объекты и массивы

```javascript
// ✅ Правильно - деструктуризация
const { name, price, rating } = hotelData;
const [firstImage, ...otherImages] = images;

// ✅ Правильно - spread оператор
const defaultOptions = { extractImages: true, extractPrices: true };
const options = { ...defaultOptions, ...userOptions };

// ✅ Правильно - object shorthand
const createHotel = (name, price) => ({ name, price });

// ✅ Правильно - template literals
const message = `Hotel ${hotelName} costs ${price} per night`;
```

### Обработка ошибок

```javascript
// ✅ Правильно - специфичные ошибки
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

class ProcessingError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ProcessingError';
    this.details = details;
  }
}

// ✅ Правильно - обработка ошибок
async function processRequest(req, res) {
  try {
    const { html, options } = req.body;
    
    // Валидация
    if (!html) {
      throw new ValidationError('HTML content is required', 'html');
    }
    
    // Обработка
    const result = await processHTMLContent(html, options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Логирование
    logger.error('Request processing failed', {
      error: error.message,
      stack: error.stack,
      requestId: req.id
    });
    
    // Отправка ответа
    const statusCode = error instanceof ValidationError ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.name,
        message: error.message,
        details: error.details || {}
      }
    });
  }
}
```

### Логирование

```javascript
// ✅ Правильно - структурированное логирование
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// ✅ Правильно - контекстное логирование
logger.info('HTML analysis completed', {
  requestId: req.id,
  processingTime: Date.now() - startTime,
  contentType: result.contentType,
  confidence: result.confidence,
  elementCount: result.metadata.elementCount
});

// ✅ Правильно - логирование ошибок
logger.error('Failed to extract hotel data', {
  error: error.message,
  stack: error.stack,
  html: html.substring(0, 100), // Только первые 100 символов
  selectors: usedSelectors
});
```

## Express.js

### Структура приложения

```javascript
// ✅ Правильно - модульная структура
// src/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(rateLimit(rateLimitOptions));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api', authMiddleware, routes);

// Error handling
app.use(errorHandler);

module.exports = app;
```

### Middleware

```javascript
// ✅ Правильно - middleware с обработкой ошибок
const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Token is required'
        }
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication failed', { error: error.message });
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid token'
      }
    });
  }
};

// ✅ Правильно - валидация middleware
const validateHTMLRequest = (req, res, next) => {
  const { error, value } = htmlRequestSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details[0].message,
        details: error.details
      }
    });
  }
  
  req.validatedData = value;
  next();
};
```

### Routes

```javascript
// ✅ Правильно - модульные routes
// src/routes/analyze.js
const express = require('express');
const router = express.Router();
const analyzeController = require('../controllers/analyzeController');
const validateHTMLRequest = require('../middleware/validation');

router.post('/analyze-html', 
  validateHTMLRequest, 
  analyzeController.analyzeHTML
);

module.exports = router;

// ✅ Правильно - контроллеры
// src/controllers/analyzeController.js
const HTMLAnalyzerService = require('../services/htmlAnalyzerService');

const analyzeHTML = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { html, url, context, options } = req.validatedData;
    
    const result = await HTMLAnalyzerService.analyzeHTML(
      html, 
      url, 
      context, 
      options
    );
    
    logger.info('HTML analysis completed', {
      requestId: req.id,
      processingTime: Date.now() - startTime,
      contentType: result.contentType
    });
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('HTML analysis failed', {
      requestId: req.id,
      error: error.message,
      processingTime: Date.now() - startTime
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_ERROR',
        message: 'Failed to analyze HTML content'
      }
    });
  }
};

module.exports = {
  analyzeHTML
};
```

## Тестирование

### Unit тесты

```javascript
// ✅ Правильно - структура тестов
describe('HTMLAnalyzerService', () => {
  describe('analyzeHTML', () => {
    it('should analyze hotel HTML correctly', async () => {
      // Arrange
      const html = '<div class="hotel-card"><h2>Grand Hotel</h2></div>';
      const options = { extractImages: true };
      
      // Act
      const result = await HTMLAnalyzerService.analyzeHTML(html, null, 'travel_offer', options);
      
      // Assert
      expect(result.contentType).toBe('hotel_card');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.extractedData).toHaveProperty('hotelName');
    });
    
    it('should throw error for invalid HTML', async () => {
      // Arrange
      const invalidHTML = null;
      
      // Act & Assert
      await expect(
        HTMLAnalyzerService.analyzeHTML(invalidHTML)
      ).rejects.toThrow('HTML content is required');
    });
  });
});
```

### Integration тесты

```javascript
// ✅ Правильно - тестирование API endpoints
describe('POST /api/analyze-html', () => {
  it('should return analysis result for valid request', async () => {
    const response = await request(app)
      .post('/api/analyze-html')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        html: '<div class="hotel">Grand Hotel</div>',
        url: 'https://example.com/hotel',
        options: { extractImages: true }
      });
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('contentType');
  });
  
  it('should return 401 for missing token', async () => {
    const response = await request(app)
      .post('/api/analyze-html')
      .send({ html: '<div>test</div>' });
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
```

## Документация кода

### JSDoc комментарии

```javascript
/**
 * Анализирует HTML контент и извлекает структурированные данные
 * @param {string} html - HTML контент для анализа
 * @param {string} [url] - URL страницы для контекста
 * @param {string} [context='travel_offer'] - Контекст анализа
 * @param {Object} [options] - Опции анализа
 * @param {boolean} [options.extractImages=true] - Извлекать изображения
 * @param {boolean} [options.extractPrices=true] - Извлекать цены
 * @param {boolean} [options.extractText=true] - Извлекать текст
 * @param {number} [options.maxElements=100] - Максимум элементов для анализа
 * @param {number} [options.timeout=30000] - Таймаут обработки в мс
 * @returns {Promise<Object>} Результат анализа
 * @throws {ValidationError} Если HTML невалиден
 * @throws {ProcessingError} Если произошла ошибка обработки
 * @example
 * const result = await analyzeHTML('<div class="hotel">Grand Hotel</div>');
 * console.log(result.contentType); // 'hotel_card'
 */
async function analyzeHTML(html, url = null, context = 'travel_offer', options = {}) {
  // Реализация
}
```

### README файлы

```markdown
# HTML Analyzer Service

Сервис для анализа HTML контента и извлечения структурированных данных о туристических предложениях.

## Использование

```javascript
const HTMLAnalyzerService = require('./services/htmlAnalyzerService');

const result = await HTMLAnalyzerService.analyzeHTML(html, url, context, options);
```

## API

### analyzeHTML(html, url, context, options)

Анализирует HTML контент и возвращает структурированные данные.

#### Параметры

- `html` (string) - HTML контент для анализа
- `url` (string, optional) - URL страницы для контекста
- `context` (string, optional) - Контекст анализа (по умолчанию: 'travel_offer')
- `options` (object, optional) - Опции анализа

#### Возвращает

Promise<Object> - Результат анализа

#### Примеры

```javascript
// Базовый анализ
const result = await analyzeHTML('<div class="hotel">Grand Hotel</div>');

// Анализ с опциями
const result = await analyzeHTML(html, url, 'travel_offer', {
  extractImages: true,
  extractPrices: true,
  maxElements: 50
});
```
```

## Git workflow

### Commit сообщения

```bash
# ✅ Правильно - conventional commits
feat: add hotel data extraction
fix: resolve HTML parsing issue
docs: update API documentation
test: add unit tests for content detector
refactor: improve error handling
style: fix code formatting
perf: optimize image processing
chore: update dependencies

# ❌ Неправильно
update code
fix bug
add feature
```

### Branch naming

```bash
# ✅ Правильно
feature/hotel-data-extraction
bugfix/html-parsing-issue
hotfix/security-vulnerability
docs/api-documentation
refactor/error-handling

# ❌ Неправильно
new-feature
fix-bug
update
```

### Pull Request

```markdown
## Описание

Краткое описание изменений

## Тип изменений

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Тестирование

- [ ] Unit тесты пройдены
- [ ] Integration тесты пройдены
- [ ] Ручное тестирование выполнено

## Чек-лист

- [ ] Код соответствует стандартам
- [ ] Добавлены тесты для новых функций
- [ ] Обновлена документация
- [ ] Проверена безопасность
```

## Производительность

### Оптимизация

```javascript
// ✅ Правильно - кэширование
const cache = new Map();

const getCachedResult = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < 300000) { // 5 минут
    return cached.data;
  }
  return null;
};

const setCachedResult = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// ✅ Правильно - асинхронная обработка
const processBatch = async (items) => {
  const batchSize = 10;
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processItem(item))
    );
    results.push(...batchResults);
  }
  
  return results;
};
```

### Мониторинг

```javascript
// ✅ Правильно - метрики производительности
const performanceMetrics = {
  requestCount: 0,
  averageResponseTime: 0,
  errorCount: 0
};

const updateMetrics = (responseTime, isError = false) => {
  performanceMetrics.requestCount++;
  performanceMetrics.averageResponseTime = 
    (performanceMetrics.averageResponseTime * (performanceMetrics.requestCount - 1) + responseTime) / 
    performanceMetrics.requestCount;
  
  if (isError) {
    performanceMetrics.errorCount++;
  }
};
```