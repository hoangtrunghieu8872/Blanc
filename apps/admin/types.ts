export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'student' | 'mentor' | 'admin' | 'super_admin';
  balance: number;
  status: 'active' | 'banned' | 'inactive' | 'deleted';
}

export interface MentorBlog {
  bannerUrl: string;
  body: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MentorBlogSummary {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  joinedAt?: string | null;
  mentorBlog?: {
    bannerUrl?: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  mentorBlogCompleted?: boolean;
}

export interface MentorBlogDetail extends MentorBlogSummary {
  mentorBlog?: MentorBlog;
  bio?: string;
}

export interface MentorPublicSummary {
  id: string;
  name: string;
  avatar?: string | null;
  bannerUrl?: string;
  joinedAt?: string | null;
  mentorBlogCompleted?: boolean;
  fields?: string[];
}

export interface MentorPublicDetail extends MentorPublicSummary {
  bio?: string;
  mentorBlog?: MentorBlog;
}

// Extended user profile with full details
export interface UserProfile extends User {
  phoneNumber?: string;
  school?: string;
  grade?: string;
  interests?: string[];
  talents?: string[];
  futureMajor?: string;
  createdAt: string;
  updatedAt: string;
  wallet?: {
    balance: number;
  };
  _count?: {
    contestRegistrations: number;
    orders: number;
  };
}

// Payload for updating user details
export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phoneNumber?: string;
  school?: string;
  grade?: string;
  role?: 'student' | 'mentor' | 'admin' | 'super_admin';
}

// Payload for updating user status
export interface UpdateStatusPayload {
  status: 'active' | 'inactive' | 'banned';
  reason?: string;
}

// Payload for deleting user
export interface DeleteUserPayload {
  reason?: string;
  hardDelete?: boolean;
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
  endDate?: string;
  deadline: string;
  status: 'OPEN' | 'FULL' | 'CLOSED';
  fee: number;
  tags: string[];
  image: string;
  description?: string;
  participants: number;
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
  // Comments/Reviews
  comments?: Comment[];
}

// Comment for courses, documents, and contests
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  rating?: number; // 1-5 stars
  createdAt: string;
  updatedAt?: string;
}

// Course section/curriculum item
export interface CourseSection {
  title: string;
  lessons: number;
  duration: string; // e.g., "45 phút"
  description?: string;
}

export interface Course {
  id: string;
  title: string;
  instructor: string;
  contact?: string; // Deprecated: use contactInfo instead
  contactInfo?: string; // Phone number or link
  contactType?: 'link' | 'phone';
  price: number;
  rating: number;
  reviewsCount: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  image: string;
  description?: string;
  // Schedule fields
  duration?: string; // e.g., "8 tuần", "20 giờ"
  hoursPerWeek?: number;
  startDate?: string;
  endDate?: string;
  // Additional fields
  benefits?: string[]; // Course benefits list
  sections?: CourseSection[]; // Course curriculum/sections
  lessonsCount?: number;
  // Comments/Reviews
  comments?: Comment[];
  // Visibility and timestamps
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Document {
  id: string;
  title: string;
  author: string;
  category: 'Tutorial' | 'Reference' | 'Guide' | 'Research';
  link: string;
  description?: string;
  thumbnail?: string; // Optional thumbnail image
  createdAt: string;
  updatedAt: string;
  downloads: number;
  isPublic: boolean;
  // Rating fields
  rating?: number;
  reviewsCount?: number;
  // Comments/Reviews
  comments?: Comment[];
}

export type NewsType = 'announcement' | 'minigame' | 'update' | 'event' | 'tip';

export interface NewsAuthor {
  id?: string | null;
  name?: string | null;
  email?: string | null;
}

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body?: string;
  tags: string[];
  coverImage?: string;
  type?: NewsType;
  highlight?: boolean;
  actionLabel?: string;
  actionLink?: string;
  status: 'draft' | 'published';
  publishAt?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  author?: NewsAuthor | null;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  rolesNeeded: string[];
  members: number;
  avatar: string;
}

export interface TeamPostCreator {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface TeamPostMember {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
  joinedAt?: string;
}

export interface TeamPost {
  id: string;
  title: string;
  description: string;
  contestId?: string | null;
  contestTitle?: string | null;
  rolesNeeded: string[];
  currentMembers: number;
  maxMembers: number;
  requirements?: string;
  contactMethod?: string;
  status: 'open' | 'closed' | 'full';
  createdBy: TeamPostCreator;
  members?: TeamPostMember[];
  invitedMembers?: TeamPostCreator[];
  expiresAt?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecruitmentRole {
  role: string;
  description?: string;
  skills?: string[];
}

export interface RecruitmentContact {
  name?: string;
  email?: string;
  phone?: string;
  link?: string;
  discord?: string;
  note?: string;
}

export interface RecruitmentPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body?: string;
  tags: string[];
  coverImage?: string;
  roles: RecruitmentRole[];
  contact?: RecruitmentContact;
  status: 'draft' | 'published';
  publishAt?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  author?: NewsAuthor | null;
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

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon: React.ElementType;
}
