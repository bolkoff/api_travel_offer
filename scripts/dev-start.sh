#!/bin/bash

# Development startup script for Travel Offer API

echo "🚀 Запуск Travel Offer API в режиме разработки..."

# Создаем необходимые директории
echo "📁 Создание необходимых директорий..."
mkdir -p logs
mkdir -p db/init

# Проверяем наличие Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Пожалуйста, установите Docker."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Пожалуйста, установите Docker Compose."
    exit 1
fi

# Останавливаем существующие контейнеры
echo "🛑 Остановка существующих контейнеров..."
docker-compose -f docker/docker-compose.dev.yml down

# Пересборка API контейнера
echo "🔨 Пересборка API контейнера..."
docker-compose -f docker/docker-compose.dev.yml build api

# Запуск всех сервисов
echo "🚀 Запуск всех сервисов..."
docker-compose -f docker/docker-compose.dev.yml up -d

# Ожидание запуска сервисов
echo "⏳ Ожидание запуска сервисов..."
sleep 10

# Проверка состояния сервисов
echo "🔍 Проверка состояния сервисов..."
docker-compose -f docker/docker-compose.dev.yml ps

# Проверка health endpoints
echo "🏥 Проверка health endpoints..."
echo "API Health Check:"
curl -f http://localhost:3000/api/health 2>/dev/null | jq . || echo "API еще не готов"

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "🌐 Доступные сервисы:"
echo "  - API: http://localhost:3000"
echo "  - API Health: http://localhost:3000/api/health"
echo "  - PgAdmin: http://localhost:5050"
echo "  - Redis: localhost:6379"
echo "  - PostgreSQL: localhost:5432"
echo ""
echo "📊 Для просмотра логов:"
echo "  docker-compose -f docker/docker-compose.dev.yml logs -f api"
echo ""
echo "🛑 Для остановки:"
echo "  docker-compose -f docker/docker-compose.dev.yml down"