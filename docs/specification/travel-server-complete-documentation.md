# Travel Offers Server - Полная документация API

## Описание проекта

Универсальный REST API сервер для управления предложениями (proposals) с поддержкой версионирования, управления конфликтами и публикации. Сервер агностичен к структуре данных предложений и работает с ними как с JSON объектами.

## Ключевые особенности

- ✅ **CRUD операции** с предложениями любой JSON структуры
- ✅ **Ручное версионирование** - пользователи сами создают версии
- ✅ **Простое разрешение конфликтов** - overwrite или create version
- ✅ **Управление публикацией** - draft/published/archived с ограничением на одну публикацию
- ✅ **Optimistic locking** через ETag для предотвращения потери данных
- ✅ **Изоляция данных** по пользователям
- ✅ **Express.js** архитектура с MongoDB/PostgreSQL

## Архитектура

### Технологический стек
- **Backend**: Node.js + Express.js
- **Database**: MongoDB или PostgreSQL
- **Auth**: JWT токены
- **API Docs**: OpenAPI 3.0
- **Caching**: Redis (опционально)

### Основные сущности

```
User (пользователь)
├── Offer (предложение)
│   ├── OfferVersion (версии)
│   └── Publication (публикации)
└── Session (сессии)
```

## Быстрый старт

### 1. Аутентификация

```bash
# Получить токен
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username": "john_doe", "password": "password123"}'

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_456",
    "username": "john_doe"
  }
}
```

### 2. Создать предложение

```bash
curl -X POST http://localhost:3000/api/offers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Тур в Турцию",
    "content": {
      "destination": "Turkey",
      "duration": 7,
      "price": 50000
    }
  }'

# Response
{
  "id": "offer_123",
  "title": "Тур в Турцию",
  "content": {...},
  "status": "draft",
  "version": 1,
  "eTag": "W/abc123"
}
```

### 3. Обновить предложение

```bash
curl -X PUT http://localhost:3000/api/offers/offer_123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "If-Match: W/abc123" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Обновленный тур",
    "content": {...}
  }'
```

### 4. Создать версию

```bash
curl -X POST http://localhost:3000/api/offers/offer_123/versions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Добавил новые отели"}'
```

### 5. Опубликовать

```bash
curl -X POST http://localhost:3000/api/offers/offer_123/publish \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version": 2}'
```

## Основные API эндпоинты

### Предложения
- `GET /api/offers` - получить список предложений
- `POST /api/offers` - создать предложение
- `GET /api/offers/{id}` - получить предложение
- `PUT /api/offers/{id}` - обновить предложение (с ETag)
- `PATCH /api/offers/{id}` - частичное обновление
- `DELETE /api/offers/{id}` - удалить предложение

### Версии
- `GET /api/offers/{id}/versions` - список версий
- `POST /api/offers/{id}/versions` - создать версию
- `GET /api/offers/{id}/versions/{version}` - получить версию
- `POST /api/offers/{id}/versions/{version}/restore` - восстановить версию

### Публикация
- `GET /api/offers/{id}/publication` - статус публикации
- `POST /api/offers/{id}/publish` - опубликовать
- `DELETE /api/offers/{id}/publication` - снять с публикации

### Конфликты
- `POST /api/offers/{id}/resolve-conflict` - разрешить конфликт

## Управление версиями

### Принципы версионирования
- Версии создаются **только пользователем вручную**
- Каждая версия содержит полный снапшот данных
- Восстановление версии не удаляет текущие данные
- Версии нумеруются последовательно (1, 2, 3...)

### Создание версии
```javascript
// Пользователь решает создать версию
POST /api/offers/offer_123/versions
{
  "description": "Добавил больше фотографий отелей"
}

// Система создает снапшот текущего состояния
{
  "version": 4,
  "description": "Добавил больше фотографий отелей", 
  "createdAt": "2024-01-15T15:30:00Z",
  "createdBy": "user_456"
}
```

### Восстановление версии
```javascript
// Восстановить версию 2
POST /api/offers/offer_123/versions/2/restore
{
  "createBackupVersion": true // создать backup текущих данных
}

// Результат
{
  "restoredToVersion": 2,
  "newCurrentVersion": 5, // backup версия
  "updatedAt": "2024-01-15T16:00:00Z"
}
```

