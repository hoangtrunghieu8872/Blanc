import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectToDatabase, getCollection } from '../lib/db.js';

const contests = [
  {
    code: 'CH-UIUX-2024',
    title: 'Cuoc thi Thiet ke UI/UX Sang tao 2024',
    organizer: 'TechGen Z',
    dateStart: '2024-10-20T00:00:00.000Z',
    deadline: '2024-11-20T00:00:00.000Z',
    status: 'OPEN',
    fee: 0,
    tags: ['UI/UX', 'Design', 'Creative'],
    image: 'https://picsum.photos/seed/c1/600/400',
    description: 'Thach thuc cac nha thiet ke tre voi chu de sang tao va trai nghiem nguoi dung.',
  },
  {
    code: 'CH-HACK-2024',
    title: 'Hackathon Sinh vien Toan quoc 2024',
    organizer: 'Blanc',
    dateStart: '2024-09-10T00:00:00.000Z',
    deadline: '2024-10-01T00:00:00.000Z',
    status: 'FULL',
    fee: 0,
    tags: ['Coding', 'Startup', 'Innovation'],
    image: 'https://picsum.photos/seed/c2/600/400',
    description: 'Cuoc thi lap trinh hackathon danh cho sinh vien dam me cong nghe va khoi nghiep.',
  },
  {
    code: 'CH-MARKETING-2024',
    title: 'Marketing Challenge 2024',
    organizer: 'BrandLab',
    dateStart: '2024-08-15T00:00:00.000Z',
    deadline: '2024-09-15T00:00:00.000Z',
    status: 'CLOSED',
    fee: 200000,
    tags: ['Marketing', 'Content', 'Social'],
    image: 'https://picsum.photos/seed/c3/600/400',
    description: 'Xay dung chien dich marketing so va noi dung thu hut.',
  },
  {
    code: 'CH-DATA-2024',
    title: 'Data Science Cup 2024',
    organizer: 'DataLab',
    dateStart: '2024-12-01T00:00:00.000Z',
    deadline: '2025-01-10T00:00:00.000Z',
    status: 'OPEN',
    fee: 150000,
    tags: ['Data', 'AI', 'ML'],
    image: 'https://picsum.photos/seed/c4/600/400',
    description: 'Giai cuoc thi danh cho cac ban yeu thich phan tich du lieu va machine learning.',
  },
  {
    code: 'CH-IOT-2025',
    title: 'IoT Innovation 2025',
    organizer: 'MakerSpace',
    dateStart: '2025-02-01T00:00:00.000Z',
    deadline: '2025-03-01T00:00:00.000Z',
    status: 'OPEN',
    fee: 100000,
    tags: ['IoT', 'Hardware'],
    image: 'https://picsum.photos/seed/c5/600/400',
    description: 'Sang tao giai phap IoT giai quyet bai toan thuc te.',
  },
  {
    code: 'CH-ANIMATION-2025',
    title: '2D/3D Animation Challenge 2025',
    organizer: 'CreativeHub',
    dateStart: '2025-03-10T00:00:00.000Z',
    deadline: '2025-04-05T00:00:00.000Z',
    status: 'OPEN',
    fee: 0,
    tags: ['Animation', 'Design'],
    image: 'https://picsum.photos/seed/c6/600/400',
    description: 'Thi thiet ke va lam chuyen dong 2D/3D danh cho nguoi moi va chuyen nghiep.',
  },
];

