import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// MongoDB connection string (old database)
const MONGODB_URI = '';

// PostgreSQL connection (new database)
const POSTGRES_URI = process.env.DATABASE_URL;

// Collections to migrate
const COLLECTIONS_TO_MIGRATE = [
    'users',
    'contests',
    'courses',
    'registrations',
    'notifications',
    'team_posts',
    'reviews',
    'documents',
    'reports',
    'news',
    'recruitments',
    'memberships',
    'payments',
    'mentors',
    'feedback',
    'user_matching',
    'audit_logs'
];

function getDefaultRootCertPath() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'postgresql', 'root.crt');
}

function getSslConfig() {
    const url = POSTGRES_URI;
    const wantsVerify = /[?&]sslmode=verify-full(?:&|$)/i.test(url);

    if (wantsVerify) {
        const rootCertPath = process.env.PGSSLROOTCERT || process.env.SSL_CERT_FILE || getDefaultRootCertPath();

        if (!rootCertPath || !fs.existsSync(rootCertPath)) {
            throw new Error(`sslmode=verify-full requested but CA cert not found at: ${rootCertPath}`);
        }

        return {
            rejectUnauthorized: true,
            ca: fs.readFileSync(rootCertPath, 'utf8'),
        };
    }

    return undefined;
}

async function ensurePostgresSchema(pgPool) {
    console.log('📋 Ensuring PostgreSQL schema...');

    await pgPool.query(`
        CREATE TABLE IF NOT EXISTS documents (
            collection TEXT NOT NULL,
            id TEXT NOT NULL,
            doc JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (collection, id)
        )
    `);

    await pgPool.query(`CREATE INDEX IF NOT EXISTS documents_collection_idx ON documents (collection)`);

    try {
        await pgPool.query(`CREATE INVERTED INDEX IF NOT EXISTS documents_doc_inverted_idx ON documents (doc)`);
    } catch {
        // Best effort - not all PostgreSQL versions support inverted indexes
        console.log('⚠️  Inverted index not supported, skipping...');
    }

    console.log('✅ Schema ready');
}

function normalizeDocument(doc) {
    // Convert MongoDB ObjectId to string
    const normalized = { ...doc };

    if (normalized._id) {
        normalized._id = normalized._id.toString();
    }

    // Convert any nested ObjectIds
    for (const [key, value] of Object.entries(normalized)) {
        if (value && typeof value === 'object') {
            if (value._bsontype === 'ObjectID' || value.constructor?.name === 'ObjectId') {
                normalized[key] = value.toString();
            } else if (Array.isArray(value)) {
                normalized[key] = value.map(item => {
                    if (item && typeof item === 'object' && (item._bsontype === 'ObjectID' || item.constructor?.name === 'ObjectId')) {
                        return item.toString();
                    }
                    return item;
                });
            } else if (typeof value === 'object' && !(value instanceof Date)) {
                // Recursively normalize nested objects
                const nestedNormalized = {};
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    if (nestedValue && typeof nestedValue === 'object' && (nestedValue._bsontype === 'ObjectID' || nestedValue.constructor?.name === 'ObjectId')) {
                        nestedNormalized[nestedKey] = nestedValue.toString();
                    } else {
                        nestedNormalized[nestedKey] = nestedValue;
                    }
                }
                normalized[key] = nestedNormalized;
            }
        }
    }

    return normalized;
}

