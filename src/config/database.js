const { Pool } = require('pg');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Инициализация подключения к базе данных
   */
  async connect() {
    if (this.pool && this.isConnected) {
      return this.pool;
    }

    try {
      // Конфигурация подключения из переменных окружения
      const config = {
        host: process.env.POSTGRES_HOST || 'postgres',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || 'element_db',
        user: process.env.POSTGRES_USER || 'user',
        password: process.env.POSTGRES_PASSWORD || 'pass_secret',
        // Настройки пула соединений
        max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
        min: parseInt(process.env.POSTGRES_MIN_CONNECTIONS || '2'),
        idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000'),
        // SSL для продакшена
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      };

      this.pool = new Pool(config);
      
      // Тестируем соединение
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      
      console.log(`Connected to PostgreSQL database: ${config.database} at ${config.host}:${config.port}`);
      
      // Обработчики ошибок пула
      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        this.isConnected = false;
      });

      return this.pool;
      
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Получить клиент для выполнения запросов
   * @returns {Promise<Object>} PostgreSQL client
   */
  async getClient() {
    if (!this.pool || !this.isConnected) {
      await this.connect();
    }
    return this.pool.connect();
  }

  /**
   * Выполнить запрос с автоматическим управлением соединением
   * @param {string} text - SQL запрос
   * @param {Array} params - Параметры запроса
   * @returns {Promise<Object>} Результат запроса
   */
  async query(text, params = []) {
    if (!this.pool || !this.isConnected) {
      await this.connect();
    }
    
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Логируем медленные запросы
      if (duration > 1000) {
        console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100));
      }
      
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  /**
   * Выполнить запросы в транзакции
   * @param {Function} queryFn - Функция с запросами: async (client) => {}
   * @returns {Promise<*>} Результат функции
   */
  async transaction(queryFn) {
    if (!this.pool || !this.isConnected) {
      await this.connect();
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await queryFn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Проверить здоровье подключения
   * @returns {Promise<boolean>} true если подключение работает
   */
  async healthCheck() {
    try {
      if (!this.pool || !this.isConnected) {
        return false;
      }
      
      const result = await this.query('SELECT 1 as health');
      return result.rows && result.rows[0] && result.rows[0].health === 1;
      
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Закрыть все соединения
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      console.log('Database connection closed');
    }
  }

  /**
   * Получить информацию о подключении
   * @returns {Object} Статистика пула соединений
   */
  getConnectionInfo() {
    if (!this.pool) {
      return { connected: false };
    }

    return {
      connected: this.isConnected,
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    };
  }
}

// Экспортируем singleton экземпляр
const dbConnection = new DatabaseConnection();

module.exports = {
  DatabaseConnection,
  db: dbConnection
};