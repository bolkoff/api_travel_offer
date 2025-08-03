const express = require('express');
const N8nService = require('./services/n8nService');
const HtmlAnalyzer = require('./services/htmlAnalyzer');

const app = express();
const port = process.env.PORT || 3000;

// Инициализация сервисов
const n8nService = new N8nService();
const htmlAnalyzer = new HtmlAnalyzer();
htmlAnalyzer.setN8nService(n8nService);

// Middleware для парсинга JSON
app.use(express.json({ limit: '10mb' })); // Увеличиваем лимит для больших HTML

// Middleware для логирования
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Базовый маршрут
app.get('/', (req, res) => {
  res.status(404).json({
    message: 'Маршрут не найден',
    path: req.originalUrl
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

// Анализ HTML элементов
app.post('/api/analyze', async (req, res) => {
  try {
    const { html_elements, mode } = req.body;

    // Валидация входных данных
    if (!html_elements || !Array.isArray(html_elements)) {
      return res.status(400).json({
        error: 'Неверный формат данных',
        message: 'html_elements должен быть массивом'
      });
    }

    if (html_elements.length === 0) {
      return res.status(400).json({
        error: 'Пустой массив',
        message: 'html_elements не может быть пустым'
      });
    }

    // Проверяем структуру элементов - только content
    for (let i = 0; i < html_elements.length; i++) {
      const element = html_elements[i];
      if (!element.content) {
        return res.status(400).json({
          error: 'Неверная структура элемента',
          message: `Элемент ${i} должен содержать поле content`
        });
      }
    }

    // Валидация режима анализа
    if (mode && !['html', 'markdown'].includes(mode)) {
      return res.status(400).json({
        error: 'Неверный режим анализа',
        message: 'mode должен быть "html" или "markdown"'
      });
    }

    console.log(`Начинаем анализ ${html_elements.length} HTML элементов`);
    console.log(`Режим анализа: ${mode || 'html'}`);

    // Выполняем анализ
    const analysisResult = await htmlAnalyzer.analyzeHtmlElements(html_elements, { mode });

    res.json({
      success: true,
      message: 'Анализ завершен',
      ...analysisResult
    });

  } catch (error) {
    console.error('Ошибка в /api/analyze:', error);
    res.status(500).json({
      error: 'Ошибка при анализе HTML',
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
  console.log(`🔍 Анализ HTML: POST http://localhost:${port}/api/analyze`);
  console.log(`🔗 Тестовый webhook: POST http://localhost:${port}/api/n8n/test-webhook`);
  console.log(` N8N webhooks: http://localhost:${port}/api/n8n/webhooks`);
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