const courses = [
  {
    code: 'CR-REACT-01',
    title: 'ReactJS Ultimate Guide',
    instructor: 'Nguyen Van A',
    price: 499000,
    rating: 4.8,
    reviewsCount: 120,
    level: 'Beginner',
    image: 'https://picsum.photos/seed/course1/400/250',
  },
  {
    code: 'CR-DATA-01',
    title: 'Data Analysis with Python',
    instructor: 'Tran Thi B',
    price: 699000,
    rating: 4.7,
    reviewsCount: 90,
    level: 'Intermediate',
    image: 'https://picsum.photos/seed/course2/400/250',
  },
  {
    code: 'CR-UIUX-01',
    title: 'UI/UX Design Foundations',
    instructor: 'Le Hoang C',
    price: 399000,
    rating: 4.9,
    reviewsCount: 150,
    level: 'Beginner',
    image: 'https://picsum.photos/seed/course3/400/250',
  },
  {
    code: 'CR-AI-01',
    title: 'Applied Generative AI',
    instructor: 'Pham D',
    price: 899000,
    rating: 4.6,
    reviewsCount: 60,
    level: 'Advanced',
    image: 'https://picsum.photos/seed/course4/400/250',
  },
];

const users = [
  {
    email: 'admin@blanc.dev',
    name: 'Admin Blanc',
    role: 'admin',
    password: bcrypt.hashSync('Admin123!', 12),
    avatar: '',
    balance: 0,
    matchingProfile: {
      primaryRole: 'Product Manager',
      secondaryRoles: ['Business Analyst', 'Fullstack Dev'],
      experienceLevel: 'advanced',
      yearsExperience: 5,
      location: 'Hà Nội',
      timeZone: 'Asia/Ho_Chi_Minh',
      languages: ['Vietnamese', 'English'],
      skills: ['Leadership', 'Project Management', 'Agile/Scrum', 'React', 'Node.js'],
      techStack: ['React', 'Node.js', 'MongoDB', 'AWS', 'Docker'],
      remotePreference: 'hybrid',
      availability: 'Có thể làm việc 20-30h/tuần',
      collaborationStyle: 'Thích làm việc nhóm, giao tiếp thường xuyên',
      communicationTools: ['Discord', 'Slack', 'Google Meet'],
      openToNewTeams: true,
      openToMentor: true,
    },
    contestPreferences: {
      contestInterests: ['Hackathon', 'Startup', 'Innovation'],
      preferredContestFormats: ['Online', 'Hybrid'],
      preferredTeamRole: 'leader',
      preferredTeamSize: '4-6',
      learningGoals: 'Mentoring các bạn trẻ, xây dựng sản phẩm có impact',
      strengths: 'Quản lý dự án, định hướng sản phẩm, kết nối team',
      achievements: 'Top 3 Hackathon 2023, Founder startup EdTech',
      portfolioLinks: ['https://github.com/admin-blanc'],
    },
    consents: {
      allowMatching: true,
      allowRecommendations: true,
      shareExtendedProfile: true,
    },
  },
  {
    email: 'student@blanc.dev',
    name: 'Student User',
    role: 'student',
    password: bcrypt.hashSync('Student123!', 12),
    avatar: '',
    balance: 500000,
    matchingProfile: {
      primaryRole: 'Frontend Dev',
      secondaryRoles: ['UI/UX Designer'],
      experienceLevel: 'intermediate',
      yearsExperience: 2,
      location: 'TP.HCM',
      timeZone: 'Asia/Ho_Chi_Minh',
      languages: ['Vietnamese', 'English'],
      skills: ['React', 'TypeScript', 'Tailwind CSS', 'Figma'],
      techStack: ['React', 'Next.js', 'TypeScript', 'Tailwind'],
      remotePreference: 'remote',
      availability: 'Fulltime trong các cuộc thi',
      collaborationStyle: 'Linh hoạt, có thể làm độc lập hoặc nhóm',
      communicationTools: ['Discord', 'Zalo'],
      openToNewTeams: true,
      openToMentor: false,
    },
    contestPreferences: {
      contestInterests: ['UI/UX', 'Web Development', 'Hackathon'],
      preferredContestFormats: ['Online'],
      preferredTeamRole: 'member',
      preferredTeamSize: '3-5',
      learningGoals: 'Nâng cao kỹ năng React và design system',
      strengths: 'Làm UI đẹp, responsive, animation',
      achievements: 'Giải khuyến khích UI/UX Contest 2023',
      portfolioLinks: ['https://github.com/student-user'],
    },
    consents: {
      allowMatching: true,
      allowRecommendations: true,
      shareExtendedProfile: true,
    },
  },
  {
    email: 'dev1@blanc.dev',
    name: 'Trần Minh Đức',
    role: 'student',
    password: bcrypt.hashSync('Dev123!', 12),
    avatar: '',
    balance: 200000,
    matchingProfile: {
      primaryRole: 'Backend Dev',
      secondaryRoles: ['DevOps', 'Data Analyst'],
      experienceLevel: 'intermediate',
      yearsExperience: 3,
      location: 'Đà Nẵng',
      timeZone: 'Asia/Ho_Chi_Minh',
      languages: ['Vietnamese', 'English'],
      skills: ['Node.js', 'Python', 'PostgreSQL', 'Docker', 'AWS'],
      techStack: ['Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker'],
      remotePreference: 'remote',
      availability: 'Part-time 15-20h/tuần',
      collaborationStyle: 'Thích code review và pair programming',
      communicationTools: ['Discord', 'Slack'],
      openToNewTeams: true,
      openToMentor: false,
    },
    contestPreferences: {
      contestInterests: ['Data', 'AI', 'Backend'],
      preferredContestFormats: ['Online', 'Hybrid'],
      preferredTeamRole: 'member',
      preferredTeamSize: '4-6',
      learningGoals: 'Học thêm về microservices và cloud architecture',
      strengths: 'API design, database optimization, deployment',
      achievements: 'Contributor open source projects',
      portfolioLinks: ['https://github.com/tranminhduc'],
    },
    consents: {
      allowMatching: true,
      allowRecommendations: true,
      shareExtendedProfile: true,
    },
  },
  {
    email: 'dev2@blanc.dev',
    name: 'Nguyễn Thị Lan',
    role: 'student',
    password: bcrypt.hashSync('Dev123!', 12),
    avatar: '',
    balance: 300000,
    matchingProfile: {
      primaryRole: 'Fullstack Dev',
      secondaryRoles: ['Mobile Dev'],
      experienceLevel: 'advanced',
      yearsExperience: 4,
      location: 'Hà Nội',
      timeZone: 'Asia/Ho_Chi_Minh',
      languages: ['Vietnamese', 'English', 'Japanese'],
      skills: ['React', 'React Native', 'Node.js', 'TypeScript', 'MongoDB'],
      techStack: ['React', 'React Native', 'Node.js', 'MongoDB', 'Firebase'],
      remotePreference: 'hybrid',
      availability: 'Fulltime cho các cuộc thi lớn',
      collaborationStyle: 'Proactive, thích lead technical decisions',
      communicationTools: ['Discord', 'Slack', 'Google Meet'],
      openToNewTeams: true,
      openToMentor: true,
    },
    contestPreferences: {
      contestInterests: ['Hackathon', 'Mobile', 'Startup'],
      preferredContestFormats: ['Offline', 'Hybrid'],
      preferredTeamRole: 'leader',
      preferredTeamSize: '4-5',
      learningGoals: 'Xây dựng sản phẩm từ 0 đến launch',
      strengths: 'Full-stack development, mobile app, rapid prototyping',
      achievements: 'Top 5 Hackathon 2023, Published 2 apps on App Store',
      portfolioLinks: ['https://github.com/nguyenthilan', 'https://linkedin.com/in/nguyenthilan'],
    },
    consents: {
      allowMatching: true,
      allowRecommendations: true,
      shareExtendedProfile: true,
    },
  },
  {
    email: 'designer@blanc.dev',
    name: 'Lê Hoàng Nam',
    role: 'student',
    password: bcrypt.hashSync('Designer123!', 12),
    avatar: '',
    balance: 150000,
    matchingProfile: {
      primaryRole: 'UI/UX Designer',
      secondaryRoles: ['Graphic Designer', 'Product Manager'],
      experienceLevel: 'intermediate',
      yearsExperience: 2,
      location: 'TP.HCM',
      timeZone: 'Asia/Ho_Chi_Minh',
      languages: ['Vietnamese', 'English'],
      skills: ['Figma', 'Adobe XD', 'Photoshop', 'Illustrator', 'User Research'],
      techStack: ['Figma', 'Framer', 'Webflow'],
      remotePreference: 'remote',
      availability: 'Part-time 10-15h/tuần',
      collaborationStyle: 'Creative, thích brainstorm và feedback',
      communicationTools: ['Discord', 'Figma Comments'],
      openToNewTeams: true,
      openToMentor: false,
    },
    contestPreferences: {
      contestInterests: ['UI/UX', 'Design', 'Creative'],
      preferredContestFormats: ['Online'],
      preferredTeamRole: 'member',
      preferredTeamSize: '3-4',
      learningGoals: 'Nâng cao UX research và design system',
      strengths: 'Visual design, prototyping, user testing',
      achievements: 'Giải nhì UI/UX Contest 2023',
      portfolioLinks: ['https://behance.net/lehoangnam', 'https://dribbble.com/lehoangnam'],
    },
    consents: {
      allowMatching: true,
      allowRecommendations: true,
      shareExtendedProfile: true,
    },
  },
  {
    email: 'test@example.com',
    name: 'Test User',
    role: 'student',
    password: bcrypt.hashSync('Test123!', 12),
    avatar: '',
    balance: 100000,
    matchingProfile: {
      primaryRole: 'Data Analyst',
      secondaryRoles: ['Backend Dev'],
      experienceLevel: 'beginner',
      yearsExperience: 1,
      location: 'Hà Nội',
      timeZone: 'Asia/Ho_Chi_Minh',
      languages: ['Vietnamese'],
      skills: ['Python', 'SQL', 'Excel', 'Power BI'],
      techStack: ['Python', 'Pandas', 'PostgreSQL'],
      remotePreference: 'remote',
      availability: 'Part-time 10h/tuần',
      collaborationStyle: 'Học hỏi từ người có kinh nghiệm',
      communicationTools: ['Zalo', 'Discord'],
      openToNewTeams: true,
      openToMentor: false,
    },
    contestPreferences: {
      contestInterests: ['Data', 'AI'],
      preferredContestFormats: ['Online'],
      preferredTeamRole: 'member',
      preferredTeamSize: '3-5',
      learningGoals: 'Học data science và machine learning',
      strengths: 'Phân tích dữ liệu, visualization',
      achievements: '',
      portfolioLinks: [],
    },
    consents: {
      allowMatching: true,
      allowRecommendations: true,
      shareExtendedProfile: true,
    },
  },
];

