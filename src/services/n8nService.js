const axios = require('axios');
const n8nWebhooks = require('../config/n8nWebhooks');

class N8nService {
  constructor() {
    this.internalUrl = process.env.N8N_INTERNAL_URL || 'http://n8n:5678';
    this.externalUrl = process.env.N8N_EXTERNAL_URL || 'https://n8n.element.travel';
    this.timeout = 30000;
  }

  // Запустить workflow по имени из мапы
  async triggerWebhookByName(webhookName, data = {}) {
    const webhookConfig = n8nWebhooks[webhookName];
    
    if (!webhookConfig) {
      throw new Error(`Webhook "${webhookName}" не найден в конфигурации`);
    }

    return this.triggerWebhook(webhookConfig.path, data, webhookConfig.method);
  }

  // Запустить workflow по webhook URL с указанием метода
  async triggerWebhook(webhookPath, data = {}, method = 'GET') {
    try {
      const webhookUrl = `${this.internalUrl}${webhookPath}`;
      console.log(`Отправляем ${method} запрос к webhook: ${webhookUrl}`);
      console.log('Данные запроса:', JSON.stringify(data, null, 2));
      
      let response;
      
      if (method.toUpperCase() === 'POST') {
        // POST запрос с данными в body
        response = await axios.post(webhookUrl, data, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        });
      } else {
        // GET запрос с параметрами в URL
        const params = new URLSearchParams(data);
        const fullUrl = params.toString() ? `${webhookUrl}?${params.toString()}` : webhookUrl;
        
        response = await axios.get(fullUrl, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        });
      }
      
      console.log('Webhook выполнен успешно:', response.status);
      console.log('Ответ:', response.data);
      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      console.error('Ошибка при выполнении webhook:', error.message);
      if (error.response) {
        console.error('Статус ответа:', error.response.status);
        console.error('Данные ответа:', error.response.data);
      }
      return {
        success: false,
        error: error.message,
        status: error.response?.status || 'unknown',
        responseData: error.response?.data
      };
    }
  }

  // Получить список доступных webhook
  getAvailableWebhooks() {
    return n8nWebhooks;
  }

  // Проверить доступность n8n
  async checkHealth() {
    try {
      const response = await axios.get(`${this.internalUrl}/api/v1/health`, {
        timeout: 5000
      });
      return {
        status: 'OK',
        data: response.data
      };
    } catch (error) {
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  getConfig() {
    return {
      internalUrl: this.internalUrl,
      externalUrl: this.externalUrl
    };
  }
}

module.exports = N8nService; 