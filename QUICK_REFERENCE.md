# 📖 QUICK REFERENCE CARD

## 🚀 5-Minute Production Setup

```bash
# 1. Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Setup .env.production
cp .env.example .env.production
# Edit and add the values above

# 3. Create database indexes
node server/scripts/optimize-indexes.cjs

# 4. Verify data consistency
node server/scripts/verify-data.cjs

# 5. Start server
npm start
```

---

## 🔐 Security Configuration

### Rate Limits
```javascript
import { RateLimiters } from './lib/security.js';

app.use('/api/auth', RateLimiters.auth);      // 5/15min
app.use('/api/otp', RateLimiters.otp);        // 3/5min
app.use('/api/admin', RateLimiters.admin);    // 30/1min
app.use('/api', RateLimiters.api);            // 100/15min
```

### Environment Variables (Required)
```env
NODE_ENV=production
JWT_SECRET=<32+ character random string>
FRONTEND_ORIGIN=https://example.com
MONGODB_URI=mongodb+srv://...
```

---

## ✅ Input Validation

### Email Validation
```javascript
import { validateEmail } from './lib/validation.js';

const result = validateEmail(req.body.email);
if (!result.isValid) {
  return res.status(400).json({ error: result.error });
}
```

### Password Validation
```javascript
import { validatePassword } from './lib/validation.js';

const result = validatePassword(req.body.password);
if (!result.isValid) {
  return res.status(400).json({ 
    error: result.errors.join(', '),
    strength: result.strength 
  });
}
```

### Custom Field Validation
```javascript
import { 
  validateReportTitle,
  validateReportDescription 
} from './lib/validation.js';

const titleErr = validateReportTitle(req.body.title);
if (!titleErr.isValid) {
  return res.status(400).json({ error: titleErr.error });
}
```

---

## 📄 Pagination

### Basic Usage
```javascript
import { 
  normalizePagination, 
  createPaginatedResponse 
} from './lib/pagination.js';

const pagination = normalizePagination(
  req.query.page, 
  req.query.limit, 
  'REPORTS'  // Resource type
);

const [total, items] = await Promise.all([
  collection.countDocuments(filter),
  collection
    .find(filter)
    .skip(pagination.skip)
    .limit(pagination.limit)
    .toArray()
]);

res.json(
  createPaginatedResponse(
    items, 
    pagination.page, 
    pagination.limit, 
    total
  )
);
```

### Response Format
```javascript
{
  "data": [ /* items */ ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 95,
    "itemsPerPage": 20,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 🔒 Role-Based Access

### Require Authentication
```javascript
import { authGuard } from './middleware/auth.js';

router.get('/profile', authGuard, async (req, res) => {
  const user = req.user; // { id, email, role }
  // ...
});
```

### Require Admin Role
```javascript
import { authGuard, requireAdmin } from './middleware/auth.js';

router.delete('/users/:id', authGuard, requireAdmin(), async (req, res) => {
  // Only admins can access
});
```

### Custom Role Check
```javascript
import { authGuard, requireRole } from './middleware/auth.js';

router.post('/mentor/create', authGuard, requireRole('mentor'), async (req, res) => {
  // Only mentors can access
});
```

---

## 📊 Validation Rules

### Built-in Limits
```javascript
{
  EMAIL_MAX_LENGTH: 254,
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
  REPORT_TITLE_MIN_LENGTH: 5,
  REPORT_TITLE_MAX_LENGTH: 200,
  REPORT_DESCRIPTION_MIN_LENGTH: 20,
  REPORT_DESCRIPTION_MAX_LENGTH: 5000,
  EVIDENCE_URL_MAX_LENGTH: 1000,
  
  // Pagination
  DEFAULT_PAGE_LIMIT: 20,
  MAX_PAGE_LIMIT: 100,
}
```

---

## 🛡️ Security Middleware

### Get Client IP
```javascript
import { getClientIp } from './lib/security.js';

router.post('/sensitive', authGuard, (req, res) => {
  const ip = getClientIp(req);
  console.log(`Action by ${req.user.id} from ${ip}`);
});
```

### Generate Secure Token
```javascript
import { generateSecureToken } from './lib/security.js';

const token = generateSecureToken(32); // 32 random bytes
```

---

## 🗄️ Database Scripts

### Create Indexes (Run Once)
```bash
node server/scripts/optimize-indexes.cjs
```
Creates:
- 35+ indexes across 10 collections
- Text indexes for search
- TTL indexes for auto-cleanup
- Unique constraints

### Verify Data Consistency
```bash
node server/scripts/verify-data.cjs
```
Checks:
- Orphaned enrollments
- Invalid references
- Duplicate records
- Inconsistent status values

---

## 📝 Logging Best Practices

### Log Failed Auth
```javascript
const ip = getClientIp(req);
console.warn(`[Auth] Failed login attempt from ${ip}`);
```

### Log Sensitive Actions
```javascript
console.log(`[Admin] User ${userId} deleted by ${req.user.id}`);
```

### Log Errors
```javascript
catch (error) {
  console.error('[Route] Operation failed:', error.message);
  res.status(500).json({ error: 'Operation failed' });
}
```

### Log on Production
```javascript
if (process.env.NODE_ENV === 'production') {
  console.log(`[Production] Critical event: ${action}`);
}
```

---

## 🧪 Testing Commands

### Test Rate Limiting
```bash
for i in {1..6}; do
  echo "Attempt $i:"
  curl -X POST http://localhost:4000/api/auth/login
done
# 6th should fail with 429
```

### Test Validation
```bash
curl -X POST http://localhost:4000/api/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Bad", "description": "x"}'
# Should return 400 with validation error
```

### Test Pagination
```bash
curl "http://localhost:4000/api/reports?page=1&limit=999999"
# Should return max 50 items (enforced limit)
```

---

## 🚨 Common Issues & Fixes

### JWT_SECRET too short
```bash
# Fix: Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Update .env.production
```

### CORS blocked in production
```bash
# Fix: Set FRONTEND_ORIGIN correctly
FRONTEND_ORIGIN=https://example.com,https://admin.example.com
# No localhost!
```

### Slow queries
```bash
# Fix: Run index optimization
node server/scripts/optimize-indexes.cjs
```

### Orphaned records
```bash
# Check: Run data consistency
node server/scripts/verify-data.cjs
```

---

## 📚 Documentation Files

| File | Purpose | Read Time |
|------|---------|-----------|
| QUICK_START.md | 5-min setup | 5 min |
| SECURITY_IMPROVEMENTS.md | Complete guide | 20 min |
| MIGRATION_GUIDE.js | Code examples | 15 min |
| IMPLEMENTATION_SUMMARY.md | Overview | 10 min |
| CHECKLIST.md | Full checklist | 10 min |

---

## 🎯 Priority Migration Order

1. **AUTH ROUTES** (server/routes/auth.js)
   - Add password validation
   - Add email validation
   - Fix error messages

2. **ADMIN ROUTES** (server/routes/admin.js)
   - Add pagination to all lists
   - Add requireAdmin() middleware
   - Add audit logging

3. **REPORT ROUTES** (server/routes/reports.js)
   - Add validation to all fields
   - Add pagination to listing
   - Add ownership checks

4. **OTHER ROUTES**
   - Add pagination
   - Add validation
   - Improve error handling

---

**Version:** 1.0 | **Created:** Dec 24, 2025 | **Status:** ✅ Ready
