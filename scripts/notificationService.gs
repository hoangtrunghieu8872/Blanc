/**
 * Blanc Notification Email Service v2.0 (Enhanced)
 *
 * Supports multiple notification types:
 * - Contest reminders (24h, 1h before)
 * - Course updates (new content)
 * - Marketing/promotional emails
 * - System announcements
 * - Welcome emails
 * - Contest registration confirmations
 * - Team notifications (join request, invite, accepted, rejected)
 * - Contest recommendations (AI-powered suggestions)
 * - Profile completion reminders
 * - Achievement notifications
 * - Bulk notifications (internal batching)
 *
 * Security:
 * - HMAC-signed requests with shared secret key
 * - Timestamp + nonce + replay protection
 * - Smart per-recipient rate limiting (hour + day + priority bypass)
 * - Optional origin allow-list (via Script Properties)
 * - Size + content-type checks
 * - Priority levels for urgent notifications
 *
 * New in v2.0:
 * - Email templates with dark mode support
 * - Tracking pixels for open rate (optional)
 * - Unsubscribe links
 * - Smart batching for bulk sends
 * - Retry logic for failed sends
 */

const NOTIF_CONFIG = Object.freeze({
  APP_NAME: 'Blanc',
  SENDER_NAME: 'Blanc',
  SUPPORT_EMAIL: 'clbflife2025thptfptcantho@gmail.com',
  SUPPORT_PHONE: '+84916007090',
  LOGO_URL: 'https://via.placeholder.com/120x40/10B981/FFFFFF?text=Blanc',
  WEBSITE_URL: 'https://blanc.com',
  PRIMARY_COLOR: '#10B981',
  SECONDARY_COLOR: '#059669',
  ACCENT_COLOR: '#6366f1',
  WARNING_COLOR: '#f59e0b',
  ERROR_COLOR: '#ef4444',
  INFO_COLOR: '#3b82f6',
  
  // Security
  SIGNATURE_MAX_SKEW_MS: 5 * 60 * 1000, // 5 minutes
  NONCE_TTL_SECONDS: 10 * 60,           // 10 minutes
  
  // Rate limits per email (tiered by priority)
  RATE_LIMIT_PER_HOUR: 10,
  RATE_LIMIT_DAILY: 50,
  RATE_LIMIT_HIGH_PRIORITY_HOUR: 20,    // Higher limit for urgent
  RATE_LIMIT_HIGH_PRIORITY_DAILY: 100,
  
  // Request hardening
  MAX_BODY_BYTES: 64 * 1024, // 64 KB (increased for rich content)
  
  // Batch settings
  BATCH_SIZE: 10,
  BATCH_DELAY_MS: 1000,
  
  // Supported actions
  SUPPORTED_ACTIONS: Object.freeze([
    // Core notifications
    'contestReminder',
    'courseUpdate',
    'marketing',
    'announcement',
    'bulk',
    'welcome',
    'contestRegistration',
    
    // Team notifications
    'team_join_request',
    'team_invite',
    'team_accepted',
    'team_rejected',
    'team_removed',
    
    // Recommendation & AI notifications
    'contest_recommendation',
    'team_match_suggestion',
    'course_recommendation',
    
    // Profile & Achievement
    'profile_incomplete',
    'achievement_unlocked',
    'leaderboard_update',
    
    // Account
    'password_reset',
    'email_verification',
    'account_warning'
  ]),
  
  // Priority levels
  PRIORITY: Object.freeze({
    LOW: 0,      // Marketing, recommendations
    NORMAL: 1,   // Updates, reminders
    HIGH: 2,     // Team invites, achievements
    URGENT: 3    // Password reset, account warnings
  })
});

let NOTIF_SETTINGS_CACHE = null;

function getNotifSettings() {
  if (NOTIF_SETTINGS_CACHE) return NOTIF_SETTINGS_CACHE;

  const props = PropertiesService.getScriptProperties();
  const secretKey = props.getProperty('NOTIFICATION_SECRET_KEY') || props.getProperty('OTP_SECRET_KEY');

  if (!secretKey) {
    throw new Error('Missing Script Property: NOTIFICATION_SECRET_KEY');
  }

  const allowedOriginsProp = props.getProperty('ALLOWED_ORIGINS') || '';
  const allowedOrigins = allowedOriginsProp
    .split(',')
    .map(function (o) { return o.trim(); })
    .filter(function (o) { return o; });

  const enableVerboseLogging = props.getProperty('ENABLE_VERBOSE_LOGGING') === 'true';
  const enableTracking = props.getProperty('ENABLE_EMAIL_TRACKING') === 'true';
  const trackingUrl = props.getProperty('TRACKING_PIXEL_URL') || '';

  NOTIF_SETTINGS_CACHE = {
    secretKey: secretKey,
    allowedOrigins: allowedOrigins,
    enableVerboseLogging: enableVerboseLogging,
    enableTracking: enableTracking,
    trackingUrl: trackingUrl
  };

  return NOTIF_SETTINGS_CACHE;
}

// ============ ACTION TO PRIORITY MAPPING ============

function getActionPriority(action) {
  const priorityMap = {
    // Urgent
    'password_reset': NOTIF_CONFIG.PRIORITY.URGENT,
    'email_verification': NOTIF_CONFIG.PRIORITY.URGENT,
    'account_warning': NOTIF_CONFIG.PRIORITY.URGENT,
    
    // High
    'team_invite': NOTIF_CONFIG.PRIORITY.HIGH,
    'team_accepted': NOTIF_CONFIG.PRIORITY.HIGH,
    'achievement_unlocked': NOTIF_CONFIG.PRIORITY.HIGH,
    'contestReminder': NOTIF_CONFIG.PRIORITY.HIGH,
    
    // Normal
    'welcome': NOTIF_CONFIG.PRIORITY.NORMAL,
    'contestRegistration': NOTIF_CONFIG.PRIORITY.NORMAL,
    'team_join_request': NOTIF_CONFIG.PRIORITY.NORMAL,
    'team_rejected': NOTIF_CONFIG.PRIORITY.NORMAL,
    'team_removed': NOTIF_CONFIG.PRIORITY.NORMAL,
    'courseUpdate': NOTIF_CONFIG.PRIORITY.NORMAL,
    'announcement': NOTIF_CONFIG.PRIORITY.NORMAL,
    'leaderboard_update': NOTIF_CONFIG.PRIORITY.NORMAL,
    
    // Low
    'marketing': NOTIF_CONFIG.PRIORITY.LOW,
    'contest_recommendation': NOTIF_CONFIG.PRIORITY.LOW,
    'team_match_suggestion': NOTIF_CONFIG.PRIORITY.LOW,
    'course_recommendation': NOTIF_CONFIG.PRIORITY.LOW,
    'profile_incomplete': NOTIF_CONFIG.PRIORITY.LOW
  };
  
  return priorityMap[action] !== undefined ? priorityMap[action] : NOTIF_CONFIG.PRIORITY.NORMAL;
}

/**
 * Main entry point for POST requests
 */
