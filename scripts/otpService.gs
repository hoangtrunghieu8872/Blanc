/**
 * Blanc OTP Email Service (Hardened)
 * 
 * Security features:
 * - HMAC-signed requests (OTP_SECRET_KEY in Script Properties)
 * - Optional OTP derivation from opaque otpToken using HMAC-SHA256
 * - Per-email rate limiting using CacheService
 * - Basic origin allowlist (ALLOWED_ORIGINS in Script Properties)
 * - Strict payload validation + HTML escaping
 */

const CONFIG = Object.freeze({
  APP_NAME: 'Blanc',
  SENDER_NAME: 'Blanc Security',
  SUPPORT_EMAIL: 'clbflife2025thptfptcantho@gmail.com',
  SUPPORT_PHONE: '+84916007090',
  LOGO_URL: 'https://via.placeholder.com/120x40/10B981/FFFFFF?text=Blanc',
  ROCKET_IMAGE_URL: 'https://img.icons8.com/color/96/rocket.png',
  PRIMARY_COLOR: '#10B981',
  SECONDARY_COLOR: '#059669',
  // Security / rate limit
  RATE_LIMIT_PER_WINDOW: 5,          // max OTP per email in a rolling window
  RATE_LIMIT_WINDOW_SECONDS: 300,    // 5 minutes
  RATE_LIMIT_DAILY: 20,              // max OTP per email per day
  SIGNATURE_MAX_SKEW_MS: 5 * 60 * 1000, // signature timestamp allowed skew
  NONCE_TTL_SECONDS: 10 * 60,        // nonce lifetime for replay protection
  MIN_TTL_MINUTES: 1,
  MAX_TTL_MINUTES: 15
});

let SETTINGS_CACHE = null;

function getSettings() {
  if (SETTINGS_CACHE) {
    return SETTINGS_CACHE;
  }
  const props = PropertiesService.getScriptProperties();
  const secretKey = props.getProperty('OTP_SECRET_KEY');
  if (!secretKey) {
    throw new Error('Missing Script Property: OTP_SECRET_KEY');
  }
  const allowedOriginsRaw = props.getProperty('ALLOWED_ORIGINS') || '';
  const allowedOrigins = allowedOriginsRaw
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return !!s; });

  SETTINGS_CACHE = {
    secretKey: secretKey,
    allowedOrigins: allowedOrigins
  };
  return SETTINGS_CACHE;
}

/**
 * Webhook entrypoint
 */
function doPost(e) {
  try {
    const settings = getSettings();

    if (!e || !e.postData || !e.postData.contents) {
      return errorResponse('Empty request body', 400);
    }

    if (!e.postData.type || e.postData.type.indexOf('application/json') !== 0) {
      return errorResponse('Unsupported Content-Type. Use application/json.', 415);
    }

    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return errorResponse('Invalid JSON payload', 400);
    }

    if (!data || typeof data !== 'object') {
      return errorResponse('Invalid request body', 400);
    }

    if (data.action !== 'sendOtp') {
      return errorResponse('Unknown action', 400);
    }

    // Optional: soft origin check (not a primary security control)
    const origin =
      (data.origin && String(data.origin)) ||
      (e.parameter && e.parameter.origin) ||
      '';
    if (!isOriginAllowed(origin, settings.allowedOrigins)) {
      return errorResponse('Origin not allowed', 403);
    }

    // Strong: HMAC verification + replay protection
    try {
      verifySignature(data, settings.secretKey);
    } catch (sigErr) {
      return errorResponse(sigErr.message || 'Invalid signature', 401);
    }

    const email = (data.email && String(data.email).toLowerCase().trim()) || '';
    if (!email) {
      return errorResponse('Missing email', 400);
    }

    if (!checkAndIncrementRateLimit(email)) {
      return errorResponse(
        'Too many OTP requests. Please wait a few minutes before trying again.',
        429
      );
    }

    // Delegate to email sender (re-validates and can derive OTP from otpToken)
    return sendOtpEmail(data, settings);
  } catch (err) {
    Logger.log('[FATAL_ERROR] ' + (err && err.stack ? err.stack : err));
    return errorResponse('Internal error', 500);
  }
}

/**
 * Simple health check
 */
function doGet(e) {
  return createResponse(
    {
      ok: true,
      service: 'Blanc OTP Service',
      timestamp: new Date().toISOString()
    },
    200
  );
}

