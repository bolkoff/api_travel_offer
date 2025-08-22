class AuthService {
  constructor() {
    // Моковые пользователи с хардкоженными токенами
    this.users = {
      'token_user1': {
        id: 'user_1',
        username: 'alice',
        email: 'alice@example.com'
      },
      'token_user2': {
        id: 'user_2', 
        username: 'bob',
        email: 'bob@example.com'
      },
      'token_user3': {
        id: 'user_3',
        username: 'charlie', 
        email: 'charlie@example.com'
      }
    };
  } 

  /**
   * Проверяет токен и возвращает данные пользователя
   * @param {string} token - JWT токен (пока просто строка)
   * @returns {Object|null} Данные пользователя или null если токен неверный
   */
  async validateToken(token) {
    // Убираем "Bearer " если есть
    const cleanToken = token?.replace('Bearer ', '');
    
    const user = this.users[cleanToken];
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email
    };
  }

  /**
   * Получает пользователя по ID
   * @param {string} userId - ID пользователя
   * @returns {Object|null} Данные пользователя
   */
  async getUserById(userId) {
    const user = Object.values(this.users).find(u => u.id === userId);
    return user || null;
  }

  /**
   * Мок-метод для получения токена (для документации)
   * @param {string} username - Имя пользователя
   * @returns {Object} Токен и данные пользователя
   */
  async getToken(username) {
    const userEntry = Object.entries(this.users).find(([token, user]) => 
      user.username === username
    );

    if (!userEntry) {
      throw new Error('User not found');
    }

    const [token, user] = userEntry;
    
    return {
      token,
      user: {
        id: user.id,
        username: user.username
      }
    };
  }
}

module.exports = AuthService;