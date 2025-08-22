const fs = require('fs').promises;
const path = require('path');
const ETag = require('../utils/ETag');

class OfferRepository {
  constructor() {
    // Путь к файлу для персиста данных
    this.dataFile = path.join(__dirname, '../../data/offers.json');
    this.offers = [];
    this.versions = [];
    this.nextId = 1;
    this.nextVersionId = 1;
    
    // Загружаем данные при инициализации
    this.loadData();
  }

  /**
   * Загрузить данные из файла
   */
  async loadData() {
    try {
      // Создаем папку data если не существует
      const dataDir = path.dirname(this.dataFile);
      await fs.mkdir(dataDir, { recursive: true });

      // Пытаемся загрузить данные
      const data = await fs.readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(data);
      
      this.offers = parsed.offers || [];
      this.versions = parsed.versions || [];
      this.nextId = parsed.nextId || 1;
      this.nextVersionId = parsed.nextVersionId || 1;
      
      console.log(`Loaded ${this.offers.length} offers and ${this.versions.length} versions from file`);
    } catch (error) {
      // Файл не существует или поврежден - используем пустые данные
      console.log('No existing data file found, starting with empty storage');
      this.offers = [];
      this.versions = [];
      this.nextId = 1;
      this.nextVersionId = 1;
    }
  }