/**
 * Send OTP Email with hardened validation.
 * Can be called directly from Apps Script (e.g. testSendOtp)
 * without HMAC/nonce, but all external traffic must go through doPost.
 */
function sendOtpEmail(rawData, settingsOpt) {
  const settings = settingsOpt || getSettings();

  let payload;
  try {
    payload = normalizeAndValidatePayload(rawData, settings.secretKey);
  } catch (err) {
    return errorResponse(err.message || 'Invalid payload', 400);
  }

  const subject = getEmailSubject(payload.actionType, payload.otp, payload.appName);
  const htmlBody = generateOtpEmailTemplate(
    payload.otp,
    payload.actionText,
    payload.ttlMinutes,
    payload.actionType,
    payload.appName
  );
  const textBody = generatePlainTextEmail(
    payload.otp,
    payload.actionText,
    payload.ttlMinutes,
    payload.appName
  );

  try {
    MailApp.sendEmail({
      to: payload.email,
      subject: subject,
      htmlBody: htmlBody,
      body: textBody,
      name: CONFIG.SENDER_NAME,
      replyTo: CONFIG.SUPPORT_EMAIL
    });

    Logger.log(
      JSON.stringify({
        event: 'otp_email_sent',
        // Log only a hash, never the raw email or OTP
        emailHash: hashEmailForLog(payload.email, settings.secretKey),
        actionType: payload.actionType,
        ttlMinutes: payload.ttlMinutes
      })
    );

    return createResponse(
      {
        ok: true,
        message: 'Email sent successfully'
      },
      200
    );
  } catch (error) {
    Logger.log('[EMAIL_ERROR] ' + (error && error.stack ? error.stack : error));
    return errorResponse('Failed to send email', 500);
  }
}

/**
 * Normalize + validate incoming payload and derive OTP if needed.
 */
function normalizeAndValidatePayload(data, secretKey) {
  const appName =
    (data.appName && String(data.appName).trim()) || CONFIG.APP_NAME;

  const emailRaw = (data.email && String(data.email).trim()) || '';
  const email = emailRaw.toLowerCase();
  if (!isValidEmail(email)) {
    throw new Error('Invalid email address');
  }

  let actionType =
    (data.actionType && String(data.actionType).trim()) || 'verify';
  if (['verify', 'reset_password', 'login'].indexOf(actionType) === -1) {
    actionType = 'verify';
  }

  let ttl = parseInt(data.ttlMinutes, 10);
  if (isNaN(ttl) || ttl <= 0) {
    ttl = 2;
  }
  if (ttl < CONFIG.MIN_TTL_MINUTES) {
    ttl = CONFIG.MIN_TTL_MINUTES;
  }
  if (ttl > CONFIG.MAX_TTL_MINUTES) {
    ttl = CONFIG.MAX_TTL_MINUTES;
  }

  // Action text (used in email body only)
  let actionText = (data.actionText && String(data.actionText).trim()) || '';
  if (!actionText) {
    if (actionType === 'verify') {
      actionText = 'xác thực email';
    } else if (actionType === 'reset_password') {
      actionText = 'đặt lại mật khẩu';
    } else if (actionType === 'login') {
      actionText = 'đăng nhập';
    } else {
      actionText = 'xác thực';
    }
  }

  // OTP:
  // - Prefer explicit data.otp (for backward compatibility)
  // - Otherwise derive from otpToken using HMAC-SHA256
  let otp =
    data.otp != null && data.otp !== undefined
      ? String(data.otp).trim()
      : '';

  if (!otp) {
    const otpToken =
      data.otpToken != null && data.otpToken !== undefined
        ? String(data.otpToken)
        : '';
    if (!otpToken) {
      throw new Error('Missing otp or otpToken');
    }
    otp = deriveOtpFromToken(otpToken, secretKey);
  }

  if (!/^\d{6,8}$/.test(otp)) {
    throw new Error('OTP must be 6–8 digits');
  }

  return {
    appName: appName,
    email: email,
    otp: otp,
    actionType: actionType,
    actionText: actionText,
    ttlMinutes: ttl
  };
}

/**
 * Simple email validation – enough for OTP use
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Derive a 6-digit OTP from an opaque token using HMAC-SHA256.
 * This MUST match the algorithm in server/routes/otp.js:
 *   - HMAC-SHA256 of sessionToken with secretKey
 *   - Take first 4 bytes as unsigned 32-bit big-endian integer
 *   - Modulo 1,000,000 and pad to 6 digits
 */
