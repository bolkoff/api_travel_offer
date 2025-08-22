class OfferController {
  constructor(offerService, authService) {
    this.offerService = offerService;
    this.authService = authService;
  }

  /**
   * GET /api/offers - Получить список предложений пользователя
   */
  async getOffers(req, res, next) {
    try {
      // Извлечение токена из заголовка Authorization
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized', 
          message: 'Invalid or expired token'
        });
      }

      // Извлечение query параметров
      const {
        status,
        limit,
        offset,
        orderBy,
        order
      } = req.query;

      // Получение предложений через сервис
      const result = await this.offerService.getUserOffers(user.id, {
        status,
        limit,
        offset,
        orderBy,
        order
      });

      // Генерация ETag для списка предложений
      const ETag = require('../utils/ETag');
      const responseData = {
        offers: result.offers,
        total: result.total,
        limit: result.limit,
        offset: result.offset
      };
      const etag = ETag.generate(responseData);

      // Проверка If-None-Match для кэширования
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ETag.compare(ifNoneMatch, etag)) {
        return res.status(304).end(); // Not Modified
      }

      // Успешный ответ с ETag (согласно спецификации)
      res.header('ETag', etag)
         .json(responseData);

    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/offers - Создать новое предложение
   */
  async createOffer(req, res, next) {
    try {
      // Проверка токена
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Извлечение данных из тела запроса
      const { title, content, status } = req.body;

      // Создание предложения через сервис
      const newOffer = await this.offerService.createOffer(user.id, {
        title,
        content,
        status
      });

      // Успешный ответ с ETag заголовком (согласно спецификации)
      res.status(201)
         .header('ETag', newOffer.eTag)
         .json(newOffer);

    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/offers/:id - Удалить предложение
   */
  async deleteOffer(req, res, next) {
    try {
      // Проверка токена
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Извлечение ID предложения из параметров URL
      const { id: offerId } = req.params;

      // Удаление предложения через сервис
      await this.offerService.deleteOffer(offerId, user.id);

      // Успешный ответ без тела (204 No Content)
      res.status(204).send();

    } catch (error) {
      // Если предложение не найдено или нет доступа
      if (error.message === 'Offer not found or access denied') {
        return res.status(404).json({
          error: 'not_found',
          message: 'Offer not found'
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/offers/:id - Получить предложение по ID
   */
  async getOfferById(req, res, next) {
    try {
      // Проверка токена
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Извлечение ID предложения из параметров URL
      const { id: offerId } = req.params;

      // Получение предложения через сервис
      const offer = await this.offerService.getOfferById(offerId, user.id);

      // Проверка If-None-Match для кэширования
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch) {
        const ETag = require('../utils/ETag');
        if (ETag.compare(ifNoneMatch, offer.eTag)) {
          return res.status(304).end(); // Not Modified
        }
      }

      // Успешный ответ с ETag заголовком (согласно спецификации)
      res.header('ETag', offer.eTag)
         .json(offer);

    } catch (error) {
      // Если предложение не найдено или нет доступа
      if (error.message === 'Offer not found') {
        return res.status(404).json({
          error: 'not_found',
          message: 'Offer not found'
        });
      }
      next(error);
    }
  }

  /**
   * PUT /api/offers/:id - Обновить предложение (полная замена)
   */
  async updateOffer(req, res, next) {
    try {
      // Проверка токена
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Извлечение ID предложения из параметров URL
      const { id: offerId } = req.params;

      // Извлечение If-Match заголовка для optimistic locking
      const ifMatch = req.headers['if-match'];
      
      console.log('PUT /offers/:id - Headers debug:', {
        'if-match': ifMatch,
        'authorization': req.headers.authorization,
        'content-type': req.headers['content-type'],
        allHeaders: req.headers
      });
      
      if (!ifMatch) {
        console.log('Missing If-Match header');
        return res.status(412).json({
          error: 'precondition_failed',
          message: 'If-Match header is required for updates'
        });
      }

      // Извлечение данных из тела запроса
      const { title, content, status, createVersion } = req.body;

      // Обновление предложения через сервис
      const updatedOffer = await this.offerService.updateOffer(offerId, user.id, {
        title,
        content,
        status,
        createVersion
      }, ifMatch);

      // Успешный ответ с новым ETag заголовком (согласно спецификации)
      res.header('ETag', updatedOffer.eTag)
         .json(updatedOffer);

    } catch (error) {
      // Обработка конфликта версий
      if (error.name === 'ConflictError') {
        return res.status(409).json({
          error: 'conflict',
          message: error.message,
          conflictDetails: {
            lastModifiedAt: new Date().toISOString(), // В реальной БД это будет из предложения
            currentVersion: 'unknown', // Потребует дополнительного запроса к БД
            yourVersion: 'outdated'
          },
          resolutionOptions: [
            {
              action: 'overwrite',
              description: 'Перезаписать изменения другого пользователя'
            },
            {
              action: 'create_version',
              description: 'Создать новую версию без конфликтов'
            },
            {
              action: 'view_changes',
              description: 'Сравнить изменения'
            }
          ]
        });
      }

      // Если предложение не найдено или нет доступа
      if (error.message === 'Offer not found or access denied') {
        return res.status(404).json({
          error: 'not_found',
          message: 'Offer not found'
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/offers/:id/versions - Получить список версий предложения
   */
  async getVersions(req, res, next) {
    try {
      // Проверка токена
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Извлечение ID предложения из параметров URL
      const { id: offerId } = req.params;

      // Получение версий через сервис
      const result = await this.offerService.getVersions(offerId, user.id);

      // Успешный ответ
      res.json(result);

    } catch (error) {
      if (error.message === 'Offer not found') {
        return res.status(404).json({
          error: 'not_found',
          message: 'Offer not found'
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/offers/:id/versions - Создать новую версию
   */
  async createVersion(req, res, next) {
    try {
      // Проверка токена
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Извлечение ID предложения из параметров URL
      const { id: offerId } = req.params;
      
      // Извлечение данных из тела запроса
      const { description } = req.body;

      // Создание версии через сервис
      const newVersion = await this.offerService.createVersion(offerId, user.id, description);

      // Успешный ответ
      res.status(201).json(newVersion);

    } catch (error) {
      if (error.message === 'Offer not found') {
        return res.status(404).json({
          error: 'not_found',
          message: 'Offer not found'
        });
      }
      next(error);
    }
  }

  /**
   * GET /api/offers/:id/versions/:version - Получить конкретную версию
   */
  async getVersion(req, res, next) {
    try {
      // Проверка токена
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Извлечение ID предложения и номера версии из параметров URL
      const { id: offerId, version } = req.params;
      const versionNumber = parseInt(version, 10);

      if (isNaN(versionNumber) || versionNumber < 1) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'Invalid version number'
        });
      }

      // Получение версии через сервис
      const versionData = await this.offerService.getVersion(offerId, versionNumber, user.id);

      // Успешный ответ
      res.json(versionData);

    } catch (error) {
      if (error.message === 'Offer not found' || error.message === 'Version not found') {
        return res.status(404).json({
          error: 'not_found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/offers/:id/versions/:version/restore - Восстановить версию
   */
  async restoreVersion(req, res, next) {
    try {
      // Проверка токена
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Извлечение ID предложения и номера версии из параметров URL
      const { id: offerId, version } = req.params;
      const versionNumber = parseInt(version, 10);

      if (isNaN(versionNumber) || versionNumber < 1) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'Invalid version number'
        });
      }

      // Извлечение данных из тела запроса
      const { createBackupVersion = false } = req.body;

      // Восстановление версии через сервис
      const result = await this.offerService.restoreVersion(offerId, versionNumber, user.id, createBackupVersion);

      // Успешный ответ
      res.json(result);

    } catch (error) {
      if (error.message === 'Offer not found' || error.message === 'Version not found') {
        return res.status(404).json({
          error: 'not_found',
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * POST /api/offers/:id/versions/:version/switch - Переключиться на версию
   */
  async switchToVersion(req, res, next) {
    try {
      // Проверка токена
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Authorization token required'
        });
      }

      // Валидация токена и получение пользователя
      const user = await this.authService.validateToken(token);
      if (!user) {
        return res.status(401).json({
          error: 'unauthorized',
          message: 'Invalid or expired token'
        });
      }

      // Извлечение ID предложения и номера версии из параметров URL
      const { id: offerId, version } = req.params;
      const versionNumber = parseInt(version, 10);

      if (isNaN(versionNumber) || versionNumber < 1) {
        return res.status(400).json({
          error: 'bad_request',
          message: 'Invalid version number'
        });
      }

      // Переключение на версию через сервис
      const updatedOffer = await this.offerService.switchToVersion(offerId, versionNumber, user.id);

      // Успешный ответ с новым ETag
      res.header('ETag', updatedOffer.eTag)
         .json(updatedOffer);

    } catch (error) {
      if (error.message === 'Offer not found' || error.message === 'Version not found') {
        return res.status(404).json({
          error: 'not_found',
          message: error.message
        });
      }
      next(error);
    }
  }
}

module.exports = OfferController;