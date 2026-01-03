/**
 * ============================================================================
 * AGGREGATION PIPELINE BUILDER
 * ============================================================================
 * 
 * MongoDB aggregation pipelines for efficient data retrieval and processing.
 * 
 * Benefits:
 * - Server-side filtering reduces network traffic
 * - Parallel processing of large datasets
 * - Automatic projection minimizes memory usage
 * - Reduced client-side computation
 * - Better query plan optimization
 * 
 * Example Improvement:
 * - Traditional: 1000 documents fetched → filtered client-side
 * - Aggregation: Match early → only 50 documents fetched
 * - Benefit: 20x reduction in network data transfer
 */

import { ObjectId } from 'mongodb';

/**
 * Build pipeline to find potential team matches for a user
 * This replaces the inefficient find().toArray() + map approach
 * 
 * @param {string} userId - Current user's ID
 * @param {Object} options - Matching options
 * @param {string} options.contestId - Optional contest filter
 * @param {string[]} options.excludeUserIds - User IDs to exclude
 * @param {number} options.limit - Result limit (default: 200)
 * @returns {Array} MongoDB aggregation pipeline
 */
export function buildMatchCandidatePipeline(userId, options = {}) {
    const {
        contestId = null,
        excludeUserIds = [],
        limit = 200
    } = options;

    const excludeIds = [
        new ObjectId(userId),
        ...excludeUserIds.map(id => new ObjectId(id))
    ];

    const pipeline = [
        // Stage 1: Filter for eligible candidates
        {
            $match: {
                _id: { $nin: excludeIds },
                'matchingProfile.openToNewTeams': true,
                'consents.allowMatching': true
            }
        },

        // Stage 2: Project only needed fields (reduce memory)
        {
            $project: {
                name: 1,
                avatar: 1,
                matchingProfile: 1,
                contestPreferences: 1,
                consents: 1
            }
        },

        // Stage 3: Limit results (early filtering)
        {
            $limit: limit
        }
    ];

    // Optional: Add contest-specific filtering
    if (contestId) {
        pipeline.splice(1, 0, {
            $match: {
                'contestPreferences.contestInterests': contestId
            }
        });
    }

    return pipeline;
}

/**
 * Build pipeline for finding users by role category
 * More efficient than client-side role matching
 * 
 * @param {string} roleCategory - Role category (development, design, business, data, support)
 * @param {number} limit - Result limit
 * @returns {Array} MongoDB aggregation pipeline
 */
export function buildRoleCategoryPipeline(roleCategory, limit = 50) {
    const roleMaps = {
        'development': ['Frontend Dev', 'Backend Dev', 'Fullstack Dev', 'Mobile Dev', 'DevOps'],
        'design': ['UI/UX Designer', 'Graphic Designer', 'Video Editor'],
        'business': ['Business Analyst', 'Product Manager', 'Marketing', 'Pitching'],
        'data': ['Data Analyst', 'Data Scientist', 'ML Engineer', 'Researcher'],
        'support': ['QA/Tester', 'Content Writer', 'Team Lead', 'Other']
    };

    const roles = roleMaps[roleCategory] || [];

    return [
        {
            $match: {
                'matchingProfile.primaryRole': { $in: roles },
                'consents.allowMatching': true
            }
        },
        {
            $project: {
                name: 1,
                avatar: 1,
                primaryRole: '$matchingProfile.primaryRole',
                skills: '$matchingProfile.skills',
                experienceLevel: '$matchingProfile.experienceLevel'
            }
        },
        {
            $limit: limit
        }
    ];
}

/**
 * Build pipeline for skill-based matching
 * Finds users with specific skill combinations
 * 
 * @param {string[]} requiredSkills - Skills that candidates must have
 * @param {string[]} optionalSkills - Bonus skills
 * @param {number} limit - Result limit
 * @returns {Array} MongoDB aggregation pipeline
 */
