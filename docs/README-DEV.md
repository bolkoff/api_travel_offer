# Development Setup Guide

Руководство по настройке локального окружения разработки для Travel Offer API.

## Быстрый старт

### Требования
- Docker 20.0.0+
- Docker Compose 2.0.0+
- curl (для проверки health endpoints)
- jq (опционально, для форматирования JSON)

### Запуск окружения разработки

```bash
# Запуск всех сервисов
./scripts/dev-start.sh

# Или вручную
docker-compose -f docker/docker-compose.dev.yml up -d --build
```

### Остановка окружения

```bash
# Остановка всех сервисов
./scripts/dev-stop.sh

# Или вручную
docker-compose -f docker/docker-compose.dev.yml down
```

## Доступные сервисы

| Сервис | URL | Описание |
|--------|-----|----------|
| **API** | http://localhost:3000 | Travel Offer API |
| **Health Check** | http://localhost:3000/api/health | Проверка состояния API |
| **PgAdmin** | http://localhost:5050 | Веб-интерфейс PostgreSQL |
| **PostgreSQL** | localhost:5432 | База данных |
| **Redis** | localhost:6379 | Кэш и сессии |
| **Caddy** | http://localhost:80 | Reverse proxy |

## Доступы

### PostgreSQL
- **Host**: localhost:5432
- **Database**: element_db
- **User**: user
- **Password**: pass_secret

### PgAdmin
- **URL**: http://localhost:5050
- **Email**: vladimir@element.travel
- **Password**: jOz2!^ZLeY61U5

### Redis
- **Host**: localhost:6379
- **Без аутентификации**

## Разработка

### Hot Reload
API автоматически перезапускается при изменении файлов в папке `src/`:
- `src/` папка подмонтирована в контейнер
- Используется `nodemon` для отслеживания изменений
- Логи отображаются в реальном времени

### Просмотр логов

```bash
# Все сервисы
docker-compose -f docker/docker-compose.dev.yml logs -f

# Только API
docker-compose -f docker/docker-compose.dev.yml logs -f api

# Только PostgreSQL
docker-compose -f docker/docker-compose.dev.yml logs -f postgres
```

### Отладка

#### Подключение к контейнеру API
```bash
docker exec -it travel-offer-api-dev sh
```

#### Проверка состояния сервисов
```bash
docker-compose -f docker/docker-compose.dev.yml ps
```

#### Перезапуск API без пересборки
```bash
docker-compose -f docker/docker-compose.dev.yml restart api
```

#### Пересборка API
```bash
docker-compose -f docker/docker-compose.dev.yml up -d --build api
```

### База данных

#### Подключение к PostgreSQL
```bash
# Через контейнер
docker exec -it postgres-dev psql -U user -d element_db

# Или через host
psql -h localhost -p 5432 -U user -d element_db
```

#### Инициализация БД
Поместите SQL скрипты в папку `db/init/` - они автоматически выполнятся при первом запуске PostgreSQL.

### Переменные окружения

Файл `.env.dev` содержит настройки для разработки:
- Подключения к БД и Redis
- Настройки логирования
- Лимиты обработки
- Настройки безопасности (для dev режима)

## Устранение проблем

### Порты заняты
```bash
# Найти процессы на портах
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Остановить все контейнеры
docker-compose -f docker/docker-compose.dev.yml down
```

### Проблемы с правами
```bash
# Исправить права на логи
chmod 755 logs/

# Пересоздать volume для postgres
docker-compose -f docker/docker-compose.dev.yml down -v
docker volume rm travel_offer_api_postgres_data
```

### Очистка Docker ресурсов
```bash
# Остановить все контейнеры
docker-compose -f docker/docker-compose.dev.yml down

# Удалить неиспользуемые образы
docker system prune -a

# Удалить все volumes (ОСТОРОЖНО - потеряете данные БД)
docker-compose -f docker/docker-compose.dev.yml down -v
```

### API не отвечает
```bash
# Проверить статус
curl http://localhost:3000/api/health

# Проверить логи API
docker-compose -f docker/docker-compose.dev.yml logs api

# Перезапустить API
docker-compose -f docker/docker-compose.dev.yml restart api
```

## Полезные команды

```bash
# Статус всех сервисов
docker-compose -f docker/docker-compose.dev.yml ps

# Остановить определенный сервис
docker-compose -f docker/docker-compose.dev.yml stop api

# Запустить определенный сервис
docker-compose -f docker/docker-compose.dev.yml start api

# Посмотреть использование ресурсов
docker stats

# Очистка логов Docker
docker system prune --volumes
```