function deriveOtpFromToken(otpToken, secretKey) {
  const hmacBytes = Utilities.computeHmacSha256Signature(otpToken, secretKey);
  
  // Take first 4 bytes and convert to unsigned 32-bit big-endian integer
  // Same as Node.js: hash.readUInt32BE(0)
  const num = 
    ((hmacBytes[0] & 0xff) << 24) |
    ((hmacBytes[1] & 0xff) << 16) |
    ((hmacBytes[2] & 0xff) << 8) |
    (hmacBytes[3] & 0xff);
  
  // Convert to unsigned (JavaScript handles signed 32-bit)
  const unsignedNum = num >>> 0;
  
  // Modulo 1,000,000 and pad to 6 digits
  const otp = unsignedNum % 1000000;
  return ('000000' + otp).slice(-6);
}

/**
 * Soft origin allowlist – best-effort only, main security is HMAC.
 */
function isOriginAllowed(origin, allowedOrigins) {
  if (!allowedOrigins || !allowedOrigins.length) {
    return true; // not configured -> skip
  }
  if (!origin) {
    return false;
  }
  const normalizedOrigin = String(origin).trim().toLowerCase();
  return (
    allowedOrigins.indexOf(normalizedOrigin) !== -1 ||
    allowedOrigins.indexOf('*') !== -1
  );
}

/**
 * HMAC-based request verification with replay protection.
 *
 * Expected fields on client side:
 *  - email
 *  - actionType
 *  - ttlMinutes
 *  - timestamp (ms since epoch)
 *  - nonce (random string)
 *  - signature = base64(HMAC_SHA256(canonicalString, OTP_SECRET_KEY))
 *
 * canonicalString format:
 *  email=<email>&actionType=<actionType>&ttlMinutes=<ttl>&nonce=<nonce>&timestamp=<timestamp>
 */
function verifySignature(payload, secretKey) {
  const timestamp = Number(payload.timestamp);
  const nonce =
    payload.nonce != null && payload.nonce !== undefined
      ? String(payload.nonce)
      : '';
  const signature =
    payload.signature != null && payload.signature !== undefined
      ? String(payload.signature)
      : '';

  if (!timestamp || !nonce || !signature) {
    throw new Error('Missing signature fields');
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > CONFIG.SIGNATURE_MAX_SKEW_MS) {
    throw new Error('Signature expired');
  }

  // Replay protection with CacheService
  const cache = CacheService.getScriptCache();
  const nonceKey = 'otp_nonce:' + nonce;
  if (cache.get(nonceKey)) {
    throw new Error('Replay detected');
  }
  cache.put(nonceKey, '1', CONFIG.NONCE_TTL_SECONDS);

  const canonicalString =
    'email=' + String(payload.email || '') +
    '&actionType=' + String(payload.actionType || '') +
    '&ttlMinutes=' + String(payload.ttlMinutes || '') +
    '&nonce=' + nonce +
    '&timestamp=' + String(timestamp);

  const computedBytes = Utilities.computeHmacSha256Signature(
    canonicalString,
    secretKey
  );
  const computed = Utilities.base64Encode(computedBytes);

  if (!constantTimeEquals(computed, signature)) {
    throw new Error('Invalid signature');
  }
}

/**
 * Constant-time string comparison to avoid timing attacks
 */
function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Rate limiting using CacheService + LockService
 */
function checkAndIncrementRateLimit(email) {
  const cache = CacheService.getScriptCache();
  const windowKey = 'otp_window:' + email;
  const dailyKey = 'otp_day:' + email + ':' + getUtcDateKey();

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (err) {
    Logger.log('[RATE_LIMIT_LOCK_ERROR] ' + err);
    // Fail closed: don't send OTP if we can't safely update counters
    return false;
  }

  try {
    let windowCount = parseInt(cache.get(windowKey) || '0', 10);
    let dailyCount = parseInt(cache.get(dailyKey) || '0', 10);

    if (windowCount >= CONFIG.RATE_LIMIT_PER_WINDOW) {
      return false;
    }
    if (dailyCount >= CONFIG.RATE_LIMIT_DAILY) {
      return false;
    }

    windowCount++;
    dailyCount++;

    cache.put(
      windowKey,
      String(windowCount),
      CONFIG.RATE_LIMIT_WINDOW_SECONDS
    );
    cache.put(dailyKey, String(dailyCount), 24 * 60 * 60);

    return true;
  } finally {
    lock.releaseLock();
  }
}

function getUtcDateKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  return (
    year +
    '-' +
    (month < 10 ? '0' + month : month) +
    '-' +
    (day < 10 ? '0' + day : day)
  );
}

/**
 * SHA256-based email hash for safer logging.
 */
function hashEmailForLog(email, secretKey) {
  const normalized = String(email || '').toLowerCase().trim();
  const bytes = Utilities.computeHmacSha256Signature(normalized, secretKey);
  // Shorten hash for logs
  return Utilities.base64Encode(bytes).substring(0, 12);
}

/**
 * Get email subject based on action
 */
function getEmailSubject(actionType, otp, appName) {
  const app = appName || CONFIG.APP_NAME;
  const subjects = {
    verify: '🔐 Mã xác thực của bạn: ' + otp,
    reset_password: '🔑 Đặt lại mật khẩu - Mã OTP: ' + otp,
    login: '🚀 Đăng nhập an toàn - Mã OTP: ' + otp
  };
  return subjects[actionType] || '🔐 Mã xác thực ' + app + ': ' + otp;
}

/**
 * Basic HTML escaping for user-supplied strings
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate HTML email template (slightly modified to escape dynamic content)
 */
function generateOtpEmailTemplate(otp, actionText, ttlMinutes, actionType, appName) {
  const actionIcons = {
    verify: '✉️',
    reset_password: '🔑',
    login: '🚀'
  };
  const icon = actionIcons[actionType] || '🔐';

  const actionTitles = {
    verify: 'Xác thực email',
    reset_password: 'Đặt lại mật khẩu',
    login: 'Đăng nhập an toàn'
  };
  const title = actionTitles[actionType] || 'Xác thực';

  const safeAppName = escapeHtml(appName || CONFIG.APP_NAME);
  const safeActionText = escapeHtml(actionText);
  const safeOtp = escapeHtml(otp);
  const safeTtl = escapeHtml(String(ttlMinutes));

  return (
    '<!DOCTYPE html>' +
    '<html lang="vi">' +
    '<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + title + ' - ' + safeAppName + '</title>' +
    '</head>' +
    "<body style=\"margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;\">" +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc;">' +
    '<tr>' +
    '<td style="padding: 40px 20px;">' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto;">' +
    '<tr>' +
    '<td style="text-align: center; padding-bottom: 30px;">' +
    '<div style="display: inline-block; background: linear-gradient(135deg, ' + CONFIG.PRIMARY_COLOR + ' 0%, ' + CONFIG.SECONDARY_COLOR + ' 100%); padding: 12px 24px; border-radius: 12px;">' +
    '<span style="color: white; font-size: 24px; font-weight: bold; letter-spacing: -0.5px;">🏆 ' + safeAppName + '</span>' +
    '</div>' +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td>' +
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;">' +
    '<tr>' +
    '<td style="background: linear-gradient(135deg, ' + CONFIG.PRIMARY_COLOR + ' 0%, ' + CONFIG.SECONDARY_COLOR + ' 100%); padding: 30px; text-align: center;">' +
    '<div style="width: 90px; height: 90px; background-color: rgba(255,255,255,0.22); border-radius: 50%; display: inline-block; margin-bottom: 15px; background-image: url(' + CONFIG.ROCKET_IMAGE_URL + '); background-repeat: no-repeat; background-position: center; background-size: 64px 64px;"></div>' +
    '<h1 style="color: #ffffff; font-size: 22px; margin: 0; font-weight: 600;">' + title + '</h1>' +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding: 35px 30px;">' +
    '<p style="color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0; text-align: center;">' +
    'Xin chào! 👋<br>' +
    'Bạn vừa yêu cầu <strong style="color: #334155;">' + safeActionText + '</strong> trên ' + safeAppName + '.' +
    '</p>' +
    '<div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 2px dashed ' + CONFIG.PRIMARY_COLOR + '; border-radius: 16px; padding: 25px; text-align: center; margin: 25px 0;">' +
    '<p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Mã xác thực của bạn</p>' +
    '<div style="font-family: \'Courier New\', monospace; font-size: 36px; font-weight: bold; color: ' + CONFIG.PRIMARY_COLOR + '; letter-spacing: 8px; margin: 10px 0;">' +
    safeOtp +
    '</div>' +
    '<p style="color: #94a3b8; font-size: 12px; margin: 10px 0 0 0;">' +
    '⏱️ Mã có hiệu lực trong <strong style="color: #ef4444;">' + safeTtl + ' phút</strong>' +
    '</p>' +
    '</div>' +
    '<div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 25px;">' +
    '<p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">' +
    '📋 <strong>Hướng dẫn:</strong><br>' +
    'Nhập mã này vào trang ' + safeActionText + ' để tiếp tục. Không chia sẻ mã này với bất kỳ ai.' +
    '</p>' +
    '</div>' +
    '<div style="border-left: 4px solid #fbbf24; background-color: #fffbeb; border-radius: 0 8px 8px 0; padding: 15px 20px; margin-top: 25px;">' +
    '<p style="color: #92400e; font-size: 13px; line-height: 1.5; margin: 0;">' +
    '⚠️ <strong>Lưu ý bảo mật:</strong><br>' +
    'Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này và đảm bảo tài khoản của bạn vẫn an toàn.' +
    '</p>' +
    '</div>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</td>' +
    '</tr>' +
    '<tr>' +
    '<td style="padding: 30px 20px; text-align: center;">' +
    '<p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0;">' +
    'Email này được gửi tự động từ ' + safeAppName + '.<br>' +
    'Cần hỗ trợ? Liên hệ: <a href="mailto:' + CONFIG.SUPPORT_EMAIL + '" style="color:' + CONFIG.PRIMARY_COLOR + ';text-decoration:none;">' + CONFIG.SUPPORT_EMAIL + '</a> • <a href="tel:' + CONFIG.SUPPORT_PHONE + '" style="color:' + CONFIG.PRIMARY_COLOR + ';text-decoration:none;">' + CONFIG.SUPPORT_PHONE + '</a>' +
    '</p>' +
    '<p style="color: #cbd5e1; font-size: 11px; margin: 15px 0 0 0;">' +
    '© ' + (new Date().getFullYear()) + ' ' + safeAppName + '. All rights reserved.' +
    '</p>' +
    '<div style="margin-top: 15px;">' +
    '<span style="color: #10b981; font-size: 20px;">🏆</span>' +
    '</div>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</td>' +
    '</tr>' +
    '</table>' +
    '</body>' +
    '</html>'
  );
}

