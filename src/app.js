const express = require('express');

// Импорты сервисов и контроллеров
const AuthService = require('./services/AuthService');
const OfferService = require('./services/OfferService');
const OfferRepository = require('./repositories/OfferRepository');
const OfferController = require('./controllers/OfferController');
const { db } = require('./config/database');

class App {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupDependencies();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Парсинг JSON
    this.app.use(express.json({ limit: '10mb' }));
    
    // CORS для разработки
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, If-Match');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Логирование запросов
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`${timestamp} ${req.method} ${req.path}`, req.query, req.headers);
      next();
    });
  }

  setupDependencies() {
    // Инициализация слоев по принципу DI
    this.offerRepository = new OfferRepository();
    this.authService = new AuthService();
    this.offerService = new OfferService(this.offerRepository);
    
    // Контроллеры
    this.offerController = new OfferController(this.offerService, this.authService);
  }

  setupRoutes() {
    // Health check with database connectivity
    this.app.get('/api/health', async (req, res) => {
      const timestamp = new Date().toISOString();
      
      try {
        // Проверяем подключение к базе данных
        const dbHealthy = await db.healthCheck();
        const connectionInfo = db.getConnectionInfo();
        
        res.json({
          status: 'healthy',
          timestamp,
          version: '1.0.0',
          database: {
            connected: dbHealthy,
            ...connectionInfo
          }
        });
      } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
          status: 'unhealthy',
          timestamp,
          version: '1.0.0',
          database: {
            connected: false,
            error: error.message
          }
        });
      }
    });

    // Offers routes
    this.app.get('/api/offers', this.offerController.getOffers.bind(this.offerController));
    this.app.post('/api/offers', this.offerController.createOffer.bind(this.offerController));
    this.app.get('/api/offers/:id', this.offerController.getOfferById.bind(this.offerController));
    this.app.put('/api/offers/:id', this.offerController.updateOffer.bind(this.offerController));
    this.app.delete('/api/offers/:id', this.offerController.deleteOffer.bind(this.offerController));

    // Version management routes
    this.app.get('/api/offers/:id/versions', this.offerController.getVersions.bind(this.offerController));
    this.app.post('/api/offers/:id/versions', this.offerController.createVersion.bind(this.offerController));
    this.app.get('/api/offers/:id/versions/:version', this.offerController.getVersion.bind(this.offerController));
    this.app.post('/api/offers/:id/versions/:version/restore', this.offerController.restoreVersion.bind(this.offerController));
    this.app.post('/api/offers/:id/versions/:version/switch', this.offerController.switchToVersion.bind(this.offerController));

    // Мок эндпоинт для получения токена (для тестирования)
    this.app.post('/api/auth/token', async (req, res, next) => {
      try {
        const { username } = req.body;
        
        if (!username) {
          return res.status(400).json({
            error: 'validation_error',
            message: 'Username is required'
          });
        }

        const result = await this.authService.getToken(username);
        res.json(result);
      } catch (error) {
        if (error.message === 'User not found') {
          return res.status(401).json({
            error: 'user_not_found',
            message: 'User not found'
          });
        }
        next(error);
      }
    });

    // 404 для неизвестных путей
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'not_found',
        message: 'Endpoint not found'
      });
    });
  }

  setupErrorHandling() {
    // Глобальная обработка ошибок
    this.app.use((error, req, res, next) => {
      console.error('Error:', error);

      // Валидационные ошибки
      if (error.message.includes('Invalid')) {
        return res.status(400).json({
          error: 'validation_error',
          message: error.message
        });
      }

      // Общие ошибки сервера
      res.status(500).json({
        error: 'internal_server_error',
        message: 'An unexpected error occurred'
      });
    });
  }

  getExpressApp() {
    return this.app;
  }
}

module.exports = App;