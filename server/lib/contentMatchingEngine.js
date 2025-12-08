/**
 * ============================================================================
 * CONTENT MATCHING ENGINE
 * ============================================================================
 * 
 * Matching algorithm for recommending contests and courses based on user profile.
 * 
 * Features:
 * - Profile-based scoring for contests and courses
 * - Uses user's skills, interests, experience level
 * - Simple and fast algorithm for homepage recommendations
 * - 1-hour caching for performance
 * 
 * Scoring factors for CONTESTS:
 * - Tags matching user's contestInterests (40%)
 * - Category matching user's skills/roles (30%)
 * - Experience level appropriateness (20%)
 * - Contest format preference (10%)
 * 
 * Scoring factors for COURSES:
 * - Course level matching user's experience (35%)
 * - Skills/tech stack overlap (35%)
 * - Contest interests alignment (20%)
 * - Random diversity factor (10%)
 */

import { getCollection } from './db.js';
import { ObjectId } from 'mongodb';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const contentRecommendationCache = new Map();

// Experience level mapping for courses
const EXPERIENCE_TO_COURSE_LEVEL = {
    'beginner': ['Beginner'],
    'intermediate': ['Beginner', 'Intermediate'],
    'advanced': ['Intermediate', 'Advanced'],
    'expert': ['Advanced']
};

// Contest category to skill/role mapping
const CONTEST_CATEGORY_SKILLS = {
    'Hackathon': ['React', 'Node.js', 'Python', 'JavaScript', 'TypeScript', 'Frontend Dev', 'Backend Dev', 'Fullstack Dev'],
    'Coding': ['JavaScript', 'Python', 'Java', 'C++', 'Algorithm', 'Data Structure', 'Backend Dev'],
    'AI': ['Python', 'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Data Scientist', 'ML Engineer'],
    'Data': ['Python', 'SQL', 'Data Analysis', 'Machine Learning', 'Data Analyst', 'Data Scientist'],
    'Design': ['Figma', 'Adobe XD', 'Photoshop', 'UI/UX Designer', 'Graphic Designer', 'UI Design'],
    'IoT': ['Arduino', 'Raspberry Pi', 'Python', 'C++', 'Embedded', 'Hardware'],
    'Animation': ['Adobe After Effects', 'Blender', '3D', '2D', 'Video Editor', 'Graphic Designer'],
    'Mobile': ['React Native', 'Flutter', 'iOS', 'Android', 'Mobile Dev'],
    'Web': ['React', 'Vue.js', 'Angular', 'Next.js', 'Frontend Dev', 'Fullstack Dev'],
    'Startup': ['Business Analysis', 'Product Management', 'Marketing', 'Pitching', 'Business Analyst']
};

