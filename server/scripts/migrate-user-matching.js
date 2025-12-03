import 'dotenv/config';
import { connectToDatabase, getCollection } from '../lib/db.js';

/**
 * Migration script để kích hoạt tính năng ghép đội cho user cụ thể
 * Sử dụng: node server/scripts/migrate-user-matching.js
 */

const targetEmail = 'dangthhfct31147@gmail.com';

const defaultMatchingProfile = {
    primaryRole: '',
    secondaryRoles: [],
    experienceLevel: 'beginner',
    yearsExperience: null,
    location: '',
    timeZone: 'Asia/Ho_Chi_Minh',
    languages: ['Vietnamese'],
    skills: [],
    techStack: [],
    remotePreference: 'remote',
    availability: '',
    collaborationStyle: '',
    communicationTools: [],
    openToNewTeams: true,
    openToMentor: false,
};

const defaultContestPreferences = {
    contestInterests: [],
    preferredContestFormats: ['Online'],
    preferredTeamRole: 'member',
    preferredTeamSize: '3-5',
    learningGoals: '',
    strengths: '',
    achievements: '',
    portfolioLinks: [],
};

const defaultConsents = {
    allowMatching: true,
    allowRecommendations: true,
    shareExtendedProfile: true,
};

async function migrateUserMatching() {
    try {
        await connectToDatabase();
        const usersCollection = getCollection('users');

        // Tìm user theo email
        const user = await usersCollection.findOne({ email: targetEmail });

        if (!user) {
            console.log(`❌ Không tìm thấy user với email: ${targetEmail}`);
            process.exit(1);
        }

        console.log(`📧 Tìm thấy user: ${user.name || user.email}`);
        console.log(`   - Matching Profile hiện tại: ${user.matchingProfile ? 'Có' : 'Không có'}`);
        console.log(`   - Allow Matching: ${user.consents?.allowMatching ?? 'Chưa thiết lập'}`);

        // Cập nhật user với matching profile và consents
        const updateData = {
            matchingProfile: {
                ...defaultMatchingProfile,
                ...(user.matchingProfile || {}),
            },
            contestPreferences: {
                ...defaultContestPreferences,
                ...(user.contestPreferences || {}),
            },
            consents: {
                ...defaultConsents,
                ...(user.consents || {}),
                allowMatching: true, // Đảm bảo bật tính năng ghép đội
            },
            updatedAt: new Date(),
        };

        const result = await usersCollection.updateOne(
            { email: targetEmail },
            { $set: updateData }
        );

        if (result.modifiedCount > 0) {
            console.log(`\n✅ Đã cập nhật thành công cho user: ${targetEmail}`);
            console.log('   - Đã thêm/cập nhật matchingProfile');
            console.log('   - Đã thêm/cập nhật contestPreferences');
            console.log('   - Đã bật allowMatching = true');
            console.log('\n📝 Lưu ý: User cần vào Cài đặt hồ sơ để điền thông tin chi tiết để có độ phù hợp cao hơn.');
        } else {
            console.log(`⚠️ Không có thay đổi nào được thực hiện (có thể dữ liệu đã cập nhật)`);
        }

        // Hiển thị thông tin sau khi cập nhật
        const updatedUser = await usersCollection.findOne({ email: targetEmail });
        console.log('\n📊 Thông tin sau khi cập nhật:');
        console.log(`   - Allow Matching: ${updatedUser.consents?.allowMatching}`);
        console.log(`   - Primary Role: ${updatedUser.matchingProfile?.primaryRole || '(chưa điền)'}`);
        console.log(`   - Skills: ${updatedUser.matchingProfile?.skills?.length || 0} kỹ năng`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateUserMatching();