## Разрешение конфликтов

### Обнаружение конфликта
```javascript
// User A пытается сохранить с устаревшим ETag
PUT /api/offers/offer_123
Headers: If-Match: "old_etag"

// Ответ 409 Conflict
{
  "error": "conflict",
  "message": "Предложение было изменено другим пользователем",
  "conflictDetails": {
    "lastModifiedAt": "2024-01-15T14:45:00Z",
    "lastModifiedBy": "user_789",
    "currentVersion": 4
  },
  "resolutionOptions": [
    {
      "action": "overwrite",
      "description": "Перезаписать изменения другого пользователя"
    },
    {
      "action": "create_version",
      "description": "Создать новую версию без конфликтов"
    }
  ]
}
```

### Разрешение конфликта
```javascript
// Вариант 1: Перезаписать
POST /api/offers/offer_123/resolve-conflict
{
  "resolution": "overwrite",
  "content": {...} // мои изменения
}

// Вариант 2: Создать новую версию
POST /api/offers/offer_123/resolve-conflict
{
  "resolution": "create_version", 
  "content": {...}, // мои изменения
  "versionDescription": "Разрешение конфликта"
}
```

## Управление публикацией

### Статусы предложений
- **draft** - черновик, можно редактировать и публиковать
- **published** - опубликовано на внешнем сервере  
- **archived** - архивировано, ограниченное редактирование

### Правила публикации
- Только одна версия предложения может быть опубликована
- При публикации новой версии предыдущая снимается с публикации
- Изменения после публикации помечаются как `hasUnpublishedChanges`
- Архивирование автоматически снимает с публикации

### Workflow публикации
```javascript
// 1. Опубликовать версию 3
POST /api/offers/offer_123/publish
{"version": 3}

// 2. Предложение получает статус "published"
{
  "status": "published",
  "isPublished": true,
  "publishedVersion": 3,
  "publicUrl": "https://external-site.com/offers/abc123"
}

// 3. Пользователь редактирует → hasUnpublishedChanges: true
PUT /api/offers/offer_123
{"title": "Новый заголовок"}

// 4. Обновить публикацию
POST /api/offers/offer_123/publish
{"version": 4} // публикует текущую версию
```

## Схемы данных

### Offer (Предложение)
```json
{
  "_id": "offer_123",
  "userId": "user_456", 
  "title": "Тур в Турцию",
  "content": {}, // любая JSON структура
  "status": "draft|published|archived",
  "currentVersion": 3,
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-15T14:30:00Z",
  "lastModifiedBy": "user_456",
  "eTag": "W/abc123def",
  "isPublished": false,
  "publishedVersion": null,
  "publicUrl": null,
  "hasUnpublishedChanges": false
}
```

### OfferVersion (Версия)
```json
{
  "_id": "version_789",
  "offerId": "offer_123",
  "userId": "user_456",
  "version": 3,
  "title": "Тур в Турцию",
  "content": {}, // снапшот на момент версии
  "description": "Добавил новые отели",
  "createdAt": "2024-01-15T14:30:00Z",
  "createdBy": "user_456"
}
```

### Publication (Публикация)
```json
{
  "_id": "pub_456",
  "offerId": "offer_123",
  "userId": "user_456",
  "version": 2,
  "publicUrl": "https://external-site.com/offers/abc123",
  "status": "active",
  "publishedAt": "2024-01-15T12:00:00Z",
  "publishedBy": "user_456",
  "externalId": "ext_abc123"
}
```

## Примеры использования

### Пример 1: Создание и редактирование предложения

```javascript
// 1. Создаем предложение
const offer = await createOffer({
  title: "Тур в Египет",
  content: {
    destination: "Egypt",
    hotels: ["Hotel A", "Hotel B"],
    price: 45000
  }
});
// Результат: offer v1, status: draft

// 2. Редактируем
await updateOffer(offer.id, {
  title: "Супер тур в Египет",
  content: {
    ...offer.content,
    hotels: ["Hotel A", "Hotel B", "Hotel C"]
  }
}, offer.eTag);
// Результат: offer v1 (обновлен), новый eTag

// 3. Создаем версию перед важными изменениями
await createVersion(offer.id, "Добавил третий отель");
// Результат: создана v2 со снапшотом текущих данных

// 4. Продолжаем редактирование
await updateOffer(offer.id, {
  content: {
    ...offer.content,
    excursions: ["Pyramids", "Nile cruise"]
  }
}, newETag);
// Результат: offer v2 (обновлен)
```

