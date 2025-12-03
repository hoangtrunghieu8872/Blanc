/**
 * ============================================================================
 * BLANC TEAMMATE MATCHING ENGINE
 * ============================================================================
 * 
 * Comprehensive matching algorithm for finding diverse, compatible teammates.
 * 
 * Features:
 * - Full profile-based scoring using ALL user profile fields
 * - Diversity optimization for building a complete team of 6 (5 recommendations)
 * - Two-way matching for Community page (both users must be interested)
 * - One-way matching for AI agent recommendations
 * - Contest-specific matching support
 * - 6-hour caching for performance optimization
 * - Security: no sensitive data exposure, privacy consent checks
 * 
 * Scoring Weights (Total: 100):
 * - Role Diversity & Complementarity: 25
 * - Skill Compatibility: 20
 * - Availability & Schedule: 15
 * - Experience Level: 10
 * - Location & Timezone: 10
 * - Communication Preferences: 10
 * - Contest Preferences: 5
 * - Collaboration Style: 5
 */

import { getCollection } from './db.js';
import { ObjectId } from 'mongodb';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const SCORING_WEIGHTS = {
    roleDiversity: 25,        // Different roles for team diversity
    skillComplementarity: 20, // Complementary skills (some overlap, some new)
    availability: 15,         // Schedule compatibility
    experienceLevel: 10,      // Experience level proximity
    locationTimezone: 10,     // Location/timezone compatibility
    communicationTools: 10,   // Shared communication preferences
    contestPreferences: 5,    // Similar contest interests
    collaborationStyle: 5,    // Compatible working styles
};

// Role categories for diversity calculation
const ROLE_CATEGORIES = {
    'development': ['Frontend Dev', 'Backend Dev', 'Fullstack Dev', 'Mobile Dev', 'DevOps'],
    'design': ['UI/UX Designer', 'Graphic Designer', 'Video Editor'],
    'business': ['Business Analyst', 'Product Manager', 'Marketing', 'Pitching'],
    'data': ['Data Analyst', 'Data Scientist', 'ML Engineer', 'Researcher'],
    'support': ['QA/Tester', 'Content Writer', 'Team Lead', 'Other']
};

// Experience level order for proximity calculation
const EXPERIENCE_ORDER = ['beginner', 'intermediate', 'advanced', 'expert'];

// Cache configuration
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
const recommendationCache = new Map();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate Jaccard similarity coefficient between two arrays
 * @param {string[]} arr1 
 * @param {string[]} arr2 
 * @returns {number} Similarity score between 0 and 1
 */
function jaccardSimilarity(arr1 = [], arr2 = []) {
    if (!arr1.length || !arr2.length) return 0;

    const set1 = new Set(arr1.map(s => s.toLowerCase().trim()));
    const set2 = new Set(arr2.map(s => s.toLowerCase().trim()));

    const intersection = [...set1].filter(x => set2.has(x)).length;
    const union = new Set([...set1, ...set2]).size;

    return union > 0 ? intersection / union : 0;
}

/**
 * Calculate overlap count between two arrays
 */
function countOverlap(arr1 = [], arr2 = []) {
    const set1 = new Set(arr1.map(s => s.toLowerCase().trim()));
    return arr2.filter(item => set1.has(item.toLowerCase().trim())).length;
}

/**
 * Get role category for diversity calculation
 */
function getRoleCategory(role) {
    if (!role) return null;
    const normalizedRole = role.trim();
    for (const [category, roles] of Object.entries(ROLE_CATEGORIES)) {
        if (roles.includes(normalizedRole)) return category;
    }
    return 'support'; // Default category
}

/**
 * Calculate experience level distance (0-3)
 */
function getExperienceLevelDistance(level1, level2) {
    const idx1 = EXPERIENCE_ORDER.indexOf(level1);
    const idx2 = EXPERIENCE_ORDER.indexOf(level2);
    if (idx1 === -1 || idx2 === -1) return 2; // Default moderate distance
    return Math.abs(idx1 - idx2);
}

/**
 * Check if two timezones are compatible (within 3 hours)
 */
function areTimezonesCompatible(tz1, tz2) {
    if (!tz1 || !tz2) return true; // Assume compatible if not specified

    const parseOffset = (tz) => {
        const match = tz.match(/UTC([+-]?\d+(?::\d+)?)/);
        if (!match) return 0;
        const [hours, minutes = 0] = match[1].split(':').map(Number);
        return hours + (minutes / 60);
    };

    const diff = Math.abs(parseOffset(tz1) - parseOffset(tz2));
    return diff <= 3;
}

