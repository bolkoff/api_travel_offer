# Управление статусами публикации

## Обзор системы

Система управления публикацией предложений на внешний веб-сервер с контролем статусов и ограничением на одну опубликованную версию.

### Ключевые принципы

1. **Единственная публикация** - только одна версия предложения может быть опубликована одновременно
2. **Простые статусы** - draft, published, archived
3. **Внешняя публикация** - интеграция с внешним веб-сервером для размещения
4. **Контроль изменений** - отслеживание изменений после публикации

## Статусы предложений

### 1. Draft (Черновик)
- **Описание**: Предложение в разработке, не опубликовано
- **Доступные действия**: редактирование, создание версий, публикация
- **Ограничения**: нет

### 2. Published (Опубликовано)
- **Описание**: Предложение опубликовано на внешнем сервере
- **Доступные действия**: редактирование (создает unpublished changes), снятие с публикации
- **Ограничения**: только одна версия может быть опубликована

### 3. Archived (Архивировано)  
- **Описание**: Предложение архивировано, не используется
- **Доступные действия**: восстановление в draft, удаление
- **Ограничения**: нельзя публиковать, редактирование ограничено

## Модель данных публикации

### Offer Document
```javascript
{
  "_id": "offer_123",
  "userId": "user_456",
  "title": "Тур в Турцию",
  "content": {...},
  "status": "published", // draft | published | archived
  "currentVersion": 3,
  "isPublished": true,
  "publishedVersion": 2, // какая версия опубликована
  "publishedAt": "2024-01-15T12:00:00Z",
  "publicUrl": "https://external-site.com/offers/abc123",
  "hasUnpublishedChanges": true, // есть ли изменения после публикации
  "eTag": "W/abc123def"
}
```

### Publication Record
```javascript
{
  "_id": "pub_789",
  "offerId": "offer_123",
  "userId": "user_456", 
  "version": 2, // опубликованная версия
  "publicUrl": "https://external-site.com/offers/abc123",
  "status": "active", // active | inactive
  "publishedAt": "2024-01-15T12:00:00Z",
  "publishedBy": "user_456",
  "externalId": "ext_abc123", // ID на внешнем сервере
  "publishConfig": {
    "template": "tour_template",
    "domain": "mysite.com"
  }
}
```

## API для управления публикацией

### 1. Получить статус публикации

```javascript
GET /api/offers/{id}/publication

Response:
{
  "isPublished": true,
  "currentPublication": {
    "version": 2,
    "publishedAt": "2024-01-15T12:00:00Z",
    "publicUrl": "https://external-site.com/offers/abc123",
    "status": "active"
  },
  "hasUnpublishedChanges": true,
  "currentVersion": 3 // текущая версия предложения
}
```

### 2. Опубликовать предложение

```javascript
POST /api/offers/{id}/publish

Request:
{
  "version": 3, // optional, по умолчанию текущая версия
  "publishConfig": {
    "template": "tour_template", // optional
    "domain": "mysite.com" // optional
  }
}

Response:
{
  "published": true,
  "version": 3,
  "publicUrl": "https://external-site.com/offers/def456",
  "publishedAt": "2024-01-15T16:30:00Z",
  "previousPublication": {
    "version": 2,
    "unpublishedAt": "2024-01-15T16:30:00Z"
  }
}
```

### 3. Снять с публикации

```javascript
DELETE /api/offers/{id}/publication

Response:
{
  "unpublished": true,
  "unpublishedAt": "2024-01-15T17:00:00Z",
  "removedFromUrl": "https://external-site.com/offers/abc123"
}
```

### 4. Изменить статус предложения

```javascript
PATCH /api/offers/{id}/status

Request:
{
  "status": "archived" // draft | published | archived
}

Response:
{
  "success": true,
  "newStatus": "archived",
  "updatedAt": "2024-01-15T18:00:00Z",
  "warnings": [
    "Предложение было снято с публикации при архивировании"
  ]
}
```

## Бизнес-логика публикации

### 1. Правила публикации

