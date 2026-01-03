/**
 * Services Index
 * Central export for all API services
 */

export { default as api, tokenManager, ApiError } from './api';
export { default as userService } from './userService';
export { default as contestService } from './contestService';
export { default as courseService } from './courseService';
export { default as documentService, validateAndSanitizeUrl, sanitizeText } from './documentService';
export { default as auditLogService } from './auditLogService';
export { default as dashboardService } from './dashboardService';
export { default as settingsService } from './settingsService';
export { default as newsService } from './newsService';
export { default as communityService } from './communityService';
export { default as mentorBlogService } from './mentorBlogService';
export { default as mentorPublicService } from './mentorPublicService';
export { default as recruitmentService } from './recruitmentService';

// Re-export types
export type { UserFilters, CreateUserData, UpdateUserData, PaginatedResponse } from './userService';
export type { ContestFilters, CreateContestData, UpdateContestData } from './contestService';
export type { CourseFilters, CreateCourseData, UpdateCourseData } from './courseService';
export type { DocumentFilters, CreateDocumentData, UpdateDocumentData } from './documentService';
export type { AuditLogFilters, AuditAction } from './auditLogService';
export type { PlatformSettings } from './settingsService';
export type { DashboardStats, RevenueData, ActivityData } from './dashboardService';
export type { NewsFilters, CreateNewsData, UpdateNewsData } from './newsService';
export type { TeamPostFilters } from './communityService';
export type { MentorBlogFilters, UpdateMentorBlogData } from './mentorBlogService';
export type { MentorPublicFilters, MentorSortValue } from './mentorPublicService';
export type { RecruitmentFilters, RecruitmentStatus } from './recruitmentService';
