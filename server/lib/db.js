import { MongoClient, ServerApiVersion } from 'mongodb';

let client;
let database;
let streakIndexesPromise;

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'blanc';

/**
 * MongoDB 7.0 Optimized Connection Configuration
 * Features:
 * - Connection pooling for better performance
 * - Automatic retry on network errors
 * - Compression for reduced bandwidth
 * - Server monitoring for high availability
 */
const mongoOptions = {
    // Server API version - MongoDB 7.0 compatible
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },

    // Connection Pool Settings (optimized for Atlas free tier)
    maxPoolSize: 10,           // Reduced for free tier (max 500 connections shared)
    minPoolSize: 2,            // Minimum connections maintained
    maxIdleTimeMS: 30000,      // Close idle connections after 30s
    waitQueueTimeoutMS: 30000, // Increased timeout for connection queue

    // Network & Timeout Settings
    connectTimeoutMS: 30000,   // Increased connection timeout
    socketTimeoutMS: 60000,    // Increased socket timeout

    // Retry Settings (MongoDB 7.0 improved retry logic)
    retryWrites: true,         // Retry failed writes
    retryReads: true,          // Retry failed reads

    // Compression (reduces network bandwidth)
    compressors: ['zstd', 'snappy', 'zlib'],

    // Write Concern for data safety
    w: 'majority',             // Wait for majority acknowledgment

    // Read Preference
    readPreference: 'primaryPreferred',

    // Server Monitoring
    heartbeatFrequencyMS: 30000,     // Check server health every 30s
    serverSelectionTimeoutMS: 30000, // Increased timeout for server selection

    // App identification (helps with monitoring)
    appName: 'Blanc-App',
};

export async function connectToDatabase() {
    if (database) {
        return database;
    }
    if (!uri) {
        throw new Error('MONGODB_URI is not set. Add it to your environment variables.');
    }

    client = new MongoClient(uri, mongoOptions);

    await client.connect();
    database = client.db(dbName);

    // Verify connection with a simple ping (compatible with Stable API)
    await database.command({ ping: 1 });

    // Ensure critical indexes exist (once per process)
    if (!streakIndexesPromise) {
        streakIndexesPromise = (async () => {
            const streaks = database.collection('user_streaks');
            try {
                await streaks.createIndex(
                    { userId: 1 },
                    { unique: true, name: 'idx_user_streak' }
                );
            } catch (err) {
                // Duplicate userId values prevent building a unique index; fix data then restart.
                if (err?.code === 11000) {
                    const message =
                        'Cannot create unique index user_streaks.userId because duplicates exist. Run server/scripts/fix-duplicate-streaks.cjs then restart.';
                    if (process.env.NODE_ENV === 'production') {
                        console.error(message);
                        return;
                    }
                    throw new Error(message);
                }

                if (err?.code === 85 || err?.codeName === 'IndexOptionsConflict') {
                    return;
                }

                throw err;
            }
        })();
    }
    await streakIndexesPromise;

    // Log connection success
    if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ Connected to MongoDB (${dbName})`);
    }

    return database;
}

export function getDb() {
    if (!database) {
        throw new Error('Database has not been initialized. Call connectToDatabase() first.');
    }
    return database;
}

export function getCollection(name) {
    return getDb().collection(name);
}

export function getClient() {
    if (!client) {
        throw new Error('MongoDB client not initialized. Call connectToDatabase() first.');
    }
    return client;
}

export async function disconnectFromDatabase() {
    if (client) {
        await client.close();
        client = undefined;
        database = undefined;
        console.log('📤 Disconnected from MongoDB');
    }
}
