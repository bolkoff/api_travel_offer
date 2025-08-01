# Travel Offer API

REST API для анализа HTML контента и извлечения структурированных данных о туристических предложениях.

## �� Быстрый старт

### Требования

- Node.js 18.0.0 или выше
- npm 8.0.0 или выше

### Установка

```bash
# Клонирование репозитория
git clone https://github.com/your-org/travel-offer-api.git
cd travel-offer-api

# Установка зависимостей
npm install

# Настройка переменных окружения
cp .env.example .env
# Отредактируйте .env файл

# Запуск в режиме разработки
npm run dev
```

### Проверка работоспособности

```bash
# Health check
curl http://localhost:3000/api/health

# Статус API
curl http://localhost:3000/api/status
```

## 📚 Документация

- [Обзор проекта](docs/project-overview.md)
- [API Документация](docs/api/README.md)
- [Архитектура](docs/architecture/README.md)
- [Руководство разработчика](docs/development/README.md)

## 🛠️ Разработка

### Запуск тестов

```bash
# Все тесты
npm test

# Тесты в режиме watch
npm run test:watch

# Покрытие кода
npm run test:coverage

# Unit тесты
npm run test:unit

# Integration тесты
npm run test:integration
```

### Линтинг и форматирование

```bash
# Проверка кода
npm run lint

# Автоматическое исправление
npm run lint:fix

# Форматирование кода
npm run format
```

### Docker

```bash
# Сборка образа
npm run docker:build

# Запуск контейнера
npm run docker:run

# Docker Compose
npm run docker:compose
```

## �� API Endpoints

### Основные endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `POST` | `/api/analyze-html` | Анализ HTML контента |
| `GET` | `/api/health` | Проверка состояния |
| `GET` | `/api/status` | Статус и метрики |

### Пример использования

```javascript
const response = await fetch('http://localhost:3000/api/analyze-html', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    html: '<div class="hotel">Grand Hotel Paris</div>',
    url: 'https://example.com/hotel',
    options: {
      extractImages: true,
      extractPrices: true
    }
  })
});

const result = await response.json();
console.log(result.data.contentType); // 'hotel_card'
```

## 🔧 Конфигурация

Основные настройки в файле `.env`:

```bash
# Основные настройки
NODE_ENV=development
PORT=3000

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
```

## 🏗️ Архитектура

Проект построен на принципах микросервисной архитектуры:

- **Express.js** - веб-фреймворк
- **JWT** - аутентификация
- **Cheerio/JSDOM** - парсинг HTML
- **Winston** - логирование
- **Jest** - тестирование

## 📊 Мониторинг

- Health checks: `/api/health`
- Метрики: `/api/metrics`
- Статус: `/api/status`
- Логи: `logs/app.log`

## �� Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## �� Поддержка

- **Issues**: [GitHub Issues](https://github.com/your-org/travel-offer-api/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/travel-offer-api/discussions)
- **Документация**: [docs/](docs/)

## ��️ Дорожная карта

- [x] Базовая архитектура
- [x] JWT аутентификация
- [x] HTML анализ
- [ ] Продвинутый анализ контента
- [ ] Кэширование
- [ ] Мониторинг
- [ ] CI/CD pipeline