/**
 * Generate cache key for recommendations
 */
function generateCacheKey(userId, options = {}) {
    const parts = [
        userId,
        options.contestId || 'all',
        options.twoWay ? 'two-way' : 'one-way',
        options.excludeUserIds?.join(',') || ''
    ];
    return parts.join(':');
}

/**
 * Check if cache is valid
 */
function isCacheValid(cacheEntry) {
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < CACHE_TTL_MS;
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Score role diversity (higher = more diverse/complementary)
 * Penalizes same role, rewards different categories
 */
function scoreRoleDiversity(userProfile, candidateProfile, selectedTeamRoles = []) {
    const userRole = userProfile?.matchingProfile?.primaryRole || '';
    const candidateRole = candidateProfile?.matchingProfile?.primaryRole || '';

    if (!candidateRole) return 0;

    let score = 0;

    // Penalize if same role as the user
    if (candidateRole.toLowerCase() === userRole.toLowerCase()) {
        score -= 10;
    }

    // Check category diversity
    const userCategory = getRoleCategory(userRole);
    const candidateCategory = getRoleCategory(candidateRole);

    if (candidateCategory !== userCategory) {
        score += 15; // Bonus for different category
    }

    // Check against already selected team roles
    const alreadyHasRole = selectedTeamRoles.some(
        r => r.toLowerCase() === candidateRole.toLowerCase()
    );
    if (alreadyHasRole) {
        score -= 15; // Heavy penalty for duplicate role in team
    }

    // Check category saturation in team
    const teamCategories = selectedTeamRoles.map(r => getRoleCategory(r));
    const categoryCounts = {};
    for (const cat of teamCategories) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    // Bonus if this category is underrepresented
    if ((categoryCounts[candidateCategory] || 0) === 0) {
        score += 10;
    }

    // Consider secondary roles for flexibility
    const candidateSecondary = candidateProfile?.matchingProfile?.secondaryRoles || [];
    const uniqueSecondaryRoles = candidateSecondary.filter(
        r => !selectedTeamRoles.includes(r) && r !== userRole
    ).length;
    score += uniqueSecondaryRoles * 2; // Bonus for versatility

    // Normalize to 0-25 scale
    return Math.max(0, Math.min(25, score + 10)); // Base score + adjustments
}

/**
 * Score skill complementarity
 * Balance: some shared skills (communication), some unique (coverage)
 */
function scoreSkillComplementarity(userProfile, candidateProfile, selectedTeamSkills = []) {
    const userSkills = userProfile?.matchingProfile?.skills || [];
    const userTechStack = userProfile?.matchingProfile?.techStack || [];
    const candidateSkills = candidateProfile?.matchingProfile?.skills || [];
    const candidateTechStack = candidateProfile?.matchingProfile?.techStack || [];

    // Combine skills and tech stack
    const userAll = [...new Set([...userSkills, ...userTechStack])];
    const candidateAll = [...new Set([...candidateSkills, ...candidateTechStack])];

    if (candidateAll.length === 0) return 5; // Minimum score if no skills

    let score = 0;

    // Calculate overlap with user (some overlap is good for communication)
    const overlapWithUser = countOverlap(userAll, candidateAll);
    const overlapRatio = overlapWithUser / Math.max(userAll.length, 1);

    // Sweet spot: 20-50% overlap
    if (overlapRatio >= 0.2 && overlapRatio <= 0.5) {
        score += 8;
    } else if (overlapRatio > 0.5) {
        score += 4; // Too similar
    } else {
        score += 6; // Some unique skills
    }

    // Calculate new skills contribution (skills not yet in team)
    const teamSkillsSet = new Set(selectedTeamSkills.map(s => s.toLowerCase()));
    const newSkills = candidateAll.filter(s => !teamSkillsSet.has(s.toLowerCase()));
    const newSkillsRatio = newSkills.length / Math.max(candidateAll.length, 1);

    score += Math.min(8, newSkillsRatio * 10); // Up to 8 points for new skills

    // Bonus for having many skills (more versatile)
    if (candidateAll.length >= 10) score += 2;
    if (candidateAll.length >= 20) score += 2;

    return Math.max(0, Math.min(20, score));
}

/**
 * Score availability compatibility
 */
function scoreAvailability(userProfile, candidateProfile) {
    const userAvailability = userProfile?.matchingProfile?.availability || '';
    const candidateAvailability = candidateProfile?.matchingProfile?.availability || '';

    if (!userAvailability || !candidateAvailability) return 7; // Neutral if not specified

    const userSlots = userAvailability.split(',').map(s => s.trim().toLowerCase());
    const candidateSlots = candidateAvailability.split(',').map(s => s.trim().toLowerCase());

    // Calculate overlap
    const overlap = countOverlap(userSlots, candidateSlots);
    const totalSlots = Math.max(userSlots.length, candidateSlots.length);

    const overlapRatio = overlap / Math.max(totalSlots, 1);

    // Score based on overlap
    if (overlapRatio >= 0.5) return 15;
    if (overlapRatio >= 0.3) return 12;
    if (overlapRatio >= 0.1) return 8;
    return 5;
}

/**
 * Score experience level compatibility
 * Prefer similar levels but allow some diversity
 */
function scoreExperienceLevel(userProfile, candidateProfile) {
    const userLevel = userProfile?.matchingProfile?.experienceLevel || '';
    const candidateLevel = candidateProfile?.matchingProfile?.experienceLevel || '';

    if (!userLevel || !candidateLevel) return 5; // Neutral if not specified

    const distance = getExperienceLevelDistance(userLevel, candidateLevel);

    // Score based on distance (0 = same, 3 = max difference)
    switch (distance) {
        case 0: return 10; // Same level - good for collaboration
        case 1: return 8;  // Adjacent - can learn from each other
        case 2: return 5;  // Some gap
        case 3: return 3;  // Large gap
        default: return 5;
    }
}

/**
 * Score location and timezone compatibility
 */
function scoreLocationTimezone(userProfile, candidateProfile) {
    const userLocation = userProfile?.matchingProfile?.location || '';
    const userTimezone = userProfile?.matchingProfile?.timeZone || '';
    const candidateLocation = candidateProfile?.matchingProfile?.location || '';
    const candidateTimezone = candidateProfile?.matchingProfile?.timeZone || '';

    let score = 0;

    // Same location bonus
    if (userLocation && candidateLocation) {
        if (userLocation.toLowerCase() === candidateLocation.toLowerCase()) {
            score += 5;
        }
    }

    // Timezone compatibility
    if (areTimezonesCompatible(userTimezone, candidateTimezone)) {
        score += 5;
    } else {
        score += 2; // Some score even if different timezone
    }

    return Math.min(10, score);
}

/**
 * Score communication tool compatibility
 */
function scoreCommunicationTools(userProfile, candidateProfile) {
    const userTools = userProfile?.matchingProfile?.communicationTools || [];
    const candidateTools = candidateProfile?.matchingProfile?.communicationTools || [];

    if (!userTools.length || !candidateTools.length) return 5;

    const overlap = countOverlap(userTools, candidateTools);

    if (overlap >= 3) return 10;
    if (overlap >= 2) return 8;
    if (overlap >= 1) return 6;
    return 3;
}

/**
 * Score contest preferences compatibility
 */
function scoreContestPreferences(userProfile, candidateProfile, contestTags = []) {
    const userInterests = userProfile?.contestPreferences?.contestInterests || [];
    const candidateInterests = candidateProfile?.contestPreferences?.contestInterests || [];
    const userFormats = userProfile?.contestPreferences?.preferredContestFormats || [];
    const candidateFormats = candidateProfile?.contestPreferences?.preferredContestFormats || [];

    let score = 0;

    // If contest is specified, check if candidate is interested
    if (contestTags.length > 0) {
        const interestMatch = countOverlap(contestTags, candidateInterests);
        if (interestMatch > 0) score += 3;
    } else {
        // Check interest overlap
        const interestOverlap = countOverlap(userInterests, candidateInterests);
        if (interestOverlap >= 2) score += 3;
        else if (interestOverlap >= 1) score += 2;
    }

    // Format compatibility
    const formatOverlap = countOverlap(userFormats, candidateFormats);
    if (formatOverlap > 0) score += 2;

    return Math.min(5, score);
}

/**
 * Score collaboration style compatibility
 */
function scoreCollaborationStyle(userProfile, candidateProfile) {
    const userStyle = userProfile?.matchingProfile?.collaborationStyle || '';
    const candidateStyle = candidateProfile?.matchingProfile?.collaborationStyle || '';

    if (!userStyle || !candidateStyle) return 2;

    const userStyles = userStyle.split(',').map(s => s.trim().toLowerCase());
    const candidateStyles = candidateStyle.split(',').map(s => s.trim().toLowerCase());

    const overlap = countOverlap(userStyles, candidateStyles);

    if (overlap >= 2) return 5;
    if (overlap >= 1) return 3;
    return 1;
}

/**
 * Calculate total match score for a candidate
 */
function calculateMatchScore(userProfile, candidateProfile, options = {}) {
    const {
        selectedTeamRoles = [],
        selectedTeamSkills = [],
        contestTags = []
    } = options;

    const scores = {
        roleDiversity: scoreRoleDiversity(userProfile, candidateProfile, selectedTeamRoles),
        skillComplementarity: scoreSkillComplementarity(userProfile, candidateProfile, selectedTeamSkills),
        availability: scoreAvailability(userProfile, candidateProfile),
        experienceLevel: scoreExperienceLevel(userProfile, candidateProfile),
        locationTimezone: scoreLocationTimezone(userProfile, candidateProfile),
        communicationTools: scoreCommunicationTools(userProfile, candidateProfile),
        contestPreferences: scoreContestPreferences(userProfile, candidateProfile, contestTags),
        collaborationStyle: scoreCollaborationStyle(userProfile, candidateProfile)
    };

    const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);

    return {
        totalScore,
        breakdown: scores,
        maxScore: 100
    };
}