/**
 * Generate plain text fallback
 */
function generatePlainTextEmail(otp, actionText, ttlMinutes, appName) {
  const app = appName || CONFIG.APP_NAME;
  return (
    app + ' - Mã xác thực\n\n' +
    'Xin chào!\n\n' +
    'Bạn vừa yêu cầu ' + actionText + ' trên ' + app + '.\n\n' +
    'MÃ XÁC THỰC CỦA BẠN: ' + otp + '\n\n' +
    'Mã có hiệu lực trong ' + ttlMinutes + ' phút.\n\n' +
    'Hướng dẫn:\n' +
    '- Nhập mã này vào trang ' + actionText + ' để tiếp tục\n' +
    '- Không chia sẻ mã này với bất kỳ ai\n\n' +
    'Lưu ý bảo mật:\n' +
    'Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.\n\n' +
    '---\n' +
    '© ' + (new Date().getFullYear()) + ' ' + app + '\n' +
    'Email này được gửi tự động, vui lòng không trả lời.'
  );
}

/**
 * Create JSON response wrapper
 * (Apps Script Web Apps cannot change HTTP status, so we embed it in JSON)
 */
function createResponse(data, statusCode) {
  const body = data || {};
  body.statusCode = statusCode || 200;
  const output = ContentService.createTextOutput(JSON.stringify(body));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function errorResponse(message, statusCode) {
  return createResponse(
    {
      ok: false,
      error: String(message || 'Unknown error')
    },
    statusCode || 500
  );
}

/**
 * Local test helper – bypasses HMAC + rate limit, but still validates and sends email
 */
function testSendOtp() {
  const result = sendOtpEmail({
    email: 'test@example.com',
    otp: '123456',
    actionType: 'reset_password',
    actionText: 'đặt lại mật khẩu',
    ttlMinutes: 2,
    appName: 'Blanc (DEV)'
  });
  Logger.log(result.getContent());
}
