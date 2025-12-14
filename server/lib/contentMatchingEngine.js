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

// Contest category definitions (grouped, with label aliases for legacy values)
const CONTEST_CATEGORY_SKILLS = [
    {
        name: 'IT & Tech',
        labels: ['it', 'it & tech', 'tech', 'hackathon', 'coding', 'coding contest', 'ai/ml', 'ai', 'ml', 'programming', 'software'],
        skills: ['React', 'Node.js', 'Python', 'JavaScript', 'TypeScript', 'Algorithms', 'Data Structures', 'Frontend Dev', 'Backend Dev', 'Fullstack Dev', 'ML Engineer']
    },
    {
        name: 'Data & Analytics',
        labels: ['data', 'data & analytics', 'analytics', 'data science', 'bi'],
        skills: ['Python', 'SQL', 'Data Analysis', 'Machine Learning', 'Business Intelligence', 'Data Analyst', 'Data Scientist']
    },
    {
        name: 'Cybersecurity',
        labels: ['cyber', 'cybersecurity', 'security', 'infosec'],
        skills: ['Security Analyst', 'OWASP', 'Penetration Testing', 'Network Security', 'SIEM', 'Threat Hunting']
    },
    {
        name: 'Robotics & IoT',
        labels: ['robotics', 'robot', 'iot', 'embedded', 'hardware', 'internet of things'],
        skills: ['Arduino', 'Raspberry Pi', 'C++', 'Python', 'Embedded Systems', 'Electronics']
    },
    {
        name: 'Design / UI-UX',
        labels: ['design', 'ui', 'ux', 'ui/ux', 'product design', 'creative'],
        skills: ['Figma', 'Adobe XD', 'Photoshop', 'UI/UX Designer', 'Graphic Designer', 'Prototyping']
    },
    {
        name: 'Business & Strategy',
        labels: ['business', 'strategy', 'case study', 'management'],
        skills: ['Business Analysis', 'Consulting', 'Product Management', 'Market Research']
    },
    {
        name: 'Startup & Innovation',
        labels: ['startup', 'innovation', 'pitch', 'entrepreneur', 'founder'],
        skills: ['Pitching', 'Lean Canvas', 'Fundraising', 'MVP', 'Go-to-market']
    },
    {
        name: 'Marketing & Growth',
        labels: ['marketing', 'growth', 'branding', 'seo', 'ads'],
        skills: ['Digital Marketing', 'SEO', 'Performance Ads', 'Copywriting', 'Growth Hacking']
    },
    {
        name: 'Finance & Fintech',
        labels: ['finance', 'fintech', 'investment', 'trading'],
        skills: ['Financial Analysis', 'Investment', 'Blockchain', 'Payments']
    },
    {
        name: 'Health & Biotech',
        labels: ['health', 'biotech', 'medical', 'med'],
        skills: ['Bioinformatics', 'Healthcare', 'Clinical Data', 'Biotech']
    },
    {
        name: 'Education & EdTech',
        labels: ['education', 'edtech', 'learning', 'training'],
        skills: ['Instructional Design', 'LMS', 'Teaching', 'Curriculum Design']
    },
    {
        name: 'Sustainability & Environment',
        labels: ['sustainability', 'environment', 'green', 'climate'],
        skills: ['Renewable Energy', 'Climate Tech', 'ESG', 'Sustainability']
    },
    {
        name: 'Gaming & Esports',
        labels: ['gaming', 'esports', 'game'],
        skills: ['Game Design', 'Unity', 'Unreal', 'Game Dev', 'Shoutcasting']
    },
    {
        name: 'Research & Science',
        labels: ['research', 'science', 'academic'],
        skills: ['Research Methods', 'Statistics', 'Lab Work', 'Academic Writing']
    },
    {
        name: 'Other',
        labels: ['other'],
        skills: []
    }
];

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
function resolveContestCategory(rawCategory = '', tags = []) {
    const candidates = [rawCategory, ...tags].map(normalizeString).filter(Boolean);
    for (const candidate of candidates) {
        for (const def of CONTEST_CATEGORY_SKILLS) {
            if (def.labels.some(label => candidate.includes(normalizeString(label)))) {
                return def.name;
            }
        }
    }
    return '';
}

/**
 * Extract relevant skills from contest tags/category
 */
function getContestRelatedSkills(tags = [], category = '') {
    const skills = new Set();
    const matchedDefinitions = new Set();

    const addSkillsForToken = (token) => {
        const normalizedToken = normalizeString(token);
        if (!normalizedToken) return;

        CONTEST_CATEGORY_SKILLS.forEach(def => {
            if (def.labels.some(label => normalizedToken.includes(normalizeString(label)))) {
                matchedDefinitions.add(def.name);
                def.skills.forEach(skill => skills.add(skill));
            }
        });
        // Keep original tag as potential direct match
        skills.add(token);
    };

    tags.forEach(addSkillsForToken);
    addSkillsForToken(category);

    // If nothing matched but we have a resolvable category, add its skills
    if (matchedDefinitions.size === 0) {
        const resolved = resolveContestCategory(category, tags);
        const def = CONTEST_CATEGORY_SKILLS.find(d => d.name === resolved);
        if (def) {
            def.skills.forEach(skill => skills.add(skill));
        }
    }

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

    const contestRelatedSkills = getContestRelatedSkills(contestTags, contest.category);
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

        // Get active contests (OPEN/FULL and not past deadline)
        const now = new Date().toISOString();
        const activeContests = await contestsCollection.find({
            status: { $in: ['OPEN', 'FULL'] },
            deadline: { $gte: now }
        }).toArray();

        let contests = activeContests;

        // Fallback: if not enough active contests, include recent OPEN/FULL even if deadline passed
        if (contests.length < limit) {
            const fallbackOpen = await contestsCollection.find({
                status: { $in: ['OPEN', 'FULL'] },
                deadline: { $lt: now }
            })
                .sort({ deadline: -1, createdAt: -1 })
                .limit(limit - contests.length)
                .toArray();

            const existingIds = new Set(contests.map(c => c._id?.toString()));
            contests = [...contests, ...fallbackOpen.filter(c => !existingIds.has(c._id?.toString()))];
        }

        // Last fallback: if still short, include recent closed contests to fill the list
        if (contests.length < limit) {
            const fallbackClosed = await contestsCollection.find({
                status: { $nin: ['OPEN', 'FULL'] }
            })
                .sort({ deadline: -1, createdAt: -1 })
                .limit(limit - contests.length)
                .toArray();

            const existingIds = new Set(contests.map(c => c._id?.toString()));
            contests = [...contests, ...fallbackClosed.filter(c => !existingIds.has(c._id?.toString()))];
        }

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
    const { limit = 3 } = options;

    // Check cache
    const cacheKey = `courses:${userId}:${limit}`;
    const cached = contentRecommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const usersCollection = getCollection('users');
        const coursesCollection = getCollection('courses');
        const enrollmentsCollection = getCollection('enrollments');

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
            {
                userId: new ObjectId(userId),
                status: { $in: ['active', 'completed'] }
            },
            { projection: { courseId: 1 } }
        ).toArray();

        const enrolledCourseIds = new Set(
            userEnrollments.map(e => e.courseId?.toString()).filter(Boolean)
        );

        // Get all courses
        // Only recommend active/public courses
        const courses = await coursesCollection.find({
            deletedAt: { $exists: false },
            isPublic: { $ne: false }
        }).toArray();

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
