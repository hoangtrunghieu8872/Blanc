import { Contest, User, Course, Document, AuditLogEntry, Notification } from './types';

export const MOCK_USERS: User[] = [
  { id: '1', name: 'Alex Nguyen', email: 'alex.n@university.edu', avatar: 'https://picsum.photos/seed/alex/150/150', role: 'student', balance: 500000, status: 'active' },
  { id: '2', name: 'Sarah Tran', email: 'sarah.t@university.edu', avatar: 'https://picsum.photos/seed/sarah/150/150', role: 'admin', balance: 0, status: 'active' },
  { id: '3', name: 'Mike Le', email: 'mike.l@university.edu', avatar: 'https://picsum.photos/seed/mike/150/150', role: 'student', balance: 120000, status: 'banned' },
  { id: '4', name: 'Jenny Pham', email: 'jenny.p@university.edu', avatar: 'https://picsum.photos/seed/jenny/150/150', role: 'student', balance: 850000, status: 'active' },
  { id: '5', name: 'David Vo', email: 'david.v@university.edu', avatar: 'https://picsum.photos/seed/david/150/150', role: 'student', balance: 300000, status: 'active' },
];

export const MOCK_CONTESTS: Contest[] = [
  {
    id: '101',
    title: 'Hackathon 2024: AI Innovation',
    organizer: 'Tech Club',
    dateStart: '2024-06-15',
    deadline: '2024-06-01',
    status: 'OPEN',
    fee: 100000,
    tags: ['AI', 'Python', 'Innovation'],
    image: 'https://picsum.photos/seed/hackathon/800/400',
    description: 'A 48-hour challenge to build the next generation of AI tools.',
    participants: 120
  },
  {
    id: '102',
    title: 'Code War: Algorithms',
    organizer: 'Dept of CS',
    dateStart: '2024-05-20',
    deadline: '2024-05-18',
    status: 'CLOSED',
    fee: 50000,
    tags: ['Algorithms', 'C++'],
    image: 'https://picsum.photos/seed/algo/800/400',
    description: 'Test your algorithmic skills against the best.',
    participants: 350
  },
  {
    id: '103',
    title: 'Web Design Sprint',
    organizer: 'Design Faculty',
    dateStart: '2024-07-01',
    deadline: '2024-06-25',
    status: 'OPEN',
    fee: 150000,
    tags: ['UI/UX', 'Figma', 'React'],
    image: 'https://picsum.photos/seed/design/800/400',
    description: 'Create the most beautiful landing page.',
    participants: 45
  },
];

export const MOCK_COURSES: Course[] = [
  {
    id: '201',
    title: 'React Mastery',
    instructor: 'Dr. Smith',
    contact: '0912345678',
    price: 500000,
    rating: 4.8,
    reviewsCount: 120,
    level: 'Intermediate',
    image: 'https://picsum.photos/seed/react/400/300',
    description: 'Deep dive into Hooks, Context API, and Performance Optimization.'
  },
  {
    id: '202',
    title: 'Python for Data Science',
    instructor: 'Prof. Johnson',
    contact: 'https://facebook.com/prof.johnson',
    price: 600000,
    rating: 4.9,
    reviewsCount: 300,
    level: 'Advanced',
    image: 'https://picsum.photos/seed/python/400/300',
    description: 'Master Pandas, NumPy, and Machine Learning concepts.'
  },
  {
    id: '203',
    title: 'JavaScript Fundamentals',
    instructor: 'Jane Doe',
    contact: '0987654321',
    price: 350000,
    rating: 4.7,
    reviewsCount: 250,
    level: 'Beginner',
    image: 'https://picsum.photos/seed/javascript/400/300',
    description: 'Complete JavaScript course from zero to hero.'
  },
  {
    id: '204',
    title: 'Node.js Backend Development',
    instructor: 'Mike Chen',
    contact: 'https://linkedin.com/in/mikechen',
    price: 550000,
    rating: 4.6,
    reviewsCount: 180,
    level: 'Intermediate',
    image: 'https://picsum.photos/seed/nodejs/400/300',
    description: 'Build scalable backend applications with Node.js and Express.'
  },
  {
    id: '205',
    title: 'Machine Learning Basics',
    instructor: 'Dr. Sarah Lee',
    contact: '0909123456',
    price: 750000,
    rating: 4.9,
    reviewsCount: 420,
    level: 'Advanced',
    image: 'https://picsum.photos/seed/ml/400/300',
    description: 'Introduction to Machine Learning algorithms and applications.'
  },
  {
    id: '206',
    title: 'CSS & Tailwind Mastery',
    instructor: 'Emily Wang',
    price: 400000,
    rating: 4.5,
    reviewsCount: 95,
    level: 'Beginner',
    image: 'https://picsum.photos/seed/css/400/300',
    description: 'Modern CSS techniques and Tailwind CSS framework.'
  },
  {
    id: '207',
    title: 'TypeScript Advanced',
    instructor: 'Prof. Johnson',
    contact: 'https://twitter.com/profjohnson',
    price: 650000,
    rating: 4.8,
    reviewsCount: 210,
    level: 'Advanced',
    image: 'https://picsum.photos/seed/typescript/400/300',
    description: 'Advanced TypeScript patterns and best practices.'
  },
  {
    id: '208',
    title: 'Database Design',
    instructor: 'David Kim',
    contact: '0918765432',
    price: 480000,
    rating: 4.4,
    reviewsCount: 150,
    level: 'Intermediate',
    image: 'https://picsum.photos/seed/database/400/300',
    description: 'Learn SQL, NoSQL, and database optimization techniques.'
  },
];