// Course title keywords to skill mapping
const COURSE_KEYWORDS_SKILLS = {
    'react': ['React', 'JavaScript', 'Frontend Dev', 'Web Development'],
    'python': ['Python', 'Backend Dev', 'Data Science'],
    'ai': ['Machine Learning', 'Deep Learning', 'Python', 'AI', 'ML Engineer', 'Data Scientist'],
    'data': ['Data Analysis', 'Python', 'SQL', 'Data Analyst', 'Data Scientist'],
    'design': ['Figma', 'UI/UX Designer', 'UI Design', 'Graphic Designer'],
    'javascript': ['JavaScript', 'Frontend Dev', 'Node.js', 'Web Development'],
    'typescript': ['TypeScript', 'JavaScript', 'Frontend Dev'],
    'node': ['Node.js', 'Backend Dev', 'JavaScript'],
    'mobile': ['React Native', 'Flutter', 'Mobile Dev'],
    'backend': ['Node.js', 'Python', 'Java', 'Backend Dev'],
    'frontend': ['React', 'Vue.js', 'HTML/CSS', 'Frontend Dev'],
    'fullstack': ['React', 'Node.js', 'Fullstack Dev'],
    'devops': ['Docker', 'AWS', 'CI/CD', 'DevOps'],
    'cloud': ['AWS', 'Azure', 'GCP', 'DevOps'],
    'generative': ['Machine Learning', 'Deep Learning', 'AI', 'Python', 'ML Engineer']
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize string for comparison
 */
function normalizeString(str) {
    return (str || '').toLowerCase().trim();
}

/**
 * Calculate overlap score between two arrays (0-1)
 */
function calculateOverlapScore(arr1 = [], arr2 = []) {
    if (!arr1.length || !arr2.length) return 0;

    const set1 = new Set(arr1.map(normalizeString));
    const set2 = new Set(arr2.map(normalizeString));

    const intersection = [...set1].filter(x => set2.has(x)).length;
    return intersection / Math.max(arr1.length, arr2.length);
}

/**
 * Check if any keyword from list is in text
 */
function matchesKeywords(text, keywords) {
    const normalizedText = normalizeString(text);
    return keywords.some(keyword => normalizedText.includes(normalizeString(keyword)));
}

/**
 * Extract relevant skills from contest tags
 */
function getContestRelatedSkills(tags = []) {
    const skills = new Set();

    tags.forEach(tag => {
        const normalizedTag = normalizeString(tag);
        // Check each category
        Object.entries(CONTEST_CATEGORY_SKILLS).forEach(([category, categorySkills]) => {
            if (normalizedTag.includes(normalizeString(category))) {
                categorySkills.forEach(skill => skills.add(skill));
            }
        });
        // Also add the tag itself as potential match
        skills.add(tag);
    });

    return Array.from(skills);
}

/**
 * Extract relevant skills from course title
 */
function getCourseRelatedSkills(title = '') {
    const skills = new Set();
    const normalizedTitle = normalizeString(title);

    Object.entries(COURSE_KEYWORDS_SKILLS).forEach(([keyword, keywordSkills]) => {
        if (normalizedTitle.includes(keyword)) {
            keywordSkills.forEach(skill => skills.add(skill));
        }
    });

    return Array.from(skills);
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate match score for a contest
 * @param {Object} contest - Contest object
 * @param {Object} userProfile - User's matching profile and contest preferences
 * @returns {number} Score from 0-100
 */
function calculateContestScore(contest, userProfile) {
    const { matchingProfile = {}, contestPreferences = {} } = userProfile;

    let score = 0;

    // 1. Tags matching user's contestInterests (40%)
    const userInterests = contestPreferences.contestInterests || [];
    const contestTags = contest.tags || [];

    // Direct interest match
    const interestOverlap = calculateOverlapScore(userInterests, contestTags);
    score += interestOverlap * 40;

    // 2. Category matching user's skills/roles (30%)
    const userSkills = [
        ...(matchingProfile.skills || []),
        ...(matchingProfile.techStack || []),
        matchingProfile.primaryRole || '',
        ...(matchingProfile.secondaryRoles || [])
    ].filter(Boolean);

    const contestRelatedSkills = getContestRelatedSkills(contestTags);
    const skillOverlap = calculateOverlapScore(userSkills, contestRelatedSkills);
    score += skillOverlap * 30;

    // 3. Experience level appropriateness (20%)
    const userLevel = matchingProfile.experienceLevel || 'intermediate';
    // Simple heuristic: all contests are suitable, but advanced users get slight boost for harder contests
    const levelBonus = userLevel === 'advanced' || userLevel === 'expert' ? 20 : 15;
    score += levelBonus;

    // 4. Contest format preference (10%)
    const preferredFormats = contestPreferences.preferredContestFormats || [];
    const contestFormat = contest.locationType || 'online';

    if (preferredFormats.length === 0 || preferredFormats.some(f => normalizeString(f) === normalizeString(contestFormat))) {
        score += 10;
    } else {
        score += 5; // Partial match
    }

    return Math.min(100, Math.round(score));
}

/**
 * Calculate match score for a course
 * @param {Object} course - Course object
 * @param {Object} userProfile - User's matching profile and contest preferences
 * @returns {number} Score from 0-100
 */
function calculateCourseScore(course, userProfile) {
    const { matchingProfile = {}, contestPreferences = {} } = userProfile;

    let score = 0;

    // 1. Course level matching user's experience (35%)
    const userLevel = matchingProfile.experienceLevel || 'intermediate';
    const courseLevel = course.level || 'Intermediate';
    const suitableLevels = EXPERIENCE_TO_COURSE_LEVEL[userLevel] || ['Intermediate'];

    if (suitableLevels.includes(courseLevel)) {
        score += 35;
    } else {
        // Adjacent level gets partial score
        score += 15;
    }

    // 2. Skills/tech stack overlap (35%)
    const userSkills = [
        ...(matchingProfile.skills || []),
        ...(matchingProfile.techStack || []),
        matchingProfile.primaryRole || '',
        ...(matchingProfile.secondaryRoles || [])
    ].filter(Boolean);

    const courseRelatedSkills = getCourseRelatedSkills(course.title);
    const skillOverlap = calculateOverlapScore(userSkills, courseRelatedSkills);
    score += skillOverlap * 35;

    // 3. Contest interests alignment (20%)
    const userInterests = contestPreferences.contestInterests || [];

    // Check if course title relates to user interests
    const courseTitle = normalizeString(course.title);
    const interestMatch = userInterests.some(interest => {
        const normalizedInterest = normalizeString(interest);
        return courseTitle.includes(normalizedInterest) ||
            normalizedInterest.split(' ').some(word => courseTitle.includes(word));
    });

    if (interestMatch) {
        score += 20;
    } else {
        score += 8; // Base score for any course
    }

    // 4. Random diversity factor (10%) - based on course rating
    const ratingBonus = (course.rating || 4) / 5 * 10;
    score += ratingBonus;

    return Math.min(100, Math.round(score));
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Get recommended contests for a user
 * @param {string} userId - User ID
 * @param {Object} options - Options { limit: number }
 * @returns {Promise<Array>} Sorted array of contests with scores (scores hidden from response)
 */
export async function getRecommendedContests(userId, options = {}) {
    const { limit = 3 } = options;

    // Check cache
    const cacheKey = `contests:${userId}:${limit}`;
    const cached = contentRecommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const usersCollection = getCollection('users');
        const contestsCollection = getCollection('contests');
        const registrationsCollection = getCollection('registrations');

        // Get user profile
        const user = await usersCollection.findOne(
            { _id: new ObjectId(userId) },
            { projection: { matchingProfile: 1, contestPreferences: 1 } }
        );

        if (!user) {
            return [];
        }

        // Get user's registered contest IDs to exclude
        const userRegistrations = await registrationsCollection.find(
            { userId: userId, status: { $in: ['active', 'completed'] } },
            { projection: { contestId: 1 } }
        ).toArray();

        const registeredContestIds = new Set(
            userRegistrations.map(r => r.contestId?.toString()).filter(Boolean)
        );

        // Get active contests
        const now = new Date().toISOString();
        const contests = await contestsCollection.find({
            status: { $in: ['OPEN', 'FULL'] },
            deadline: { $gte: now }
        }).toArray();

        if (contests.length === 0) {
            return [];
        }

        // Filter out already registered contests and calculate scores
        const scoredContests = contests
            .filter(contest => !registeredContestIds.has(contest._id?.toString()))
            .map(contest => ({
                ...contest,
                _matchScore: calculateContestScore(contest, user)
            }));

        // Sort by score descending
        scoredContests.sort((a, b) => b._matchScore - a._matchScore);

        // Take top results and remove score from response
        const results = scoredContests.slice(0, limit).map(({ _matchScore, ...contest }) => contest);

        // Cache results
        contentRecommendationCache.set(cacheKey, {
            timestamp: Date.now(),
            data: results
        });

        return results;

    } catch (error) {
        console.error('[ContentMatching] Error getting recommended contests:', error);
        return [];
    }
}

/**
 * Get recommended courses for a user
 * @param {string} userId - User ID
 * @param {Object} options - Options { limit: number }
 * @returns {Promise<Array>} Sorted array of courses with scores (scores hidden from response)
 */
export async function getRecommendedCourses(userId, options = {}) {
    const { limit = 4 } = options;

    // Check cache
    const cacheKey = `courses:${userId}:${limit}`;
    const cached = contentRecommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const usersCollection = getCollection('users');
        const coursesCollection = getCollection('courses');
        const enrollmentsCollection = getCollection('courseEnrollments');

        // Get user profile
        const user = await usersCollection.findOne(
            { _id: new ObjectId(userId) },
            { projection: { matchingProfile: 1, contestPreferences: 1 } }
        );

        if (!user) {
            return [];
        }

        // Get user's enrolled course IDs to exclude
        const userEnrollments = await enrollmentsCollection.find(
            { userId: userId, status: { $in: ['active', 'completed'] } },
            { projection: { courseId: 1 } }
        ).toArray();

        const enrolledCourseIds = new Set(
            userEnrollments.map(e => e.courseId?.toString()).filter(Boolean)
        );

        // Get all courses
        const courses = await coursesCollection.find({}).toArray();

        if (courses.length === 0) {
            return [];
        }

        // Filter out already enrolled courses and calculate scores
        const scoredCourses = courses
            .filter(course => !enrolledCourseIds.has(course._id?.toString()))
            .map(course => ({
                ...course,
                _matchScore: calculateCourseScore(course, user)
            }));

        // Sort by score descending
        scoredCourses.sort((a, b) => b._matchScore - a._matchScore);

        // Take top results and remove score from response
        const results = scoredCourses.slice(0, limit).map(({ _matchScore, ...course }) => course);

        // Cache results
        contentRecommendationCache.set(cacheKey, {
            timestamp: Date.now(),
            data: results
        });

        return results;

    } catch (error) {
        console.error('[ContentMatching] Error getting recommended courses:', error);
        return [];
    }
}

/**
 * Get both recommended contests and courses
 * @param {string} userId - User ID
 * @param {Object} options - Options { contestLimit, courseLimit }
 * @returns {Promise<Object>} { contests: [], courses: [] }
 */
export async function getRecommendedContent(userId, options = {}) {
    const { contestLimit = 3, courseLimit = 4 } = options;

    const [contests, courses] = await Promise.all([
        getRecommendedContests(userId, { limit: contestLimit }),
        getRecommendedCourses(userId, { limit: courseLimit })
    ]);

    return { contests, courses };
}

/**
 * Clear cache for a specific user
 */
export function invalidateContentCache(userId) {
    for (const key of contentRecommendationCache.keys()) {
        if (key.includes(userId)) {
            contentRecommendationCache.delete(key);
        }
    }
}

/**
 * Clear all cache
 */
export function clearAllContentCache() {
    contentRecommendationCache.clear();
}

/**
 * Get cache stats
 */
export function getContentCacheStats() {
    return {
        size: contentRecommendationCache.size,
        ttlMs: CACHE_TTL_MS
    };
}
