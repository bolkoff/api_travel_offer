#!/bin/bash

# Development stop script for Travel Offer API

echo "🛑 Остановка Travel Offer API развертывания..."

# Остановка и удаление контейнеров
docker-compose -f docker/docker-compose.dev.yml down

echo "🧹 Очистка неиспользуемых ресурсов..."
docker system prune -f

echo "✅ Все сервисы остановлены!"