// Team posts will be created after users are seeded
const teamPostsData = [
  {
    title: 'Tìm Designer cho Hackathon 2024',
    description: 'Chào mọi người! Team mình đang cần tìm 1 bạn UI/UX Designer có kinh nghiệm Figma để tham gia Hackathon Sinh viên 2024. Team hiện có 2 Dev fullstack và 1 BA. Mình đã có ý tưởng về app quản lý tài chính cá nhân cho sinh viên. Ưu tiên bạn có portfolio và đã từng tham gia cuộc thi.',
    contestCode: 'CH-HACK-2024',
    rolesNeeded: ['UI/UX Designer', 'Graphic Designer'],
    maxMembers: 5,
    contactMethod: 'both',
  },
  {
    title: 'Team AI/ML tìm thêm thành viên',
    description: 'Team mình đang build solution cho Data Science Cup 2024, cần tìm thêm 2 bạn: 1 Data Analyst giỏi visualization và 1 Backend Dev biết deploy ML models. Đề bài năm nay về dự đoán xu hướng thị trường, team đã có 2 ML engineers.',
    contestCode: 'CH-DATA-2024',
    rolesNeeded: ['Data Analyst', 'Backend Dev', 'DevOps'],
    maxMembers: 6,
    contactMethod: 'message',
  },
  {
    title: 'Cần Frontend Dev cho dự án IoT',
    description: 'Xin chào! Mình đang tìm 1 Frontend Dev (React/Vue) để làm dashboard cho dự án IoT smart home. Team có 2 hardware engineers và 1 backend. Dự án hướng tới IoT Innovation 2025. Cần bạn có thể làm responsive UI và realtime data display.',
    contestCode: 'CH-IOT-2025',
    rolesNeeded: ['Frontend Dev', 'Mobile Dev'],
    maxMembers: 5,
    contactMethod: 'email',
  },
  {
    title: 'Tìm team Animation Challenge',
    description: 'Mình là motion designer 2 năm kinh nghiệm, đang tìm team cho Animation Challenge 2025. Cần tìm: 1 bạn biết 3D modeling (Blender/Maya), 1 bạn làm sound design. Mình sẽ lo phần 2D animation và compositing. Có thể làm remote, họp online hàng tuần.',
    contestCode: 'CH-ANIMATION-2025',
    rolesNeeded: ['Graphic Designer', 'Content Writer'],
    maxMembers: 4,
    contactMethod: 'both',
  },
  {
    title: 'Marketing Team - Cần BA và Content',
    description: 'Team Marketing Challenge đang thiếu 2 vị trí quan trọng: Business Analyst để research thị trường và Content Writer để viết copy. Team đã có 2 bạn làm social media và 1 designer. Deadline gấp, cần bạn có thể commit full-time trong 1 tháng tới!',
    contestCode: 'CH-MARKETING-2024',
    rolesNeeded: ['Business Analyst', 'Content Writer', 'Marketing'],
    maxMembers: 6,
    contactMethod: 'message',
  },
  {
    title: 'Startup Team tìm Fullstack Dev',
    description: 'Chúng mình là nhóm 3 bạn đang ấp ủ startup về EdTech, muốn tham gia Hackathon để validate idea. Cần tìm 2 Fullstack Dev (Node.js + React) để build MVP. Có mentor hỗ trợ và cơ hội nhận funding nếu vào top. Ưu tiên bạn có passion về giáo dục!',
    contestCode: 'CH-HACK-2024',
    rolesNeeded: ['Fullstack Dev', 'Backend Dev', 'Frontend Dev'],
    maxMembers: 5,
    contactMethod: 'both',
  },
  {
    title: 'Designer Team cho UI/UX Contest',
    description: 'Team design cần thêm 1 UX Researcher và 1 Graphic Designer cho cuộc thi UI/UX 2024. Chủ đề năm nay về accessibility và inclusive design. Team có 2 UI designers đã có giải các cuộc thi trước. Làm việc bằng Figma, họp 3 buổi/tuần.',
    contestCode: 'CH-UIUX-2024',
    rolesNeeded: ['UI/UX Designer', 'Graphic Designer', 'Product Manager'],
    maxMembers: 5,
    contactMethod: 'email',
  },
  {
    title: 'Tìm QA/Tester và DevOps cho team',
    description: 'Team product đang cần urgent 1 QA Tester để test app trước deadline và 1 DevOps để setup CI/CD pipeline. App đã code xong 80%, cần đảm bảo quality trước khi submit. Có thể trả phí hỗ trợ cho bạn nào tham gia!',
    contestCode: 'CH-DATA-2024',
    rolesNeeded: ['QA/Tester', 'DevOps'],
    maxMembers: 7,
    contactMethod: 'both',
  },
];

