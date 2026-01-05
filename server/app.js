import 'dotenv/config';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { RateLimiters } from './lib/security.js';
import { trackConcurrentUsers } from './lib/concurrentUsers.js';
import { ipBlocklist } from './middleware/ipBlocklist.js';
import { requestSanitizer } from './middleware/requestSanitizer.js';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import contestsRouter from './routes/contests.js';
import coursesRouter from './routes/courses.js';
import documentsRouter from './routes/documents.js';
import feedbackRouter from './routes/feedback.js';
import healthRouter from './routes/health.js';
import matchingRouter from './routes/matching.js';
import mediaRouter from './routes/media.js';
import membershipRouter from './routes/membership.js';
import mentorsRouter from './routes/mentors.js';
import newsRouter from './routes/news.js';
import notificationsRouter from './routes/notifications.js';
import otpRouter from './routes/otp.js';
import paymentsRouter from './routes/payments.js';
import recruitmentsRouter from './routes/recruitments.js';
import registrationsRouter from './routes/registrations.js';
import reportsRouter from './routes/reports.js';
import reviewReportsRouter from './routes/reviewReports.js';
import reviewsRouter from './routes/reviews.js';
import searchRouter from './routes/search.js';
import statsRouter from './routes/stats.js';
import teamsRouter from './routes/teams.js';
import usersRouter from './routes/users.js';

const app = express();
app.disable('x-powered-by');

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
    // Netlify provides these at runtime; include them by default.
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
  ].filter(Boolean);

const helmetCrossOriginResourcePolicy =
  String(process.env.HELMET_CORP || 'false').toLowerCase() === 'true'
    ? { policy: 'same-site' }
    : false;

app.use(
  helmet({
    crossOriginResourcePolicy: helmetCrossOriginResourcePolicy,
  })
);
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
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '10mb';
app.use(express.json({ limit: jsonBodyLimit }));
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

app.use((err, _req, res, _next) => {
  // Generic error handler to avoid leaking stack traces
  const status = err.status || 500;
  const message = status === 500 ? 'Unexpected error' : err.message;
  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error('[server-error]', err);
  }
  res.status(status).json({ error: message });
});

export default app;