// ============================================================================
// TWO-WAY MATCHING
// ============================================================================

/**
 * Calculate mutual compatibility score (both users interested in each other)
 */
function calculateMutualScore(userProfile, candidateProfile, options = {}) {
    // Calculate both directions
    const userToCandidate = calculateMatchScore(userProfile, candidateProfile, options);
    const candidateToUser = calculateMatchScore(candidateProfile, userProfile, options);

    // Use geometric mean for mutual score (penalizes one-sided matches)
    const mutualScore = Math.sqrt(userToCandidate.totalScore * candidateToUser.totalScore);

    return {
        totalScore: mutualScore,
        userToCandidate: userToCandidate.totalScore,
        candidateToUser: candidateToUser.totalScore,
        breakdown: userToCandidate.breakdown,
        maxScore: 100
    };
}

// ============================================================================
// MAIN MATCHING FUNCTIONS
// ============================================================================

/**
 * Get recommended teammates for a user
 * @param {string} userId - The user's ID
 * @param {Object} options - Matching options
 * @param {string} options.contestId - Optional contest ID for contest-specific matching
 * @param {boolean} options.twoWay - Use two-way matching (default: true)
 * @param {string[]} options.excludeUserIds - User IDs to exclude
 * @param {number} options.limit - Number of recommendations (default: 5)
 * @param {boolean} options.skipCache - Skip cache lookup
 * @returns {Promise<Array>} Recommended teammates
 */