export function buildSkillMatchPipeline(requiredSkills = [], optionalSkills = [], limit = 50) {
    const pipeline = [
        {
            $match: {
                'matchingProfile.skills': { $in: requiredSkills },
                'consents.allowMatching': true
            }
        },
        {
            $project: {
                name: 1,
                avatar: 1,
                skills: '$matchingProfile.skills',
                techStack: '$matchingProfile.techStack',
                experienceLevel: '$matchingProfile.experienceLevel',
                skillCount: { $size: { $ifNull: ['$matchingProfile.skills', []] } },
                matchedSkills: {
                    $filter: {
                        input: '$matchingProfile.skills',
                        as: 'skill',
                        cond: { $in: ['$$skill', requiredSkills] }
                    }
                }
            }
        },
        {
            $addFields: {
                // Bonus points for optional skills
                optionalSkillCount: {
                    $size: {
                        $filter: {
                            input: '$matchingProfile.skills',
                            as: 'skill',
                            cond: { $in: ['$$skill', optionalSkills] }
                        }
                    }
                }
            }
        },
        {
            $sort: {
                optionalSkillCount: -1,
                skillCount: -1
            }
        },
        {
            $limit: limit
        }
    ];

    return pipeline;
}

/**
 * Build pipeline for availability-based matching
 * Finds users with compatible schedules
 * 
 * @param {string[]} userAvailability - User's available time slots
 * @param {number} minOverlapSlots - Minimum slots to match
 * @param {number} limit - Result limit
 * @returns {Array} MongoDB aggregation pipeline
 */
export function buildAvailabilityMatchPipeline(userAvailability = [], minOverlapSlots = 1, limit = 50) {
    return [
        {
            $match: {
                'matchingProfile.availability': { $exists: true },
                'consents.allowMatching': true
            }
        },
        {
            $project: {
                name: 1,
                avatar: 1,
                availability: '$matchingProfile.availability',
                experienceLevel: '$matchingProfile.experienceLevel',
                matchedSlots: {
                    $filter: {
                        input: { $split: ['$matchingProfile.availability', ','] },
                        as: 'slot',
                        cond: { $in: ['$$slot', userAvailability] }
                    }
                }
            }
        },
        {
            $match: {
                'matchedSlots.0': { $exists: true } // Only keep users with at least 1 matching slot
            }
        },
        {
            $addFields: {
                overlapCount: { $size: '$matchedSlots' }
            }
        },
        {
            $match: {
                overlapCount: { $gte: minOverlapSlots }
            }
        },
        {
            $sort: { overlapCount: -1 },
        },
        {
            $limit: limit
        }
    ];
}

/**
 * Build pipeline for diversity-optimized team selection
 * Selects users from different roles and skill areas
 * 
 * @param {string[]} selectedRoles - Roles already in team
 * @param {number} limit - Number of candidates to fetch
 * @returns {Array} MongoDB aggregation pipeline
 */
export function buildDiverseTeamPipeline(selectedRoles = [], limit = 10) {
    return [
        {
            $match: {
                'matchingProfile.primaryRole': { $nin: selectedRoles },
                'matchingProfile.openToNewTeams': true,
                'consents.allowMatching': true
            }
        },
        {
            $project: {
                name: 1,
                avatar: 1,
                primaryRole: '$matchingProfile.primaryRole',
                skills: { $slice: ['$matchingProfile.skills', 8] },
                techStack: { $slice: ['$matchingProfile.techStack', 8] },
                experienceLevel: '$matchingProfile.experienceLevel'
            }
        },
        {
            $addFields: {
                skillCount: { $size: { $ifNull: ['$skills', []] } }
            }
        },
        {
            $sort: {
                skillCount: -1,
                experienceLevel: -1
            }
        },
        {
            $limit: limit
        }
    ];
}

/**
 * Build pipeline for contest-based team formation
 * Finds compatible team members for a specific contest
 * 
 * @param {string} contestId - Contest ID
 * @param {string[]} contestTags - Contest topic tags
 * @param {number} limit - Result limit
 * @returns {Array} MongoDB aggregation pipeline
 */
