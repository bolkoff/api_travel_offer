const App = require('./app');

const PORT = process.env.PORT || 3000;

// Создание и запуск приложения
const appInstance = new App();
const app = appInstance.getExpressApp();

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Запуск сервера
const server = app.listen(PORT, () => {
  console.log(`🚀 Travel Offers API Server running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📝 Offers API: http://localhost:${PORT}/api/offers`);
  console.log(`🔑 Auth API: http://localhost:${PORT}/api/auth/token`);
  console.log('');
  console.log('Available test tokens:');
  console.log('  - token_user1 (alice)');
  console.log('  - token_user2 (bob)');  
  console.log('  - token_user3 (charlie)');
});

module.exports = server;