export async function getRecommendedTeammates(userId, options = {}) {
    const {
        contestId = null,
        twoWay = true,
        excludeUserIds = [],
        limit = 5,
        skipCache = false
    } = options;

    // Check cache first
    const cacheKey = generateCacheKey(userId, { contestId, twoWay, excludeUserIds });
    if (!skipCache) {
        const cached = recommendationCache.get(cacheKey);
        if (isCacheValid(cached)) {
            console.log(`[Matching] Cache hit for user ${userId}`);
            return cached.data;
        }
    }

    console.log(`[Matching] Computing recommendations for user ${userId}`);

    const usersCollection = getCollection('users');

    // Get the requesting user's profile
    const userProfile = await usersCollection.findOne(
        { _id: new ObjectId(userId) },
        {
            projection: {
                name: 1,
                matchingProfile: 1,
                contestPreferences: 1,
                consents: 1
            }
        }
    );

    if (!userProfile) {
        throw new Error('User not found');
    }

    // Check if user allows matching
    if (!userProfile.consents?.allowMatching) {
        return [];
    }

    // Build query for potential candidates
    const excludeIds = [new ObjectId(userId), ...excludeUserIds.map(id => new ObjectId(id))];

    const candidateQuery = {
        _id: { $nin: excludeIds },
        'matchingProfile.openToNewTeams': true,
        'consents.allowMatching': true
    };

    // Get contest info if specified
    let contestTags = [];
    if (contestId) {
        try {
            const contestsCollection = getCollection('contests');
            const contest = await contestsCollection.findOne(
                { _id: new ObjectId(contestId) },
                { projection: { tags: 1 } }
            );
            if (contest?.tags) {
                contestTags = contest.tags;
            }
        } catch (e) {
            console.warn(`[Matching] Could not fetch contest ${contestId}:`, e.message);
        }
    }

    // Fetch candidates with relevant fields only
    const candidates = await usersCollection.find(candidateQuery)
        .project({
            name: 1,
            avatar: 1,
            matchingProfile: 1,
            contestPreferences: 1,
            consents: 1
        })
        .limit(200) // Limit initial fetch for performance
        .toArray();

    if (candidates.length === 0) {
        return [];
    }

    // Calculate scores for all candidates
    const scoredCandidates = candidates.map(candidate => {
        const scoreResult = twoWay
            ? calculateMutualScore(userProfile, candidate, { contestTags })
            : calculateMatchScore(userProfile, candidate, { contestTags });

        return {
            ...candidate,
            matchScore: scoreResult.totalScore,
            scoreBreakdown: scoreResult.breakdown,
            matchDetails: twoWay ? {
                userToCandidate: scoreResult.userToCandidate,
                candidateToUser: scoreResult.candidateToUser
            } : null
        };
    });

    // Sort by score
    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

    // Select diverse team using greedy algorithm
    const selectedTeam = selectDiverseTeam(
        userProfile,
        scoredCandidates,
        limit,
        { twoWay, contestTags }
    );

    // Format results (remove sensitive data)
    const results = selectedTeam.map(formatCandidateForResponse);

    // Cache results
    recommendationCache.set(cacheKey, {
        timestamp: Date.now(),
        data: results
    });

    // Clean old cache entries periodically
    cleanExpiredCache();

    return results;
}