export const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'doc_001',
    title: 'React Best Practices Guide',
    author: 'Dr. Smith',
    category: 'Guide',
    link: 'https://docs.example.com/react-best-practices',
    description: 'Comprehensive guide on React development best practices and patterns.',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-05-20T14:30:00Z',
    downloads: 1250,
    isPublic: true
  },
  {
    id: 'doc_002',
    title: 'TypeScript Handbook',
    author: 'Prof. Johnson',
    category: 'Reference',
    link: 'https://docs.example.com/typescript-handbook',
    description: 'Official TypeScript reference documentation for developers.',
    createdAt: '2024-02-10T08:00:00Z',
    updatedAt: '2024-05-18T09:15:00Z',
    downloads: 890,
    isPublic: true
  },
  {
    id: 'doc_003',
    title: 'Advanced Algorithms Tutorial',
    author: 'Dr. Lee',
    category: 'Tutorial',
    link: 'https://docs.example.com/algorithms-tutorial',
    description: 'Step-by-step tutorial on advanced algorithmic concepts.',
    createdAt: '2024-03-05T11:30:00Z',
    updatedAt: '2024-05-15T16:45:00Z',
    downloads: 567,
    isPublic: false
  }
];

export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log_001',
    action: 'LOGIN_ATTEMPT',
    user: 'mike.l@university.edu',
    target: 'System',
    timestamp: '2024-05-25T08:30:00Z',
    ip: '192.168.1.45',
    status: 'Failed',
    details: 'Invalid password attempt limit reached.'
  },
  {
    id: 'log_002',
    action: 'CONTEST_CREATE',
    user: 'sarah.t@university.edu',
    target: 'Contest #104',
    timestamp: '2024-05-25T09:15:00Z',
    ip: '10.0.0.12',
    status: 'Success',
    details: 'Created new contest "Mobile App Dev".'
  },
  {
    id: 'log_003',
    action: 'USER_BAN',
    user: 'sarah.t@university.edu',
    target: 'User #3 (Mike Le)',
    timestamp: '2024-05-25T09:45:00Z',
    ip: '10.0.0.12',
    status: 'Warning',
    details: 'User banned for suspicious activity.'
  },
  {
    id: 'log_004',
    action: 'COURSE_UPDATE',
    user: 'Dr. Smith',
    target: 'Course #201',
    timestamp: '2024-05-25T10:00:00Z',
    ip: '172.16.0.5',
    status: 'Success',
    details: 'Updated syllabus content.'
  },
  {
    id: 'log_005',
    action: 'LOGIN_SUCCESS',
    user: 'alex.n@university.edu',
    target: 'System',
    timestamp: '2024-05-25T10:05:00Z',
    ip: '192.168.1.101',
    status: 'Success',
    details: 'Student login via Web.'
  },
  {
    id: 'log_006',
    action: 'SETTINGS_CHANGE',
    user: 'sarah.t@university.edu',
    target: 'Global Settings',
    timestamp: '2024-05-25T11:20:00Z',
    ip: '10.0.0.12',
    status: 'Success',
    details: 'Enabled Two-Factor Authentication enforcement.'
  },
  {
    id: 'log_007',
    action: 'API_KEY_ACCESS',
    user: 'Unknown',
    target: 'API Endpoint',
    timestamp: '2024-05-25T12:00:00Z',
    ip: '45.33.22.11',
    status: 'Failed',
    details: 'Unauthorized access attempt using expired token.'
  }
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    title: 'New Contest Approval',
    message: 'The "AI Hackathon 2024" requires your approval to go live.',
    type: 'warning',
    timestamp: '10 min ago',
    read: false
  },
  {
    id: 'n2',
    title: 'System Update',
    message: 'Platform maintenance scheduled for tonight at 2 AM.',
    type: 'info',
    timestamp: '1 hour ago',
    read: false
  },
  {
    id: 'n3',
    title: 'High Traffic Alert',
    message: 'Server load reached 85% capacity due to Hackathon registration.',
    type: 'error',
    timestamp: '2 hours ago',
    read: true
  },
  {
    id: 'n4',
    title: 'New User Milestone',
    message: 'We reached 2,500 active students on the platform!',
    type: 'success',
    timestamp: '5 hours ago',
    read: true
  },
  {
    id: 'n5',
    title: 'Course Review',
    message: 'Dr. Smith published a new course that needs review.',
    type: 'info',
    timestamp: '1 day ago',
    read: true
  }
];