```javascript
class PublicationService {
  async publishOffer(offerId, version, config) {
    const offer = await this.getOffer(offerId);
    
    // Проверяем возможность публикации
    if (offer.status === 'archived') {
      throw new Error('Cannot publish archived offer');
    }
    
    // Снимаем с публикации предыдущую версию
    if (offer.isPublished) {
      await this.unpublishVersion(offer.publishedVersion);
    }
    
    // Публикуем новую версию
    const externalUrl = await this.publishToExternalServer(offer, version, config);
    
    // Обновляем статус предложения
    await this.updateOfferPublication(offerId, {
      status: 'published',
      isPublished: true,
      publishedVersion: version,
      publishedAt: new Date().toISOString(),
      publicUrl: externalUrl,
      hasUnpublishedChanges: false
    });
    
    return externalUrl;
  }
  
  async unpublishOffer(offerId) {
    const offer = await this.getOffer(offerId);
    
    if (!offer.isPublished) {
      throw new Error('Offer is not published');
    }
    
    // Удаляем с внешнего сервера
    await this.removeFromExternalServer(offer.publicUrl);
    
    // Обновляем статус
    await this.updateOfferPublication(offerId, {
      status: 'draft',
      isPublished: false,
      publishedVersion: null,
      publicUrl: null
    });
    
    // Деактивируем запись публикации
    await this.deactivatePublication(offer.publicUrl);
  }
}
```

### 2. Обработка изменений после публикации

```javascript
class OfferUpdateService {
  async updateOffer(offerId, changes) {
    const offer = await this.getOffer(offerId);
    
    // Сохраняем изменения
    await this.saveChanges(offerId, changes);
    
    // Если предложение опубликовано - отмечаем unpublished changes
    if (offer.isPublished && offer.currentVersion !== offer.publishedVersion) {
      await this.markUnpublishedChanges(offerId, true);
    }
    
    return updatedOffer;
  }
  
  async createVersion(offerId, description) {
    const offer = await this.getOffer(offerId);
    const newVersion = await this.saveVersion(offerId, description);
    
    // Если есть опубликованная версия - отмечаем что есть изменения
    if (offer.isPublished) {
      await this.markUnpublishedChanges(offerId, true);
    }
    
    return newVersion;
  }
}
```

## UI для управления публикацией

### 1. Статус публикации в интерфейсе

```javascript
const PublicationStatus = ({ offer }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'gray';
      case 'published': return 'green'; 
      case 'archived': return 'orange';
      default: return 'gray';
    }
  };
  
  return (
    <div className="publication-status">
      <span className={`status-badge ${getStatusColor(offer.status)}`}>
        {offer.status === 'draft' && '📝 Черновик'}
        {offer.status === 'published' && '🌐 Опубликовано'}
        {offer.status === 'archived' && '📦 Архив'}
      </span>
      
      {offer.isPublished && (
        <div className="publication-details">
          <a href={offer.publicUrl} target="_blank" rel="noopener">
            Просмотр на сайте ↗
          </a>
          <span className="published-version">
            Версия {offer.publishedVersion}
          </span>
          {offer.hasUnpublishedChanges && (
            <span className="unpublished-changes">
              ⚠️ Есть неопубликованные изменения
            </span>
          )}
        </div>
      )}
    </div>
  );
};
```

### 2. Панель управления публикацией

