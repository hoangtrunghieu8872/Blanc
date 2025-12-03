// Seed admin notifications for testing
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blanc';

async function seedNotifications() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        const db = client.db();
        const notifications = db.collection('admin_notifications');

        // Clear existing notifications
        await notifications.deleteMany({});

        const now = new Date();
        const testNotifications = [
            {
                title: 'New Contest Pending Approval',
                message: 'The contest "AI Hackathon 2025" has been submitted and requires your approval to go live.',
                type: 'warning',
                category: 'contest',
                link: '/contests',
                read: false,
                createdAt: new Date(now - 10 * 60 * 1000) // 10 minutes ago
            },
            {
                title: 'New User Registration',
                message: '5 new students have registered in the last hour.',
                type: 'info',
                category: 'user',
                link: '/users',
                read: false,
                createdAt: new Date(now - 30 * 60 * 1000) // 30 minutes ago
            },
            {
                title: 'Security Alert',
                message: 'Multiple failed login attempts detected from IP 192.168.1.100. Consider blocking this IP.',
                type: 'error',
                category: 'security',
                link: '/security',
                read: false,
                createdAt: new Date(now - 2 * 60 * 60 * 1000) // 2 hours ago
            },
            {
                title: 'Course Published Successfully',
                message: 'The course "React Advanced Patterns" has been published and is now available.',
                type: 'success',
                category: 'course',
                link: '/courses',
                read: true,
                createdAt: new Date(now - 5 * 60 * 60 * 1000) // 5 hours ago
            },
            {
                title: 'System Maintenance Scheduled',
                message: 'Platform maintenance is scheduled for tonight at 2:00 AM. Expected downtime: 30 minutes.',
                type: 'info',
                category: 'system',
                read: true,
                createdAt: new Date(now - 24 * 60 * 60 * 1000) // 1 day ago
            },
            {
                title: 'User Milestone Reached',
                message: 'Congratulations! Blanc has reached 1,000 active students!',
                type: 'success',
                category: 'system',
                read: true,
                createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000) // 3 days ago
            }
        ];

        await notifications.insertMany(testNotifications);
        console.log('Seeded', testNotifications.length, 'notifications successfully!');

    } catch (error) {
        console.error('Error seeding notifications:', error);
    } finally {
        await client.close();
    }
}

seedNotifications();