async function seedContests() {
  const collection = getCollection('contests');
  await collection.createIndex({ code: 1 }, { unique: true });

  const operations = contests.map((contest) =>
    collection.updateOne(
      { code: contest.code },
      {
        $set: {
          ...contest,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )
  );

  await Promise.all(operations);
}

async function seedCourses() {
  const collection = getCollection('courses');
  await collection.createIndex({ code: 1 }, { unique: true });

  const operations = courses.map((course) =>
    collection.updateOne(
      { code: course.code },
      {
        $set: {
          ...course,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )
  );

  await Promise.all(operations);
}

async function seedUsers() {
  const collection = getCollection('users');
  await collection.createIndex({ email: 1 }, { unique: true });

  const operations = users.map((user) =>
    collection.updateOne(
      { email: user.email },
      {
        $set: {
          ...user,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )
  );

  await Promise.all(operations);
}

async function seedTeamPosts() {
  const teamPostsCollection = getCollection('team_posts');
  const usersCollection = getCollection('users');
  const contestsCollection = getCollection('contests');

  // Create indexes
  await teamPostsCollection.createIndex({ status: 1, createdAt: -1 });
  await teamPostsCollection.createIndex({ createdBy: 1 });
  await teamPostsCollection.createIndex({ contestId: 1 });

  // Get users for creators (exclude admin)
  const allUsers = await usersCollection.find({ role: 'student' }).toArray();
  if (allUsers.length === 0) {
    console.log('⚠️ No student users found, skipping team posts seed');
    return;
  }

  // Get contests for linking
  const allContests = await contestsCollection.find({}).toArray();
  const contestMap = new Map(allContests.map(c => [c.code, c]));

  // Clear existing team posts to avoid duplicates
  await teamPostsCollection.deleteMany({});

  const teamPosts = teamPostsData.map((post, index) => {
    // Rotate through users as creators
    const creator = allUsers[index % allUsers.length];
    const contest = contestMap.get(post.contestCode);

    // Add some random members (other users)
    const otherUsers = allUsers.filter(u => u._id.toString() !== creator._id.toString());
    const memberCount = Math.min(Math.floor(Math.random() * 2) + 1, otherUsers.length);
    const members = [
      {
        id: creator._id.toString(),
        name: creator.name,
        avatar: creator.avatar || '',
        role: 'Leader',
        joinedAt: new Date().toISOString(),
      },
      ...otherUsers.slice(0, memberCount).map((u, i) => ({
        id: u._id.toString(),
        name: u.name,
        avatar: u.avatar || '',
        role: post.rolesNeeded[i] || 'Member',
        joinedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      })),
    ];

    return {
      title: post.title,
      description: post.description,
      contestId: contest ? contest._id.toString() : null,
      contestTitle: contest ? contest.title : null,
      rolesNeeded: post.rolesNeeded,
      currentMembers: members.length,
      maxMembers: post.maxMembers,
      requirements: '',
      contactMethod: post.contactMethod,
      status: 'open',
      createdBy: {
        id: creator._id.toString(),
        name: creator.name,
        avatar: creator.avatar || ''
      },
      members: members,
      createdAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Random within last 2 weeks
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    };
  });

  await teamPostsCollection.insertMany(teamPosts);
  console.log(`✅ Created ${teamPosts.length} team posts`);
}

async function setupLoginAttemptsCollection() {
  const loginAttempts = getCollection('login_attempts');

  // Create indexes for efficient queries
  await loginAttempts.createIndex({ email: 1, createdAt: -1 });
  await loginAttempts.createIndex({ ip: 1, createdAt: -1 });
  await loginAttempts.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // TTL: 7 days

  console.log('✅ Created login_attempts collection with indexes');
}

async function main() {
  try {
    await connectToDatabase();
    await seedUsers();
    await seedContests();
    await seedCourses();
    await seedTeamPosts();
    await setupLoginAttemptsCollection();
    // eslint-disable-next-line no-console
    console.log('✅ Seed data has been migrated to MongoDB.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  }
}

main();