function doPost(e) {
  try {
    const settings = getNotifSettings();

    if (!e || !e.postData || !e.postData.contents) {
      return notifErrorResponse('Empty request body', 400);
    }

    const rawBody = String(e.postData.contents || '');
    
    // DEBUG: Log incoming request
    Logger.log('[DEBUG] Raw body: ' + rawBody.substring(0, 500));

    // Basic body-size guard (avoid abuse / huge payloads)
    if (NOTIF_CONFIG.MAX_BODY_BYTES && rawBody.length > NOTIF_CONFIG.MAX_BODY_BYTES) {
      return notifErrorResponse('Request body too large', 413);
    }

    // Enforce JSON content-type when provided
    const contentType = (e.postData.type || '').toLowerCase();
    if (contentType && contentType.indexOf('application/json') === -1) {
      return notifErrorResponse('Unsupported content type', 415);
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (err) {
      return notifErrorResponse('Invalid JSON', 400);
    }
    
    // DEBUG: Log parsed data
    Logger.log('[DEBUG] Parsed action: ' + data.action + ', email: ' + data.email);

    // Optional origin validation (client must send `origin` field explicitly)
    if (data.origin && settings.allowedOrigins && settings.allowedOrigins.length) {
      const origin = String(data.origin).trim();
      if (settings.allowedOrigins.indexOf(origin) === -1) {
        return notifErrorResponse('Origin not allowed', 403);
      }
    }

    // Verify signature (HMAC + timestamp + nonce + replay protection)
    try {
      verifyNotifSignature(data, settings.secretKey);
      Logger.log('[DEBUG] Signature verified successfully');
    } catch (sigErr) {
      Logger.log('[NOTIF_SIGNATURE_ERROR] ' + (sigErr.stack || sigErr));
      return notifErrorResponse(sigErr.message || 'Invalid signature', 401);
    }

    const action = data.action;

    if (NOTIF_CONFIG.SUPPORTED_ACTIONS.indexOf(action) === -1) {
      return notifErrorResponse('Unknown or unsupported action: ' + action, 400);
    }

    switch (action) {
      case 'contestReminder':
        return sendContestReminder(data, settings);
      case 'courseUpdate':
        return sendCourseUpdate(data, settings);
      case 'marketing':
        return sendMarketingEmail(data, settings);
      case 'announcement':
        return sendAnnouncement(data, settings);
      case 'bulk':
        return sendBulkNotifications(data, settings);
      case 'welcome':
        return sendWelcomeEmail(data, settings);
      case 'contestRegistration':
        return sendContestRegistrationEmail(data, settings);
      
      // Team notifications
      case 'team_join_request':
        return sendTeamJoinRequestEmail(data, settings);
      case 'team_invite':
        return sendTeamInviteEmail(data, settings);
      case 'team_accepted':
        return sendTeamAcceptedEmail(data, settings);
      case 'team_rejected':
        return sendTeamRejectedEmail(data, settings);
      case 'team_removed':
        return sendTeamRemovedEmail(data, settings);
      
      // Recommendation notifications
      case 'contest_recommendation':
        return sendContestRecommendationEmail(data, settings);
      case 'team_match_suggestion':
        return sendTeamMatchSuggestionEmail(data, settings);
      case 'course_recommendation':
        return sendCourseRecommendationEmail(data, settings);
      
      // Profile & Achievement
      case 'profile_incomplete':
        return sendProfileIncompleteEmail(data, settings);
      case 'achievement_unlocked':
        return sendAchievementUnlockedEmail(data, settings);
      case 'leaderboard_update':
        return sendLeaderboardUpdateEmail(data, settings);
      
      // Account
      case 'password_reset':
        return sendPasswordResetEmail(data, settings);
      case 'email_verification':
        return sendEmailVerificationEmail(data, settings);
      case 'account_warning':
        return sendAccountWarningEmail(data, settings);
        
      default:
        return notifErrorResponse('Unknown action: ' + action, 400);
    }
  } catch (err) {
    Logger.log('[NOTIF_ERROR] ' + (err.stack || err));
    return notifErrorResponse('Internal error', 500);
  }
}

/**
 * Health check
 */
function doGet(e) {
  return notifCreateResponse({
    ok: true,
    service: 'Blanc Notification Service',
    timestamp: new Date().toISOString(),
    supportedActions: NOTIF_CONFIG.SUPPORTED_ACTIONS
  }, 200);
}

// ============ RATE LIMITING (Smart Tiered) ============

function createRateLimitError(message) {
  const err = new Error(message || 'Rate limited');
  err.name = 'RateLimitError';
  return err;
}

function enforceRateLimit(email, action) {
  if (!email) return; // nothing to do

  const normalizedEmail = String(email).trim().toLowerCase();
  const now = new Date();
  const hourBucket = Utilities.formatDate(now, 'Etc/UTC', 'yyyyMMddHH');
  const dayBucket = Utilities.formatDate(now, 'Etc/UTC', 'yyyyMMdd');

  const cache = CacheService.getScriptCache();
  const priority = getActionPriority(action);

  const hourKey = 'notif_rl_h:' + normalizedEmail + ':' + hourBucket;
  const dayKey = 'notif_rl_d:' + normalizedEmail + ':' + dayBucket;

  const hourCount = parseInt(cache.get(hourKey) || '0', 10);
  const dayCount = parseInt(cache.get(dayKey) || '0', 10);

  // Get limits based on priority
  const hourLimit = priority >= NOTIF_CONFIG.PRIORITY.HIGH 
    ? NOTIF_CONFIG.RATE_LIMIT_HIGH_PRIORITY_HOUR 
    : NOTIF_CONFIG.RATE_LIMIT_PER_HOUR;
  const dayLimit = priority >= NOTIF_CONFIG.PRIORITY.HIGH 
    ? NOTIF_CONFIG.RATE_LIMIT_HIGH_PRIORITY_DAILY 
    : NOTIF_CONFIG.RATE_LIMIT_DAILY;

  // Urgent priority bypasses rate limiting
  if (priority === NOTIF_CONFIG.PRIORITY.URGENT) {
    // Still increment counters but don't enforce limits
    cache.put(hourKey, String(hourCount + 1), 60 * 60);
    cache.put(dayKey, String(dayCount + 1), 24 * 60 * 60);
    return;
  }

  if (hourCount >= hourLimit) {
    throw createRateLimitError('Hourly rate limit exceeded (' + hourLimit + '/hour)');
  }

  if (dayCount >= dayLimit) {
    throw createRateLimitError('Daily rate limit exceeded (' + dayLimit + '/day)');
  }

  // Best-effort increments (not strictly atomic but sufficient for this workload)
  cache.put(hourKey, String(hourCount + 1), 60 * 60);         // 1 hour
  cache.put(dayKey, String(dayCount + 1), 24 * 60 * 60);      // 1 day
}

// ============ NOTIFICATION HANDLERS ============

/**
 * Send contest reminder email
 */
function sendContestReminder(data, settings) {
  const { email, userName, contestTitle, contestDate, contestTime, contestUrl, reminderType } = data;

  if (!email || !contestTitle) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const isUrgent = reminderType === '1h';
  const timeLabel = isUrgent ? '1 giờ nữa' : '24 giờ nữa';
  const icon = isUrgent ? '🔔' : '📅';

  const subject = icon + ' Nhắc nhở: ' + contestTitle + ' sẽ bắt đầu sau ' + timeLabel;

  const htmlBody = generateContestReminderHtml({
    userName: userName || 'bạn',
    contestTitle,
    contestDate,
    contestTime,
    contestUrl,
    timeLabel,
    isUrgent
  });

  const textBody = generateContestReminderText({
    userName: userName || 'bạn',
    contestTitle,
    contestDate,
    contestTime,
    contestUrl,
    timeLabel
  });

  try {
    enforceRateLimit(email, 'contestReminder');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: textBody,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Contest reminder sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      Logger.log('[CONTEST_REMINDER_RATELIMIT] ' + err.message);
      return notifErrorResponse(err.message, 429);
    }
    Logger.log('[CONTEST_REMINDER_ERROR] ' + err);
    return notifErrorResponse('Failed to send email', 500);
  }
}

/**
 * Send course update notification
 */
function sendCourseUpdate(data, settings) {
  const { email, userName, courseTitle, updateType, updateTitle, courseUrl } = data;

  if (!email || !courseTitle) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '📚 Cập nhật mới: ' + courseTitle;

  const htmlBody = generateCourseUpdateHtml({
    userName: userName || 'bạn',
    courseTitle,
    updateType: updateType || 'lesson',
    updateTitle: updateTitle || 'Nội dung mới',
    courseUrl
  });

  const textBody = generateCourseUpdateText({
    userName: userName || 'bạn',
    courseTitle,
    updateType: updateType || 'lesson',
    updateTitle: updateTitle || 'Nội dung mới',
    courseUrl
  });

  try {
    enforceRateLimit(email, 'courseUpdate');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: textBody,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Course update sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      Logger.log('[COURSE_UPDATE_RATELIMIT] ' + err.message);
      return notifErrorResponse(err.message, 429);
    }
    Logger.log('[COURSE_UPDATE_ERROR] ' + err);
    return notifErrorResponse('Failed to send email', 500);
  }
}

/**
 * Send marketing/promotional email
 */
function sendMarketingEmail(data, settings) {
  const { email, userName, subject, headline, content, ctaText, ctaUrl } = data;

  if (!email || !subject || !content) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const htmlBody = generateMarketingHtml({
    userName: userName || 'bạn',
    headline: headline || subject,
    content,
    ctaText: ctaText || 'Khám phá ngay',
    ctaUrl: ctaUrl || 'https://blanc.com'
  });

  const textBody = generateMarketingText({
    userName: userName || 'bạn',
    headline: headline || subject,
    content,
    ctaUrl: ctaUrl || 'https://blanc.com'
  });

  try {
    enforceRateLimit(email, 'marketing');

    MailApp.sendEmail({
      to: email,
      subject: '🎉 ' + subject,
      htmlBody: htmlBody,
      body: textBody,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Marketing email sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      Logger.log('[MARKETING_RATELIMIT] ' + err.message);
      return notifErrorResponse(err.message, 429);
    }
    Logger.log('[MARKETING_ERROR] ' + err);
    return notifErrorResponse('Failed to send email', 500);
  }
}

/**
 * Send system announcement
 */
function sendAnnouncement(data, settings) {
  const { email, userName, title, message, severity } = data;

  if (!email || !title || !message) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const icons = { info: 'ℹ️', warning: '⚠️', success: '✅', urgent: '🚨' };
  const icon = icons[severity] || icons.info;

  const subject = icon + ' ' + title;

  const htmlBody = generateAnnouncementHtml({
    userName: userName || 'bạn',
    title,
    message,
    severity: severity || 'info'
  });

  const textBody = generateAnnouncementText({
    userName: userName || 'bạn',
    title,
    message
  });

  try {
    enforceRateLimit(email, 'announcement');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: textBody,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Announcement sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      Logger.log('[ANNOUNCEMENT_RATELIMIT] ' + err.message);
      return notifErrorResponse(err.message, 429);
    }
    Logger.log('[ANNOUNCEMENT_ERROR] ' + err);
    return notifErrorResponse('Failed to send email', 500);
  }
}

/**
 * Send bulk notifications (batch processing)
 *
 * NOTE: This is intended to be called from the backend via the `bulk` action
 * and not directly exposed to untrusted clients.
 */
