#!/usr/bin/env node

/**
 * Скрипт для миграции данных из JSON файла в PostgreSQL
 * Запуск: node scripts/migrate-data.js
 */

const fs = require('fs').promises;
const path = require('path');
const { db } = require('../src/config/database');

async function migrateData() {
  console.log('Starting data migration from offers.json to PostgreSQL...');
  
  try {
    // Подключаемся к базе данных
    await db.connect();
    console.log('Connected to PostgreSQL');

    // Читаем данные из JSON файла
    const jsonFile = path.join(__dirname, '../data/offers.json');
    const jsonData = await fs.readFile(jsonFile, 'utf8');
    const data = JSON.parse(jsonData);

    console.log(`Found ${data.offers.length} offers and ${data.versions.length} versions`);

    // Очищаем существующие данные (осторожно!)
    if (process.argv.includes('--clean')) {
      console.log('Cleaning existing data...');
      await db.query('DELETE FROM offer_versions');
      await db.query('DELETE FROM offers');
      console.log('Existing data cleaned');
    }

    // Мигрируем данные в транзакции
    await db.transaction(async (client) => {
      // Мигрируем offers
      console.log('Migrating offers...');
      for (const offer of data.offers) {
        const query = `
          INSERT INTO offers (
            id, user_id, current_version, total_versions,
            created_at, updated_at, last_modified_by, etag,
            is_published, published_version, published_at, public_url, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            current_version = EXCLUDED.current_version,
            total_versions = EXCLUDED.total_versions,
            updated_at = EXCLUDED.updated_at,
            last_modified_by = EXCLUDED.last_modified_by,
            etag = EXCLUDED.etag,
            metadata = EXCLUDED.metadata
        `;
        
        const params = [
          offer.id,
          offer.userId,
          offer.currentVersion,
          offer.totalVersions,
          new Date(offer.createdAt),
          new Date(offer.updatedAt),
          offer.lastModifiedBy,
          offer.eTag,
          offer.isPublished,
          offer.publishedVersion,
          offer.publishedAt ? new Date(offer.publishedAt) : null,
          offer.publicUrl,
          JSON.stringify(offer.metadata)
        ];
        
        await client.query(query, params);
      }
      console.log(`Migrated ${data.offers.length} offers`);

      // Мигрируем offer_versions
      console.log('Migrating versions...');
      for (const version of data.versions) {
        const query = `
          INSERT INTO offer_versions (
            id, offer_id, version, title, content, status,
            change_type, description, created_at, created_by, is_published
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (offer_id, version) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            status = EXCLUDED.status,
            change_type = EXCLUDED.change_type,
            description = EXCLUDED.description,
            is_published = EXCLUDED.is_published
        `;
        
        const params = [
          version.id,
          version.offerId,
          version.version,
          version.title,
          JSON.stringify(version.content),
          version.status,
          version.changeType,
          version.description,
          new Date(version.createdAt),
          version.createdBy,
          version.isPublished
        ];
        
        await client.query(query, params);
      }
      console.log(`Migrated ${data.versions.length} versions`);

      // Добавляем недостающие версии 1 для offers без версий
      console.log('Creating missing version 1 for offers...');
      for (const offer of data.offers) {
        // Проверяем, есть ли версия 1
        const versionExists = data.versions.some(v => 
          v.offerId === offer.id && v.version === 1
        );
        
        if (!versionExists) {
          const versionId = `version_migrated_${offer.id}_1`;
          const query = `
            INSERT INTO offer_versions (
              id, offer_id, version, title, content, status,
              change_type, description, created_at, created_by, is_published
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (offer_id, version) DO NOTHING
          `;
          
          const params = [
            versionId,
            offer.id,
            1,
            offer.title,
            JSON.stringify(offer.content),
            offer.status,
            'manual',
            'Первоначальная версия (мигрирована)',
            new Date(offer.createdAt),
            offer.lastModifiedBy,
            false
          ];
          
          await client.query(query, params);
          console.log(`Created missing version 1 for offer ${offer.id}`);
        }
      }
    });

    // Проверяем результаты миграции
    const offersResult = await db.query('SELECT COUNT(*) as count FROM offers');
    const versionsResult = await db.query('SELECT COUNT(*) as count FROM offer_versions');
    
    console.log('\nMigration completed successfully!');
    console.log(`Offers in database: ${offersResult.rows[0].count}`);
    console.log(`Versions in database: ${versionsResult.rows[0].count}`);

    // Проверяем целостность данных
    const integrityCheck = await db.query(`
      SELECT 
        o.id,
        o.current_version,
        o.total_versions,
        COUNT(ov.version) as actual_versions
      FROM offers o
      LEFT JOIN offer_versions ov ON o.id = ov.offer_id
      GROUP BY o.id, o.current_version, o.total_versions
      HAVING COUNT(ov.version) != o.total_versions
    `);
    
    if (integrityCheck.rows.length > 0) {
      console.warn('\nIntegrity issues found:');
      integrityCheck.rows.forEach(row => {
        console.warn(`Offer ${row.id}: expected ${row.total_versions} versions, found ${row.actual_versions}`);
      });
    } else {
      console.log('Data integrity check passed ✓');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
    console.log('Database connection closed');
  }
}

// Запускаем миграцию
if (require.main === module) {
  migrateData().catch(console.error);
}

module.exports = { migrateData };