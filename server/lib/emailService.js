/**
 * Email Service Library
 * Gửi email qua Google Apps Script (notificationService.gs)
 * Sử dụng cùng cơ chế signature với scheduler.js
 */

import crypto from 'crypto';

const SECRET_KEY = process.env.OTP_SECRET_KEY || process.env.JWT_SECRET || 'default-secret-key';
const NOTIFICATION_URL = process.env.NOTIFICATION_EMAIL_URL;

/**
 * Generate HMAC signature for Apps Script request
 * Match the signature format in notificationService.gs
 */
function generateNotifSignature(payload) {
    // canonical string: action, nonce, timestamp, [email]
    const canonicalParts = [
        'action=' + String(payload.action || ''),
        'nonce=' + String(payload.nonce || ''),
        'timestamp=' + String(payload.timestamp || '')
    ];

    if (payload.email) {
        canonicalParts.push('email=' + String(payload.email || ''));
    }

    const canonicalString = canonicalParts.join('&');
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(canonicalString);
    return hmac.digest('base64');
}

/**
 * Send notification via Apps Script
 */
async function sendNotification(data) {
    if (!NOTIFICATION_URL) {
        console.log('[EMAIL] (No NOTIFICATION_EMAIL_URL) Would send:', data.action, 'to', data.email);
        return { ok: true, method: 'log', message: 'Email logged (no URL configured)' };
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();

    const payload = {
        ...data,
        nonce,
        timestamp,
    };

    payload.signature = generateNotifSignature(payload);

    try {
        const response = await fetch(NOTIFICATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!result.ok && result.statusCode !== 200) {
            throw new Error(result.error || `Apps Script error: ${result.statusCode}`);
        }

        console.log('[EMAIL] Sent', data.action, 'to', data.email);
        return result;
    } catch (error) {
        console.error('[EMAIL] Failed to send:', error.message);
        throw error;
    }
}

/**
 * Send system notification/announcement email
 */
export async function sendSystemNotification({ to, title, message }) {
    return sendNotification({
        action: 'announcement',
        email: to,
        userName: '',
        title,
        message,
        severity: 'info'
    });
}

/**
 * Send marketing email
 */
export async function sendMarketingEmail({ to, title, content, ctaText, ctaUrl }) {
    return sendNotification({
        action: 'marketing',
        email: to,
        userName: '',
        subject: title,
        headline: title,
        content,
        ctaText: ctaText || 'Khám phá ngay',
        ctaUrl: ctaUrl || 'https://blanc.com'
    });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail({ to, userName }) {
    return sendNotification({
        action: 'welcome',
        email: to,
        userName: userName || ''
    });
}

/**
 * Send contest reminder
 */
export async function sendContestReminder({ to, userName, contestTitle, contestDate, contestTime, contestUrl, reminderType }) {
    return sendNotification({
        action: 'contestReminder',
        email: to,
        userName,
        contestTitle,
        contestDate,
        contestTime,
        contestUrl,
        reminderType: reminderType || '24h'
    });
}

export default {
    sendSystemNotification,
    sendMarketingEmail,
    sendWelcomeEmail,
    sendContestReminder,
};
