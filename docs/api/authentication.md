## Обзор

Travel Offer API использует JWT (JSON Web Tokens) для аутентификации и авторизации. Все защищенные endpoints требуют валидный JWT токен в заголовке запроса.

## JWT Аутентификация

### Получение токена

Для получения JWT токена используйте endpoint `/api/auth/login`:

```http
POST /api/auth/login
Content-Type: application/json

{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret"
}
```

### Ответ

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRJZCI6ImV4dGVuc2lvbi1jbGllbnQiLCJpYXQiOjE2NzM4NzY4MDAsImV4cCI6MTY3Mzk2MzIwMH0.signature",
    "expiresIn": 86400,
    "tokenType": "Bearer"
  }
}
```

### Использование токена

Добавьте токен в заголовок `Authorization`:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Обновление токена

Для обновления токена используйте endpoint `/api/auth/refresh`:

```http
POST /api/auth/refresh
Authorization: Bearer <current-token>
```

## Структура JWT токена

### Header
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Payload
```json
{
  "clientId": "extension-client",
  "iat": 1673876800,
  "exp": 1673963200,
  "iss": "travel-offer-api",
  "aud": "travel-offer-extension"
}
```

### Поля payload

| Поле | Описание |
|------|----------|
| `clientId` | Идентификатор клиента |
| `iat` | Время создания токена (Issued At) |
| `exp` | Время истечения токена (Expiration) |
| `iss` | Издатель токена (Issuer) |
| `aud` | Аудитория токена (Audience) |

## Безопасность

### Защита токенов

1. **Хранение**: Токены должны храниться в безопасном месте
2. **Передача**: Токены передаются только по HTTPS
3. **Обновление**: Токены обновляются до истечения срока действия
4. **Отзыв**: Скомпрометированные токены немедленно отзываются

### Rate Limiting

API использует многоуровневое ограничение запросов:

#### По IP адресу
- **100 запросов** в течение **15 минут**
- **1000 запросов** в течение **1 часа**

#### По JWT токену
- **1000 запросов** в течение **1 часа**
- **10000 запросов** в течение **24 часов**

### CORS настройки

```javascript
const corsOptions = {
  origin: [
    'https://chrome-extension://your-extension-id',
    'https://your-extension-domain.com'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
};
```

### HTTP Security Headers

API использует Helmet.js для установки безопасных заголовков:

```javascript
// Автоматически устанавливаемые заголовки
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

## Обработка ошибок аутентификации

### 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Invalid or missing token",
    "details": {
      "reason": "token_missing"
    }
  }
}
```

### 401 Token Expired

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Token has expired",
    "details": {
      "reason": "token_expired",
      "expiredAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Insufficient permissions",
    "details": {
      "requiredScope": "analyze:html",
      "providedScope": "read:only"
    }
  }
}
```

## Валидация входных данных

### HTML контент

```javascript
const htmlValidation = Joi.object({
  html: Joi.string()
    .required()
    .max(1048576) // 1MB
    .custom((value, helpers) => {
      // Проверка на вредоносный код
      if (containsMaliciousCode(value)) {
        return helpers.error('html.malicious');
      }
      return value;
    }),
  url: Joi.string().uri().optional(),
  context: Joi.string().valid('travel_offer').default('travel_offer'),
  options: Joi.object({
    extractImages: Joi.boolean().default(true),
    extractPrices: Joi.boolean().default(true),
    extractText: Joi.boolean().default(true),
    maxElements: Joi.number().integer().min(1).max(1000).default(100),
    timeout: Joi.number().integer().min(1000).max(60000).default(30000)
  }).default()
});
```

### Санитизация HTML

```javascript
const sanitizeHTML = (html) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'img', 'a', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
      'strong', 'em', 'b', 'i', 'br', 'hr'
    ],
    ALLOWED_ATTR: [
      'src', 'alt', 'href', 'class', 'id', 'style',
      'width', 'height', 'title'
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover']
  });
};
```

## Логирование безопасности

### События безопасности

```javascript
const securityEvents = {
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILURE: 'auth_failure',
  TOKEN_EXPIRED: 'token_expired',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  MALICIOUS_INPUT: 'malicious_input',
  UNAUTHORIZED_ACCESS: 'unauthorized_access'
};
```

### Логирование

```javascript
const logSecurityEvent = (event, details) => {
  logger.warn('Security event', {
    event,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    ...details
  });
};
```

## Рекомендации по безопасности

### Для клиентов (расширения)

1. **Безопасное хранение токенов**
   ```javascript
   // Используйте chrome.storage.secure для хранения токенов
   chrome.storage.secure.set({
     'jwt_token': token
   });
   ```

2. **Автоматическое обновление токенов**
   ```javascript
   const refreshToken = async () => {
     const response = await fetch('/api/auth/refresh', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${currentToken}`
       }
     });
     const { token } = await response.json();
     await chrome.storage.secure.set({ 'jwt_token': token });
   };
   ```

3. **Обработка ошибок аутентификации**
   ```javascript
   const handleAuthError = (error) => {
     if (error.code === 'AUTHENTICATION_ERROR') {
       // Попытка обновления токена
       refreshToken().catch(() => {
         // Перенаправление на страницу входа
         redirectToLogin();
       });
     }
   };
   ```

### Для разработчиков

1. **Регулярное обновление секретов**
2. **Мониторинг подозрительной активности**
3. **Логирование всех событий безопасности**
4. **Регулярные аудиты безопасности**

## Тестирование безопасности

### Unit тесты

```javascript
describe('Authentication', () => {
  test('should reject invalid tokens', async () => {
    const response = await request(app)
      .post('/api/analyze-html')
      .set('Authorization', 'Bearer invalid-token')
      .send(validPayload);
    
    expect(response.status).toBe(401);
  });

  test('should reject expired tokens', async () => {
    const expiredToken = generateExpiredToken();
    const response = await request(app)
      .post('/api/analyze-html')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send(validPayload);
    
    expect(response.status).toBe(401);
  });
});
```

### Integration тесты

```javascript
describe('Rate Limiting', () => {
  test('should limit requests per IP', async () => {
    const requests = Array(101).fill().map(() => 
      request(app)
        .post('/api/analyze-html')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validPayload)
    );
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```