const axios = require('axios');

class N8nService {
  constructor() {
    // Для внутренних запросов используем HTTP и имя контейнера
    this.internalUrl = process.env.N8N_INTERNAL_URL || 'http://n8n:5678';
    // Для внешних webhook используем HTTPS
    this.externalUrl = process.env.N8N_EXTERNAL_URL || 'https://n8n.element.travel';
    this.timeout = 30000; // 30 секунд
  }

  // Запустить workflow по webhook URL (GET запрос)
  async triggerWebhook(webhookPath, data = {}) {
    try {
      // Используем внутренний URL для запросов внутри Docker сети
      const webhookUrl = `${this.internalUrl}${webhookPath}`;
      console.log(`Отправляем GET запрос к webhook: ${webhookUrl}`);
      console.log('Параметры запроса:', JSON.stringify(data, null, 2));
      
      // Используем GET запрос с параметрами в URL
      const params = new URLSearchParams(data);
      const fullUrl = params.toString() ? `${webhookUrl}?${params.toString()}` : webhookUrl;
      
      const response = await axios.get(fullUrl, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
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

  // Получить список активных webhook
  async getActiveWebhooks() {
    try {
      const response = await axios.get(`${this.internalUrl}/api/v1/workflows`, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });
      
      const workflows = response.data;
      const webhooks = [];
      
      workflows.forEach(workflow => {
        if (workflow.active && workflow.webhooks) {
          workflow.webhooks.forEach(webhook => {
            webhooks.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              webhookId: webhook.id,
              webhookPath: webhook.path,
              fullPath: `/webhook-${webhook.path}`,
              method: webhook.httpMethod || 'GET'
            });
          });
        }
      });
      
      return webhooks;
    } catch (error) {
      console.error('Ошибка при получении webhook:', error.message);
      return [];
    }
  }

  // Проверить доступность n8n (внутренний запрос)
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

  // Получить информацию о конфигурации
  getConfig() {
    return {
      internalUrl: this.internalUrl,
      externalUrl: this.externalUrl
    };
  }
}

module.exports = N8nService; 