function sendBulkNotifications(data, settings) {
  const { notifications } = data;

  if (!notifications || !Array.isArray(notifications)) {
    return notifErrorResponse('Missing notifications array', 400);
  }

  const results = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < notifications.length; i++) {
    const notif = notifications[i];
    try {
      let result;
      switch (notif.type) {
        case 'contestReminder':
          result = sendContestReminder(notif, settings);
          break;
        case 'courseUpdate':
          result = sendCourseUpdate(notif, settings);
          break;
        default:
          results.failed++;
          results.errors.push({ index: i, error: 'Unknown type' });
          continue;
      }

      const resultData = JSON.parse(result.getContent());
      if (resultData.ok) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({ index: i, error: resultData.error });
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ index: i, error: err.message });
    }

    // Avoid rate limiting / quota spikes
    if (i > 0 && i % 10 === 0) {
      Utilities.sleep(1000);
    }
  }

  return notifCreateResponse({
    ok: true,
    message: 'Bulk send completed',
    results
  }, 200);
}

/**
 * Send welcome email for new user registration
 */
function sendWelcomeEmail(data, settings) {
  const { email, userName } = data;

  if (!email) {
    return notifErrorResponse('Missing email', 400);
  }

  const subject = '🎉 Chào mừng bạn đến với Blanc!';

  const htmlBody = generateWelcomeHtml({
    userName: userName || 'bạn'
  });

  const textBody = generateWelcomeText({
    userName: userName || 'bạn'
  });

  try {
    enforceRateLimit(email, 'welcome');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: textBody,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Welcome email sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      Logger.log('[WELCOME_EMAIL_RATELIMIT] ' + err.message);
      return notifErrorResponse(err.message, 429);
    }
    Logger.log('[WELCOME_EMAIL_ERROR] ' + err);
    return notifErrorResponse('Failed to send email', 500);
  }
}

/**
 * Send contest registration confirmation email
 */
function sendContestRegistrationEmail(data, settings) {
  const { email, userName, contestTitle, contestDate, contestTime, contestUrl, organizerName } = data;

  if (!email || !contestTitle) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '✅ Đăng ký thành công: ' + contestTitle;

  const htmlBody = generateContestRegistrationHtml({
    userName: userName || 'bạn',
    contestTitle,
    contestDate,
    contestTime,
    contestUrl,
    organizerName: organizerName || 'Blanc'
  });

  const textBody = generateContestRegistrationText({
    userName: userName || 'bạn',
    contestTitle,
    contestDate,
    contestTime,
    contestUrl,
    organizerName: organizerName || 'Blanc'
  });

  try {
    enforceRateLimit(email, 'contestRegistration');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: textBody,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Registration confirmation sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      Logger.log('[CONTEST_REG_EMAIL_RATELIMIT] ' + err.message);
      return notifErrorResponse(err.message, 429);
    }
    Logger.log('[CONTEST_REG_EMAIL_ERROR] ' + err);
    return notifErrorResponse('Failed to send email', 500);
  }
}

/**
 * Send team join request notification email
 */
function sendTeamJoinRequestEmail(data, settings) {
  const { email, recipientName, requesterName, teamTitle, message, teamPostUrl } = data;

  if (!email || !teamTitle || !requesterName) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '👥 Yêu cầu tham gia nhóm: ' + teamTitle;

  const htmlBody = generateTeamJoinRequestHtml({
    recipientName: recipientName || 'bạn',
    requesterName,
    teamTitle,
    message: message || 'Không có lời nhắn',
    teamPostUrl
  });

  const textBody = generateTeamJoinRequestText({
    recipientName: recipientName || 'bạn',
    requesterName,
    teamTitle,
    message: message || 'Không có lời nhắn',
    teamPostUrl
  });

  try {
    enforceRateLimit(email, 'team_join_request');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: textBody,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Team join request notification sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      Logger.log('[TEAM_JOIN_EMAIL_RATELIMIT] ' + err.message);
      return notifErrorResponse(err.message, 429);
    }
    Logger.log('[TEAM_JOIN_EMAIL_ERROR] ' + err);
    return notifErrorResponse('Failed to send email', 500);
  }
}

/**
 * Generate HTML for team join request email
 */
function generateTeamJoinRequestHtml(data) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background: linear-gradient(135deg, ' + NOTIF_CONFIG.ACCENT_COLOR + ' 0%, #4f46e5 100%);padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">👥 Yêu cầu tham gia nhóm</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.recipientName) + '</strong>,</p>' +
    '<p style="color:#475569;font-size:15px;line-height:1.6;">Có người muốn tham gia nhóm của bạn!</p>' +
    '<div style="background:#f0f9ff;border-left:4px solid ' + NOTIF_CONFIG.ACCENT_COLOR + ';padding:20px;margin:20px 0;border-radius:0 8px 8px 0;">' +
    '<p style="color:#1e40af;margin:0 0 10px 0;font-size:16px;"><strong>' + escapeHtmlNotif(data.requesterName) + '</strong> muốn tham gia nhóm:</p>' +
    '<h2 style="color:#1e3a8a;margin:0 0 15px 0;font-size:18px;">🏆 ' + escapeHtmlNotif(data.teamTitle) + '</h2>' +
    '<div style="background:#fff;padding:15px;border-radius:8px;margin-top:10px;">' +
    '<p style="color:#64748b;margin:0 0 5px 0;font-size:13px;font-weight:bold;">💬 Lời nhắn:</p>' +
    '<p style="color:#475569;margin:0;font-size:14px;font-style:italic;">"' + escapeHtmlNotif(data.message) + '"</p>' +
    '</div>' +
    '</div>' +
    (data.teamPostUrl ? '<div style="text-align:center;margin:25px 0;"><a href="' + escapeHtmlNotif(data.teamPostUrl) + '" style="display:inline-block;background:' + NOTIF_CONFIG.ACCENT_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Xem và phản hồi yêu cầu</a></div>' : '') +
    '<p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:30px;">Hãy phản hồi sớm để không bỏ lỡ ứng viên tốt! 🚀</p>' +
    '</td></tr>' +
    '<tr><td style="background:#f1f5f9;padding:20px;text-align:center;">' +
    '<p style="color:#94a3b8;font-size:12px;margin:0;">Email này được gửi tự động từ ' + NOTIF_CONFIG.APP_NAME + '</p>' +
    '</td></tr></table></td></tr></table></body></html>';
}

/**
 * Generate plain text for team join request email
 */
function generateTeamJoinRequestText(data) {
  return 'Xin chào ' + data.recipientName + ',\n\n' +
    data.requesterName + ' muốn tham gia nhóm "' + data.teamTitle + '" của bạn.\n\n' +
    'Lời nhắn: "' + data.message + '"\n\n' +
    (data.teamPostUrl ? 'Xem và phản hồi: ' + data.teamPostUrl + '\n\n' : '') +
    'Hãy phản hồi sớm để không bỏ lỡ ứng viên tốt!\n\n' +
    '-- ' + NOTIF_CONFIG.APP_NAME;
}

// ============ TEAM INVITE EMAIL ============

/**
 * Send team invite notification email
 */
function sendTeamInviteEmail(data, settings) {
  const { email, recipientName, inviterName, teamTitle, teamDescription, role, teamPostUrl } = data;

  if (!email || !teamTitle || !inviterName) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '🎯 Bạn được mời tham gia nhóm: ' + teamTitle;

  const htmlBody = generateTeamInviteHtml({
    recipientName: recipientName || 'bạn',
    inviterName,
    teamTitle,
    teamDescription: teamDescription || '',
    role: role || 'Thành viên',
    teamPostUrl
  });

  const textBody = generateTeamInviteText({
    recipientName: recipientName || 'bạn',
    inviterName,
    teamTitle,
    role: role || 'Thành viên',
    teamPostUrl
  });

  try {
    enforceRateLimit(email, 'team_invite');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: textBody,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Team invite sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    Logger.log('[TEAM_INVITE_ERROR] ' + err);
    return notifErrorResponse('Failed to send email', 500);
  }
}

function generateTeamInviteHtml(data) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">🎯 Lời mời tham gia nhóm</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.recipientName) + '</strong>,</p>' +
    '<p style="color:#475569;font-size:15px;line-height:1.6;"><strong>' + escapeHtmlNotif(data.inviterName) + '</strong> đã mời bạn tham gia nhóm của họ!</p>' +
    '<div style="background:#f5f3ff;border-left:4px solid #8b5cf6;padding:20px;margin:20px 0;border-radius:0 8px 8px 0;">' +
    '<h2 style="color:#5b21b6;margin:0 0 10px 0;font-size:18px;">🏆 ' + escapeHtmlNotif(data.teamTitle) + '</h2>' +
    '<p style="color:#7c3aed;margin:0 0 10px 0;font-size:14px;">Vai trò: <strong>' + escapeHtmlNotif(data.role) + '</strong></p>' +
    (data.teamDescription ? '<p style="color:#6b7280;margin:0;font-size:13px;">' + escapeHtmlNotif(data.teamDescription) + '</p>' : '') +
    '</div>' +
    (data.teamPostUrl ? '<div style="text-align:center;margin:25px 0;"><a href="' + escapeHtmlNotif(data.teamPostUrl) + '" style="display:inline-block;background:#8b5cf6;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Xem chi tiết & Phản hồi</a></div>' : '') +
    '<p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:30px;">Đây là cơ hội tuyệt vời để tham gia cuộc thi cùng đội! 🚀</p>' +
    '</td></tr>' +
    generateEmailFooter() +
    '</table></td></tr></table></body></html>';
}

