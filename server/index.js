import 'dotenv/config';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { connectToDatabase, disconnectFromDatabase } from './lib/db.js';
import { disconnect as disconnectCache } from './lib/cache.js';
import { startContestReminderScheduler } from './lib/scheduler.js';
import { RateLimiters, validateProductionSetup } from './lib/security.js';
import { ipBlocklist } from './middleware/ipBlocklist.js';
import { requestSanitizer } from './middleware/requestSanitizer.js';
import authRouter from './routes/auth.js';
import contestsRouter from './routes/contests.js';
import coursesRouter from './routes/courses.js';
import healthRouter from './routes/health.js';
import mediaRouter from './routes/media.js';
import notificationsRouter from './routes/notifications.js';
import otpRouter from './routes/otp.js';
import registrationsRouter from './routes/registrations.js';
import searchRouter from './routes/search.js';
import statsRouter from './routes/stats.js';
import teamsRouter from './routes/teams.js';
import usersRouter from './routes/users.js';
import chatRouter from './routes/chat.js';
import matchingRouter from './routes/matching.js';
import adminRouter from './routes/admin.js';
import reviewsRouter from './routes/reviews.js';
import documentsRouter from './routes/documents.js';
import reportsRouter from './routes/reports.js';
import reviewReportsRouter from './routes/reviewReports.js';
import feedbackRouter from './routes/feedback.js';
import newsRouter from './routes/news.js';
import recruitmentsRouter from './routes/recruitments.js';
import membershipRouter from './routes/membership.js';
import paymentsRouter from './routes/payments.js';
import mentorsRouter from './routes/mentors.js';
import { trackConcurrentUsers } from './lib/concurrentUsers.js';

const app = express();
app.disable('x-powered-by');
const port = process.env.PORT || 4000;
let server;

// Validate production setup first
if (process.env.NODE_ENV === 'production') {
  validateProductionSetup();
}

// Trust the upstream proxy so rate limiting can read the real client IP from X-Forwarded-For
// Defaults to a single hop but can be overridden via TRUST_PROXY env (e.g. "true", "false", number, or subnet string)
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy !== undefined) {
  const parsedTrustProxy =
    trustProxy === 'true'
      ? true
      : trustProxy === 'false'
        ? false
        : Number.isNaN(Number(trustProxy))
          ? trustProxy
          : Number(trustProxy);
  app.set('trust proxy', parsedTrustProxy);
} else {
  app.set('trust proxy', 1);
}

// Parse and validate CORS origins
const corsOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  : [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
  ];

// In production, ensure no localhost origins
if (process.env.NODE_ENV === 'production') {
  const hasLocalhost = corsOrigins.some(
    (o) => o.includes('localhost') || o.includes('127.0.0.1')
  );
  if (hasLocalhost) {
    console.error('[Security] Production mode detected but localhost found in CORS origins!');
    console.error('[Security] This is a security risk. Please set proper FRONTEND_ORIGIN.');
    process.exit(1);
  }
}

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    maxAge: 86400, // 24 hours
  })
);

// Enforce admin-managed IP blocks early (best-effort, cached).
app.use(ipBlocklist);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestSanitizer);

// Track approximate concurrent users (best-effort, in-memory) for alerting.
app.use((req, _res, next) => {
  try {
    if (req.path?.startsWith('/api/health')) return next();
    trackConcurrentUsers(req);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[concurrent-users] tracking error:', err?.message || err);
  }
  return next();
});

// Apply rate limiters based on endpoint
app.use('/api/auth', RateLimiters.auth);
app.use('/api/otp', RateLimiters.otp);
app.use('/api/admin', RateLimiters.admin);
app.use('/api', RateLimiters.api);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/otp', otpRouter);
app.use('/api/contests', contestsRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/search', searchRouter);
app.use('/api/stats', statsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/users', usersRouter);
app.use('/api/chat', chatRouter);
app.use('/api/matching', matchingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/review/reports', reviewReportsRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/news', newsRouter);
app.use('/api/recruitments', recruitmentsRouter);
app.use('/api/membership', membershipRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/mentors', mentorsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, _next) => {
  // Generic error handler to avoid leaking stack traces
  const status = err.status || 500;
  const message = status === 500 ? 'Unexpected error' : err.message;
  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error('[server-error]', err);
  }
  res.status(status).json({ error: message });
});

connectToDatabase()
  .then(() => {
    server = app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`API server listening on port ${port}`);

      // Start contest reminder scheduler
      startContestReminderScheduler();
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start API server', error);
    process.exit(1);
  });

// ============================================================================
// GRACEFUL SHUTDOWN HANDLERS
// ============================================================================

async function gracefulShutdown(signal) {
  console.log(`\n⚠️ ${signal} received, closing server gracefully...`);

  // Close HTTP server to stop accepting new requests
  if (server) {
    server.close(async () => {
      console.log('✅ HTTP server closed');

      try {
        // Close database connection
        await disconnectFromDatabase();

        // Close Redis connection
        await disconnectCache();

        console.log('✅ All connections closed gracefully');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error during graceful shutdown:', err);
        process.exit(1);
      }
    });
  }

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('💥 Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
