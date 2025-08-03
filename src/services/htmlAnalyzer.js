const axios = require('axios');
const MarkdownConverter = require('./markdownConverter');

class HtmlAnalyzer {
  constructor() {
    this.n8nService = null;
    this.markdownConverter = new MarkdownConverter();
  }

  setN8nService(n8nService) {
    this.n8nService = n8nService;
  }

  async analyzeHtmlElements(htmlElements, options = {}) {
    try {
      const { mode = 'markdown' } = options; // 'html' | 'markdown'
      
      console.log('Начинаем анализ HTML элементов:', htmlElements.length);
      console.log(`Режим анализа: ${mode}`);
      
      const results = {
        success: true,
        timestamp: new Date().toISOString(),
        total_elements: htmlElements.length,
        analysis_mode: mode,
        found_objects: [],
        errors: []
      };

      if (mode === 'markdown') {
        // Анализ через Markdown
        await this.analyzeAsMarkdown(htmlElements, results);
      } else {
        // Анализ через HTML (по умолчанию)
        await this.analyzeAsHtml(htmlElements, results);
      }

      console.log(`Анализ завершен. Найдено объектов: ${results.found_objects.length}`);
      return results;

    } catch (error) {
      console.error('Ошибка в analyzeHtmlElements:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Анализ как HTML (оригинальная логика)
  async analyzeAsHtml(htmlElements, results) {
    console.log('Выполняем анализ как HTML...');
    
    results.analyzed_elements = 0;
    
    for (let i = 0; i < htmlElements.length; i++) {
      const element = htmlElements[i];
      
      try {
        console.log(`Анализируем HTML элемент ${i + 1}/${htmlElements.length}`);
        
        const analysis = await this.analyzeSingleElement(element);
        
        if (analysis.success && analysis.objects.length > 0) {
          results.found_objects.push(...analysis.objects);
          results.analyzed_elements++;
        }
        
      } catch (error) {
        console.error(`Ошибка при анализе HTML элемента ${i + 1}:`, error.message);
        results.errors.push({
          element_index: i,
          type: 'html_analysis',
          error: error.message
        });
      }
    }
  }

  // Анализ как Markdown
  async analyzeAsMarkdown(htmlElements, results) {
    console.log('Выполняем анализ как Markdown...');
    
    // Конвертируем HTML в Markdown
    const markdownResult = this.markdownConverter.convertFullHtml(htmlElements);
    
    if (markdownResult.success) {
      results.markdown_conversion = markdownResult;
      console.log('HTML успешно конвертирован в Markdown');
      
      // Отправляем Markdown в n8n workflow для анализа
      if (this.n8nService) {
        try {
          console.log('Отправляем Markdown в n8n workflow для анализа...');
          const n8nResult = await this.n8nService.triggerWebhookByName('analyze_md', {
            markdown_content: markdownResult.markdown_content,
            original_html_elements_count: htmlElements.length,
            markdown_length: markdownResult.markdown_length,
            conversion_timestamp: markdownResult.timestamp
          });
          
          if (n8nResult.success && n8nResult.data) {
            results.found_objects = Array.isArray(n8nResult.data) ? n8nResult.data : [n8nResult.data];
            results.markdown_analysis = n8nResult.data;
            console.log('Markdown успешно проанализирован в n8n');
          } else {
            console.error('Ошибка анализа Markdown в n8n:', n8nResult.error);
            results.errors.push({
              type: 'markdown_analysis',
              error: n8nResult.error
            });
          }
        } catch (error) {
          console.error('Ошибка при анализе Markdown в n8n:', error.message);
          results.errors.push({
            type: 'markdown_analysis',
            error: error.message
          });
        }
      }
    } else {
      console.error('Ошибка конвертации в Markdown:', markdownResult.error);
      results.errors.push({
        type: 'markdown_conversion',
        error: markdownResult.error
      });
    }
  }

  async analyzeSingleElement(element) {
    try {
      const result = {
        success: true,
        element: {
          content: element.content
        },
        objects: []
      };

      if (this.n8nService) {
        const n8nResult = await this.n8nService.triggerWebhookByName('analyze_html', {
          html_content: element.content
        });

        if (n8nResult.success && n8nResult.data) {
          result.objects = Array.isArray(n8nResult.data) ? n8nResult.data : [n8nResult.data];
        }
      }

      return result;

    } catch (error) {
      console.error('Ошибка в analyzeSingleElement:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = HtmlAnalyzer; 