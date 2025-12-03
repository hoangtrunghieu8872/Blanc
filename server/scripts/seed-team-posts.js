/**
 * Seed Team Posts Migration Script
 * 
 * Tạo 2 bài đăng tìm đội cho user dangthhfct31147@gmail.com
 * 
 * Chạy: node server/scripts/seed-team-posts.js
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/contesthub';

async function seedTeamPosts() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db();
        const users = db.collection('users');
        const teamPosts = db.collection('team_posts');
        const contests = db.collection('contests');

        // Tìm user với email dangthhfct31147@gmail.com
        const targetEmail = 'dangthhfct31147@gmail.com';
        const user = await users.findOne({ email: targetEmail.toLowerCase() });

        if (!user) {
            console.error(`❌ Không tìm thấy user với email: ${targetEmail}`);
            console.log('Các user hiện có:');
            const allUsers = await users.find({}, { projection: { email: 1, name: 1 } }).limit(10).toArray();
            allUsers.forEach(u => console.log(`  - ${u.email} (${u.name})`));
            return;
        }

        console.log(`✅ Tìm thấy user: ${user.name} (${user.email})`);

        // Lấy một vài cuộc thi để gắn vào bài đăng (nếu có)
        const contestsList = await contests.find({ status: { $in: ['active', 'upcoming'] } })
            .limit(2)
            .toArray();

        const now = new Date();
        const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        // Tạo 2 bài đăng mẫu
        const teamPostsData = [
            {
                title: 'Tìm 2 Frontend Developer cho dự án Website Thương mại điện tử',
                description: `Chào mọi người! 👋

Mình đang tìm 2 bạn Frontend Developer để cùng xây dựng một website thương mại điện tử hoàn chỉnh.

**Về dự án:**
- Website bán hàng trực tuyến với đầy đủ tính năng: giỏ hàng, thanh toán, quản lý đơn hàng
- Sử dụng React + TypeScript + Tailwind CSS
- Backend đã sẵn sàng (Node.js + MongoDB)

**Yêu cầu:**
- Có kinh nghiệm với React (hooks, state management)
- Biết TypeScript là một lợi thế
- Có thể commit 10-15 giờ/tuần
- Tinh thần teamwork, giao tiếp tốt

**Lợi ích:**
- Được mentoring về kiến trúc frontend
- Có sản phẩm thực tế để đưa vào portfolio
- Networking với các developers khác

Ai quan tâm thì inbox mình nhé! 🚀`,
                contestId: contestsList[0]?._id || null,
                contestTitle: contestsList[0]?.title || null,
                rolesNeeded: ['frontend', 'designer'],
                roleSlots: {
                    frontend: { needed: 2, filled: 0 },
                    designer: { needed: 1, filled: 0 }
                },
                currentMembers: 1,
                maxMembers: 4,
                requirements: 'Có kinh nghiệm với React, biết TypeScript là lợi thế. Có thể dành 10-15 giờ/tuần.',
                skills: ['React', 'TypeScript', 'Tailwind CSS', 'JavaScript', 'HTML/CSS'],
                contactMethod: 'Nhắn tin qua hệ thống hoặc email',
                status: 'open',
                deadline: oneWeekLater.toISOString(),
                invitedMembers: null,
                createdBy: {
                    id: user._id,
                    name: user.name,
                    avatar: user.avatar || null,
                    email: user.email
                },
                members: [{
                    id: user._id,
                    name: user.name,
                    avatar: user.avatar || null,
                    role: 'Trưởng nhóm',
                    joinedAt: now.toISOString()
                }],
                createdAt: now,
                updatedAt: now,
                expiresAt: twoWeeksLater
            },
            {
                title: 'Tuyển thành viên nhóm thi Hackathon AI 2024',
                description: `🔥 **Tìm kiếm đồng đội cho Hackathon AI sắp tới!**

Mình đang lập team để tham gia cuộc thi Hackathon về AI/ML. Cần thêm các vị trí sau:

**Vị trí cần tuyển:**
1. **Backend Developer** (1 người)
   - Có kinh nghiệm với Python/Node.js
   - Biết xây dựng REST API
   
2. **AI/ML Engineer** (1 người)
   - Có kinh nghiệm với TensorFlow/PyTorch
   - Hiểu về NLP hoặc Computer Vision
   
3. **UI/UX Designer** (1 người)
   - Có portfolio design
   - Biết Figma

**Thời gian thi:** Cuối tuần này
**Hình thức:** Online

**Về mình:**
- Đang là Fullstack Developer
- Đã từng tham gia nhiều hackathon
- Có ý tưởng hay về chatbot AI

Ưu tiên các bạn có kinh nghiệm thi hackathon. Let's win together! 🏆`,
                contestId: contestsList[1]?._id || null,
                contestTitle: contestsList[1]?.title || 'Hackathon AI 2024',
                rolesNeeded: ['backend', 'data', 'designer'],
                roleSlots: {
                    backend: { needed: 1, filled: 0 },
                    data: { needed: 1, filled: 0 },
                    designer: { needed: 1, filled: 0 }
                },
                currentMembers: 1,
                maxMembers: 4,
                requirements: 'Có kinh nghiệm thi hackathon là lợi thế. Có thể tham gia full-time trong 48 giờ hackathon.',
                skills: ['Python', 'TensorFlow', 'Node.js', 'Figma', 'REST API', 'Machine Learning'],
                contactMethod: 'Email hoặc nhắn tin trực tiếp',
                status: 'open',
                deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 ngày
                invitedMembers: null,
                createdBy: {
                    id: user._id,
                    name: user.name,
                    avatar: user.avatar || null,
                    email: user.email
                },
                members: [{
                    id: user._id,
                    name: user.name,
                    avatar: user.avatar || null,
                    role: 'Trưởng nhóm',
                    joinedAt: now.toISOString()
                }],
                createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 giờ trước
                updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
                expiresAt: oneWeekLater
            }
        ];

        // Kiểm tra xem đã có bài đăng của user này chưa
        const existingPosts = await teamPosts.countDocuments({ 'createdBy.id': user._id });
        console.log(`📝 User hiện có ${existingPosts} bài đăng`);

        // Insert các bài đăng mới
        const result = await teamPosts.insertMany(teamPostsData);

        console.log(`\n✅ Đã tạo thành công ${result.insertedCount} bài đăng:`);

        for (let i = 0; i < teamPostsData.length; i++) {
            console.log(`   ${i + 1}. "${teamPostsData[i].title}"`);
            console.log(`      ID: ${result.insertedIds[i]}`);
            console.log(`      Roles: ${teamPostsData[i].rolesNeeded.join(', ')}`);
            console.log(`      Max members: ${teamPostsData[i].maxMembers}`);
            console.log('');
        }

        // Thống kê tổng
        const totalPosts = await teamPosts.countDocuments({ 'createdBy.id': user._id });
        console.log(`📊 Tổng số bài đăng của ${user.name}: ${totalPosts}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
seedTeamPosts();