function generateTeamInviteText(data) {
  return 'Xin chào ' + data.recipientName + ',\n\n' +
    data.inviterName + ' đã mời bạn tham gia nhóm "' + data.teamTitle + '".\n' +
    'Vai trò: ' + data.role + '\n\n' +
    (data.teamPostUrl ? 'Xem chi tiết: ' + data.teamPostUrl + '\n\n' : '') +
    '-- ' + NOTIF_CONFIG.APP_NAME;
}

// ============ TEAM ACCEPTED EMAIL ============

function sendTeamAcceptedEmail(data, settings) {
  const { email, userName, memberName, teamTitle, teamPostUrl } = data;

  if (!email || !teamTitle) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '✅ Chúc mừng! Bạn đã được chấp nhận vào nhóm';

  const htmlBody = generateTeamAcceptedHtml({
    userName: userName || 'bạn',
    memberName,
    teamTitle,
    teamPostUrl
  });

  try {
    enforceRateLimit(email, 'team_accepted');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Bạn đã được chấp nhận vào nhóm ' + teamTitle,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Team accepted notification sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

function generateTeamAcceptedHtml(data) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background: linear-gradient(135deg, ' + NOTIF_CONFIG.PRIMARY_COLOR + ' 0%, ' + NOTIF_CONFIG.SECONDARY_COLOR + ' 100%);padding:40px;text-align:center;">' +
    '<div style="font-size:48px;margin-bottom:10px;">🎉</div>' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">Chúc mừng!</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;text-align:center;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName) + '</strong>,</p>' +
    '<p style="color:#166534;font-size:18px;font-weight:bold;margin:20px 0;">Bạn đã được chấp nhận vào nhóm!</p>' +
    '<div style="background:#f0fdf4;border-radius:12px;padding:25px;margin:20px 0;">' +
    '<h2 style="color:#166534;margin:0;font-size:20px;">🏆 ' + escapeHtmlNotif(data.teamTitle) + '</h2>' +
    '</div>' +
    '<p style="color:#475569;font-size:14px;line-height:1.6;">Hãy liên hệ với đội trưởng để bắt đầu chuẩn bị cho cuộc thi!</p>' +
    (data.teamPostUrl ? '<div style="margin:25px 0;"><a href="' + escapeHtmlNotif(data.teamPostUrl) + '" style="display:inline-block;background:' + NOTIF_CONFIG.PRIMARY_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Xem nhóm của bạn</a></div>' : '') +
    '</td></tr>' +
    generateEmailFooter() +
    '</table></td></tr></table></body></html>';
}

// ============ TEAM REJECTED EMAIL ============

function sendTeamRejectedEmail(data, settings) {
  const { email, userName, teamTitle, reason } = data;

  if (!email || !teamTitle) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '📋 Cập nhật về yêu cầu tham gia nhóm';

  const htmlBody = generateTeamRejectedHtml({
    userName: userName || 'bạn',
    teamTitle,
    reason: reason || ''
  });

  try {
    enforceRateLimit(email, 'team_rejected');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Yêu cầu tham gia nhóm ' + teamTitle + ' chưa được chấp nhận.',
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Team rejected notification sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

function generateTeamRejectedHtml(data) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background:#64748b;padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">📋 Cập nhật yêu cầu</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName) + '</strong>,</p>' +
    '<p style="color:#475569;font-size:15px;line-height:1.6;">Rất tiếc, yêu cầu tham gia nhóm <strong>"' + escapeHtmlNotif(data.teamTitle) + '"</strong> của bạn chưa được chấp nhận lần này.</p>' +
    (data.reason ? '<div style="background:#f1f5f9;border-radius:8px;padding:15px;margin:20px 0;"><p style="color:#64748b;margin:0;font-size:14px;"><strong>Lý do:</strong> ' + escapeHtmlNotif(data.reason) + '</p></div>' : '') +
    '<div style="background:#fffbeb;border-radius:8px;padding:15px;margin:20px 0;">' +
    '<p style="color:#92400e;margin:0;font-size:14px;">💡 <strong>Đừng nản lòng!</strong> Có rất nhiều đội khác đang tìm kiếm thành viên. Hãy tiếp tục khám phá!</p>' +
    '</div>' +
    '<div style="text-align:center;margin:25px 0;"><a href="' + NOTIF_CONFIG.WEBSITE_URL + '/community" style="display:inline-block;background:' + NOTIF_CONFIG.ACCENT_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Tìm đội khác</a></div>' +
    '</td></tr>' +
    generateEmailFooter() +
    '</table></td></tr></table></body></html>';
}

// ============ TEAM REMOVED EMAIL ============

function sendTeamRemovedEmail(data, settings) {
  const { email, userName, teamTitle, reason } = data;

  if (!email || !teamTitle) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '👥 Bạn đã rời khỏi nhóm: ' + teamTitle;

  try {
    enforceRateLimit(email, 'team_removed');

    const htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
      '<table width="100%" style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
      '<tr><td style="padding:30px;">' +
      '<p style="color:#64748b;">Xin chào <strong>' + escapeHtmlNotif(userName || 'bạn') + '</strong>,</p>' +
      '<p style="color:#475569;">Bạn đã rời khỏi nhóm <strong>"' + escapeHtmlNotif(teamTitle) + '"</strong>.</p>' +
      (reason ? '<p style="color:#64748b;font-size:14px;">Lý do: ' + escapeHtmlNotif(reason) + '</p>' : '') +
      '<p style="color:#64748b;">Bạn có thể tìm kiếm các đội khác phù hợp với bạn.</p>' +
      '</td></tr>' +
      generateEmailFooter() +
      '</table></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Bạn đã rời khỏi nhóm ' + teamTitle,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Team removed notification sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

// ============ CONTEST RECOMMENDATION EMAIL ============

function sendContestRecommendationEmail(data, settings) {
  const { email, userName, contests } = data;

  if (!email || !contests || !contests.length) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '🎯 Cuộc thi phù hợp với bạn tuần này';

  const htmlBody = generateContestRecommendationHtml({
    userName: userName || 'bạn',
    contests: contests.slice(0, 5) // Max 5 contests
  });

  try {
    enforceRateLimit(email, 'contest_recommendation');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Chúng tôi đã tìm thấy ' + contests.length + ' cuộc thi phù hợp với bạn.',
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Contest recommendation sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

function generateContestRecommendationHtml(data) {
  let contestCards = '';
  for (let i = 0; i < data.contests.length; i++) {
    const c = data.contests[i];
    contestCards += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:15px;margin:10px 0;">' +
      '<h3 style="color:#1e293b;margin:0 0 8px 0;font-size:16px;">' + escapeHtmlNotif(c.title) + '</h3>' +
      '<p style="color:#64748b;margin:0 0 8px 0;font-size:13px;">🏢 ' + escapeHtmlNotif(c.organizer || 'Blanc') + '</p>' +
      '<p style="color:#64748b;margin:0 0 12px 0;font-size:13px;">📅 ' + escapeHtmlNotif(c.dateStart || 'Sắp diễn ra') + '</p>' +
      (c.matchScore ? '<div style="display:inline-block;background:#dcfce7;color:#166534;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;">✨ Phù hợp ' + c.matchScore + '%</div>' : '') +
      (c.url ? '<a href="' + escapeHtmlNotif(c.url) + '" style="display:block;margin-top:12px;color:' + NOTIF_CONFIG.PRIMARY_COLOR + ';font-size:13px;text-decoration:none;">Xem chi tiết →</a>' : '') +
      '</div>';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.PRIMARY_COLOR + ' 0%, ' + NOTIF_CONFIG.ACCENT_COLOR + ' 100%);padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">🎯 Cuộc thi dành cho bạn</h1>' +
    '<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;font-size:14px;">Được gợi ý dựa trên profile của bạn</p>' +
    '</td></tr>' +
    '<tr><td style="padding:25px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName) + '</strong>,</p>' +
    '<p style="color:#475569;font-size:15px;">Chúng tôi đã tìm thấy một số cuộc thi phù hợp với kỹ năng và sở thích của bạn:</p>' +
    '<div style="margin:20px 0;">' + contestCards + '</div>' +
    '<div style="text-align:center;margin:25px 0;"><a href="' + NOTIF_CONFIG.WEBSITE_URL + '/contests" style="display:inline-block;background:' + NOTIF_CONFIG.PRIMARY_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Xem tất cả cuộc thi</a></div>' +
    '</td></tr>' +
    generateEmailFooter() +
    '</table></td></tr></table></body></html>';
}

// ============ TEAM MATCH SUGGESTION EMAIL ============

function sendTeamMatchSuggestionEmail(data, settings) {
  const { email, userName, teams } = data;

  if (!email || !teams || !teams.length) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '👥 Đội phù hợp với bạn - Đừng bỏ lỡ!';

  const htmlBody = generateTeamMatchSuggestionHtml({
    userName: userName || 'bạn',
    teams: teams.slice(0, 3)
  });

  try {
    enforceRateLimit(email, 'team_match_suggestion');

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Chúng tôi đã tìm thấy ' + teams.length + ' đội phù hợp với bạn.',
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Team match suggestion sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

function generateTeamMatchSuggestionHtml(data) {
  let teamCards = '';
  for (let i = 0; i < data.teams.length; i++) {
    const t = data.teams[i];
    teamCards += '<div style="background:#f8fafc;border-radius:12px;padding:20px;margin:15px 0;">' +
      '<div style="display:flex;align-items:center;margin-bottom:12px;">' +
      '<div style="width:40px;height:40px;border-radius:50%;background:' + NOTIF_CONFIG.ACCENT_COLOR + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;margin-right:12px;">' + (t.leaderName ? t.leaderName.charAt(0).toUpperCase() : 'T') + '</div>' +
      '<div><h3 style="color:#1e293b;margin:0;font-size:16px;">' + escapeHtmlNotif(t.title) + '</h3>' +
      '<p style="color:#64748b;margin:0;font-size:13px;">👤 ' + escapeHtmlNotif(t.leaderName || 'Team Leader') + '</p></div>' +
      '</div>' +
      '<p style="color:#64748b;font-size:13px;margin:0 0 10px 0;">🎯 ' + escapeHtmlNotif(t.contestTitle || 'Cuộc thi') + '</p>' +
      '<p style="color:#64748b;font-size:13px;margin:0 0 10px 0;">🔍 Cần: ' + escapeHtmlNotif((t.rolesNeeded || []).join(', ')) + '</p>' +
      (t.matchScore ? '<div style="display:inline-block;background:#dbeafe;color:#1d4ed8;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;">⭐ Phù hợp ' + t.matchScore + '%</div>' : '') +
      '</div>';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.ACCENT_COLOR + ' 0%, #4f46e5 100%);padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">👥 Đội đang tìm bạn!</h1>' +
    '<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;font-size:14px;">Matching dựa trên kỹ năng của bạn</p>' +
    '</td></tr>' +
    '<tr><td style="padding:25px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName) + '</strong>,</p>' +
    '<p style="color:#475569;font-size:15px;">Các đội này đang tìm người với kỹ năng như bạn:</p>' +
    teamCards +
    '<div style="text-align:center;margin:25px 0;"><a href="' + NOTIF_CONFIG.WEBSITE_URL + '/community" style="display:inline-block;background:' + NOTIF_CONFIG.ACCENT_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Xem tất cả đội</a></div>' +
    '</td></tr>' +
    generateEmailFooter() +
    '</table></td></tr></table></body></html>';
}

// ============ COURSE RECOMMENDATION EMAIL ============

function sendCourseRecommendationEmail(data, settings) {
  const { email, userName, courses } = data;

  if (!email || !courses || !courses.length) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '📚 Khóa học được đề xuất cho bạn';

  try {
    enforceRateLimit(email, 'course_recommendation');

    let courseList = '';
    for (let i = 0; i < Math.min(courses.length, 3); i++) {
      const c = courses[i];
      courseList += '<div style="background:#f8fafc;border-radius:8px;padding:15px;margin:10px 0;">' +
        '<h4 style="color:#1e293b;margin:0 0 5px 0;">' + escapeHtmlNotif(c.title) + '</h4>' +
        '<p style="color:#64748b;margin:0;font-size:13px;">👨‍🏫 ' + escapeHtmlNotif(c.instructor || 'Giảng viên') + '</p>' +
        '</div>';
    }

    const htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
      '<table width="100%" style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
      '<tr><td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:30px;text-align:center;">' +
      '<h1 style="color:#fff;margin:0;font-size:24px;">📚 Khóa học cho bạn</h1></td></tr>' +
      '<tr><td style="padding:25px;">' +
      '<p style="color:#64748b;">Xin chào <strong>' + escapeHtmlNotif(userName || 'bạn') + '</strong>,</p>' +
      '<p style="color:#475569;">Dựa trên sở thích của bạn, chúng tôi gợi ý:</p>' +
      courseList +
      '<div style="text-align:center;margin:25px 0;"><a href="' + NOTIF_CONFIG.WEBSITE_URL + '/marketplace" style="display:inline-block;background:#f59e0b;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Khám phá thêm</a></div>' +
      '</td></tr>' +
      generateEmailFooter() +
      '</table></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Chúng tôi đã tìm thấy ' + courses.length + ' khóa học phù hợp với bạn.',
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Course recommendation sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

// ============ PROFILE INCOMPLETE REMINDER ============

function sendProfileIncompleteEmail(data, settings) {
  const { email, userName, completionPercent, missingFields } = data;

  if (!email) {
    return notifErrorResponse('Missing email', 400);
  }

  const subject = '📝 Hoàn thiện profile để được gợi ý tốt hơn!';

  try {
    enforceRateLimit(email, 'profile_incomplete');

    const missing = missingFields || [];
    let missingList = '';
    for (let i = 0; i < missing.length; i++) {
      missingList += '<li style="color:#64748b;margin:5px 0;">' + escapeHtmlNotif(missing[i]) + '</li>';
    }

    const htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
      '<table width="100%" style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
      '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.INFO_COLOR + ' 0%,#2563eb 100%);padding:30px;text-align:center;">' +
      '<h1 style="color:#fff;margin:0;font-size:24px;">📝 Hoàn thiện Profile</h1></td></tr>' +
      '<tr><td style="padding:25px;">' +
      '<p style="color:#64748b;">Xin chào <strong>' + escapeHtmlNotif(userName || 'bạn') + '</strong>,</p>' +
      '<p style="color:#475569;">Profile của bạn đã hoàn thiện <strong>' + (completionPercent || 0) + '%</strong>. Hoàn thiện thêm để:</p>' +
      '<ul style="color:#475569;padding-left:20px;">' +
      '<li>Được gợi ý cuộc thi phù hợp hơn</li>' +
      '<li>Matching với đội chính xác hơn</li>' +
      '<li>Tăng cơ hội được mời vào các đội</li>' +
      '</ul>' +
      (missingList ? '<p style="color:#64748b;font-weight:bold;margin-top:20px;">Các mục cần bổ sung:</p><ul style="padding-left:20px;">' + missingList + '</ul>' : '') +
      '<div style="text-align:center;margin:25px 0;"><a href="' + NOTIF_CONFIG.WEBSITE_URL + '/profile?tab=settings" style="display:inline-block;background:' + NOTIF_CONFIG.INFO_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Hoàn thiện ngay</a></div>' +
      '</td></tr>' +
      generateEmailFooter() +
      '</table></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Hoàn thiện profile để được gợi ý tốt hơn!',
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Profile incomplete reminder sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

// ============ ACHIEVEMENT UNLOCKED EMAIL ============

function sendAchievementUnlockedEmail(data, settings) {
  const { email, userName, achievementName, achievementDescription, achievementIcon } = data;

  if (!email || !achievementName) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '🏅 Chúc mừng! Bạn đã mở khóa thành tích mới!';

  try {
    enforceRateLimit(email, 'achievement_unlocked');

    const htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
      '<table width="100%" style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
      '<tr><td style="background:linear-gradient(135deg,#f59e0b 0%,#eab308 100%);padding:40px;text-align:center;">' +
      '<div style="font-size:64px;margin-bottom:15px;">' + (achievementIcon || '🏅') + '</div>' +
      '<h1 style="color:#fff;margin:0;font-size:24px;">Thành tích mới!</h1></td></tr>' +
      '<tr><td style="padding:30px;text-align:center;">' +
      '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(userName || 'bạn') + '</strong>,</p>' +
      '<div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:16px;padding:25px;margin:20px 0;">' +
      '<h2 style="color:#92400e;margin:0 0 10px 0;font-size:22px;">' + escapeHtmlNotif(achievementName) + '</h2>' +
      (achievementDescription ? '<p style="color:#b45309;margin:0;font-size:14px;">' + escapeHtmlNotif(achievementDescription) + '</p>' : '') +
      '</div>' +
      '<p style="color:#475569;font-size:14px;">Tiếp tục cố gắng để mở khóa thêm nhiều thành tích khác! 💪</p>' +
      '<div style="margin:25px 0;"><a href="' + NOTIF_CONFIG.WEBSITE_URL + '/profile" style="display:inline-block;background:#f59e0b;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Xem thành tích</a></div>' +
      '</td></tr>' +
      generateEmailFooter() +
      '</table></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Chúc mừng! Bạn đã mở khóa thành tích: ' + achievementName,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Achievement notification sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

// ============ LEADERBOARD UPDATE EMAIL ============

function sendLeaderboardUpdateEmail(data, settings) {
  const { email, userName, currentRank, previousRank, period } = data;

  if (!email || !currentRank) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const rankChange = previousRank ? previousRank - currentRank : 0;
  const isUp = rankChange > 0;
  const subject = isUp ? '📈 Bạn đã tăng hạng trên bảng xếp hạng!' : '📊 Cập nhật xếp hạng của bạn';

  try {
    enforceRateLimit(email, 'leaderboard_update');

    const htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
      '<table width="100%" style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
      '<tr><td style="background:linear-gradient(135deg,' + (isUp ? NOTIF_CONFIG.PRIMARY_COLOR : NOTIF_CONFIG.INFO_COLOR) + ' 0%,' + (isUp ? NOTIF_CONFIG.SECONDARY_COLOR : '#2563eb') + ' 100%);padding:30px;text-align:center;">' +
      '<h1 style="color:#fff;margin:0;font-size:24px;">' + (isUp ? '📈 Tăng hạng!' : '📊 Xếp hạng') + '</h1></td></tr>' +
      '<tr><td style="padding:30px;text-align:center;">' +
      '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(userName || 'bạn') + '</strong>,</p>' +
      '<div style="font-size:64px;font-weight:bold;color:' + (isUp ? NOTIF_CONFIG.PRIMARY_COLOR : NOTIF_CONFIG.INFO_COLOR) + ';margin:20px 0;">#' + currentRank + '</div>' +
      (rankChange !== 0 ? '<p style="color:' + (isUp ? '#166534' : '#dc2626') + ';font-size:16px;">' + (isUp ? '↑' : '↓') + ' ' + Math.abs(rankChange) + ' bậc so với ' + (period || 'tuần trước') + '</p>' : '') +
      '<p style="color:#475569;font-size:14px;margin-top:20px;">Tiếp tục tham gia các cuộc thi để leo hạng! 🚀</p>' +
      '</td></tr>' +
      generateEmailFooter() +
      '</table></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Xếp hạng hiện tại của bạn: #' + currentRank,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Leaderboard update sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

// ============ PASSWORD RESET EMAIL ============

function sendPasswordResetEmail(data, settings) {
  const { email, userName, resetUrl, expiresIn } = data;

  if (!email || !resetUrl) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '🔐 Đặt lại mật khẩu Blanc';

  try {
    enforceRateLimit(email, 'password_reset');

    const htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
      '<table width="100%" style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
      '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.ERROR_COLOR + ' 0%,#dc2626 100%);padding:30px;text-align:center;">' +
      '<h1 style="color:#fff;margin:0;font-size:24px;">🔐 Đặt lại mật khẩu</h1></td></tr>' +
      '<tr><td style="padding:30px;">' +
      '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(userName || 'bạn') + '</strong>,</p>' +
      '<p style="color:#475569;font-size:15px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>' +
      '<div style="text-align:center;margin:30px 0;"><a href="' + escapeHtmlNotif(resetUrl) + '" style="display:inline-block;background:' + NOTIF_CONFIG.ERROR_COLOR + ';color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Đặt lại mật khẩu</a></div>' +
      '<div style="background:#fef2f2;border-radius:8px;padding:15px;margin:20px 0;">' +
      '<p style="color:#991b1b;margin:0;font-size:13px;">⚠️ Link này sẽ hết hạn sau ' + (expiresIn || '1 giờ') + '</p>' +
      '</div>' +
      '<p style="color:#94a3b8;font-size:13px;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>' +
      '</td></tr>' +
      generateEmailFooter() +
      '</table></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Đặt lại mật khẩu: ' + resetUrl,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Password reset email sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

// ============ EMAIL VERIFICATION ============

function sendEmailVerificationEmail(data, settings) {
  const { email, userName, verifyUrl } = data;

  if (!email || !verifyUrl) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '✉️ Xác nhận địa chỉ email của bạn';

  try {
    enforceRateLimit(email, 'email_verification');

    const htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
      '<table width="100%" style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
      '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.PRIMARY_COLOR + ' 0%,' + NOTIF_CONFIG.SECONDARY_COLOR + ' 100%);padding:30px;text-align:center;">' +
      '<h1 style="color:#fff;margin:0;font-size:24px;">✉️ Xác nhận Email</h1></td></tr>' +
      '<tr><td style="padding:30px;">' +
      '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(userName || 'bạn') + '</strong>,</p>' +
      '<p style="color:#475569;font-size:15px;">Vui lòng xác nhận địa chỉ email của bạn để hoàn tất đăng ký.</p>' +
      '<div style="text-align:center;margin:30px 0;"><a href="' + escapeHtmlNotif(verifyUrl) + '" style="display:inline-block;background:' + NOTIF_CONFIG.PRIMARY_COLOR + ';color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">Xác nhận email</a></div>' +
      '</td></tr>' +
      generateEmailFooter() +
      '</table></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Xác nhận email: ' + verifyUrl,
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Verification email sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

// ============ ACCOUNT WARNING EMAIL ============

function sendAccountWarningEmail(data, settings) {
  const { email, userName, warningType, warningMessage, actionRequired } = data;

  if (!email || !warningType) {
    return notifErrorResponse('Missing required fields', 400);
  }

  const subject = '⚠️ Cảnh báo bảo mật tài khoản';

  try {
    enforceRateLimit(email, 'account_warning');

    const htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
      '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
      '<table width="100%" style="max-width:500px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
      '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.WARNING_COLOR + ' 0%,#d97706 100%);padding:30px;text-align:center;">' +
      '<h1 style="color:#fff;margin:0;font-size:24px;">⚠️ Cảnh báo bảo mật</h1></td></tr>' +
      '<tr><td style="padding:30px;">' +
      '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(userName || 'bạn') + '</strong>,</p>' +
      '<div style="background:#fffbeb;border-left:4px solid ' + NOTIF_CONFIG.WARNING_COLOR + ';padding:15px;margin:20px 0;border-radius:0 8px 8px 0;">' +
      '<p style="color:#92400e;margin:0;font-weight:bold;">' + escapeHtmlNotif(warningType) + '</p>' +
      (warningMessage ? '<p style="color:#b45309;margin:10px 0 0 0;font-size:14px;">' + escapeHtmlNotif(warningMessage) + '</p>' : '') +
      '</div>' +
      (actionRequired ? '<p style="color:#dc2626;font-weight:bold;">Hành động cần thiết: ' + escapeHtmlNotif(actionRequired) + '</p>' : '') +
      '<p style="color:#94a3b8;font-size:13px;margin-top:20px;">Nếu bạn không thực hiện hành động này, vui lòng liên hệ hỗ trợ ngay.</p>' +
      '</td></tr>' +
      generateEmailFooter() +
      '</table></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody,
      body: 'Cảnh báo: ' + warningType + '\n' + (warningMessage || ''),
      name: NOTIF_CONFIG.SENDER_NAME,
      replyTo: NOTIF_CONFIG.SUPPORT_EMAIL
    });

    return notifCreateResponse({ ok: true, message: 'Account warning sent' }, 200);
  } catch (err) {
    if (err && err.name === 'RateLimitError') {
      return notifErrorResponse(err.message, 429);
    }
    return notifErrorResponse('Failed to send email', 500);
  }
}

// ============ SHARED EMAIL FOOTER ============

function generateEmailFooter() {
  return '<tr><td style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;">' +
    '<p style="color:#94a3b8;font-size:12px;margin:0 0 10px 0;">© ' + new Date().getFullYear() + ' ' + NOTIF_CONFIG.APP_NAME + '. All rights reserved.</p>' +
    '<p style="color:#94a3b8;font-size:11px;margin:0;">' +
    '<a href="' + NOTIF_CONFIG.WEBSITE_URL + '" style="color:#64748b;text-decoration:none;">Website</a> • ' +
    '<a href="' + NOTIF_CONFIG.WEBSITE_URL + '/profile?tab=settings" style="color:#64748b;text-decoration:none;">Cài đặt thông báo</a> • ' +
    '<a href="mailto:' + NOTIF_CONFIG.SUPPORT_EMAIL + '" style="color:#64748b;text-decoration:none;">Email: ' + NOTIF_CONFIG.SUPPORT_EMAIL + '</a> • ' +
    '<a href="tel:' + NOTIF_CONFIG.SUPPORT_PHONE + '" style="color:#64748b;text-decoration:none;">Tel: ' + NOTIF_CONFIG.SUPPORT_PHONE + '</a>' +
    '</p></td></tr>';
}

// ============ HTML TEMPLATES ============

function generateContestReminderHtml(data) {
  const urgentStyle = data.isUrgent
    ? 'background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);'
    : 'background: linear-gradient(135deg, ' + NOTIF_CONFIG.PRIMARY_COLOR + ' 0%, ' + NOTIF_CONFIG.SECONDARY_COLOR + ' 100%);';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="' + urgentStyle + 'padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">' + (data.isUrgent ? '🔔 Sắp bắt đầu!' : '📅 Nhắc nhở cuộc thi') + '</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName) + '</strong>,</p>' +
    '<div style="background:#f0fdf4;border-left:4px solid ' + NOTIF_CONFIG.PRIMARY_COLOR + ';padding:20px;margin:20px 0;border-radius:0 8px 8px 0;">' +
    '<h2 style="color:#166534;margin:0 0 10px 0;font-size:18px;">🏆 ' + escapeHtmlNotif(data.contestTitle) + '</h2>' +
    '<p style="color:#15803d;margin:0;font-size:14px;">Sẽ bắt đầu sau <strong>' + data.timeLabel + '</strong></p>' +
    (data.contestDate ? '<p style="color:#64748b;margin:10px 0 0 0;font-size:13px;">📅 ' + escapeHtmlNotif(data.contestDate) + (data.contestTime ? ' lúc ' + escapeHtmlNotif(data.contestTime) : '') + '</p>' : '') +
    '</div>' +
    (data.contestUrl ? '<div style="text-align:center;margin:25px 0;"><a href="' + escapeHtmlNotif(data.contestUrl) + '" style="display:inline-block;background:' + NOTIF_CONFIG.PRIMARY_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Xem chi tiết cuộc thi</a></div>' : '') +
    '<p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:30px;">Chúc bạn thi đấu thật tốt! 💪</p>' +
    '</td></tr></table>' +
    '</td></tr></table></body></html>';
}

function generateContestReminderText(data) {
  return 'Xin chào ' + data.userName + ',\n\n' +
    'NHẮC NHỞ: ' + data.contestTitle + '\n' +
    'Sẽ bắt đầu sau ' + data.timeLabel + '\n' +
    (data.contestDate ? 'Ngày: ' + data.contestDate + (data.contestTime ? ' lúc ' + data.contestTime : '') + '\n' : '') +
    (data.contestUrl ? '\nXem chi tiết: ' + data.contestUrl + '\n' : '') +
    '\nChúc bạn thi đấu thật tốt!\n' +
    '---\nBlanc';
}

function generateCourseUpdateHtml(data) {
  const updateIcons = { lesson: '📖', quiz: '✍️', assignment: '📝', resource: '📎' };
  const icon = updateIcons[data.updateType] || '📚';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.ACCENT_COLOR + ' 0%, #4f46e5 100%);padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">📚 Cập nhật khóa học</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName) + '</strong>,</p>' +
    '<p style="color:#475569;font-size:15px;">Khóa học <strong>' + escapeHtmlNotif(data.courseTitle) + '</strong> vừa có nội dung mới!</p>' +
    '<div style="background:#eef2ff;border-radius:12px;padding:20px;margin:20px 0;">' +
    '<p style="color:#4338ca;margin:0;font-size:16px;">' + icon + ' ' + escapeHtmlNotif(data.updateTitle) + '</p>' +
    '</div>' +
    (data.courseUrl ? '<div style="text-align:center;margin:25px 0;"><a href="' + escapeHtmlNotif(data.courseUrl) + '" style="display:inline-block;background:' + NOTIF_CONFIG.ACCENT_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Học ngay</a></div>' : '') +
    '</td></tr></table>' +
    '</td></tr></table></body></html>';
}

function generateCourseUpdateText(data) {
  return 'Xin chào ' + data.userName + ',\n\n' +
    'Khóa học "' + data.courseTitle + '" vừa có nội dung mới!\n\n' +
    'Cập nhật: ' + data.updateTitle + '\n' +
    (data.courseUrl ? '\nHọc ngay: ' + data.courseUrl + '\n' : '') +
    '\n---\nBlanc';
}

function generateMarketingHtml(data) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.WARNING_COLOR + ' 0%, #d97706 100%);padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">🎉 ' + escapeHtmlNotif(data.headline) + '</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName) + '</strong>,</p>' +
    '<div style="color:#475569;font-size:15px;line-height:1.6;">' + sanitizeHtmlNotif(data.content) + '</div>' +
    '<div style="text-align:center;margin:30px 0;"><a href="' + escapeHtmlNotif(data.ctaUrl) + '" style="display:inline-block;background:' + NOTIF_CONFIG.WARNING_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">' + escapeHtmlNotif(data.ctaText) + '</a></div>' +
    '</td></tr></table>' +
    '</td></tr></table></body></html>';
}

function generateMarketingText(data) {
  return 'Xin chào ' + data.userName + ',\n\n' +
    data.headline + '\n\n' +
    data.content + '\n\n' +
    'Xem thêm: ' + data.ctaUrl + '\n' +
    '\n---\nBlanc';
}

function generateAnnouncementHtml(data) {
  const colors = {
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
    success: { bg: '#f0fdf4', border: '#10b981', text: '#166534' },
    urgent: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' }
  };
  const style = colors[data.severity] || colors.info;

  // Allow basic HTML tags in message (p, strong, br, em, ul, li, a)
  // Sanitize dangerous tags like script, iframe, etc.
  const sanitizedMessage = sanitizeHtmlNotif(data.message || '');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background:' + style.border + ';padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">📢 Thông báo từ Blanc</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName || 'bạn') + '</strong>,</p>' +
    '<div style="background:' + style.bg + ';border-left:4px solid ' + style.border + ';padding:20px;margin:20px 0;border-radius:0 8px 8px 0;">' +
    '<h2 style="color:' + style.text + ';margin:0 0 10px 0;font-size:18px;">' + escapeHtmlNotif(data.title) + '</h2>' +
    '<div style="color:' + style.text + ';margin:0;font-size:14px;line-height:1.6;">' + sanitizedMessage + '</div>' +
    '</div>' +
    '</td></tr>' +
    generateEmailFooter() +
    '</table>' +
    '</td></tr></table></body></html>';
}

function generateAnnouncementText(data) {
  return 'Xin chào ' + data.userName + ',\n\n' +
    'THÔNG BÁO: ' + data.title + '\n\n' +
    data.message + '\n' +
    '\n---\nBlanc';
}

function generateWelcomeHtml(data) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.PRIMARY_COLOR + ' 0%, ' + NOTIF_CONFIG.SECONDARY_COLOR + ' 100%);padding:40px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:28px;">🎉 Chào mừng bạn!</h1>' +
    '<p style="color:rgba(255,255,255,0.9);margin:10px 0 0 0;font-size:16px;">Cảm ơn bạn đã tham gia Blanc</p>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName) + '</strong>,</p>' +
    '<p style="color:#475569;font-size:15px;line-height:1.6;">Chúng tôi rất vui khi bạn đã gia nhập cộng đồng Blanc! Đây là nơi bạn có thể:</p>' +
    '<div style="margin:20px 0;">' +
    '<div style="display:flex;align-items:center;margin:15px 0;padding:15px;background:#f0fdf4;border-radius:8px;">' +
    '<span style="font-size:24px;margin-right:15px;">🏆</span>' +
    '<div><strong style="color:#166534;">Tham gia cuộc thi</strong><p style="color:#15803d;margin:5px 0 0 0;font-size:13px;">Thử thách bản thân với các cuộc thi lập trình hấp dẫn</p></div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;margin:15px 0;padding:15px;background:#eef2ff;border-radius:8px;">' +
    '<span style="font-size:24px;margin-right:15px;">📚</span>' +
    '<div><strong style="color:#4338ca;">Học tập không giới hạn</strong><p style="color:#6366f1;margin:5px 0 0 0;font-size:13px;">Khám phá hàng trăm khóa học chất lượng</p></div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;margin:15px 0;padding:15px;background:#fffbeb;border-radius:8px;">' +
    '<span style="font-size:24px;margin-right:15px;">👥</span>' +
    '<div><strong style="color:#92400e;">Kết nối cộng đồng</strong><p style="color:#b45309;margin:5px 0 0 0;font-size:13px;">Gặp gỡ và học hỏi từ những người cùng đam mê</p></div>' +
    '</div>' +
    '</div>' +
    '<div style="text-align:center;margin:30px 0;">' +
    '<a href="https://blanc.com" style="display:inline-block;background:' + NOTIF_CONFIG.PRIMARY_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Bắt đầu khám phá</a>' +
    '</div>' +
    '<p style="color:#94a3b8;font-size:13px;text-align:center;margin-top:25px;">Nếu có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi!</p>' +
    '</td></tr>' +
    '<tr><td style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;">' +
    '<p style="color:#94a3b8;font-size:12px;margin:0;">© 2024 Blanc. All rights reserved.</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function generateWelcomeText(data) {
  return 'Xin chào ' + data.userName + ',\n\n' +
    'Chào mừng bạn đến với Blanc! 🎉\n\n' +
    'Chúng tôi rất vui khi bạn đã gia nhập cộng đồng. Tại đây bạn có thể:\n\n' +
    '🏆 Tham gia các cuộc thi lập trình hấp dẫn\n' +
    '📚 Học tập với hàng trăm khóa học chất lượng\n' +
    '👥 Kết nối với cộng đồng những người cùng đam mê\n\n' +
    'Bắt đầu khám phá ngay: https://blanc.com\n\n' +
    'Nếu có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi!\n' +
    '\n---\nBlanc Team';
}

function generateContestRegistrationHtml(data) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f8fafc;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:40px 20px;">' +
    '<table width="100%" style="max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">' +
    '<tr><td style="background:linear-gradient(135deg,' + NOTIF_CONFIG.PRIMARY_COLOR + ' 0%, ' + NOTIF_CONFIG.SECONDARY_COLOR + ' 100%);padding:30px;text-align:center;">' +
    '<h1 style="color:#fff;margin:0;font-size:24px;">✅ Đăng ký thành công!</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:30px;">' +
    '<p style="color:#64748b;font-size:15px;">Xin chào <strong>' + escapeHtmlNotif(data.userName) + '</strong>,</p>' +
    '<p style="color:#475569;font-size:15px;">Bạn đã đăng ký tham gia cuộc thi thành công!</p>' +
    '<div style="background:#f0fdf4;border:2px solid ' + NOTIF_CONFIG.PRIMARY_COLOR + ';border-radius:12px;padding:25px;margin:20px 0;text-align:center;">' +
    '<h2 style="color:#166534;margin:0 0 15px 0;font-size:20px;">🏆 ' + escapeHtmlNotif(data.contestTitle) + '</h2>' +
    '<div style="display:inline-block;text-align:left;">' +
    (data.organizerName ? '<p style="color:#15803d;margin:8px 0;font-size:14px;">🏢 Tổ chức: <strong>' + escapeHtmlNotif(data.organizerName) + '</strong></p>' : '') +
    (data.contestDate ? '<p style="color:#15803d;margin:8px 0;font-size:14px;">📅 Ngày: <strong>' + escapeHtmlNotif(data.contestDate) + '</strong></p>' : '') +
    (data.contestTime ? '<p style="color:#15803d;margin:8px 0;font-size:14px;">⏰ Giờ: <strong>' + escapeHtmlNotif(data.contestTime) + '</strong></p>' : '') +
    '</div>' +
    '</div>' +
    '<div style="background:#fffbeb;border-radius:8px;padding:15px;margin:20px 0;">' +
    '<p style="color:#92400e;margin:0;font-size:14px;">💡 <strong>Mẹo:</strong> Hãy chuẩn bị kỹ càng và đừng quên kiểm tra email để nhận nhắc nhở trước khi cuộc thi bắt đầu!</p>' +
    '</div>' +
    (data.contestUrl ? '<div style="text-align:center;margin:25px 0;"><a href="' + escapeHtmlNotif(data.contestUrl) + '" style="display:inline-block;background:' + NOTIF_CONFIG.PRIMARY_COLOR + ';color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Xem chi tiết cuộc thi</a></div>' : '') +
    '<p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:25px;">Chúc bạn thi đấu thật tốt! 💪</p>' +
    '</td></tr></table>' +
    '</td></tr></table></body></html>';
}

function generateContestRegistrationText(data) {
  return 'Xin chào ' + data.userName + ',\n\n' +
    '✅ ĐĂNG KÝ THÀNH CÔNG!\n\n' +
    'Bạn đã đăng ký tham gia cuộc thi:\n' +
    '🏆 ' + data.contestTitle + '\n' +
    (data.organizerName ? '🏢 Tổ chức: ' + data.organizerName + '\n' : '') +
    (data.contestDate ? '📅 Ngày: ' + data.contestDate + '\n' : '') +
    (data.contestTime ? '⏰ Giờ: ' + data.contestTime + '\n' : '') +
    (data.contestUrl ? '\nXem chi tiết: ' + data.contestUrl + '\n' : '') +
    '\n💡 Mẹo: Hãy chuẩn bị kỹ càng và đừng quên kiểm tra email để nhận nhắc nhở!\n' +
    '\nChúc bạn thi đấu thật tốt! 💪\n' +
    '\n---\nBlanc';
}

// ============ UTILITIES ============

function escapeHtmlNotif(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sanitize HTML - Allow only safe tags, remove dangerous ones
 * Allowed: p, strong, b, em, i, br, ul, ol, li, a (with href), span
 * Blocked: script, iframe, object, embed, form, input, style, etc.
 */
function sanitizeHtmlNotif(html) {
  if (!html) return '';
  
  let sanitized = String(html);
  
  // Remove dangerous tags completely (including content)
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'style', 'link', 'meta', 'base'];
  for (var i = 0; i < dangerousTags.length; i++) {
    var tag = dangerousTags[i];
    // Remove opening and closing tags with content
    var regex = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
    sanitized = sanitized.replace(regex, '');
    // Remove self-closing
    regex = new RegExp('<' + tag + '[^>]*\\/?>', 'gi');
    sanitized = sanitized.replace(regex, '');
  }
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  
  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*data:[^"'>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'src=""');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*data:[^"'>]*/gi, 'src=""');
  
  return sanitized;
}

function safeCompare(a, b) {
  // Constant-time-ish string comparison to avoid timing attacks
  const sa = String(a || '');
  const sb = String(b || '');
  const len = Math.max(sa.length, sb.length);
  let result = 0;

  for (let i = 0; i < len; i++) {
    const ca = sa.charCodeAt(i) || 0;
    const cb = sb.charCodeAt(i) || 0;
    result |= ca ^ cb;
  }

  return result === 0 && sa.length === sb.length;
}

function verifyNotifSignature(payload, secretKey) {
  const timestamp = Number(payload.timestamp);
  const nonce = String(payload.nonce || '');
  const signature = String(payload.signature || '');

  if (!timestamp || !nonce || !signature) {
    throw new Error('Missing signature fields');
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > NOTIF_CONFIG.SIGNATURE_MAX_SKEW_MS) {
    throw new Error('Signature expired');
  }

  // Replay protection via nonce cache
  const cache = CacheService.getScriptCache();
  const nonceKey = 'notif_nonce:' + nonce;
  if (cache.get(nonceKey)) {
    throw new Error('Replay detected');
  }
  cache.put(nonceKey, '1', NOTIF_CONFIG.NONCE_TTL_SECONDS);

  // Canonical string MUST match the logic on your backend when computing HMAC
  // Example backend canonical builder:
  //   const parts = [
  //     'action=' + action,
  //     'nonce=' + nonce,
  //     'timestamp=' + timestamp,
  //     'email=' + email
  //   ];
  //   const canonical = parts.join('&');
  //   const signature = base64(HMAC_SHA256(canonical, SECRET));

  const canonicalParts = [
    'action=' + String(payload.action || ''),
    'nonce=' + nonce,
    'timestamp=' + String(timestamp)
  ];

  // Bind signature to recipient email when present
  if (payload.email) {
    canonicalParts.push('email=' + String(payload.email || ''));
  }

  // NOTE: Do NOT add extra fields like 'type' to canonical string
  // The canonical string must match exactly what the backend generates:
  // action, nonce, timestamp, [email]

  const canonicalString = canonicalParts.join('&');

  const computedBytes = Utilities.computeHmacSha256Signature(canonicalString, secretKey);
  const computed = Utilities.base64Encode(computedBytes);

  if (!safeCompare(computed, signature)) {
    throw new Error('Invalid signature');
  }
}

function notifCreateResponse(data, statusCode) {
  const body = data || {};
  body.statusCode = statusCode || 200;

  const output = ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);

  // Basic CORS headers (useful if you ever call from frontend)
  try {
    output.setHeader('Access-Control-Allow-Origin', '*');
    output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  } catch (e) {
    // ContentService in some contexts may not support setHeader – ignore silently
  }

  return output;
}

function notifErrorResponse(message, statusCode, extraFields) {
  const data = Object.assign({
    ok: false,
    error: String(message)
  }, extraFields || {});

  return notifCreateResponse(data, statusCode || 500);
}

// ============ TEST FUNCTIONS ============

function testContestReminder() {
  const result = sendContestReminder({
    email: 'test@example.com',
    userName: 'Nguyễn Văn A',
    contestTitle: 'Hackathon 2024',
    contestDate: '30/11/2024',
    contestTime: '09:00',
    contestUrl: 'https://blanc.com/contests/1',
    reminderType: '1h'
  }, getNotifSettings());
  Logger.log(result.getContent());
}

function testCourseUpdate() {
  const result = sendCourseUpdate({
    email: 'test@example.com',
    userName: 'Nguyễn Văn A',
    courseTitle: 'ReactJS Advanced',
    updateType: 'lesson',
    updateTitle: 'Bài 10: React Hooks nâng cao',
    courseUrl: 'https://blanc.com/courses/1'
  }, getNotifSettings());
  Logger.log(result.getContent());
}

function testTeamInvite() {
  const result = sendTeamInviteEmail({
    email: 'test@example.com',
    recipientName: 'Nguyễn Văn B',
    inviterName: 'Trần Văn A',
    teamTitle: 'Team AI Innovation',
    teamDescription: 'Đội thi AI cho hackathon 2024',
    role: 'Backend Developer',
    teamPostUrl: 'https://blanc.com/community/team/123'
  }, getNotifSettings());
  Logger.log(result.getContent());
}

function testContestRecommendation() {
  const result = sendContestRecommendationEmail({
    email: 'test@example.com',
    userName: 'Nguyễn Văn A',
    contests: [
      { title: 'Hackathon AI 2024', organizer: 'Google', dateStart: '15/12/2024', matchScore: 95, url: 'https://blanc.com/contests/1' },
      { title: 'Web Dev Challenge', organizer: 'Microsoft', dateStart: '20/12/2024', matchScore: 88, url: 'https://blanc.com/contests/2' },
      { title: 'Mobile App Contest', organizer: 'Apple', dateStart: '25/12/2024', matchScore: 75, url: 'https://blanc.com/contests/3' }
    ]
  }, getNotifSettings());
  Logger.log(result.getContent());
}

function testTeamMatchSuggestion() {
  const result = sendTeamMatchSuggestionEmail({
    email: 'test@example.com',
    userName: 'Nguyễn Văn A',
    teams: [
      { title: 'Team Innovation', leaderName: 'Trần Văn B', contestTitle: 'Hackathon 2024', rolesNeeded: ['Backend', 'DevOps'], matchScore: 92 },
      { title: 'AI Warriors', leaderName: 'Lê Thị C', contestTitle: 'AI Challenge', rolesNeeded: ['ML Engineer'], matchScore: 85 }
    ]
  }, getNotifSettings());
  Logger.log(result.getContent());
}

function testAchievementUnlocked() {
  const result = sendAchievementUnlockedEmail({
    email: 'test@example.com',
    userName: 'Nguyễn Văn A',
    achievementName: 'First Blood',
    achievementDescription: 'Hoàn thành cuộc thi đầu tiên',
    achievementIcon: '🥇'
  }, getNotifSettings());
  Logger.log(result.getContent());
}

function testProfileIncomplete() {
  const result = sendProfileIncompleteEmail({
    email: 'test@example.com',
    userName: 'Nguyễn Văn A',
    completionPercent: 45,
    missingFields: ['Kỹ năng chuyên môn', 'Kinh nghiệm thi đấu', 'Liên kết mạng xã hội']
  }, getNotifSettings());
  Logger.log(result.getContent());
}
