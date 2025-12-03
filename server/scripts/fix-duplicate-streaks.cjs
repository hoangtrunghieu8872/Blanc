/**
 * Fix duplicate user streaks
 * MongoDB 8.0 requires unique indexes - remove duplicate entries
 */

const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoOptions = {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
};

async function fixDuplicateStreaks() {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'blanc';

    const client = new MongoClient(uri, mongoOptions);

    try {
        await client.connect();
        const db = client.db(dbName);
        
        // Verify connection with ping (compatible with Stable API)
        await db.command({ ping: 1 });
        console.log(`✅ Connected to MongoDB (${dbName})`);
        
        const collection = db.collection('user_streaks');

        console.log('🔍 Finding duplicate userId entries...\n');

        // Find duplicate userIds
        const duplicates = await collection.aggregate([
            {
                $group: {
                    _id: '$userId',
                    count: { $sum: 1 },
                    docs: { $push: { id: '$_id', updatedAt: '$updatedAt', currentStreak: '$currentStreak' } }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (duplicates.length === 0) {
            console.log('✅ No duplicates found!');
            return;
        }

        console.log(`⚠️ Found ${duplicates.length} userId(s) with duplicate entries:\n`);

        let totalRemoved = 0;

        for (const dup of duplicates) {
            console.log(`  userId: ${dup._id}`);
            console.log(`    Entries: ${dup.count}`);

            // Sort by updatedAt (newest first), then by currentStreak (highest first)
            const sorted = dup.docs.sort((a, b) => {
                const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
                const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
                if (dateB - dateA !== 0) return dateB - dateA;
                return (b.currentStreak || 0) - (a.currentStreak || 0);
            });

            // Keep the first one (newest/highest streak), remove the rest
            const keep = sorted[0];
            const remove = sorted.slice(1).map(d => d.id);

            console.log(`    Keeping: ${keep.id} (streak: ${keep.currentStreak})`);
            console.log(`    Removing: ${remove.length} duplicate(s)`);

            const result = await collection.deleteMany({ _id: { $in: remove } });
            totalRemoved += result.deletedCount;
        }

        console.log(`\n✅ Removed ${totalRemoved} duplicate entries`);

        // Now try to create the unique index again
        console.log('\n🔧 Creating unique index on userId...');
        try {
            await collection.createIndex(
                { userId: 1 },
                { unique: true, name: 'idx_user_streak' }
            );
            console.log('✅ Unique index created successfully!');
        } catch (err) {
            if (err.code === 85 || err.codeName === 'IndexOptionsConflict') {
                console.log('ℹ️ Index already exists');
            } else {
                throw err;
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}

fixDuplicateStreaks();