### Пример 2: Обработка конфликта

```javascript
// User A и User B редактируют одновременно
const offerA = await getOffer("offer_123"); // ETag: "v3"
const offerB = await getOffer("offer_123"); // ETag: "v3" 

// User B сохраняет первым
await updateOffer("offer_123", {
  title: "Изменение от User B"
}, "v3");
// Успех: новый ETag "v4"

// User A пытается сохранить
try {
  await updateOffer("offer_123", {
    title: "Изменение от User A"  
  }, "v3"); // устаревший ETag
} catch (conflict) {
  // 409 Conflict
  
  // User A выбирает разрешение
  if (userChoice === 'overwrite') {
    await resolveConflict("offer_123", {
      resolution: "overwrite",
      content: userAChanges
    });
    // Изменения User B потеряны
  } else {
    await resolveConflict("offer_123", {
      resolution: "create_version",
      content: userAChanges,
      versionDescription: "Мои изменения"
    });
    // Создана новая версия с изменениями User A
    // Изменения User B сохранены в предыдущей версии
  }
}
```

### Пример 3: Публикация предложения

```javascript
// 1. Подготавливаем предложение
await updateOffer("offer_123", finalData, currentETag);
await createVersion("offer_123", "Финальная версия для публикации");

// 2. Публикуем
const publication = await publishOffer("offer_123", {
  version: 4, // конкретная версия
  publishConfig: {
    template: "tour_template",
    domain: "mysite.com"
  }
});

// Результат:
// - status: "published"
// - publicUrl: "https://mysite.com/offers/abc123"
// - publishedVersion: 4

// 3. Продолжаем редактирование (создаются unpublished changes)
await updateOffer("offer_123", {
  title: "Обновленный заголовок"
}, currentETag);
// hasUnpublishedChanges: true

// 4. Обновляем публикацию
await publishOffer("offer_123", {
  version: 5 // или текущая версия
});
// Предыдущая публикация заменена новой
```

## Развертывание

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=mongodb://localhost:27017/travel-offers
JWT_SECRET=your-secret-key
EXTERNAL_PUBLISH_API=https://publisher.example.com/api
EXTERNAL_PUBLISH_KEY=api-key
```

### Docker Compose
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=mongodb://mongo:27017/travel-offers
      - JWT_SECRET=your-secret-key
    depends_on:
      - mongo
      
  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## Мониторинг и логирование

### Метрики
- Request latency
- Error rates по эндпоинтам
- Количество активных пользователей
- Размер базы данных
- Частота создания версий

### Логирование
```javascript
// Structured JSON logging
{
  "timestamp": "2024-01-15T14:30:00Z",
  "level": "info",
  "message": "Offer updated",
  "userId": "user_456",
  "offerId": "offer_123",
  "action": "update_offer",
  "eTag": "W/abc123",
  "requestId": "req_789"
}
```

## Безопасность

### Аутентификация
- JWT токены с истечением 24 часа
- Refresh токены для продления сессии
- Rate limiting: 1000 req/hour на пользователя

### Авторизация  
- Пользователи видят только свои предложения
- Админы имеют доступ ко всем данным
- API ключи для интеграций

### Валидация данных
- JSON Schema валидация входящих данных
- XSS protection
- SQL injection protection  
- Максимальный размер content: 10MB

## Ограничения и рекомендации

### Производительность
- Максимум 1000 версий на предложение
- Автоочистка версий старше 1 года
- Индексирование по userId, updatedAt, eTag
- Кэширование часто запрашиваемых данных

### Масштабирование
- Horizontal scaling через sharding по userId
- Read replicas для MongoDB
- CDN для статических ресурсов публикаций
- Load balancing для API серверов

### Backup и восстановление
- Ежедневные автоматические backup'ы
- Point-in-time recovery
- Тестирование процедур восстановления
- Хранение backup'ов в разных регионах

Данная документация предоставляет полное описание Travel Offers Server API для успешной разработки и интеграции.