```javascript
const PublicationControls = ({ offer, onPublish, onUnpublish, onArchive }) => {
  const [isPublishing, setIsPublishing] = useState(false);
  
  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish(offer.currentVersion);
    } finally {
      setIsPublishing(false);
    }
  };
  
  return (
    <div className="publication-controls">
      {offer.status === 'draft' && (
        <button 
          className="btn-primary"
          onClick={handlePublish}
          disabled={isPublishing}
        >
          {isPublishing ? 'Публикуем...' : '🌐 Опубликовать'}
        </button>
      )}
      
      {offer.status === 'published' && (
        <>
          {offer.hasUnpublishedChanges && (
            <button 
              className="btn-primary"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? 'Обновляем...' : '🔄 Обновить публикацию'}
            </button>
          )}
          
          <button 
            className="btn-secondary"
            onClick={onUnpublish}
          >
            📤 Снять с публикации
          </button>
        </>
      )}
      
      {offer.status !== 'archived' && (
        <button 
          className="btn-warning"
          onClick={() => onArchive(offer.id)}
        >
          📦 В архив
        </button>
      )}
      
      {offer.status === 'archived' && (
        <button 
          className="btn-secondary"
          onClick={() => onRestore(offer.id)}
        >
          📝 Восстановить
        </button>
      )}
    </div>
  );
};
```

### 3. Диалог публикации

```javascript
const PublishDialog = ({ offer, onPublish, onCancel }) => {
  const [selectedVersion, setSelectedVersion] = useState(offer.currentVersion);
  const [publishConfig, setPublishConfig] = useState({
    template: 'default',
    domain: 'mysite.com'
  });
  
  const handlePublish = () => {
    onPublish(selectedVersion, publishConfig);
  };
  
  return (
    <div className="publish-dialog">
      <h3>Опубликовать предложение</h3>
      
      <div className="form-group">
        <label>Версия для публикации:</label>
        <select 
          value={selectedVersion}
          onChange={(e) => setSelectedVersion(parseInt(e.target.value))}
        >
          <option value={offer.currentVersion}>
            Версия {offer.currentVersion} (текущая)
          </option>
          {/* Добавить другие версии */}
        </select>
      </div>
      
      <div className="form-group">
        <label>Шаблон:</label>
        <select 
          value={publishConfig.template}
          onChange={(e) => setPublishConfig({...publishConfig, template: e.target.value})}
        >
          <option value="default">Стандартный</option>
          <option value="tour_template">Туристический</option>
          <option value="business_template">Деловой</option>
        </select>
      </div>
      
      {offer.isPublished && (
        <div className="warning">
          ⚠️ Текущая публикация будет заменена новой версией
        </div>
      )}
      
      <div className="actions">
        <button className="btn-primary" onClick={handlePublish}>
          Опубликовать
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
};
```

## Интеграция с внешним сервером

### 1. Сервис публикации

```javascript
class ExternalPublishingService {
  constructor(config) {
    this.apiEndpoint = config.externalApiUrl;
    this.apiKey = config.apiKey;
  }
  
  async publishOffer(offer, version, config) {
    const versionData = await this.getOfferVersion(offer.id, version);
    
    const publishData = {
      title: versionData.title,
      content: versionData.content,
      template: config.template || 'default',
      domain: config.domain,
      metadata: {
        offerId: offer.id,
        version: version,
        publishedAt: new Date().toISOString()
      }
    };
    
    const response = await fetch(`${this.apiEndpoint}/publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(publishData)
    });
    
    if (!response.ok) {
      throw new Error(`Publication failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.publicUrl;
  }
  
  async unpublishOffer(publicUrl) {
    const externalId = this.extractIdFromUrl(publicUrl);
    
    const response = await fetch(`${this.apiEndpoint}/unpublish/${externalId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Unpublish failed: ${response.statusText}`);
    }
    
    return true;
  }
}
```

## Workflow управления статусами

### Переходы статусов

```
Draft ──publish──→ Published
  ↑                    ↓
archive            unpublish
  ↓                    ↓  
Archived ←─restore─── Draft

Published ─archive→ Archived (+ auto unpublish)
```

### Бизнес-правила

1. **Из Draft можно**: публиковать, архивировать
2. **Из Published можно**: снимать с публикации (→ Draft), архивировать (+ auto unpublish)
3. **Из Archived можно**: восстанавливать (→ Draft), удалять
4. **При публикации**: предыдущая публикация автоматически снимается
5. **При архивировании**: автоматически снимается с публикации если было опубликовано

Данная система обеспечивает простое и понятное управление жизненным циклом предложений с возможностью публикации на внешних ресурсах.