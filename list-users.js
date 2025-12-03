import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config(); // Load .env file

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blanc';

async function listUsers() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        console.log('Đã kết nối MongoDB\n');

        const db = client.db();
        const users = await db.collection('users')
            .find({}, { projection: { email: 1, name: 1, role: 1, createdAt: 1, _id: 0 } })
            .limit(20)
            .toArray();

        if (users.length === 0) {
            console.log('❌ Không có user nào trong database!');
        } else {
            console.log(`📧 Danh sách ${users.length} user trong database:\n`);
            users.forEach((u, i) => {
                console.log(`${i + 1}. ${u.email}`);
                console.log(`   Tên: ${u.name || 'N/A'}`);
                console.log(`   Role: ${u.role || 'N/A'}`);
                console.log(`   Ngày tạo: ${u.createdAt || 'N/A'}`);
                console.log('');
            });
        } await client.close();
    } catch (error) {
        console.error('Lỗi:', error.message);
        process.exit(1);
    }
}

listUsers();
