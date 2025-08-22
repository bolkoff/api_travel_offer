# Travel Offers Server API Specification

## Описание проекта

Универсальный REST API сервер для управления предложениями (proposals) с поддержкой версионирования, управления конфликтами и публикации. Сервер агностичен к структуре данных предложений и работает с ними как с JSON объектами.

## Основные требования

### Функциональные требования
- **CRUD операции** с предложениями
- **Версионирование** с автоматическим и ручным созданием версий
- **Управление конфликтами** при одновременном редактировании
- **Статусы публикации** (draft, published, archived)
- **Изоляция данных** по пользователям
- **Автосохранение** без дополнительных действий пользователя
- **Optimistic locking** для предотвращения потери данных

### Нефункциональные требования
- Архитектура: **Express.js** + **REST API**
- Аутентификация: **JWT токены** (пока захардкоженные)
- База данных: **MongoDB** или **PostgreSQL**
- Документация: **OpenAPI 3.0**
- Производительность: до 1000 RPS
- Availability: 99.9%

## Базовая архитектура

### Основные сущности

#### 1. Offer (Предложение)
```json
{
  "id": "string",
  "userId": "string", 
  "title": "string",
  "content": {}, // JSON объект любой структуры
  "status": "draft|published|archived",
  "version": "number",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "lastModifiedBy": "string",
  "eTag": "string" // для optimistic locking
}
```

#### 2. Version (Версия)
```json
{
  "id": "string",
  "offerId": "string",
  "version": "number",
  "content": {}, // снапшот данных предложения
  "changeType": "manual|auto",
  "description": "string",
  "createdAt": "datetime",
  "createdBy": "string"
}
```

#### 3. Publication (Публикация)
```json
{
  "id": "string",
  "offerId": "string", 
  "version": "number",
  "publishedAt": "datetime",
  "publishedBy": "string",
  "publicUrl": "string", // URL внешней публикации
  "status": "active|inactive"
}
```

## API Endpoints

### Аутентификация

#### POST /api/auth/token
Получение токена аутентификации (пока захардкожен)

**Request:**
```json
{
  "username": "string",
  "password": "string" // пока игнорируется
}
```

**Response:**
```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "username": "string"
  }
}
```

### Управление предложениями

#### GET /api/offers
Получить список предложений пользователя

**Query Parameters:**
- `status` - фильтр по статусу (draft, published, archived)
- `limit` - количество записей (default: 50, max: 100)
- `offset` - смещение для пагинации
- `orderBy` - сортировка (createdAt, updatedAt, title)
- `order` - направление сортировки (asc, desc)

