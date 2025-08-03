const TurndownService = require('turndown');

class MarkdownConverter {
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full'
    });
  }

  // Конвертировать HTML в Markdown
  convertHtmlToMarkdown(html) {
    try {
      if (!html || typeof html !== 'string') {
        throw new Error('HTML должен быть строкой');
      }

      const markdown = this.turndownService.turndown(html);
      
      return {
        success: true,
        markdown: markdown,
        originalLength: html.length,
        markdownLength: markdown.length
      };
    } catch (error) {
      console.error('Ошибка конвертации HTML в Markdown:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Конвертировать весь HTML как один документ
  convertFullHtml(htmlElements) {
    try {
      // Объединяем все HTML элементы в один документ
      const fullHtml = htmlElements
        .map(element => element.content)
        .join('\n\n');
      
      const conversion = this.convertHtmlToMarkdown(fullHtml);
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        total_elements: htmlElements.length,
        full_html_length: fullHtml.length,
        markdown_content: conversion.markdown,
        markdown_length: conversion.markdownLength
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = MarkdownConverter; 