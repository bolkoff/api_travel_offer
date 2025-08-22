const { db } = require('../config/database');
const ETag = require('../utils/ETag');

class OfferRepository {
  constructor() {
    // Инициализируем соединение при создании репозитория
    this.initConnection();
  }

  /**
   * Инициализация подключения к базе данных
   */
  async initConnection() {
    try {
      await db.connect();
      console.log('OfferRepository: Database connection established');
    } catch (error) {
      console.error('OfferRepository: Failed to connect to database:', error);
    }
  }

  /**
   * Получить предложения пользователя с фильтрацией и пагинацией
   * @param {string} userId - ID пользователя
   * @param {Object} options - Опции фильтрации и пагинации
   * @returns {Promise<Object>} Список предложений и метаданные
   */
  async findByUserId(userId, options = {}) {
    const {
      status,
      limit = 50,
      offset = 0,
      orderBy = 'updatedAt',
      order = 'desc'
    } = options;

    try {
      let query = `
        SELECT 
          o.id,
          ov.title,
          ov.status,
          o.current_version as version,
          o.created_at as "createdAt",
          o.updated_at as "updatedAt",
          o.metadata->>'hasUnpublishedChanges' as "hasUnpublishedChanges"
        FROM offers o
        JOIN offer_versions ov ON o.id = ov.offer_id AND o.current_version = ov.version
        WHERE o.user_id = $1
      `;

      const params = [userId];
      let paramIndex = 2;

      // Фильтрация по статусу
      if (status) {
        query += ` AND ov.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Сортировка
      const orderByMap = {
        'createdAt': 'o.created_at',
        'updatedAt': 'o.updated_at',
        'title': 'ov.title'
      };
      const dbOrderBy = orderByMap[orderBy] || 'o.updated_at';
      query += ` ORDER BY ${dbOrderBy} ${order.toUpperCase()}`;

      // Подсчет общего количества (без пагинации)
      const countQuery = `
        SELECT COUNT(*) as total
        FROM offers o
        JOIN offer_versions ov ON o.id = ov.offer_id AND o.current_version = ov.version
        WHERE o.user_id = $1
        ${status ? `AND ov.status = $2` : ''}
      `;
      const countParams = status ? [userId, status] : [userId];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Пагинация
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      // Преобразуем результат в нужный формат
      const offers = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        status: row.status,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        hasUnpublishedChanges: row.hasUnpublishedChanges === 'true'
      }));

      return {
        offers,
        total,
        limit,
        offset
      };

    } catch (error) {
      console.error('OfferRepository.findByUserId error:', error);
      throw error;
    }
  }

  /**
   * Получить предложение по ID
   * @param {string} offerId - ID предложения
   * @returns {Promise<Object|null>} Предложение или null
   */
  async findById(offerId) {
    try {
      const query = `
        SELECT 
          o.*,
          ov.title,
          ov.content,
          ov.status
        FROM offers o
        JOIN offer_versions ov ON o.id = ov.offer_id AND o.current_version = ov.version
        WHERE o.id = $1
      `;

      const result = await db.query(query, [offerId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        content: row.content,
        status: row.status,
        currentVersion: row.current_version,
        totalVersions: row.total_versions,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        lastModifiedBy: row.last_modified_by,
        eTag: row.etag,
        isPublished: row.is_published,
        publishedVersion: row.published_version,
        publishedAt: row.published_at ? row.published_at.toISOString() : null,
        publicUrl: row.public_url,
        metadata: row.metadata || {}
      };

    } catch (error) {
      console.error('OfferRepository.findById error:', error);
      throw error;
    }
  }

  /**
   * Создать новое предложение
   * @param {Object} offerData - Данные предложения
   * @returns {Promise<Object>} Созданное предложение
   */
  async create(offerData) {
    const now = new Date();
    const offerId = `offer_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const versionId = `version_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      return await db.transaction(async (client) => {
        // Создаем запись в offers
        const etag = ETag.forOffer({
          title: offerData.title,
          content: offerData.content || {},
          status: offerData.status || 'draft'
        });

        const offerQuery = `
          INSERT INTO offers (
            id, user_id, current_version, total_versions, 
            created_at, updated_at, last_modified_by, etag,
            is_published, published_version, published_at, public_url, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `;

        const offerParams = [
          offerId,
          offerData.userId,
          1, // current_version
          1, // total_versions
          now,
          now,
          offerData.userId,
          etag,
          false, // is_published
          null, // published_version
          null, // published_at
          null, // public_url
          JSON.stringify({ hasUnpublishedChanges: false, lastAutoSaveAt: null })
        ];

        await client.query(offerQuery, offerParams);

        // Создаем первую версию
        const versionQuery = `
          INSERT INTO offer_versions (
            id, offer_id, version, title, content, status,
            change_type, description, created_at, created_by, is_published
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        const versionParams = [
          versionId,
          offerId,
          1, // version
          offerData.title,
          offerData.content || {}, // PostgreSQL handles JSONB serialization
          offerData.status || 'draft',
          'manual',
          'Первоначальная версия',
          now,
          offerData.userId,
          false
        ];

        await client.query(versionQuery, versionParams);

        // Возвращаем созданное предложение
        return {
          id: offerId,
          userId: offerData.userId,
          title: offerData.title,
          content: offerData.content || {},
          status: offerData.status || 'draft',
          currentVersion: 1,
          totalVersions: 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          lastModifiedBy: offerData.userId,
          eTag: etag,
          isPublished: false,
          publishedVersion: null,
          publishedAt: null,
          publicUrl: null,
          metadata: { hasUnpublishedChanges: false, lastAutoSaveAt: null }
        };
      });

    } catch (error) {
      console.error('OfferRepository.create error:', error);
      throw error;
    }
  }

  /**
   * Удалить предложение по ID
   * @param {string} offerId - ID предложения
   * @param {string} userId - ID пользователя (для проверки прав доступа)
   * @returns {Promise<boolean>} true если удалено, false если не найдено
   */
  async deleteById(offerId, userId) {
    try {
      const query = `
        DELETE FROM offers 
        WHERE id = $1 AND user_id = $2
      `;

      const result = await db.query(query, [offerId, userId]);
      return result.rowCount > 0;

    } catch (error) {
      console.error('OfferRepository.deleteById error:', error);
      throw error;
    }
  }

  /**
   * Обновить предложение
   * @param {string} offerId - ID предложения
   * @param {string} userId - ID пользователя (для проверки прав)
   * @param {Object} updateData - Новые данные
   * @param {string} expectedETag - Ожидаемый ETag для optimistic locking
   * @returns {Promise<Object>} Обновленное предложение
   */
  async updateById(offerId, userId, updateData, expectedETag) {
    const now = new Date();

    try {
      return await db.transaction(async (client) => {
        // Получаем текущее предложение для проверки ETag
        const selectQuery = `
          SELECT * FROM offers WHERE id = $1 AND user_id = $2
        `;
        const selectResult = await client.query(selectQuery, [offerId, userId]);

        if (selectResult.rows.length === 0) {
          return null;
        }

        const existingOffer = selectResult.rows[0];

        // Проверка ETag для optimistic locking
        if (expectedETag && !ETag.compare(existingOffer.etag, expectedETag)) {
          throw new Error('ETag mismatch - offer was modified by another user');
        }

        // Генерируем новый ETag
        const newETag = ETag.forOffer({
          title: updateData.title,
          content: updateData.content || {},
          status: updateData.status || 'draft'
        });

        // Определяем новую версию
        const newCurrentVersion = updateData.currentVersion !== undefined 
          ? updateData.currentVersion 
          : (updateData.createVersion 
            ? existingOffer.current_version + 1 
            : existingOffer.current_version);

        const newTotalVersions = updateData.createVersion
          ? existingOffer.total_versions + 1
          : (updateData.currentVersion !== undefined && updateData.currentVersion > existingOffer.total_versions
            ? updateData.currentVersion // Обновляем total_versions если currentVersion больше
            : existingOffer.total_versions);

        // Обновляем offers
        const updateOfferQuery = `
          UPDATE offers 
          SET 
            current_version = $1,
            total_versions = $2,
            updated_at = $3,
            last_modified_by = $4,
            etag = $5
          WHERE id = $6 AND user_id = $7
          RETURNING *
        `;

        const updateOfferParams = [
          newCurrentVersion,
          newTotalVersions,
          now,
          userId,
          newETag,
          offerId,
          userId
        ];

        const offerResult = await client.query(updateOfferQuery, updateOfferParams);

        // Обновляем или создаем версию
        if (updateData.createVersion) {
          // Создаем новую версию
          const versionId = `version_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const insertVersionQuery = `
            INSERT INTO offer_versions (
              id, offer_id, version, title, content, status,
              change_type, description, created_at, created_by, is_published
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `;

          const insertVersionParams = [
            versionId,
            offerId,
            newCurrentVersion,
            updateData.title,
            updateData.content || {}, // PostgreSQL handles JSONB serialization
            updateData.status || 'draft',
            'manual',
            updateData.description || '',
            now,
            userId,
            false
          ];

          await client.query(insertVersionQuery, insertVersionParams);
        } else {
          // Обновляем текущую версию
          const updateVersionQuery = `
            UPDATE offer_versions 
            SET 
              title = $1,
              content = $2,
              status = $3
            WHERE offer_id = $4 AND version = $5
          `;

          const updateVersionParams = [
            updateData.title,
            updateData.content || {}, // PostgreSQL handles JSONB serialization
            updateData.status || 'draft',
            offerId,
            newCurrentVersion
          ];

          await client.query(updateVersionQuery, updateVersionParams);
        }

        // Возвращаем обновленное предложение
        const row = offerResult.rows[0];
        return {
          id: row.id,
          userId: row.user_id,
          title: updateData.title,
          content: updateData.content || {},
          status: updateData.status || 'draft',
          currentVersion: row.current_version,
          totalVersions: row.total_versions,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          lastModifiedBy: row.last_modified_by,
          eTag: row.etag,
          isPublished: row.is_published,
          publishedVersion: row.published_version,
          publishedAt: row.published_at ? row.published_at.toISOString() : null,
          publicUrl: row.public_url,
          metadata: row.metadata || {}
        };
      });

    } catch (error) {
      console.error('OfferRepository.updateById error:', error);
      throw error;
    }
  }

  /**
   * Сохранить версию предложения
   * @param {string} offerId - ID предложения
   * @param {Object} versionData - Данные версии
   * @returns {Promise<Object>} Созданная версия
   */
  async saveVersion(offerId, versionData) {
    const now = new Date();
    const versionId = `version_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      const query = `
        INSERT INTO offer_versions (
          id, offer_id, version, title, content, status,
          change_type, description, created_at, created_by, is_published
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const params = [
        versionId,
        offerId,
        versionData.version,
        versionData.title,
        versionData.content, // PostgreSQL handles JSONB serialization
        versionData.status,
        versionData.changeType || 'manual',
        versionData.description || '',
        now,
        versionData.createdBy,
        false
      ];

      const result = await db.query(query, params);
      const row = result.rows[0];

      return {
        id: row.id,
        offerId: row.offer_id,
        version: row.version,
        title: row.title,
        content: row.content, // PostgreSQL JSONB already returns as object
        status: row.status,
        changeType: row.change_type,
        description: row.description,
        createdAt: row.created_at.toISOString(),
        createdBy: row.created_by,
        isPublished: row.is_published
      };

    } catch (error) {
      console.error('OfferRepository.saveVersion error:', error);
      throw error;
    }
  }

  /**
   * Получить версии предложения
   * @param {string} offerId - ID предложения
   * @returns {Promise<Array>} Массив версий
   */
  async getVersionsByOfferId(offerId) {
    try {
      const query = `
        SELECT * FROM offer_versions 
        WHERE offer_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [offerId]);

      return result.rows.map(row => ({
        id: row.id,
        offerId: row.offer_id,
        version: row.version,
        title: row.title,
        content: row.content, // PostgreSQL JSONB already returns as object
        status: row.status,
        changeType: row.change_type,
        description: row.description,
        createdAt: row.created_at.toISOString(),
        createdBy: row.created_by,
        isPublished: row.is_published
      }));

    } catch (error) {
      console.error('OfferRepository.getVersionsByOfferId error:', error);
      throw error;
    }
  }

  /**
   * Получить конкретную версию
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии
   * @returns {Promise<Object|null>} Версия или null
   */
  async getVersion(offerId, versionNumber) {
    try {
      const query = `
        SELECT * FROM offer_versions 
        WHERE offer_id = $1 AND version = $2
      `;

      const result = await db.query(query, [offerId, versionNumber]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        offerId: row.offer_id,
        version: row.version,
        title: row.title,
        content: row.content, // PostgreSQL JSONB already returns as object
        status: row.status,
        changeType: row.change_type,
        description: row.description,
        createdAt: row.created_at.toISOString(),
        createdBy: row.created_by,
        isPublished: row.is_published
      };

    } catch (error) {
      console.error('OfferRepository.getVersion error:', error);
      throw error;
    }
  }

  /**
   * Обновить статус публикации версии
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии
   * @param {boolean} isPublished - Статус публикации
   * @returns {Promise<boolean>} Успешность операции
   */
  async updateVersionPublishStatus(offerId, versionNumber, isPublished) {
    try {
      return await db.transaction(async (client) => {
        // Если публикуем версию, сначала снимаем публикацию с других версий
        if (isPublished) {
          await client.query(
            'UPDATE offer_versions SET is_published = false WHERE offer_id = $1',
            [offerId]
          );
        }

        const result = await client.query(
          'UPDATE offer_versions SET is_published = $1 WHERE offer_id = $2 AND version = $3',
          [isPublished, offerId, versionNumber]
        );

        return result.rowCount > 0;
      });

    } catch (error) {
      console.error('OfferRepository.updateVersionPublishStatus error:', error);
      throw error;
    }
  }

  /**
   * Обновить данные конкретной версии
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии
   * @param {Object} versionData - Новые данные версии
   * @returns {Promise<boolean>} Успешность операции
   */
  async updateVersionData(offerId, versionNumber, versionData) {
    try {
      const query = `
        UPDATE offer_versions 
        SET title = $1, content = $2, status = $3
        WHERE offer_id = $4 AND version = $5
      `;

      const params = [
        versionData.title,
        versionData.content, // PostgreSQL handles JSONB serialization
        versionData.status,
        offerId,
        versionNumber
      ];

      const result = await db.query(query, params);
      return result.rowCount > 0;

    } catch (error) {
      console.error('OfferRepository.updateVersionData error:', error);
      throw error;
    }
  }
}

module.exports = OfferRepository;