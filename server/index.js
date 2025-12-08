import 'dotenv/config';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectToDatabase } from './lib/db.js';
import { startContestReminderScheduler } from './lib/scheduler.js';
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

const app = express();
const port = process.env.PORT || 4000;

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

const corsOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5173'];

// Add default production origins if not already included
const defaultProductionOrigins = [
  'https://contesthub.homelabo.work',
  'https://admin.contesthub.homelabo.work',
  'https://contesthub-4-admin.vercel.app',
  'https://contesthub-4.vercel.app'
];

// Merge origins, avoiding duplicates
const allOrigins = [...new Set([...corsOrigins, ...defaultProductionOrigins])];

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: allOrigins,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

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
    app.listen(port, () => {
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