  /**
   * Сохранить данные в файл
   */
  async saveData() {
    try {
      const data = {
        offers: this.offers,
        versions: this.versions,
        nextId: this.nextId,
        nextVersionId: this.nextVersionId,
        lastUpdated: new Date().toISOString()
      };
      
      await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save data:', error);
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

    // Фильтрация по пользователю
    let filtered = this.offers.filter(offer => offer.userId === userId);

    // Фильтрация по статусу
    if (status) {
      filtered = filtered.filter(offer => offer.status === status);
    }

    // Сортировка
    filtered.sort((a, b) => {
      const aValue = a[orderBy];
      const bValue = b[orderBy];
      
      if (order === 'desc') {
        return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    // Подсчет общего количества
    const total = filtered.length;

    // Пагинация
    const paginated = filtered.slice(offset, offset + limit);

    // Маппинг в формат ответа (краткая информация)
    const offers = paginated.map(offer => ({
      id: offer.id,
      title: offer.title,
      status: offer.status,
      version: offer.currentVersion, // Переименовываем для совместимости с клиентом
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      hasUnpublishedChanges: offer.metadata.hasUnpublishedChanges
    }));

    return {
      offers,
      total,
      limit,
      offset
    };
  }

  /**
   * Получить предложение по ID
   * @param {string} offerId - ID предложения
   * @returns {Promise<Object|null>} Предложение или null
   */
  async findById(offerId) {
    const offer = this.offers.find(o => o.id === offerId);
    return offer || null;
  }

  /**
   * Создать новое предложение
   * @param {Object} offerData - Данные предложения
   * @returns {Promise<Object>} Созданное предложение
   */
  async create(offerData) {
    const now = new Date().toISOString();
    const offerId = `offer_${this.nextId++}`;
    
    const newOffer = {
      id: offerId,
      userId: offerData.userId,
      title: offerData.title,
      content: offerData.content || {},
      status: offerData.status || 'draft',
      currentVersion: 1,
      totalVersions: 1,
      createdAt: now,
      updatedAt: now,
      lastModifiedBy: offerData.userId,
      eTag: ETag.forOffer({
        title: offerData.title,
        content: offerData.content || {},
        status: offerData.status || 'draft'
      }),
      isPublished: false,
      publishedVersion: null,
      publishedAt: null,
      publicUrl: null,
      metadata: {
        hasUnpublishedChanges: false,
        lastAutoSaveAt: null
      }
    };

    this.offers.push(newOffer);
    
    // Создаем первоначальную версию 1
    const initialVersion = {
      id: `version_${this.nextVersionId++}`,
      offerId: offerId,
      version: 1,
      title: offerData.title,
      content: offerData.content || {},
      status: offerData.status || 'draft',
      changeType: 'manual',
      description: 'Первоначальная версия',
      createdAt: now,
      createdBy: offerData.userId,
      isPublished: false
    };
    
    this.versions.push(initialVersion);
    
    // Сохраняем данные в файл
    await this.saveData();
    
    return newOffer;
  }

  /**
   * Удалить предложение по ID
   * @param {string} offerId - ID предложения
   * @param {string} userId - ID пользователя (для проверки прав доступа)
   * @returns {Promise<boolean>} true если удалено, false если не найдено
   */
  async deleteById(offerId, userId) {
    const index = this.offers.findIndex(offer => 
      offer.id === offerId && offer.userId === userId
    );
    
    if (index === -1) {
      return false; // Предложение не найдено или не принадлежит пользователю
    }

    this.offers.splice(index, 1);
    
    // Удаляем также все версии этого предложения
    await this.deleteVersionsByOfferId(offerId);
    
    // Сохраняем данные в файл
    await this.saveData();
    
    return true;
  }

  /**
   * Обновить предложение (полная замена)
   * @param {string} offerId - ID предложения
   * @param {string} userId - ID пользователя (для проверки прав)
   * @param {Object} updateData - Новые данные
   * @param {string} expectedETag - Ожидаемый ETag для optimistic locking
   * @returns {Promise<Object>} Обновленное предложение
   */
  async updateById(offerId, userId, updateData, expectedETag) {
    const offerIndex = this.offers.findIndex(offer => 
      offer.id === offerId && offer.userId === userId
    );
    
    if (offerIndex === -1) {
      return null; // Предложение не найдено или не принадлежит пользователю
    }

    const existingOffer = this.offers[offerIndex];

    // Проверка ETag для optimistic locking
    if (expectedETag && !ETag.compare(existingOffer.eTag, expectedETag)) {
      throw new Error('ETag mismatch - offer was modified by another user');
    }

    const now = new Date().toISOString();
    
    // Полная замена данных (согласно PUT семантике)
    const updatedOffer = {
      ...existingOffer, // Сохраняем системные поля
      title: updateData.title,
      content: updateData.content || {},
      status: updateData.status || 'draft',
      updatedAt: now,
      lastModifiedBy: userId,
      // Пересчитываем ETag на основе нового содержимого
      eTag: ETag.forOffer({
        title: updateData.title,
        content: updateData.content || {},
        status: updateData.status || 'draft'
      }),
      // Обновляем версию если запрошено или задана напрямую
      currentVersion: updateData.currentVersion !== undefined 
        ? updateData.currentVersion 
        : (updateData.createVersion 
          ? existingOffer.currentVersion + 1 
          : existingOffer.currentVersion),
      totalVersions: updateData.createVersion
        ? existingOffer.totalVersions + 1
        : existingOffer.totalVersions
    };

    this.offers[offerIndex] = updatedOffer;
    
    // Сохраняем данные в файл
    await this.saveData();
    
    return updatedOffer;
  }

  /**
   * Сохранить версию предложения
   * @param {string} offerId - ID предложения
   * @param {Object} versionData - Данные версии
   * @returns {Promise<Object>} Созданная версия
   */
  async saveVersion(offerId, versionData) {
    const now = new Date().toISOString();
    const versionId = `version_${this.nextVersionId++}`;
    
    const newVersion = {
      id: versionId,
      offerId: offerId,
      version: versionData.version,
      title: versionData.title,
      content: versionData.content,
      status: versionData.status,
      changeType: versionData.changeType || 'manual',
      description: versionData.description || '',
      createdAt: now,
      createdBy: versionData.createdBy,
      isPublished: false
    };

    this.versions.push(newVersion);
    await this.saveData();
    
    return newVersion;
  }

  /**
   * Получить версии предложения
   * @param {string} offerId - ID предложения
   * @returns {Promise<Array>} Массив версий
   */
  async getVersionsByOfferId(offerId) {
    let versions = this.versions
      .filter(v => v.offerId === offerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Если нет версий, но offer существует - создаем виртуальную версию 1
    if (versions.length === 0) {
      const offer = this.offers.find(o => o.id === offerId);
      if (offer) {
        const virtualVersion = {
          id: `version_virtual_${offer.id}_1`,
          offerId: offerId,
          version: 1,
          title: offer.title,
          content: offer.content,
          status: offer.status,
          changeType: 'manual',
          description: 'Первоначальная версия',
          createdAt: offer.createdAt,
          createdBy: offer.lastModifiedBy,
          isPublished: offer.isPublished
        };
        versions = [virtualVersion];
      }
    }
    
    return versions;
  }

  /**
   * Получить конкретную версию
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии
   * @returns {Promise<Object|null>} Версия или null
   */
  async getVersion(offerId, versionNumber) {
    let version = this.versions.find(
      v => v.offerId === offerId && v.version === versionNumber
    );
    
    // Если версии нет, но запрашивается версия 1 и offer существует - создаем виртуальную
    if (!version && versionNumber === 1) {
      const offer = this.offers.find(o => o.id === offerId);
      if (offer) {
        version = {
          id: `version_virtual_${offer.id}_1`,
          offerId: offerId,
          version: 1,
          title: offer.title,
          content: offer.content,
          status: offer.status,
          changeType: 'manual',
          description: 'Первоначальная версия',
          createdAt: offer.createdAt,
          createdBy: offer.lastModifiedBy,
          isPublished: offer.isPublished
        };
      }
    }
    
    return version || null;
  }

  /**
   * Обновить статус публикации версии
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии
   * @param {boolean} isPublished - Статус публикации
   * @returns {Promise<boolean>} Успешность операции
   */
  async updateVersionPublishStatus(offerId, versionNumber, isPublished) {
    // Если публикуем версию, сначала снимаем публикацию с других версий
    if (isPublished) {
      this.versions.forEach(v => {
        if (v.offerId === offerId && v.isPublished) {
          v.isPublished = false;
        }
      });
    }

    const versionIndex = this.versions.findIndex(
      v => v.offerId === offerId && v.version === versionNumber
    );
    
    if (versionIndex === -1) {
      return false;
    }

    this.versions[versionIndex].isPublished = isPublished;
    await this.saveData();
    
    return true;
  }

  /**
   * Удалить все версии предложения
   * @param {string} offerId - ID предложения
   * @returns {Promise<boolean>} Успешность операции
   */
  async deleteVersionsByOfferId(offerId) {
    const initialLength = this.versions.length;
    this.versions = this.versions.filter(v => v.offerId !== offerId);
    
    if (this.versions.length < initialLength) {
      await this.saveData();
      return true;
    }
    
    return false;
  }

  /**
   * Обновить данные конкретной версии
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии
   * @param {Object} versionData - Новые данные версии
   * @returns {Promise<boolean>} Успешность операции
   */
  async updateVersionData(offerId, versionNumber, versionData) {
    const versionIndex = this.versions.findIndex(v => 
      v.offerId === offerId && v.version === versionNumber
    );
    
    if (versionIndex === -1) {
      return false;
    }

    this.versions[versionIndex] = {
      ...this.versions[versionIndex],
      title: versionData.title,
      content: versionData.content,
      status: versionData.status
    };
    
    await this.saveData();
    return true;
  }

}

module.exports = OfferRepository;