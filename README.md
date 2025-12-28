# Production-Grade Ledger Transactions API

A robust, production-grade Ledger/Banking API built with Node.js, TypeScript, and PostgreSQL. This project demonstrates best practices in API design, database transactions, security, and engineering for real-world financial systems.

## Features

- **OAuth 2.0 Authentication** - Google OAuth integration with Redis-backed sessions
- **ACID-Compliant Transactions** - Atomic transfers with row-level locking to prevent race conditions
- **RESTful API Design** - Pagination, filtering, sorting, and proper HTTP semantics
- **Idempotency Support** - Safely retry requests without double-processing
- **Rate Limiting** - Protect against abuse with configurable limits
- **Structured Logging** - Request tracing with correlation IDs
- **Comprehensive Testing** - Integration tests including concurrency scenarios
- **Docker Ready** - One-command development environment setup

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.x |
| Framework | Express.js |
| Database | PostgreSQL 16 |
| Session Store | Redis 7 |
| Query Builder | Knex.js |
| Validation | Zod |
| Authentication | Passport.js (Google OAuth) |
| Logging | Pino |
| Testing | Jest + Supertest |
| Containerization | Docker + Docker Compose |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Google OAuth credentials (optional for dev mode)

### Setup

```bash
# Clone and install
git clone <repository-url>
cd production-grade-ledger-transactions-api
npm install

# Start infrastructure (Postgres + Redis)
npm run docker:up

# Run database migrations
npm run db:migrate

# Seed test data (optional)
npm run db:seed

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`.

### Environment Variables

Create a `.env` file in the project root:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ledger_db

# Redis
REDIS_URL=redis://localhost:6379

# Session
SESSION_SECRET=your-super-secret-session-key

# Google OAuth (optional for dev)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google` | GET | Initiate Google OAuth flow |
| `/auth/google/callback` | GET | OAuth callback handler |
| `/auth/me` | GET | Get current user profile |
| `/auth/logout` | POST | End session |
| `/auth/dev-login` | POST | Dev-only mock login |

### Accounts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/accounts` | GET | List user's accounts |
| `/api/v1/accounts` | POST | Create new account |
| `/api/v1/accounts/:id` | GET | Get account details |
| `/api/v1/accounts/:id` | PATCH | Update account |
| `/api/v1/accounts/:id` | DELETE | Deactivate account |

### Transactions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/transactions` | GET | List transactions (paginated) |
| `/api/v1/transactions/:id` | GET | Get transaction details |
| `/api/v1/transactions` | POST | Create transaction |

#### Query Parameters for Listing Transactions

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (max: 100, default: 20) |
| `type` | enum | Filter by type: `DEPOSIT`, `WITHDRAWAL`, `TRANSFER` |
| `status` | enum | Filter by status: `PENDING`, `COMPLETED`, `FAILED` |
| `accountId` | uuid | Filter by account (from or to) |
| `startDate` | date | Filter by start date |
| `endDate` | date | Filter by end date |
| `sortBy` | enum | Sort field: `created_at`, `amount`, `type` |
| `sortOrder` | enum | Sort direction: `asc`, `desc` |

#### Create Transaction Examples

**Transfer:**
```json
{
  "type": "TRANSFER",
  "fromAccountId": "uuid",
  "toAccountId": "uuid",
  "amount": 10000,
  "currency": "USD",
  "description": "Payment for services"
}
```

**Deposit:**
```json
{
  "type": "DEPOSIT",
  "accountId": "uuid",
  "amount": 50000,
  "currency": "USD",
  "referenceId": "external-ref-123"
}
```

**Withdrawal:**
```json
{
  "type": "WITHDRAWAL",
  "accountId": "uuid",
  "amount": 25000,
  "currency": "USD"
}
```

### Idempotency

For safe retries, include the `Idempotency-Key` header:

```bash
curl -X POST /api/v1/transactions \
  -H "Idempotency-Key: unique-request-id-123" \
  -d '{"type": "TRANSFER", ...}'
```

---

## Engineering Decisions

This section explains key architectural choices made for production-readiness.

### 1. Money Stored as Integers (Cents)

**Problem:** Floating-point arithmetic causes precision errors.

```javascript
// BAD: Floating point
0.1 + 0.2 = 0.30000000000000004

// GOOD: Integer arithmetic (cents)
10 + 20 = 30  // $0.30
```

**Solution:** All monetary values are stored as `BIGINT` in the smallest currency unit (cents for USD). This:
- Eliminates floating-point precision errors
- Supports values up to ~92 quadrillion cents
- Simplifies arithmetic operations

```sql
-- Database column definition
balance BIGINT NOT NULL DEFAULT 0
```