async function migrateCollection(mongoDb, pgPool, collectionName) {
    try {
        console.log(`\n📦 Migrating collection: ${collectionName}`);

        const collection = mongoDb.collection(collectionName);
        const documents = await collection.find({}).toArray();

        if (documents.length === 0) {
            console.log(`   ⚠️  Collection ${collectionName} is empty, skipping...`);
            return { total: 0, migrated: 0, skipped: 0, errors: 0 };
        }

        console.log(`   Found ${documents.length} documents`);

        let migrated = 0;
        let skipped = 0;
        let errors = 0;

        for (const doc of documents) {
            try {
                const normalized = normalizeDocument(doc);
                const id = normalized._id;

                if (!id) {
                    console.error(`   ❌ Document without _id in ${collectionName}, skipping`);
                    errors++;
                    continue;
                }

                // Check if document already exists
                const checkResult = await pgPool.query(
                    'SELECT id FROM documents WHERE collection = $1 AND id = $2',
                    [collectionName, id]
                );

                if (checkResult.rows.length > 0) {
                    skipped++;
                    continue;
                }

                // Insert document
                await pgPool.query(
                    `INSERT INTO documents (collection, id, doc, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (collection, id) DO NOTHING`,
                    [
                        collectionName,
                        id,
                        JSON.stringify(normalized),
                        normalized.createdAt || new Date(),
                        normalized.updatedAt || new Date()
                    ]
                );

                migrated++;

                if (migrated % 100 === 0) {
                    console.log(`   ⏳ Migrated ${migrated}/${documents.length}...`);
                }
            } catch (error) {
                errors++;
                console.error(`   ❌ Error migrating document ${doc._id}:`, error.message);
            }
        }

        console.log(`   ✅ Completed: ${migrated} migrated, ${skipped} skipped (already exist), ${errors} errors`);

        return {
            total: documents.length,
            migrated,
            skipped,
            errors
        };
    } catch (error) {
        console.error(`   ❌ Failed to migrate collection ${collectionName}:`, error);
        return { total: 0, migrated: 0, skipped: 0, errors: 1 };
    }
}

async function main() {
    let mongoClient;
    let pgPool;

    try {
        console.log('🚀 Starting MongoDB to PostgreSQL migration...\n');

        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB Atlas...');
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        const mongoDb = mongoClient.db();
        console.log('✅ Connected to MongoDB\n');

        // Connect to PostgreSQL
        console.log('📡 Connecting to PostgreSQL/CockroachDB...');
        const ssl = getSslConfig();
        pgPool = new Pool({
            connectionString: POSTGRES_URI,
            ssl,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 30000,
        });

        await pgPool.query('SELECT 1');
        console.log('✅ Connected to PostgreSQL\n');

        // Ensure schema
        await ensurePostgresSchema(pgPool);

        // Migrate all collections
        const results = {};

        for (const collectionName of COLLECTIONS_TO_MIGRATE) {
            const result = await migrateCollection(mongoDb, pgPool, collectionName);
            results[collectionName] = result;
        }

        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 MIGRATION SUMMARY');
        console.log('='.repeat(60));

        let totalDocs = 0;
        let totalMigrated = 0;
        let totalSkipped = 0;
        let totalErrors = 0;

        for (const [collection, stats] of Object.entries(results)) {
            if (stats.total > 0) {
                console.log(`\n${collection}:`);
                console.log(`  Total: ${stats.total}`);
                console.log(`  Migrated: ${stats.migrated}`);
                console.log(`  Skipped: ${stats.skipped}`);
                console.log(`  Errors: ${stats.errors}`);

                totalDocs += stats.total;
                totalMigrated += stats.migrated;
                totalSkipped += stats.skipped;
                totalErrors += stats.errors;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('TOTALS:');
        console.log(`  Total documents: ${totalDocs}`);
        console.log(`  Successfully migrated: ${totalMigrated}`);
        console.log(`  Skipped (already exist): ${totalSkipped}`);
        console.log(`  Errors: ${totalErrors}`);
        console.log('='.repeat(60));

        if (totalErrors === 0) {
            console.log('\n✅ Migration completed successfully!');
        } else {
            console.log(`\n⚠️  Migration completed with ${totalErrors} errors. Please review above.`);
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        // Cleanup connections
        if (mongoClient) {
            await mongoClient.close();
            console.log('\n👋 Disconnected from MongoDB');
        }
        if (pgPool) {
            await pgPool.end();
            console.log('👋 Disconnected from PostgreSQL');
        }
    }
}

// Run migration
main().catch(console.error);
