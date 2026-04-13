# Quick Start: Running Tests

## TL;DR - Run These Commands

### Run all tests
```bash
npm test
```

### Run only unit tests
```bash
npm test -- transactions.service.spec
```

### Run only integration tests
```bash
npm test -- purchase.e2e-spec
```

### Run with coverage
```bash
npm run test:cov
```

### Run in watch mode (re-runs on file changes)
```bash
npm run test:watch
```

---

## Step-by-Step Usage

### Setup (One Time)
```bash
# 1. Start services
docker-compose up -d

# 2. Verify services are running
docker-compose ps

# 3. Run migrations
npx prisma migrate deploy

# 4. Install dependencies (if not already done)
npm install
```

### Running Tests

**Option 1: Run Everything**
```bash
npm test
```

**Output:**
```
 PASS  src/transactions/transactions.service.spec.ts
  TransactionsService - Unit Tests
    purchase
      ✓ should successfully purchase a product (45ms)
      ✓ should throw NotFoundException if product does not exist (12ms)
      ✓ should throw BadRequestException if product is out of stock (8ms)
      ✓ should throw BadRequestException if buyer tries to purchase own product (10ms)
      ✓ should throw BadRequestException if buyer has insufficient balance (11ms)
      ✓ should throw BadRequestException if stock is unavailable (9ms)
      ✓ should credit seller after successful purchase (13ms)
      ✓ should create transaction record with correct data (12ms)

Tests:       8 passed, 8 total
Time:        2.345s
```

**Option 2: Run Unit Tests Only**
```bash
npm test -- transactions.service.spec --testTimeout=10000
```

Fast and isolated - tests the purchase logic with mocked database

**Option 3: Run Integration Tests Only**
```bash
npm test -- purchase.e2e-spec --testTimeout=30000
```

Real database and API - tests the complete purchase flow

**Option 4: Watch Mode (for development)**
```bash
npm run test:watch
```

- Automatically re-runs tests when files change
- Press `q` to quit
- Press `a` to run all tests
- Press `f` to run only failed tests

**Option 5: Generate Coverage Report**
```bash
npm run test:cov
```

Creates `coverage/` directory with HTML report:
```bash
open coverage/index.html  # macOS
start coverage/index.html # Windows
```

---

## Understanding the Tests

### Unit Tests (`src/transactions/transactions.service.spec.ts`)

**What they test:** The purchase business logic in isolation

**Tests included:**
1. ✅ Successful purchase
2. ✅ Product not found
3. ✅ Out of stock
4. ✅ Cannot buy own product
5. ✅ Insufficient funds
6. ✅ Stock conflict
7. ✅ Seller is credited
8. ✅ Transaction record is created

**Why unit tests?**
- Fast (< 1 second)
- Isolated - doesn't touch database
- Easy to debug
- Run on every change

**Example test:**
```typescript
it('should successfully purchase a product', async () => {
  // Setup: Mock all dependencies
  const mockTx = { /* ... */ };
  
  // Execute: Call the service method
  const result = await service.purchase('user-1', 'product-1');
  
  // Verify: Check results match expectations
  expect(result.transaction.id).toBeDefined();
  expect(result.buyer.balanceCents).toBe(9000); // 10000 - 1000
});
```

### Integration Tests (`test/purchase.e2e-spec.ts`)

**What they test:** Complete purchase flow with real database and API

**Test scenarios:**
1. ✅ User registration
2. ✅ Wallet deposits
3. ✅ Product creation
4. ✅ Purchase execution
5. ✅ Error handling
6. ✅ Cache invalidation
7. ✅ Balance updates

**Why integration tests?**
- Tests actual API endpoints
- Verifies database interactions
- Tests authentication flow
- Tests cache behavior

**Example test:**
```typescript
it('should successfully purchase product', async () => {
  // Send actual HTTP request
  const response = await request(app.getHttpServer())
    .post('/transactions/purchase')
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ productId: productId })
    .expect(201);

  // Verify response
  expect(response.body.transaction.from_user).toBe(buyerId);
  expect(response.body.buyer.balanceCents).toBe(40000);
});
```