/**
 * Select diverse team members using greedy algorithm
 * Ensures diversity in roles and skills while maintaining high scores
 */
function selectDiverseTeam(userProfile, scoredCandidates, limit, options = {}) {
    const { contestTags = [] } = options;
    const selected = [];
    const userRole = userProfile?.matchingProfile?.primaryRole || '';
    const userSkills = [
        ...(userProfile?.matchingProfile?.skills || []),
        ...(userProfile?.matchingProfile?.techStack || [])
    ];

    // Track what the team already has
    const teamRoles = [userRole];
    const teamSkills = [...userSkills];
    const teamCategories = new Set([getRoleCategory(userRole)]);

    // Track which candidates we've considered
    const considered = new Set();

    while (selected.length < limit && considered.size < scoredCandidates.length) {
        let bestCandidate = null;
        let bestAdjustedScore = -1;

        for (const candidate of scoredCandidates) {
            if (considered.has(candidate._id.toString())) continue;

            // Recalculate score with current team context
            const candidateRole = candidate?.matchingProfile?.primaryRole || '';
            const candidateCategory = getRoleCategory(candidateRole);
            const candidateSkills = [
                ...(candidate?.matchingProfile?.skills || []),
                ...(candidate?.matchingProfile?.techStack || [])
            ];

            // Diversity bonuses
            let diversityBonus = 0;

            // Category diversity bonus
            if (!teamCategories.has(candidateCategory)) {
                diversityBonus += 15;
            }

            // Role uniqueness bonus
            if (!teamRoles.includes(candidateRole)) {
                diversityBonus += 10;
            }

            // New skills bonus
            const newSkills = candidateSkills.filter(
                s => !teamSkills.map(ts => ts.toLowerCase()).includes(s.toLowerCase())
            );
            diversityBonus += Math.min(10, newSkills.length * 2);

            const adjustedScore = candidate.matchScore + diversityBonus;

            if (adjustedScore > bestAdjustedScore) {
                bestAdjustedScore = adjustedScore;
                bestCandidate = candidate;
            }
        }

        if (!bestCandidate) break;

        // Add to team
        selected.push(bestCandidate);
        considered.add(bestCandidate._id.toString());

        // Update team tracking
        const selectedRole = bestCandidate?.matchingProfile?.primaryRole || '';
        teamRoles.push(selectedRole);
        teamCategories.add(getRoleCategory(selectedRole));
        teamSkills.push(...(bestCandidate?.matchingProfile?.skills || []));
        teamSkills.push(...(bestCandidate?.matchingProfile?.techStack || []));
    }

    return selected;
}

