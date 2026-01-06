import serverless from 'serverless-http';
import app from '../../server/app.js';
import { connectToDatabase } from '../../server/lib/db.js';
import { validateProductionSetup } from '../../server/lib/security.js';

const baseHandler = serverless(app, { basePath: '/.netlify/functions/api' });

export async function handler(event, context) {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    if (process.env.NODE_ENV === 'production') {
      const errors = validateProductionSetup({ log: true });
      if (errors.length > 0) {
        return {
          statusCode: 500,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'Server misconfigured', details: errors }),
        };
      }
    }

    await connectToDatabase();
    return await baseHandler(event, context);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[netlify-function] Unhandled error:', err?.message || err);

    const msg = String(err?.message || '');
    const details = [];

    // Provide safe, actionable diagnostics for common deployment misconfigurations.
    if (msg.includes('DATABASE_URL is not set')) {
      details.push('DATABASE_URL is not configured');
    }
    if (msg.includes('CA cert not found') || msg.includes('sslmode=verify-')) {
      details.push('Database SSL verification requested but CA certificate is missing (set PGSSLROOTCERT_PEM/PGSSLROOTCERT_BASE64 or PGSSLROOTCERT path)');
    }

    if (details.length > 0) {
      return {
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Server misconfigured', details }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
}

