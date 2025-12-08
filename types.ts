
export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'student' | 'admin';
  balance: number;
  status?: 'active' | 'banned';
}

export interface AuditLogEntry {
  id: string;
  action: string;
  user: string;
  target: string;
  timestamp: string;
  ip: string;
  status: 'Success' | 'Failed' | 'Warning';
  details: string;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

// Prize structure for contests
export interface ContestPrize {
  rank: number;
  title: string;
  value: string;
  description?: string;
}

// Schedule/Timeline item for contests
export interface ContestScheduleItem {
  date: string;
  title: string;
  description?: string;
}

// Organizer details
export interface OrganizerDetails {
  name: string;
  school?: string;
  logo?: string;
  description?: string;
  contact?: string;
  website?: string;
}

export interface Contest {
  id: string;
  title: string;
  organizer: string;
  dateStart: string;
  deadline: string;
  status: 'OPEN' | 'FULL' | 'CLOSED';
  fee: number;
  tags: string[];
  image: string;
  description?: string;
  // New fields for complete contest info
  location?: string;
  locationType?: 'online' | 'offline' | 'hybrid';
  category?: string; // Hackathon, Design Challenge, Coding Contest, etc.
  rules?: string; // Rich text for contest rules/regulations
  schedule?: ContestScheduleItem[]; // Timeline/milestones
  prizes?: ContestPrize[]; // Prize structure
  objectives?: string; // Contest objectives
  eligibility?: string; // Eligibility requirements
  organizerDetails?: OrganizerDetails; // Extended organizer info
  maxParticipants?: number;
  registrationCount?: number;
}

export interface Course {
  id: string;
  title: string;
  instructor: string;
  price: number;
  rating: number;
  reviewsCount: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  image: string;
  description?: string;
  // Thời gian học dự kiến (số tuần hoặc số giờ)
  duration?: string;
  // Thời lượng học mỗi tuần (số giờ)
  hoursPerWeek?: number;
  // Ngày bắt đầu và kết thúc khóa học dự kiến
  startDate?: string;
  endDate?: string;
  // Thông tin liên hệ đăng ký (có thể là URL hoặc số điện thoại)
  contactInfo?: string;
  // Loại thông tin liên hệ
  contactType?: 'link' | 'phone';
}

export interface Team {
  id: string;
  name: string;
  description: string;
  rolesNeeded: string[];
  members: number;
  avatar: string;
}

// Team Finding Post
export interface TeamPost {
  id: string;
  title: string;
  description: string;
  contestId?: string;
  contestTitle?: string;
  rolesNeeded: string[];
  roleSlots?: RoleSlot[];
  currentMembers: number;
  maxMembers: number;
  requirements?: string;
  skills?: string[];
  contactMethod: 'message' | 'email' | 'both';
  status: 'open' | 'closed' | 'full';
  deadline?: string;
  invitedMembers?: Array<{
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    invitedAt?: string;
  }>;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
    email?: string;
  };
  members: Array<{
    id: string;
    name: string;
    avatar?: string;
    role?: string;
    task?: string;
    joinedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface RoleSlot {
  role: string;
  count: number;
  description?: string;
  skills?: string[];
}

export interface TeamPostCreate {
  title: string;
  description: string;
  contestId?: string;
  rolesNeeded: string[];
  roleSlots?: RoleSlot[];
  maxMembers: number;
  requirements?: string;
  skills?: string[];
  contactMethod: 'message' | 'email' | 'both';
  deadline?: string;
  expiresAt?: string;
  invitedMembers?: Array<{
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    role?: string;
  }>;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time?: string;
  createdAt?: string;
  type: 'system' | 'invite' | 'reward' | 'course' | 'contestReminder' | 'courseUpdate' | 'announcement' | 'welcome' | 'contestRegistration';
  isRead: boolean;
}

// User Registration for Contests
export interface UserRegistration {
  id: string;
  contestId: string;
  userId: string;
  registeredAt: string;
  status: 'active' | 'completed' | 'cancelled';
  contest?: {
    id: string;
    title: string;
    organizer: string;
    dateStart: string;
    deadline: string;
    status: string;
    tags: string[];
    image: string;
  };
}

// Schedule Event for Calendar
export interface ScheduleEvent {
  id: string;
  title: string;
  organizer: string;
  dateStart: string;
  deadline: string;
  status: string;
  tags: string[];
  image: string;
  type: 'contest' | 'course';
}

// Workload Warning Types
export interface WorkloadWarning {
  type: 'critical' | 'warning';
  category: 'contests' | 'courses' | 'schedule' | 'overlap';
  message: string;
  suggestion: string;
  contests?: string[];
}

export interface WorkloadAnalysis {
  workload: {
    activeContests: number;
    activeCourses: number;
    weeklyEvents: number;
    upcomingContests: Array<{
      id: string;
      title: string;
      dateStart: string;
      deadline: string;
    }>;
  };
  limits: {
    MAX_ACTIVE_CONTESTS: number;
    MAX_ACTIVE_COURSES: number;
    MAX_WEEKLY_EVENTS: number;
    WARNING_THRESHOLD_CONTESTS: number;
    WARNING_THRESHOLD_COURSES: number;
  };
  warnings: WorkloadWarning[];
  overallStatus: 'normal' | 'warning' | 'critical';
  healthScore: number;
}

// Course Enrollment
export interface CourseEnrollment {
  id: string;
  courseId: string;
  userId: string;
  enrolledAt: string;
  status: 'active' | 'completed' | 'cancelled';
  progress: number;
  completedLessons: string[];
  lastAccessedAt?: string;
  completedAt?: string;
  course?: {
    id: string;
    title: string;
    instructor: string;
    price: number;
    rating: number;
    reviewsCount: number;
    level: string;
    image: string;
    description?: string;
    lessonsCount: number;
    duration?: string;
    hoursPerWeek?: number;
    startDate?: string;
    endDate?: string;
    contactInfo?: string;
    contactType?: 'link' | 'phone';
  };
}

export type AuthStatus = 'authenticated' | 'unauthenticated' | 'loading';

// Report types for AI Report Generator
export interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
}

export interface Report {
  id: string;
  title: string;
  template: string;
  status: 'Draft' | 'Sent' | 'Ready';
  lastEdited: string;
  content: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportsResponse {
  reports: Report[];
  total: number;
  hasMore: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  tone: 'Formal' | 'Neutral' | 'Friendly';
}

// Review for contests, courses, documents
export interface Review {
  id: string;
  targetId: string;
  targetType: 'contest' | 'course' | 'document';
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  isVerified?: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}
