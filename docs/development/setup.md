# Настройка окружения разработки

## Требования

### Системные требования

- **Node.js**: версия 18.0.0 или выше
- **npm**: версия 8.0.0 или выше
- **Git**: для работы с репозиторием
- **Docker**: для контейнеризации (опционально)

### Проверка версий

```bash
node --version  # Должно быть >= 18.0.0
npm --version   # Должно быть >= 8.0.0
git --version   # Любая современная версия
docker --version # Должно быть >= 20.0.0 (если используется)
```

## Установка

### 1. Клонирование репозитория

```bash
git clone https://github.com/your-org/travel-offer-api.git
cd travel-offer-api
```

### 2. Установка зависимостей

```bash
# Установка всех зависимостей
npm install

# Или с использованием yarn
yarn install
```

### 3. Настройка переменных окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Отредактируйте `.env` файл:

```bash
# Основные настройки
NODE_ENV=development
PORT=3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-for-development
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://chrome-extension://your-extension-id

# Logging
LOG_LEVEL=debug
LOG_FILE=logs/app.log

# Processing
MAX_HTML_SIZE=1048576
PROCESSING_TIMEOUT=30000
```

### 4. Создание необходимых директорий

```bash
# Создание директории для логов
mkdir -p logs

# Создание директории для тестовых данных
mkdir -p tests/fixtures
```

## Запуск приложения

### Режим разработки

```bash
# Запуск с автоматической перезагрузкой
npm run dev

# Или с использованием nodemon
npx nodemon src/app.js
```

### Режим продакшена

```bash
# Сборка проекта
npm run build

# Запуск в продакшене
npm start
```

### Проверка работоспособности

```bash
# Проверка health endpoint
curl http://localhost:3000/api/health

# Ожидаемый ответ
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "uptime": 123,
    "version": "1.0.0",
    "environment": "development"
  }
}
```

## Docker

### Сборка образа

```bash
# Сборка Docker образа
docker build -t travel-offer-api .

# Сборка с тегами
docker build -t travel-offer-api:latest -t travel-offer-api:1.0.0 .
```

### Запуск контейнера

```bash
# Запуск контейнера
docker run -p 3000:3000 --env-file .env travel-offer-api

# Запуск в фоновом режиме
docker run -d -p 3000:3000 --env-file .env --name travel-offer-api travel-offer-api
```

### Docker Compose

Создайте файл `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - PORT=3000
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  # Redis для кэширования (опционально)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

Запуск с Docker Compose:

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f api

# Остановка сервисов
docker-compose down
```

## Тестирование

### Запуск тестов

```bash
# Запуск всех тестов
npm test

# Запуск тестов в режиме watch
npm run test:watch

# Запуск тестов с покрытием
npm run test:coverage

# Запуск только unit тестов
npm run test:unit

# Запуск только integration тестов
npm run test:integration
```

### Проверка качества кода

```bash
# Линтинг
npm run lint

# Линтинг с автоматическим исправлением
npm run lint:fix

# Проверка типов (если используется TypeScript)
npm run type-check

# Проверка безопасности
npm audit

# Исправление уязвимостей
npm audit fix
```

## Инструменты разработки

### VS Code

Рекомендуемые расширения:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-node-debug2"
  ]
}
```

Настройки VS Code (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact"
  ],
  "files.exclude": {
    "**/node_modules": true,
    "**/logs": true,
    "**/.git": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/logs": true
  }
}
```

### Отладка

Настройка отладки в VS Code (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}/src/app.js",
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    },
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Process",
      "port": 9229,
      "restart": true
    }
  ]
}
```

## Мониторинг и логирование

### Просмотр логов

```bash
# Просмотр логов в реальном времени
tail -f logs/app.log

# Просмотр только ошибок
tail -f logs/error.log

# Поиск по логам
grep "ERROR" logs/app.log
```

### Метрики

```bash
# Проверка статуса API
curl http://localhost:3000/api/status

# Проверка метрик
curl http://localhost:3000/api/metrics
```

## Troubleshooting

### Частые проблемы

#### 1. Порт уже занят

```bash
# Поиск процесса, использующего порт 3000
lsof -i :3000

# Завершение процесса
kill -9 <PID>
```

#### 2. Проблемы с зависимостями

```bash
# Очистка кэша npm
npm cache clean --force

# Удаление node_modules и переустановка
rm -rf node_modules package-lock.json
npm install
```

#### 3. Проблемы с правами доступа

```bash
# Изменение прав на директорию логов
chmod 755 logs

# Изменение владельца файлов
sudo chown -R $USER:$USER .
```

#### 4. Проблемы с Docker

```bash
# Очистка Docker кэша
docker system prune -a

# Пересборка образа
docker build --no-cache -t travel-offer-api .
```

### Получение помощи

1. **Документация**: Проверьте эту документацию
2. **Issues**: Создайте issue в GitHub
3. **Discussions**: Используйте GitHub Discussions
4. **Logs**: Проверьте логи приложения

## Следующие шаги

После настройки окружения:

1. [Изучите архитектуру проекта](../architecture/README.md)
2. [Ознакомьтесь с API документацией](../api/README.md)
3. [Начните разработку](./coding-standards.md)
4. [Напишите тесты](./testing.md)