/**
 * Avatar Utility Functions
 * Provides consistent avatar URL generation across the admin panel
 * Synced with User App avatar system
 */

/**
 * Generate avatar URL with fallback to ui-avatars.com
 * @param avatar - User's avatar URL from database
 * @param name - User's display name for fallback generation
 * @param options - Customization options
 * @returns Avatar URL string
 */
export const getAvatarUrl = (
    avatar?: string | null,
    name?: string,
    options?: {
        size?: number;
        background?: string;
        color?: string;
    }
): string => {
    // If user has a custom avatar, use it
    if (avatar && avatar.trim() !== '') {
        return avatar;
    }

    // Generate fallback avatar using ui-avatars.com
    const {
        size = 150,
        background = '10b981', // Emerald green to match admin theme
        color = 'fff'
    } = options || {};

    const displayName = name?.trim() || 'User';
    const encodedName = encodeURIComponent(displayName);

    return `https://ui-avatars.com/api/?name=${encodedName}&background=${background}&color=${color}&size=${size}`;
};

/**
 * Generate initials from a name
 * @param name - Full name
 * @returns Initials (max 2 characters)
 */
export const getInitials = (name?: string): string => {
    if (!name || name.trim() === '') return 'U';

    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    }

    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

/**
 * Avatar URL options for different contexts
 */
export const avatarPresets = {
    // Sidebar avatar (small)
    sidebar: {
        size: 40,
        background: '10b981',
        color: 'fff'
    },
    // Profile dropdown (medium)
    profile: {
        size: 150,
        background: '10b981',
        color: 'fff'
    },
    // User list table (small)
    table: {
        size: 32,
        background: '6b7280',
        color: 'fff'
    },
    // User detail modal (large)
    detail: {
        size: 200,
        background: '10b981',
        color: 'fff'
    },
    // Large avatar (for modals)
    large: {
        size: 200,
        background: '10b981',
        color: 'fff'
    }
};