---

## Common Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm test -- --watch` | Watch mode (re-run on save) |
| `npm run test:cov` | Generate coverage report |
| `npm test -- -t "should successfully purchase"` | Run specific test by name |
| `npm test -- transactions.service.spec` | Run specific test file |
| `npm run test:debug` | Debug tests in Chrome DevTools |

---

## Test Results Interpretation

### ✅ All Tests Passing
```
Tests:       16 passed, 16 total
Time:        5.234s
Coverage:    85% statements, 80% branches, 90% functions, 85% lines
```
**Good!** All logic is working correctly

### ❌ Test Failure
```
FAIL  src/transactions/transactions.service.spec.ts

× should successfully purchase a product
  Expected: { id: 'txn-1', ... }
  Received: { id: 'txn-2', ... }

Tests:       1 failed, 15 passed
```
**Action:** Review the expectation vs actual value

### ⏱️ Timeout
```
Jest did not exit one second after the test run has completed.
```
**Action:** Services not running or database connection failed
```bash
docker-compose ps  # Check services
docker-compose up -d  # Start if needed
```

---

## Test Scenarios Covered

### Purchase Success Path
```
1. Buyer registers & deposits $500
2. Seller creates product for $100
3. Buyer purchases product
   ✓ Buyer balance: $500 → $400
   ✓ Seller balance: $0 → $100
   ✓ Product stock: 5 → 4
   ✓ Transaction record created
```

### Error Cases
```
✓ Product not found → NotFoundException
✓ Product out of stock → BadRequestException
✓ Buyer trying to buy own product → BadRequestException
✓ Insufficient balance → BadRequestException
✓ Stock race condition → BadRequestException
```

### Cache Behavior
```
✓ Products cached on first fetch
✓ Cache invalidated on purchase
✓ Cache invalidated on product create/update/delete
✓ Manual cache clear works
```

---

## Debugging Tests

### See Debug Output
```bash
npm test -- --verbose
```

### Debug in Chrome DevTools
```bash
npm run test:debug
# Then open chrome://inspect in Chrome
# Click inspect on the Node process
```

### Run Single Test
```bash
npm test -- -t "should successfully purchase"
```

### Increase Timeout (for slow systems)
```bash
npm test -- --testTimeout=30000
```

---

## Tips & Tricks

### 💡 Run Tests Before Committing
```bash
npm test && git commit -m "my changes"
```

### 💡 Auto-format Test Files
```bash
npm run format
```

### 💡 Check Test Coverage
```bash
npm run test:cov -- --coverage
```

Results available in `coverage/index.html`

### 💡 See What Unit Tests Cover
```typescript
// In the test file, each 'it' is one test:
it('should successfully purchase a product', async () => {
  // ↑ This is one test case
});

it('should throw error if out of stock', async () => {
  // ↑ This is another test case
});
```

### 💡 Mock Data Reference
```typescript
const mockUser = { id: 'user-1', balanceCents: 10000 }
const mockSeller = { id: 'seller-1', balanceCents: 0 }
const mockProduct = { id: 'product-1', amount: 5, priceCents: 1000 }
const mockTransaction = { id: 'txn-1', moneyAmountCents: 1000 }
```

---

## Troubleshooting

### "Cannot connect to database"
```bash
# Verify Docker is running
docker ps

# Start services
docker-compose up -d

# Check logs
docker-compose logs postgres
```

### "Tests timeout"
```bash
# Increase timeout
npm test -- --testTimeout=60000

# Or check if services are responsive
docker exec postgres_test pg_isready -U admin
```

### "Jest not found"
```bash
npm install
```

### "Port already in use"
```bash
# See what's using port 5432
lsof -i :5432

# Or restart Docker
docker-compose down
docker-compose up -d
```

---

## Next Steps

1. **Add more tests** for other services (wallet, products)
2. **Increase coverage** to 90%+ 
3. **Add performance tests** for cache hit rates
4. **Set up CI/CD** to run tests on every commit
5. **Add E2E tests** for frontend integration

See `TEST_GUIDE.md` for detailed documentation.
