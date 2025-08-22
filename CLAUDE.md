# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Travel Offers Server - Универсальный REST API сервер для управления предложениями (offers) с поддержкой версионирования, управления конфликтами и публикации. Сервер агностичен к структуре данных предложений и работает с ними как с JSON объектами. Использует Node.js/Express и MongoDB/PostgreSQL.

## Development Commands

### Local Development
```bash
# Start development server with hot-reload
npm run dev

# Start production server
npm start

# Health check
npm run healthcheck
```

### Testing
Note: Test scripts are defined in README but not implemented in package.json yet. Based on documentation:
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only  
npm run test:integration
```

### Code Quality
From documentation (not yet implemented in package.json):
```bash
# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Docker Development
```bash
# Build and run with docker-compose in development mode
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f api

# Stop services
docker-compose -f docker/docker-compose.yml down
```

## Architecture

Follows **Layered Architecture** principles with clear separation of concerns.

### Directory Structure
```
src/
├── controllers/     # HTTP handlers, request validation
├── services/        # Business logic layer
├── models/          # Data models and validation schemas  
├── repositories/    # Data access layer
├── middleware/      # Authentication, logging, CORS
├── config/          # Application configuration
├── utils/           # Utilities (hash, validation, etc.)
└── routes/          # API route definitions
```

### Core Services

**OfferService** - Primary business logic service
- CRUD operations for offers
- Version management (create, restore, list versions)
- Optimistic locking with ETags
- Auto-save and manual versioning
- Content-agnostic JSON handling

**PublicationService** - External publishing
- Publish offers to external services
- Manage publication lifecycle
- Track publication status and URLs

**ConflictService** - Conflict resolution
- Detect concurrent edits
- Provide resolution strategies
- Handle merge conflicts

**AuthService** - Authentication
- JWT token management
- User session handling
- Permission validation

### Architectural Principles

1. **Single Responsibility** - Each module has one clear purpose
2. **Dependency Injection** - Services receive dependencies via constructor
3. **Repository Pattern** - Abstract data access layer
4. **Error-First Design** - Centralized error handling
5. **Validation at Boundaries** - Input validation at API entry points

### Environment Setup

Required environment variables:
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=mongodb://localhost:27017/travel-offers
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
API_RATE_LIMIT=1000
```

### Dependencies

**Core:**
- `express` - Web framework
- `mongodb` / `pg` - Database drivers
- `jsonwebtoken` - JWT authentication
- `bcryptjs` - Password hashing
- `joi` - Request validation
- `redis` - Session storage and caching

**Development:**
- `nodemon` - Development hot-reload
- `jest` - Testing framework
- `supertest` - HTTP testing

## Code Patterns

### Service Initialization
Services use constructor dependency injection:
```javascript
class OfferService {
  constructor(offerRepository, versionRepository) {
    this.offerRepo = offerRepository;
    this.versionRepo = versionRepository;
  }
}

// In app.js
const offerRepo = new OfferRepository(db);
const versionRepo = new VersionRepository(db);
const offerService = new OfferService(offerRepo, versionRepo);
```

### Error Handling Pattern
Standardized error responses:
```javascript
// Success response
{
  "data": { /* response data */ },
  "meta": { "timestamp": "...", "version": "..." }
}

// Error response
{
  "error": "validation_error",
  "message": "Invalid request data",
  "details": { /* validation details */ }
}
```

### Optimistic Locking Pattern
```javascript
// Client sends ETag in If-Match header
const offer = await offerService.updateOffer(id, data, {
  ifMatch: req.headers['if-match']
});

// Service validates ETag before updating
if (offer.eTag !== ifMatch) {
  throw new ConflictError('Offer was modified by another user');
}
```

## Testing Strategy

Comprehensive testing approach with Jest:

### Unit Tests
- **Services**: Test business logic in isolation
- **Repositories**: Test data access patterns
- **Utilities**: Test helper functions
- **Models**: Test validation schemas

### Integration Tests  
- **API Endpoints**: Full request/response cycle
- **Database Operations**: Real database interactions
- **Authentication Flow**: JWT token lifecycle
- **Conflict Resolution**: Multi-user scenarios

### Testing Patterns
```javascript
// Service unit test
describe('OfferService', () => {
  let offerService, mockRepo;
  
  beforeEach(() => {
    mockRepo = { findById: jest.fn(), update: jest.fn() };
    offerService = new OfferService(mockRepo);
  });
});

// API integration test
request(app)
  .put('/api/offers/123')
  .set('Authorization', 'Bearer ' + token)
  .set('If-Match', etag)
  .send(updateData)
  .expect(200);
```

## File Structure

```
src/
├── controllers/
│   ├── OfferController.js      # Offer CRUD endpoints
│   ├── VersionController.js    # Version management endpoints
│   ├── PublicationController.js # Publication endpoints
│   └── AuthController.js       # Authentication endpoints
├── services/
│   ├── OfferService.js        # Core offer business logic
│   ├── PublicationService.js  # Publishing logic
│   ├── ConflictService.js     # Conflict resolution
│   └── AuthService.js         # Authentication logic
├── repositories/
│   ├── OfferRepository.js     # Offer data access
│   ├── VersionRepository.js   # Version data access
│   ├── PublicationRepository.js # Publication data access
│   └── UserRepository.js      # User data access
├── models/
│   ├── Offer.js              # Offer schema & validation
│   ├── Version.js            # Version schema
│   └── User.js               # User schema
├── middleware/
│   ├── auth.js               # JWT authentication
│   ├── validation.js         # Request validation
│   └── errorHandler.js       # Global error handling
├── config/
│   ├── database.js           # DB configuration
│   └── app.js                # App configuration
└── utils/
    ├── hash.js               # ETag generation
    ├── logger.js             # Logging utility
    └── validators.js         # Common validators
```

## Deployment

The application is containerized with Docker:
- Development: Uses `docker/Dockerfile.dev` with volume mounts for hot-reload
- Production: Uses `docker/Dockerfile` 
- External network `d_net` for service communication
- Health checks configured with curl on `/api/health`

## Development Guidelines

### Code Organization
- Keep controllers **thin** - only handle HTTP concerns
- Put business logic in **services**
- Use **repositories** for all database access
- Validate data at **API boundaries**

### Database Patterns
- Use **transactions** for multi-step operations
- Implement **optimistic locking** with ETags
- Keep **versions** as separate collection/table
- Index frequently queried fields

### Error Handling
- Throw **domain-specific errors** in services
- Catch and transform errors in **middleware**
- Return **consistent error format** to clients
- Log errors with **structured data**

### Performance Considerations
- **Paginate** large result sets
- Use **projection** to limit returned fields
- **Cache** frequently accessed data in Redis
- **Compress** large content payloads

### Security
- **Validate** all inputs with Joi schemas
- **Sanitize** user-provided content
- **Rate limit** API endpoints
- **Audit log** sensitive operations