# API Endpoints

## Анализ HTML контента

### POST /api/analyze

Анализирует HTML элементы и извлекает объекты согласно схеме `travel_objects_schema.json`.

#### Запрос

**Content-Type:** `application/json`

**Body:**
```json
{
  "html_elements": [
    {
      "content": "<div class=\"tour-offer\">Тур в Турцию, 7 дней, от 50000 руб</div>"
    },
    {
      "content": "<div class=\"flight-option\">Москва - Стамбул, от 15000 руб</div>"
    }
  ]
}
```

#### Параметры

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `html_elements` | Array | Да | Массив HTML элементов для анализа |
| `html_elements[].content` | String | Да | HTML контент элемента |

#### Ответ

**Успешный ответ (200):**
```json
{
  "success": true,
  "message": "Анализ завершен",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "total_elements": 2,
  "analyzed_elements": 2,
  "found_objects": [
    {
      "proposal_id": "prop_123",
      "created_at": "2024-01-01T12:00:00.000Z",
      "status": "draft",
      "general": {
        "title": "Тур в Турцию",
        "destination": "Турция",
        "travel_period": {
          "start": "2024-06-01",
          "end": "2024-06-08"
        },
        "total_price": {
          "amount": 50000,
          "currency": "RUB"
        }
      }
    }
  ],
  "errors": []
}
```

**Ошибка валидации (400):**
```json
{
  "error": "Неверный формат данных",
  "message": "html_elements должен быть массивом"
}
```

**Ошибка сервера (500):**
```json
{
  "error": "Ошибка при анализе HTML",
  "message": "Детали ошибки"
}
```

#### Поля ответа

| Поле | Тип | Описание |
|------|-----|----------|
| `success` | Boolean | Статус выполнения |
| `message` | String | Сообщение о результате |
| `timestamp` | String | Время выполнения анализа |
| `total_elements` | Number | Общее количество элементов |
| `analyzed_elements` | Number | Количество успешно проанализированных элементов |
| `found_objects` | Array | Найденные объекты согласно схеме |
| `errors` | Array | Массив ошибок при анализе |

#### Примеры использования

**cURL:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "html_elements": [
      {
        "content": "<div class=\"tour-offer\">Тур в Турцию, 7 дней, от 50000 руб</div>"
      }
    ]
  }'
```

**JavaScript:**
```javascript
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    html_elements: [
      {
        content: '<div class="tour-offer">Тур в Турцию, 7 дней, от 50000 руб</div>'
      }
    ]
  })
});

const result = await response.json();
```

#### Примечания

- Анализ выполняется через n8n workflow `/webhook-analyze-html`
- Возвращаемые объекты соответствуют схеме `travel_objects_schema.json`
- Поддерживается анализ множественных HTML элементов в одном запросе
- При ошибке анализа конкретного элемента, остальные элементы продолжают обрабатываться
- Максимальный размер HTML контента ограничен настройками сервера