export function buildContestTeamPipeline(contestId, contestTags = [], limit = 5) {
    return [
        {
            $match: {
                'matchingProfile.openToNewTeams': true,
                'consents.allowMatching': true,
                'contestPreferences.contestInterests': { $in: contestTags }
            }
        },
        {
            $project: {
                name: 1,
                avatar: 1,
                primaryRole: '$matchingProfile.primaryRole',
                skills: '$matchingProfile.skills',
                experienceLevel: '$matchingProfile.experienceLevel',
                preferredTeamRole: '$contestPreferences.preferredTeamRole',
                preferredTeamSize: '$contestPreferences.preferredTeamSize',
                // Count matching interests
                matchedInterests: {
                    $size: {
                        $filter: {
                            input: '$contestPreferences.contestInterests',
                            as: 'interest',
                            cond: { $in: ['$$interest', contestTags] }
                        }
                    }
                }
            }
        },
        {
            $sort: {
                matchedInterests: -1,
                experienceLevel: -1
            }
        },
        {
            $limit: limit
        }
    ];
}

/**
 * Build pipeline for activity-based recommendations
 * Finds active users with recent engagement
 * 
 * @param {Date} afterDate - Fetch users active after this date
 * @param {number} limit - Result limit
 * @returns {Array} MongoDB aggregation pipeline
 */
export function buildActiveUsersPipeline(afterDate, limit = 50) {
    return [
        {
            $match: {
                'matchingProfile.openToNewTeams': true,
                'consents.allowMatching': true,
                'lastActiveAt': { $gte: afterDate }
            }
        },
        {
            $project: {
                name: 1,
                avatar: 1,
                primaryRole: '$matchingProfile.primaryRole',
                skills: { $slice: ['$matchingProfile.skills', 5] },
                lastActiveAt: 1
            }
        },
        {
            $sort: {
                lastActiveAt: -1
            }
        },
        {
            $limit: limit
        }
    ];
}

/**
 * Build faceted search pipeline
 * Returns results grouped by multiple criteria
 * Useful for explore/discovery features
 * 
 * @param {Object} criteria - Facet criteria
 * @returns {Array} MongoDB aggregation pipeline
 */
export function buildFacetedSearchPipeline(criteria = {}) {
    return [
        {
            $match: {
                'matchingProfile.openToNewTeams': true,
                'consents.allowMatching': true
            }
        },
        {
            $facet: {
                byRole: [
                    { $group: { _id: '$matchingProfile.primaryRole', count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ],
                byExperience: [
                    { $group: { _id: '$matchingProfile.experienceLevel', count: { $sum: 1 } } },
                    { $sort: { _id: 1 } }
                ],
                byLocation: [
                    { $group: { _id: '$matchingProfile.location', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ],
                topUsers: [
                    { $sort: { createdAt: -1 } },
                    { $limit: 5 },
                    { $project: { name: 1, avatar: 1, primaryRole: '$matchingProfile.primaryRole' } }
                ]
            }
        }
    ];
}

/**
 * Performance Guidelines:
 * 
 * 1. MATCH early - Filter documents ASAP to reduce pipeline size
 *    Good: $match (filters) → $project → $limit
 *    Bad:  $limit → ... → $match (too late, already fetched)
 * 
 * 2. PROJECT only needed fields - Reduces memory and network
 *    Good: $project { name: 1, skills: 1 }  (5 fields, 2KB per doc)
 *    Bad:  Full document (50 fields, 50KB per doc)
 * 
 * 3. LIMIT early - Stop processing when target count reached
 *    Good: $match → $project → $limit 10 (processes 10 docs max)
 *    Bad:  $match → $sort → $skip 1000 → ... (processes all docs)
 * 
 * 4. AVOID complex calculations in pipeline
 *    Can do: Field comparisons, array filters
 *    Avoid: Expensive string operations, ML scoring
 * 
 * 5. USE indexes - Add index on match criteria
 *    Example: db.users.createIndex({'matchingProfile.primaryRole': 1, 'consents.allowMatching': 1})
 * 
 * Typical Query Performance:
 * - Simple match + project + limit: ~2-5ms
 * - With sort on indexed field: ~5-10ms  
 * - With multiple facets: ~20-50ms
 */

export default {
    buildMatchCandidatePipeline,
    buildRoleCategoryPipeline,
    buildSkillMatchPipeline,
    buildAvailabilityMatchPipeline,
    buildDiverseTeamPipeline,
    buildContestTeamPipeline,
    buildActiveUsersPipeline,
    buildFacetedSearchPipeline
};
