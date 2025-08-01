#!/bin/bash

# Скрипт для запуска разработки Travel Offer API в Docker

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для вывода
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка наличия Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker не установлен"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose не установлен"
        exit 1
    fi
}

# Проверка существующей сети
check_network() {
    local network_name="your-existing-network-name"  # Замените на имя вашей сети
    
    if ! docker network ls | grep -q "$network_name"; then
        log_warning "Сеть $network_name не найдена. Создаем..."
        docker network create "$network_name" || {
            log_error "Не удалось создать сеть $network_name"
            exit 1
        }
    fi
}

# Сборка и запуск контейнеров
start_dev() {
    log_info "Запуск среды разработки..."
    
    # Остановка существующих контейнеров
    docker-compose -f docker-compose.dev.yml down
    
    # Сборка образов
    log_info "Сборка Docker образов..."
    docker-compose -f docker-compose.dev.yml build --no-cache
    
    # Запуск контейнеров
    log_info "Запуск контейнеров..."
    docker-compose -f docker-compose.dev.yml up -d
    
    # Ожидание запуска
    log_info "Ожидание запуска сервисов..."
    sleep 10
    
    # Проверка здоровья
    check_health
}

# Проверка здоровья сервисов
check_health() {
    log_info "Проверка здоровья сервисов..."
    
    # Проверка API
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        log_success "API доступен на http://localhost:3001"
    else
        log_error "API недоступен"
        return 1
    fi
    
    # Проверка Redis
    if docker exec travel-offer-api-redis-dev redis-cli ping > /dev/null 2>&1; then
        log_success "Redis доступен"
    else
        log_warning "Redis недоступен"
    fi
}

# Остановка контейнеров
stop_dev() {
    log_info "Остановка среды разработки..."
    docker-compose -f docker-compose.dev.yml down
    log_success "Среда разработки остановлена"
}

# Просмотр логов
logs() {
    local service=${1:-travel-offer-api-dev}
    log_info "Просмотр логов для $service..."
    docker-compose -f docker-compose.dev.yml logs -f "$service"
}

# Перезапуск сервиса
restart() {
    local service=${1:-travel-offer-api-dev}
    log_info "Перезапуск $service..."
    docker-compose -f docker-compose.dev.yml restart "$service"
    log_success "$service перезапущен"
}

# Очистка
clean() {
    log_info "Очистка Docker ресурсов..."
    docker-compose -f docker-compose.dev.yml down -v
    docker system prune -f
    log_success "Очистка завершена"
}

# Подключение к контейнеру
shell() {
    local service=${1:-travel-offer-api-dev}
    log_info "Подключение к контейнеру $service..."
    docker-compose -f docker-compose.dev.yml exec "$service" sh
}

# Обновление зависимостей
update_deps() {
    log_info "Обновление зависимостей..."
    docker-compose -f docker-compose.dev.yml exec travel-offer-api-dev npm install
    log_success "Зависимости обновлены"
}

# Запуск тестов
test() {
    log_info "Запуск тестов..."
    docker-compose -f docker-compose.dev.yml exec travel-offer-api-dev npm test
}

# Линтинг
lint() {
    log_info "Проверка кода..."
    docker-compose -f docker-compose.dev.yml exec travel-offer-api-dev npm run lint
}

# Помощь
show_help() {
    echo "Использование: $0 [команда]"
    echo ""
    echo "Команды:"
    echo "  start     - Запуск среды разработки"
    echo "  stop      - Остановка среды разработки"
    echo "  restart   - Перезапуск сервиса (по умолчанию: travel-offer-api-dev)"
    echo "  logs      - Просмотр логов (по умолчанию: travel-offer-api-dev)"
    echo "  shell     - Подключение к контейнеру (по умолчанию: travel-offer-api-dev)"
    echo "  test      - Запуск тестов"
    echo "  lint      - Проверка кода"
    echo "  update    - Обновление зависимостей"
    echo "  clean     - Очистка Docker ресурсов"
    echo "  health    - Проверка здоровья сервисов"
    echo "  help      - Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0 start"
    echo "  $0 logs redis-dev"
    echo "  $0 shell"
}

# Основная логика
main() {
    case "${1:-help}" in
        start)
            check_docker
            check_network
            start_dev
            ;;
        stop)
            stop_dev
            ;;
        restart)
            restart "$2"
            ;;
        logs)
            logs "$2"
            ;;
        shell)
            shell "$2"
            ;;
        test)
            test
            ;;
        lint)
            lint
            ;;
        update)
            update_deps
            ;;
        clean)
            clean
            ;;
        health)
            check_health
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Неизвестная команда: $1"
            show_help
            exit 1
            ;;
    esac
}

# Запуск скрипта
main "$@" 