**Response:**
```json
{
  "offers": [
    {
      "id": "offer_123",
      "title": "Тур в Турцию",
      "status": "draft",
      "version": 3,
      "createdAt": "2024-01-01T12:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z",
      "hasUnpublishedChanges": true
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

#### POST /api/offers
Создать новое предложение

**Request:**
```json
{
  "title": "string",
  "content": {}, // любая JSON структура
  "status": "draft" // optional, default: "draft"
}
```

**Response:**
```json
{
  "id": "offer_123",
  "title": "Тур в Турцию",
  "content": {},
  "status": "draft",
  "version": 1,
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z",
  "eTag": "etag_value",
  "versionInfo": {
    "current": 1,
    "total": 1,
    "isLatest": true,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z",
    "lastModifiedBy": "user_456",
    "hasUnpublishedChanges": false
  }
}
```

#### GET /api/offers/:id
Получить предложение по ID

**Response:**
```json
{
  "id": "offer_123",
  "title": "Тур в Турцию", 
  "content": {},
  "status": "draft",
  "version": 3,
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-15T14:30:00Z",
  "lastModifiedBy": "user_456",
  "eTag": "etag_value",
  "hasUnpublishedChanges": true,
  "versionInfo": {
    "current": 3,
    "total": 5,
    "isLatest": true,
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-15T14:30:00Z",
    "lastModifiedBy": "user_456",
    "hasUnpublishedChanges": true
  }
}
```

#### PUT /api/offers/:id
Обновить предложение (полная замена)

**Headers:**
- `If-Match: etag_value` - для optimistic locking

**Request:**
```json
{
  "title": "string",
  "content": {},
  "status": "draft|published|archived", // optional
  "createVersion": false // optional, создать версию при сохранении
}
```

**Response:**
```json
{
  "id": "offer_123",
  "title": "Обновленный тур",
  "content": {},
  "status": "draft",
  "version": 4,
  "updatedAt": "2024-01-15T15:00:00Z",
  "eTag": "new_etag_value"
}
```

**Conflict Response (409):**
```json
{
  "error": "conflict",
  "message": "Offer was modified by another user",
  "conflictDetails": {
    "lastModifiedAt": "2024-01-15T14:45:00Z",
    "lastModifiedBy": "user_789",
    "currentVersion": 4,
    "yourVersion": 3
  },
  "resolutionOptions": [
    {
      "action": "overwrite",
      "description": "Перезаписать изменения другого пользователя"
    },
    {
      "action": "create_version", 
      "description": "Создать новую версию без конфликтов"
    },
    {
      "action": "view_changes",
      "description": "Сравнить изменения"
    }
  ]
}
```

#### PATCH /api/offers/:id
Частичное обновление предложения

**Headers:**
- `If-Match: etag_value`

**Request:**
```json
{
  "title": "Новый заголовок", // optional
  "content": {
    "tours": [/* обновленный массив туров */]
  }, // optional, будет merged с существующим
  "autoSave": true // optional, создать авто-версию
}
```

#### DELETE /api/offers/:id
Удалить предложение

**Response:** 204 No Content

### Управление версиями

#### GET /api/offers/:id/versions
Получить список версий предложения

**Response:**
```json
{
  "versions": [
    {
      "version": 3,
      "changeType": "manual",
      "description": "Добавлены новые туры",
      "createdAt": "2024-01-15T14:30:00Z",
      "createdBy": "user_456",
      "isCurrent": true
    },
    {
      "version": 2,
      "changeType": "auto",
      "description": "Автосохранение",
      "createdAt": "2024-01-10T10:15:00Z",
      "createdBy": "user_456",
      "isCurrent": false
    }
  ]
}
```

#### POST /api/offers/:id/versions
Создать новую версию

**Request:**
```json
{
  "description": "Описание изменений",
  "changeType": "manual" // optional: "manual" | "auto"
}
```

**Response:**
```json
{
  "version": 4,
  "description": "Описание изменений",
  "changeType": "manual",
  "createdAt": "2024-01-15T15:30:00Z"
}
```

#### GET /api/offers/:id/versions/:version
Получить конкретную версию

**Response:**
```json
{
  "id": "offer_123",
  "version": 2,
  "title": "Старый заголовок",
  "content": {}, // контент на момент версии
  "createdAt": "2024-01-10T10:15:00Z",
  "changeType": "auto"
}
```

#### POST /api/offers/:id/versions/:version/restore
Восстановить версию (сделать её текущей)

**Request:**
```json
{
  "createBackupVersion": true // создать версию с текущими данными перед восстановлением
}
```

**Response:**
```json
{
  "restoredToVersion": 2,
  "newCurrentVersion": 5, // если создали backup
  "updatedAt": "2024-01-15T16:00:00Z"
}
```

### Управление публикацией

#### GET /api/offers/:id/publication
Получить статус публикации

**Response:**
```json
{
  "isPublished": true,
  "currentPublication": {
    "version": 2,
    "publishedAt": "2024-01-10T12:00:00Z",
    "publicUrl": "https://external-site.com/offers/abc123"
  },
  "hasUnpublishedChanges": true // есть ли изменения после публикации
}
```

#### POST /api/offers/:id/publish
Опубликовать предложение

**Request:**
```json
{
  "version": 3, // optional, по умолчанию текущая версия
  "unpublishPrevious": true // снять с публикации предыдущую версию
}
```

**Response:**
```json
{
  "published": true,
  "version": 3,
  "publicUrl": "https://external-site.com/offers/abc123",
  "publishedAt": "2024-01-15T16:30:00Z"
}
```

#### DELETE /api/offers/:id/publication
Снять с публикации

**Response:**
```json
{
  "unpublished": true,
  "unpublishedAt": "2024-01-15T17:00:00Z"
}
```

### Разрешение конфликтов

#### POST /api/offers/:id/resolve-conflict
Разрешить конфликт версий

**Request:**
```json
{
  "resolution": "overwrite|create_version",
  "content": {}, // новые данные
  "conflictVersion": 3, // версия, с которой был конфликт
  "versionDescription": "Разрешение конфликта" // если создаем новую версию
}
```

**Response:**
```json
{
  "resolved": true,
  "action": "create_version",
  "newVersion": 5,
  "updatedAt": "2024-01-15T17:30:00Z"
}
```

### Утилитарные эндпоинты

#### GET /api/health
Проверка здоровья сервера

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T18:00:00Z",
  "version": "1.0.0"
}
```