/**
 * Format candidate for API response (remove sensitive data)
 */
function formatCandidateForResponse(candidate) {
    const mp = candidate.matchingProfile || {};
    const cp = candidate.contestPreferences || {};

    return {
        id: candidate._id.toString(),
        name: candidate.name,
        avatar: candidate.avatar || null,
        matchScore: Math.round(candidate.matchScore),
        scoreBreakdown: candidate.scoreBreakdown,
        matchDetails: candidate.matchDetails,
        profile: {
            primaryRole: mp.primaryRole || '',
            secondaryRoles: (mp.secondaryRoles || []).slice(0, 3),
            experienceLevel: mp.experienceLevel || '',
            location: mp.location || '',
            timeZone: mp.timeZone || '',
            skills: (mp.skills || []).slice(0, 8),
            techStack: (mp.techStack || []).slice(0, 8),
            availability: mp.availability || '',
            collaborationStyle: mp.collaborationStyle || '',
            languages: mp.languages || [],
            openToMentor: mp.openToMentor || false
        },
        contestPreferences: {
            contestInterests: (cp.contestInterests || []).slice(0, 5),
            preferredTeamRole: cp.preferredTeamRole || '',
            preferredTeamSize: cp.preferredTeamSize || ''
        }
    };
}

/**
 * Get match score between two specific users
 * @param {string} userId1 
 * @param {string} userId2 
 * @param {boolean} twoWay 
 * @returns {Promise<Object>}
 */
export async function getMatchScoreBetweenUsers(userId1, userId2, twoWay = true) {
    const usersCollection = getCollection('users');

    const [user1, user2] = await Promise.all([
        usersCollection.findOne(
            { _id: new ObjectId(userId1) },
            { projection: { name: 1, matchingProfile: 1, contestPreferences: 1, consents: 1 } }
        ),
        usersCollection.findOne(
            { _id: new ObjectId(userId2) },
            { projection: { name: 1, matchingProfile: 1, contestPreferences: 1, consents: 1 } }
        )
    ]);

    if (!user1 || !user2) {
        throw new Error('One or both users not found');
    }

    const scoreResult = twoWay
        ? calculateMutualScore(user1, user2)
        : calculateMatchScore(user1, user2);

    return {
        user1: { id: userId1, name: user1.name },
        user2: { id: userId2, name: user2.name },
        ...scoreResult,
        compatibility: getCompatibilityLabel(scoreResult.totalScore)
    };
}

/**
 * Get human-readable compatibility label
 */
function getCompatibilityLabel(score) {
    if (score >= 80) return 'Xuất sắc';
    if (score >= 65) return 'Rất phù hợp';
    if (score >= 50) return 'Khá phù hợp';
    if (score >= 35) return 'Có tiềm năng';
    return 'Cần cân nhắc';
}

/**
 * Clean expired cache entries
 */
function cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of recommendationCache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MS) {
            recommendationCache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`[Matching] Cleaned ${cleaned} expired cache entries`);
    }
}

/**
 * Clear cache for a specific user (call when profile updates)
 */
export function invalidateUserCache(userId) {
    let cleared = 0;
    for (const key of recommendationCache.keys()) {
        if (key.startsWith(userId) || key.includes(userId)) {
            recommendationCache.delete(key);
            cleared++;
        }
    }
    console.log(`[Matching] Cleared ${cleared} cache entries for user ${userId}`);
}

/**
 * Clear all cache (for testing/maintenance)
 */
export function clearAllCache() {
    const size = recommendationCache.size;
    recommendationCache.clear();
    console.log(`[Matching] Cleared entire cache (${size} entries)`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const value of recommendationCache.values()) {
        if (now - value.timestamp < CACHE_TTL_MS) {
            valid++;
        } else {
            expired++;
        }
    }

    return {
        totalEntries: recommendationCache.size,
        validEntries: valid,
        expiredEntries: expired,
        ttlMs: CACHE_TTL_MS,
        ttlHours: CACHE_TTL_MS / (60 * 60 * 1000)
    };
}

export default {
    getRecommendedTeammates,
    getMatchScoreBetweenUsers,
    invalidateUserCache,
    clearAllCache,
    getCacheStats,
    // Export for testing
    calculateMatchScore,
    calculateMutualScore,
    SCORING_WEIGHTS
};
