const n8nWebhooks = {
  // Анализ HTML
  analyze_html: {
    path: '/webhook-test/10be2e02-3902-4107-8d19-f9baf8f77b7e',
    method: 'POST'
  },
  
  // Анализ Markdown
  analyze_md: {
    path: '/webhook-test/2e1d6199-f96d-45f0-a771-b7fb306b1e59',
    method: 'POST'
  },
  
  // Тестовый webhook
  test: {
    path: '/webhook-test/151c376e-fb7f-4af6-a425-fc0f91f955b3',
    method: 'GET'
  }
};

module.exports = n8nWebhooks; 