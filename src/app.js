const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware для парсинга JSON
app.use(express.json());

// Middleware для логирования
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Базовый маршрут
app.get('/', (req, res) => {
  res.json({
    message: 'Travel Offer API работает!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// Тестовый маршрут для API
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API тестовый endpoint работает!',
    data: {
      redis_url: process.env.REDIS_URL || 'не настроен',
      node_env: process.env.NODE_ENV,
      port: port
    }
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка:', err);
  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    message: err.message
  });
});

// Обработка 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Маршрут не найден',
    path: req.originalUrl
  });
});

// Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${port}`);
  console.log(`�� Health check: http://localhost:${port}/api/health`);
  console.log(`�� Тестовый endpoint: http://localhost:${port}/api/test`);
  console.log(`🌍 Окружение: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Получен SIGTERM, завершаем работу...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Получен SIGINT, завершаем работу...');
  process.exit(0);
});