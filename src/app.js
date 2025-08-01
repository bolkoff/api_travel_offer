const express = require('express');
const N8nService = require('./services/n8nService');

const app = express();
const port = process.env.PORT || 3000;

// Инициализация сервиса n8n
const n8nService = new N8nService();

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

// Тестовый маршрут для API с проверкой n8n
app.get('/api/test', async (req, res) => {
  try {
    // Проверяем доступность n8n
    const n8nHealth = await n8nService.checkHealth();
    
    res.json({
      message: 'API тестовый endpoint работает!',
      data: {
        redis_url: process.env.REDIS_URL || 'не настроен',
        node_env: process.env.NODE_ENV,
        port: port,
        n8n: {
          config: n8nService.getConfig(),
          health: n8nHealth
        }
      }
    });
  } catch (error) {
    console.error('Ошибка в /api/test:', error);
    res.status(500).json({
      error: 'Ошибка при выполнении теста',
      message: error.message
    });
  }
});

// Специальный endpoint для тестового webhook
app.post('/api/n8n/test-webhook', async (req, res) => {
  try {
    const data = req.body;
    const webhookPath = '/webhook-test/151c376e-fb7f-4af6-a425-fc0f91f955b3';
    
    console.log('Запускаем тестовый webhook');
    console.log('Данные:', data); 

    const result = await n8nService.triggerWebhook(webhookPath, data);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Тестовый webhook выполнен успешно',
        webhook: webhookPath,
        result: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Ошибка при выполнении тестового webhook',
        message: result.error,
        webhook: webhookPath
      });
    }
  } catch (error) {
    console.error('Ошибка при выполнении тестового webhook:', error);
    res.status(500).json({
      error: 'Ошибка при выполнении тестового webhook',
      message: error.message
    });
  }
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
  console.log(` Health check: http://localhost:${port}/api/health`);
  console.log(` Тестовый endpoint: http://localhost:${port}/api/test`);
  console.log(`🔗 Тестовый webhook: POST http://localhost:${port}/api/n8n/test-webhook`);
  console.log(`🔗 Универсальный webhook: POST http://localhost:${port}/api/n8n/webhook/{name}/{id}`);
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