#### GET /api/stats/user
Статистика пользователя

**Response:**
```json
{
  "totalOffers": 15,
  "draftOffers": 8,
  "publishedOffers": 5,
  "archivedOffers": 2,
  "lastActivity": "2024-01-15T17:30:00Z"
}
```

## Коды ответов

### Успешные ответы
- **200 OK** - успешная операция чтения/обновления
- **201 Created** - успешное создание ресурса
- **204 No Content** - успешное удаление

### Ошибки клиента  
- **400 Bad Request** - некорректные данные запроса
- **401 Unauthorized** - неверный или отсутствующий токен
- **403 Forbidden** - нет прав доступа к ресурсу
- **404 Not Found** - ресурс не найден
- **409 Conflict** - конфликт версий
- **412 Precondition Failed** - неверный ETag
- **422 Unprocessable Entity** - ошибка валидации данных
- **429 Too Many Requests** - превышен лимит запросов

### Ошибки сервера
- **500 Internal Server Error** - внутренняя ошибка сервера
- **503 Service Unavailable** - сервис временно недоступен

## Управление конфликтами

### Механизм optimistic locking

1. **ETag в заголовках**: каждый ответ содержит ETag
2. **If-Match валидация**: обновления требуют правильный ETag
3. **Conflict detection**: при несовпадении ETag возвращается 409
4. **Resolution options**: клиент получает варианты разрешения

### Сценарии разрешения конфликтов

#### Сценарий 1: Overwrite
```
User A: GET /offers/123 (ETag: "v3")
User B: PUT /offers/123 → creates v4
User A: PUT /offers/123 (If-Match: "v3") → 409 Conflict
User A: POST /offers/123/resolve-conflict {"resolution": "overwrite"}
```

#### Сценарий 2: Create Version
```
User A: GET /offers/123 (ETag: "v3") 
User B: PUT /offers/123 → creates v4
User A: PUT /offers/123 (If-Match: "v3") → 409 Conflict
User A: POST /offers/123/resolve-conflict {"resolution": "create_version"}
→ creates v5 with User A's changes
```

## Автосохранение и оптимизация

### Debouncing на клиенте
- Автосохранение через PATCH каждые 2-3 секунды
- Создание auto-версий каждые 10 минут или при значительных изменениях

### Оптимизация трафика
- Gzip сжатие
- ETags для кэширования
- Partial updates через PATCH
- Batch операции для множественных изменений

## Безопасность

### Аутентификация и авторизация
- JWT токены с истечением
- Scope-based permissions
- Rate limiting по пользователям

### Валидация данных
- JSON Schema валидация
- XSS protection для текстовых полей
- SQL injection protection
- Input size limits

## Мониторинг и логирование

### Метрики
- Request latency
- Error rates  
- Active users
- Database performance

### Логирование
- Structured logging (JSON)
- Request/response tracing
- Error stack traces
- Audit trail для изменений

## Развертывание

### Требования к инфраструктуре
- Node.js 18+
- MongoDB 6.0+ или PostgreSQL 14+
- Redis для сессий и кэширования
- Load balancer (nginx)

### Docker конфигурация
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment variables
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=mongodb://localhost:27017/travel-offers
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
API_RATE_LIMIT=1000
```

Данная спецификация обеспечивает полноценный REST API сервер для универсального управления предложениями с поддержкой всех требуемых функций.