### 2. Row-Level Locking for Concurrency Control

**Problem:** Concurrent transfers can cause race conditions (double-spending).

**Scenario:** Account has $1000. Two concurrent requests try to transfer $600 each.

Without locking:
1. Request A reads balance: $1000 ✓
2. Request B reads balance: $1000 ✓
3. Request A deducts $600: $400
4. Request B deducts $600: $400 (should fail!)

**Solution:** Use `SELECT ... FOR UPDATE` to lock rows during transactions.

```typescript
// Lock accounts in consistent order to prevent deadlocks
const [firstId, secondId] = fromAccountId < toAccountId 
  ? [fromAccountId, toAccountId] 
  : [toAccountId, fromAccountId];

const firstAccount = await trx('accounts')
  .where({ id: firstId })
  .forUpdate()  // Pessimistic lock
  .first();
```

This ensures:
- Only one transaction can modify an account at a time
- Consistent lock ordering prevents deadlocks
- ACID guarantees are maintained

### 3. Idempotency for Safe Retries

**Problem:** Network timeouts can cause duplicate transactions if the client retries.

**Solution:** Implement idempotency keys that uniquely identify requests.

```typescript
// Check for existing transaction with same key
const existing = await TransactionModel.findByIdempotencyKey(key);
if (existing) {
  return existing; // Return cached result
}

// Proceed with new transaction
await db.transaction(async (trx) => {
  // ... create transaction with idempotency_key stored
});
```

The `idempotency_key` column has a unique index for fast lookups.

### 4. Database Constraints as Safety Nets

Defense in depth - the database enforces business rules even if application code fails:

```sql
-- Prevent negative balances
ALTER TABLE accounts ADD CONSTRAINT chk_balance_non_negative 
  CHECK (balance >= 0);

-- Ensure positive transaction amounts
ALTER TABLE transactions ADD CONSTRAINT chk_amount_positive 
  CHECK (amount > 0);

-- Transfers must have both accounts
ALTER TABLE transactions ADD CONSTRAINT chk_transfer_accounts 
  CHECK (
    (type != 'TRANSFER') OR 
    (type = 'TRANSFER' AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL)
  );
```

### 5. Structured Logging with Request Correlation

Every request gets a unique ID that flows through all log entries:

```typescript
// Middleware assigns request ID
req.id = req.headers['x-request-id'] || uuidv4();

// All logs include the ID
logger.info({ 
  requestId: req.id, 
  transactionId, 
  amount 
}, 'Transfer completed');
```

This enables:
- Tracing a single request across all logs
- Debugging production issues efficiently
- Integration with log aggregation tools (ELK, Datadog)

### 6. Database Indexing Strategy

Indexes are designed for common query patterns:

```sql
-- Transaction history queries
CREATE INDEX idx_transactions_account_history 
  ON transactions(from_account_id, created_at DESC);

-- Idempotency key lookups (partial index)
CREATE INDEX idx_transactions_idempotency 
  ON transactions(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Status filtering
CREATE INDEX idx_transactions_status ON transactions(status);
```

### 7. Session Management with Redis

Sessions are stored in Redis rather than in-memory or database:

- **Horizontal Scalability:** Multiple app instances share session state
- **Performance:** Sub-millisecond session lookups
- **TTL Support:** Automatic session expiration

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Categories

1. **Unit Tests** - Validators, utilities
2. **Integration Tests** - API endpoints with database
3. **Concurrency Tests** - Race condition scenarios

---

## Docker

### Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Build

```bash
# Build optimized image
docker build -t ledger-api .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  ledger-api
```

---

## Project Structure

```
src/
├── config/           # Environment and service configuration
├── controllers/      # HTTP request handlers
├── database/
│   ├── migrations/   # Schema changes
│   └── seeds/        # Test data
├── middlewares/      # Express middleware (auth, validation, logging)
├── models/           # Data access layer
├── routes/           # API route definitions
├── services/         # Business logic (TransactionService)
├── types/            # TypeScript type definitions
├── utils/            # Shared utilities (logger, errors)
├── validators/       # Zod schemas
├── __tests__/        # Test files
├── app.ts            # Express app setup
└── server.ts         # Server entry point
```

---

## Resume Bullet Points

> Designed and implemented OAuth-secured REST APIs backed by PostgreSQL with pagination, filtering, Zod validation, and comprehensive integration tests including concurrency scenarios.

> Implemented ACID-compliant financial transactions using database-level row locking (SELECT FOR UPDATE) and idempotency keys to prevent race conditions and double-spending.

> Containerized with Docker and production-hardened with structured logging (Pino), request correlation IDs, rate limiting, and database constraint safety nets.

---

## License

MIT

