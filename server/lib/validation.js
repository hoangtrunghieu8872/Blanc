/**
 * Unified validation rules used across both client and server
 * This ensures consistent validation behavior
 */

export const ValidationRules = {
    // String lengths
    EMAIL_MAX_LENGTH: 254,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 20,
    PASSWORD_MIN_LENGTH: 8,
    FIRSTNAME_MAX_LENGTH: 50,
    LASTNAME_MAX_LENGTH: 50,
    PHONE_MAX_LENGTH: 20,
    BIO_MAX_LENGTH: 500,

    // Report/Activity fields
    REPORT_TITLE_MIN_LENGTH: 5,
    REPORT_TITLE_MAX_LENGTH: 200,
    REPORT_DESCRIPTION_MIN_LENGTH: 20,
    REPORT_DESCRIPTION_MAX_LENGTH: 5000,
    REPORT_FEEDBACK_MAX_LENGTH: 2000,
    ACTIVITY_TITLE_MAX_LENGTH: 200,
    ACTIVITY_DESCRIPTION_MAX_LENGTH: 2000,
    EVIDENCE_URL_MAX_LENGTH: 1000,
    EVIDENCE_MAX_PER_ACTIVITY: 10,

    // Team/Contest fields
    TEAM_POST_TITLE_MAX_LENGTH: 100,
    TEAM_POST_DESCRIPTION_MAX_LENGTH: 1000,
    CONTEST_TITLE_MAX_LENGTH: 200,
    CONTEST_DESCRIPTION_MAX_LENGTH: 5000,
    COURSE_TITLE_MAX_LENGTH: 200,
    COURSE_DESCRIPTION_MAX_LENGTH: 5000,

    // Pagination
    DEFAULT_PAGE_LIMIT: 20,
    MAX_PAGE_LIMIT: 100,
    MIN_PAGE_LIMIT: 1,

    // Other
    OTP_LENGTH: 6,
    OTP_EXPIRY_MINUTES: 10,
    TOKEN_EXPIRY_DAYS: 1,
    CSRF_TOKEN_LENGTH: 32,
};

/**
 * Email validation
 */
export function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { isValid: false, error: 'Email is required' };
    }

    const trimmed = email.trim();
    if (trimmed.length > ValidationRules.EMAIL_MAX_LENGTH) {
        return { isValid: false, error: 'Email is too long' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return { isValid: false, error: 'Invalid email format' };
    }

    return { isValid: true };
}

/**
 * Username validation
 */
export function validateUsername(username) {
    const errors = [];

    if (!username || typeof username !== 'string') {
        return { isValid: false, errors: ['Username is required'] };
    }

    const trimmed = username.trim();

    if (trimmed.length < ValidationRules.USERNAME_MIN_LENGTH) {
        errors.push(`Username must be at least ${ValidationRules.USERNAME_MIN_LENGTH} characters`);
    }

    if (trimmed.length > ValidationRules.USERNAME_MAX_LENGTH) {
        errors.push(`Username must not exceed ${ValidationRules.USERNAME_MAX_LENGTH} characters`);
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }

    return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

/**
 * Password validation with strength requirements
 */
export function validatePassword(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
        return { isValid: false, errors: ['Password is required'], strength: 'none' };
    }

    if (password.length < ValidationRules.PASSWORD_MIN_LENGTH) {
        errors.push(`Password must be at least ${ValidationRules.PASSWORD_MIN_LENGTH} characters`);
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
        errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
        errors.push('Password must contain at least one special character');
    }

    // Calculate strength
    let strength = 'weak';
    if (password.length >= 12 && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar) {
        strength = 'strong';
    } else if (password.length >= 10 && (hasUpperCase || hasLowerCase) && hasNumbers) {
        strength = 'medium';
    }

    return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        strength,
    };
}

/**
 * URL validation
 */
export function validateUrl(url) {
    if (!url || typeof url !== 'string') {
        return { isValid: false, error: 'URL is required' };
    }

    if (url.length > ValidationRules.EVIDENCE_URL_MAX_LENGTH) {
        return { isValid: false, error: 'URL is too long' };
    }

    try {
        const urlObj = new URL(url);
        // Only allow http and https
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
        }
        return { isValid: true };
    } catch (e) {
        return { isValid: false, error: 'Invalid URL format' };
    }
}

/**
 * Pagination parameter validation
 */
export function validatePagination(page, limit) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(
        ValidationRules.MAX_PAGE_LIMIT,
        Math.max(ValidationRules.MIN_PAGE_LIMIT, parseInt(limit) || ValidationRules.DEFAULT_PAGE_LIMIT)
    );

    return {
        page: p,
        limit: l,
        skip: (p - 1) * l,
    };
}

/**
 * Sanitize input to prevent XSS attacks
 */
export function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Validate report title
 */
export function validateReportTitle(title) {
    if (!title || typeof title !== 'string') {
        return { isValid: false, error: 'Title is required' };
    }

    const trimmed = title.trim();

    if (trimmed.length < ValidationRules.REPORT_TITLE_MIN_LENGTH) {
        return {
            isValid: false,
            error: `Title must be at least ${ValidationRules.REPORT_TITLE_MIN_LENGTH} characters`,
        };
    }

    if (trimmed.length > ValidationRules.REPORT_TITLE_MAX_LENGTH) {
        return {
            isValid: false,
            error: `Title must not exceed ${ValidationRules.REPORT_TITLE_MAX_LENGTH} characters`,
        };
    }

    return { isValid: true };
}

/**
 * Validate report description
 */
export function validateReportDescription(description) {
    if (!description || typeof description !== 'string') {
        return { isValid: false, error: 'Description is required' };
    }

    const trimmed = description.trim();

    if (trimmed.length < ValidationRules.REPORT_DESCRIPTION_MIN_LENGTH) {
        return {
            isValid: false,
            error: `Description must be at least ${ValidationRules.REPORT_DESCRIPTION_MIN_LENGTH} characters`,
        };
    }

    if (trimmed.length > ValidationRules.REPORT_DESCRIPTION_MAX_LENGTH) {
        return {
            isValid: false,
            error: `Description must not exceed ${ValidationRules.REPORT_DESCRIPTION_MAX_LENGTH} characters`,
        };
    }

    return { isValid: true };
}

/**
 * Batch validation - validates multiple fields at once
 */
export function validateReportData(data) {
    const errors = {};

    const titleValidation = validateReportTitle(data.title);
    if (!titleValidation.isValid) {
        errors.title = titleValidation.error;
    }

    const descValidation = validateReportDescription(data.description);
    if (!descValidation.isValid) {
        errors.description = descValidation.error;
    }

    if (data.activities && Array.isArray(data.activities)) {
        if (data.activities.length === 0) {
            errors.activities = 'At least one activity is required';
        }

        data.activities.forEach((activity, index) => {
            if (!activity.title || activity.title.trim().length === 0) {
                errors[`activities[${index}].title`] = 'Activity title is required';
            }
            if (!activity.description || activity.description.trim().length === 0) {
                errors[`activities[${index}].description`] = 'Activity description is required';
            }
        });
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
    };
}
