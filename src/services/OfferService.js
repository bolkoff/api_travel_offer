class OfferService {
  constructor(offerRepository) {
    this.offerRepo = offerRepository;
  }

  /**
   * Получить список предложений пользователя
   * @param {string} userId - ID пользователя
   * @param {Object} options - Опции фильтрации и пагинации
   * @returns {Promise<Object>} Список предложений с метаданными
   */
  async getUserOffers(userId, options = {}) {
    // Валидация параметров
    const {
      status,
      limit = 50,
      offset = 0,
      orderBy = 'updatedAt',
      order = 'desc'
    } = options;

    // Валидация лимита
    const validLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const validOffset = Math.max(parseInt(offset) || 0, 0);

    // Валидация статуса
    const validStatuses = ['draft', 'published', 'archived'];
    if (status && !validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Валидация сортировки
    const validOrderBy = ['createdAt', 'updatedAt', 'title'];
    if (!validOrderBy.includes(orderBy)) {
      throw new Error(`Invalid orderBy. Must be one of: ${validOrderBy.join(', ')}`);
    }

    const validOrder = ['asc', 'desc'];
    if (!validOrder.includes(order)) {
      throw new Error(`Invalid order. Must be one of: ${validOrder.join(', ')}`);
    }

    // Получаем данные из репозитория
    const result = await this.offerRepo.findByUserId(userId, {
      status,
      limit: validLimit,
      offset: validOffset,
      orderBy,
      order
    });

    return result;
  }

  /**
   * Создать новое предложение
   * @param {string} userId - ID пользователя
   * @param {Object} offerData - Данные предложения
   * @returns {Promise<Object>} Созданное предложение
   */
  async createOffer(userId, offerData) {
    // Валидация обязательных полей
    if (!offerData.title || typeof offerData.title !== 'string' || offerData.title.trim().length === 0) {
      throw new Error('Title is required and must be a non-empty string');
    }

    if (offerData.title.length > 200) {
      throw new Error('Title must not exceed 200 characters');
    }

    // Content может быть пустым при создании, но если передан - должен быть объектом
    if (offerData.content !== undefined && (offerData.content === null || typeof offerData.content !== 'object' || Array.isArray(offerData.content))) {
      throw new Error('Content must be an object');
    }

    // Валидация статуса
    if (offerData.status) {
      const validStatuses = ['draft', 'published', 'archived'];
      if (!validStatuses.includes(offerData.status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    // Создание предложения через репозиторий
    const newOffer = await this.offerRepo.create({
      userId,
      title: offerData.title.trim(),
      content: offerData.content || {},
      status: offerData.status || 'draft'
    });

    // Обогащаем данные информацией о версии
    return await this._enrichWithVersionInfo(newOffer);
  }

  /**
   * Удалить предложение
   * @param {string} offerId - ID предложения
   * @param {string} userId - ID пользователя
   * @returns {Promise<boolean>} true если удалено успешно
   */
  async deleteOffer(offerId, userId) {
    // Валидация ID предложения
    if (!offerId || typeof offerId !== 'string' || offerId.trim().length === 0) {
      throw new Error('Offer ID is required');
    }

    // Валидация ID пользователя
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Попытка удаления через репозиторий
    const deleted = await this.offerRepo.deleteById(offerId.trim(), userId);
    
    if (!deleted) {
      throw new Error('Offer not found or access denied');
    }

    return true;
  }

  /**
   * Получить предложение по ID
   * @param {string} offerId - ID предложения
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} Предложение
   */
  async getOfferById(offerId, userId) {
    // Валидация ID предложения
    if (!offerId || typeof offerId !== 'string' || offerId.trim().length === 0) {
      throw new Error('Offer ID is required');
    }

    // Валидация ID пользователя
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Получение предложения из репозитория
    const offer = await this.offerRepo.findById(offerId.trim());
    
    if (!offer) {
      throw new Error('Offer not found');
    }

    // Проверка прав доступа - пользователь может видеть только свои предложения
    if (offer.userId !== userId) {
      throw new Error('Offer not found'); // Не раскрываем что предложение существует
    }

    // Обогащаем данные информацией о версии
    return await this._enrichWithVersionInfo(offer);
  }

  /**
   * Обогатить предложение информацией о версии
   * @param {Object} offer - Предложение
   * @returns {Promise<Object>} Предложение с расширенной информацией о версии
   */
  async _enrichWithVersionInfo(offer) {
    if (!offer) return offer;

    // Получаем данные текущей версии
    const currentVersionData = await this.offerRepo.getVersion(offer.id, offer.currentVersion);
    
    // Если есть версия в коллекции - используем её данные
    const finalData = currentVersionData ? {
      ...offer,
      title: currentVersionData.title,
      content: currentVersionData.content,
      status: currentVersionData.status
    } : offer;

    return {
      ...finalData,
      // Переименовываем currentVersion в version для совместимости с API
      version: offer.currentVersion,
      // Добавляем детальную информацию о версии
      versionInfo: {
        current: offer.currentVersion,
        total: offer.totalVersions,
        isLatest: true, // Всегда true для основного ответа
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
        lastModifiedBy: offer.lastModifiedBy,
        hasUnpublishedChanges: offer.metadata?.hasUnpublishedChanges || false
      }
    };
  }

  /**
   * Обновить предложение (полная замена)
   * @param {string} offerId - ID предложения
   * @param {string} userId - ID пользователя
   * @param {Object} updateData - Новые данные
   * @param {string} ifMatch - ETag для optimistic locking (из заголовка If-Match)
   * @returns {Promise<Object>} Обновленное предложение
   */
  async updateOffer(offerId, userId, updateData, ifMatch) {
    // Валидация ID предложения
    if (!offerId || typeof offerId !== 'string' || offerId.trim().length === 0) {
      throw new Error('Offer ID is required');
    }

    // Валидация ID пользователя
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Валидация обязательных полей
    if (!updateData.title || typeof updateData.title !== 'string' || updateData.title.trim().length === 0) {
      throw new Error('Title is required and must be a non-empty string');
    }

    if (updateData.title.length > 200) {
      throw new Error('Title must not exceed 200 characters');
    }

    // Content может быть пустым при обновлении, но если передан - должен быть объектом
    if (updateData.content !== undefined && (updateData.content === null || typeof updateData.content !== 'object' || Array.isArray(updateData.content))) {
      throw new Error('Content must be an object');
    }

    // Валидация статуса
    if (updateData.status) {
      const validStatuses = ['draft', 'published', 'archived'];
      if (!validStatuses.includes(updateData.status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }

    try {
      // Получаем текущий offer для определения активной версии
      const currentOffer = await this.offerRepo.findById(offerId.trim());
      if (!currentOffer || currentOffer.userId !== userId) {
        throw new Error('Offer not found or access denied');
      }

      // Обновление предложения через репозиторий
      const updatedOffer = await this.offerRepo.updateById(
        offerId.trim(), 
        userId, 
        {
          title: updateData.title.trim(),
          content: updateData.content || {},
          status: updateData.status || 'draft',
          createVersion: updateData.createVersion || false
        },
        ifMatch // ETag для optimistic locking
      );

      if (!updatedOffer) {
        throw new Error('Offer not found or access denied');
      }

      // Если есть текущая версия в коллекции versions - обновляем её тоже
      const currentVersionInCollection = await this.offerRepo.getVersion(offerId.trim(), currentOffer.currentVersion);
      if (currentVersionInCollection && !currentVersionInCollection.id.includes('virtual')) {
        await this.offerRepo.updateVersionData(offerId.trim(), currentOffer.currentVersion, {
          title: updateData.title.trim(),
          content: updateData.content || {},
          status: updateData.status || 'draft'
        });
      }

      // Обогащаем данные информацией о версии
      return await this._enrichWithVersionInfo(updatedOffer);

    } catch (error) {
      if (error.message === 'ETag mismatch - offer was modified by another user') {
        // Создаем детальную ошибку конфликта для клиента
        const conflictError = new Error('Offer was modified by another user');
        conflictError.name = 'ConflictError';
        conflictError.code = 'CONFLICT';
        throw conflictError;
      }
      throw error;
    }
  }

  /**
   * Создать новую версию предложения
   * @param {string} offerId - ID предложения
   * @param {string} userId - ID пользователя
   * @param {string} description - Описание версии
   * @returns {Promise<Object>} Созданная версия
   */
  async createVersion(offerId, userId, description = '') {
    if (!offerId || typeof offerId !== 'string') {
      throw new Error('Offer ID is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Получаем текущее предложение
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.userId !== userId) {
      throw new Error('Offer not found');
    }

    // Создаем новую версию на основе текущих данных
    const newVersionNumber = offer.currentVersion + 1;
    
    const newVersion = await this.offerRepo.saveVersion(offerId, {
      version: newVersionNumber,
      title: offer.title,
      content: offer.content,
      status: offer.status,
      changeType: 'manual',
      description: description,
      createdBy: userId
    });

    // Обновляем метаданные в основном offer (БЕЗ createVersion чтобы не создавать дубликат)
    await this.offerRepo.updateById(offerId, userId, {
      title: offer.title,
      content: offer.content,
      status: offer.status,
      currentVersion: newVersionNumber // Переключаемся на новую версию
    });

    return {
      version: newVersion.version,
      description: newVersion.description,
      changeType: newVersion.changeType,
      createdAt: newVersion.createdAt
    };
  }

  /**
   * Получить список версий предложения
   * @param {string} offerId - ID предложения
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} Список версий
   */
  async getVersions(offerId, userId) {
    if (!offerId || typeof offerId !== 'string') {
      throw new Error('Offer ID is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Проверяем права доступа
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.userId !== userId) {
      throw new Error('Offer not found');
    }

    // Получаем версии
    const versions = await this.offerRepo.getVersionsByOfferId(offerId);
    
    return {
      versions: versions.map(v => ({
        version: v.version,
        changeType: v.changeType,
        description: v.description,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        isCurrent: v.version === offer.currentVersion,
        isPublished: v.isPublished
      }))
    };
  }

  /**
   * Получить конкретную версию
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} Данные версии
   */
  async getVersion(offerId, versionNumber, userId) {
    if (!offerId || typeof offerId !== 'string') {
      throw new Error('Offer ID is required');
    }

    if (!versionNumber || typeof versionNumber !== 'number') {
      throw new Error('Version number is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Проверяем права доступа
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.userId !== userId) {
      throw new Error('Offer not found');
    }

    // Получаем версию
    const version = await this.offerRepo.getVersion(offerId, versionNumber);
    if (!version) {
      throw new Error('Version not found');
    }

    return {
      id: offerId,
      version: version.version,
      title: version.title,
      content: version.content,
      status: version.status,
      createdAt: version.createdAt,
      changeType: version.changeType,
      description: version.description,
      isPublished: version.isPublished
    };
  }

  /**
   * Восстановить версию (сделать её текущей)
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии для восстановления
   * @param {string} userId - ID пользователя
   * @param {boolean} createBackup - Создать резервную копию текущей версии
   * @returns {Promise<Object>} Результат восстановления
   */
  async restoreVersion(offerId, versionNumber, userId, createBackup = false) {
    if (!offerId || typeof offerId !== 'string') {
      throw new Error('Offer ID is required');
    }

    if (!versionNumber || typeof versionNumber !== 'number') {
      throw new Error('Version number is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Получаем текущее предложение
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.userId !== userId) {
      throw new Error('Offer not found');
    }

    // Получаем версию для восстановления
    const versionToRestore = await this.offerRepo.getVersion(offerId, versionNumber);
    if (!versionToRestore) {
      throw new Error('Version not found');
    }

    let backupVersionNumber = null;

    // Создаем резервную копию текущей версии если запрошено
    if (createBackup) {
      const backupVersion = await this.offerRepo.saveVersion(offerId, {
        version: offer.currentVersion + 1,
        title: offer.title,
        content: offer.content,
        status: offer.status,
        changeType: 'auto',
        description: `Автоматический backup перед восстановлением версии ${versionNumber}`,
        createdBy: userId
      });
      backupVersionNumber = backupVersion.version;
    }

    // Обновляем основное предложение данными из версии
    const updatedOffer = await this.offerRepo.updateById(offerId, userId, {
      title: versionToRestore.title,
      content: versionToRestore.content,
      status: versionToRestore.status,
      createVersion: createBackup // Обновляем счётчик версий если создавали backup
    });

    return {
      restoredToVersion: versionNumber,
      newCurrentVersion: backupVersionNumber,
      updatedAt: updatedOffer.updatedAt
    };
  }

  /**
   * Обновить статус публикации версии
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии
   * @param {string} userId - ID пользователя
   * @param {boolean} isPublished - Статус публикации
   * @returns {Promise<boolean>} Успешность операции
   */
  async updateVersionPublishStatus(offerId, versionNumber, userId, isPublished) {
    if (!offerId || typeof offerId !== 'string') {
      throw new Error('Offer ID is required');
    }

    if (!versionNumber || typeof versionNumber !== 'number') {
      throw new Error('Version number is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Проверяем права доступа
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.userId !== userId) {
      throw new Error('Offer not found');
    }

    return await this.offerRepo.updateVersionPublishStatus(offerId, versionNumber, isPublished);
  }

  /**
   * Переключить текущую версию (для UX переключения между версиями)
   * @param {string} offerId - ID предложения
   * @param {number} versionNumber - Номер версии для переключения
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object>} Обновленное предложение с данными выбранной версии
   */
  async switchToVersion(offerId, versionNumber, userId) {
    if (!offerId || typeof offerId !== 'string') {
      throw new Error('Offer ID is required');
    }

    if (!versionNumber || typeof versionNumber !== 'number') {
      throw new Error('Version number is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required');
    }

    // Получаем текущее предложение
    const offer = await this.offerRepo.findById(offerId);
    if (!offer) {
      throw new Error('Offer not found');
    }

    if (offer.userId !== userId) {
      throw new Error('Offer not found');
    }

    // Получаем версию для переключения
    const targetVersion = await this.offerRepo.getVersion(offerId, versionNumber);
    if (!targetVersion) {
      throw new Error('Version not found');
    }

    // Обновляем offer данными из выбранной версии и меняем currentVersion
    const updatedOffer = await this.offerRepo.updateById(offerId, userId, {
      title: targetVersion.title,
      content: targetVersion.content,
      status: targetVersion.status,
      currentVersion: versionNumber // Переключаем указатель на новую версию
    });

    return await this._enrichWithVersionInfo(updatedOffer);
  }
}

module.exports = OfferService;