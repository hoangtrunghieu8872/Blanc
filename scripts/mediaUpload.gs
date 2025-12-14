/**
 * Google Apps Script Web App: Receive multipart/form-data and upload a single file to Google Drive.
 *
 * Features:
 *  - Accepts standard multipart/form-data uploads (e.files)
 *  - Sensible fallbacks when Apps Script doesn't parse files (uses e.postData)
 *  - Optional `fileName` and `folder` parameters
 *  - Auto-creates subfolders under a base Drive folder
 *  - Generates collision-resistant, readable file names
 *  - Returns clean JSON envelope with status + result
 *  - Robust error handling + basic logging
 *
 * How to use:
 *  1) Set `DEFAULT_FOLDER_ID` below to the ID of your target Google Drive folder
 *     (or set a script property DRIVE_FOLDER_ID instead).
 *  2) Deploy as Web App (Execute as: Me; Who has access: Anyone with the link).
 *  3) Send POST requests with multipart/form-data.
 *
 * Expected fields:
 *  - file     (binary, multipart/form-data) – preferred field name
 *  - fileName (optional: client-suggested name)
 *  - folder   (optional: logical folder label; will become a subfolder name)
 *
 * Example cURL:
 *  curl -X POST "YOUR_WEBAPP_URL" \
 *       -F "file=@/path/to/local/file.png" \
 *       -F "fileName=my_custom_name.png" \
 *       -F "folder=avatars"
 */

// ---------------------------- Configuration ---------------------------- //

/**
 * Hardcode your Drive folder ID here to avoid Script Properties lookups.
 * Example: const DEFAULT_FOLDER_ID = '1abcDEF...';
 */
const DEFAULT_FOLDER_ID = '1i-mWrEmXXChDdd3dXjr6b55HkFzVJ-Gf';

/**
 * Optional: preferred field names to look for in e.files.
 */
const FILE_FIELD_PREFERENCES = ['file', 'upload', 'data'];

// ---------------------------- Security --------------------------------- //

const UPLOAD_SECURITY = Object.freeze({
  SIGNATURE_MAX_SKEW_MS: 5 * 60 * 1000, // 5 minutes
  NONCE_TTL_SECONDS: 10 * 60, // 10 minutes
});

let UPLOAD_SETTINGS_CACHE = null;

function getUploadSettings() {
  if (UPLOAD_SETTINGS_CACHE) return UPLOAD_SETTINGS_CACHE;

  const props = PropertiesService.getScriptProperties();
  const secretKey =
    props.getProperty('MEDIA_UPLOAD_SECRET_KEY') || props.getProperty('OTP_SECRET_KEY');

  if (!secretKey) {
    throw new Error('Missing Script Property: MEDIA_UPLOAD_SECRET_KEY');
  }

  UPLOAD_SETTINGS_CACHE = { secretKey: secretKey };
  return UPLOAD_SETTINGS_CACHE;
}

function safeCompare(a, b) {
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

function verifyUploadSignature(params, secretKey) {
  const fileName = String(params.fileName || '');
  const folder = String(params.folder || '');
  const mimeType = String(params.mimeType || '');
  const nonce = String(params.nonce || '');
  const timestamp = Number(params.timestamp);
  const signature = String(params.signature || '');

  if (!fileName || !folder || !mimeType) {
    throw new Error('Missing signed fields');
  }

  if (!timestamp || !nonce || !signature) {
    throw new Error('Missing signature fields');
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > UPLOAD_SECURITY.SIGNATURE_MAX_SKEW_MS) {
    throw new Error('Signature expired');
  }

  // Replay protection via nonce cache
  const cache = CacheService.getScriptCache();
  const nonceKey = 'media_upload_nonce:' + nonce;
  if (cache.get(nonceKey)) {
    throw new Error('Replay detected');
  }
  cache.put(nonceKey, '1', UPLOAD_SECURITY.NONCE_TTL_SECONDS);

  const canonicalString =
    'fileName=' + fileName +
    '&folder=' + folder +
    '&mimeType=' + mimeType +
    '&nonce=' + nonce +
    '&timestamp=' + String(timestamp);

  const computedBytes = Utilities.computeHmacSha256Signature(canonicalString, secretKey);
  const computed = Utilities.base64Encode(computedBytes);

  if (!safeCompare(computed, signature)) {
    throw new Error('Invalid signature');
  }
}

// ---------------------------- Entry Point ------------------------------ //

function doPost(e) {
  try {
    if (!e) {
      return jsonResponse(400, { error: 'Empty request payload.' });
    }

    const params = e.parameter || {};

    // Require backend-issued HMAC token
    const settings = getUploadSettings();
    try {
      verifyUploadSignature(params, settings.secretKey);
    } catch (sigError) {
      return jsonResponse(401, { error: sigError && sigError.message ? sigError.message : 'Invalid signature.' });
    }

    // 1) Extract file as a Blob
    const fileBlob = extractFile(e, params);
    if (!fileBlob) {
      return jsonResponse(400, { error: 'Missing file payload.' });
    }

    // Optional: best-effort MIME validation (may be unavailable depending on request parsing)
    try {
      const signedMimeType = String(params.mimeType || '');
      const actualMimeType = fileBlob.getContentType ? String(fileBlob.getContentType() || '') : '';
      if (signedMimeType && actualMimeType && actualMimeType !== 'application/octet-stream' && actualMimeType !== signedMimeType) {
        return jsonResponse(400, { error: 'mimeType mismatch.' });
      }
    } catch (mimeError) {
      console.warn('mimeType check skipped:', mimeError);
    }

    // 2) Determine target folder
    const folderLabel = sanitizeFolder(params.folder);
    const targetFolder = resolveFolder(folderLabel);
    if (!targetFolder) {
      return jsonResponse(500, { error: 'Target folder could not be resolved or created.' });
    }

    // 3) Build final (safe, unique) file name
    const finalName = buildFileName(params.fileName, fileBlob, folderLabel);

    // 4) Create a copy blob with the new name and save it
    const blobToSave = fileBlob.copyBlob();
    blobToSave.setName(finalName);

    const savedFile = targetFolder.createFile(blobToSave);

    // Make file viewable by link (optional – comment out if not desired)
    try {
      savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      // In some domains, public link sharing might be disabled – log but don't fail the request.
      console.warn('setSharing failed:', sharingError);
    }

    // 5) Build success response
    return jsonResponse(200, {
      id: savedFile.getId(),
      fileName: savedFile.getName(),
      url: savedFile.getUrl(),
      downloadUrl: savedFile.getDownloadUrl(),
      size: savedFile.getSize(),
      mimeType: savedFile.getMimeType(),
      folderId: targetFolder.getId(),
      folder: folderLabel || null
    });
  } catch (err) {
    console.error('doPost error:', err);
    return jsonResponse(500, {
      error: 'Unexpected server error.',
      detail: String(err)
    });
  }
}

// ---------------------------- Core Helpers ----------------------------- //

/**
 * Try to obtain a Blob from the incoming event. Prefer e.files (multipart/form-data),
 * but fall back to e.postData if needed.
 */
function extractFile(e, params) {
  // 1) Standard multipart/form-data: expect e.files
  if (e && e.files) {
    const keys = Object.keys(e.files);
    if (keys.length > 0) {
      // Prefer known field names (file, upload, data) when available
      const preferredKey = FILE_FIELD_PREFERENCES.find(name => keys.indexOf(name) !== -1);
      const fieldKey = preferredKey || keys[0];
      return e.files[fieldKey];
    }
  }

  // 2) Fallback: raw postData (e.g., when Apps Script didn't parse multipart)
  if (e && e.postData && e.postData.contents) {
    const suggestedName = (params && params.fileName) || 'upload.bin';
    const mimeType = e.postData.type || 'application/octet-stream';
    return Utilities.newBlob(e.postData.contents, mimeType, suggestedName);
  }

  return null; // No file found
}

/**
 * Build a safe, collision-resistant file name from requestedName, fileBlob, and folderLabel.
 */
function buildFileName(requestedName, fileBlob, folderLabel) {
  // 1) Base name from client or original blob name
  let baseName;
  if (requestedName && requestedName.length) {
    baseName = String(requestedName);
  } else if (fileBlob && fileBlob.getName && fileBlob.getName()) {
    baseName = fileBlob.getName();
  } else {
    baseName = 'upload.bin';
  }

  // Strip unsafe characters, keep letters, digits, dot, underscore, dash
  baseName = baseName.replace(/[^A-Za-z0-9._-]/g, '_');

  // 2) Split into name + extension
  let extension = '';
  const parts = baseName.split('.');
  if (parts.length > 1) {
    extension = '.' + parts.pop();
  }
  const safeBase = (parts.join('.') || 'upload').slice(0, 80); // guard against absurdly long names

  // 3) Add timestamp + random token for uniqueness
  const stamp = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd_HHmmss');
  const token = Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();

  // 4) Optional folder prefix in name (purely cosmetic / organizational)
  const prefix = folderLabel ? folderLabel + '_' : '';

  return prefix + safeBase + '_CH-' + stamp + '-' + token + extension;
}

/**
 * Sanitize folder label for use as Drive folder name.
 * Returns null if no label was provided, so the base folder is used directly.
 */
function sanitizeFolder(folder) {
  if (!folder) return null;
  const cleaned = String(folder).trim();
  if (!cleaned) return null;
  return cleaned.replace(/[^A-Za-z0-9_-]/g, '-').toLowerCase();
}

/**
 * Resolve the target Drive folder given a folderLabel.
 * - If folderLabel is null/undefined/empty: return the base folder.
 * - Otherwise, ensure a subfolder under the base folder with that name exists (create if needed).
 */
function resolveFolder(folderLabel) {
  try {
    const baseId = DEFAULT_FOLDER_ID || PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
    if (!baseId) {
      console.error('No DEFAULT_FOLDER_ID or DRIVE_FOLDER_ID script property set.');
      return null;
    }

    const baseFolder = DriveApp.getFolderById(baseId);

    if (!folderLabel) {
      return baseFolder;
    }

    const existing = baseFolder.getFoldersByName(folderLabel);
    if (existing.hasNext()) {
      return existing.next();
    }

    // Auto-create subfolder
    return baseFolder.createFolder(folderLabel);
  } catch (err) {
    console.error('resolveFolder error:', err);
    return null;
  }
}

/**
 * Build a JSON response body. Note: Google Apps Script does not support
 * custom HTTP status codes from Web Apps, so `status` is part of the JSON
 * envelope, while the HTTP status itself will typically be 200.
 */
function jsonResponse(statusCode, payload) {
  const body = JSON.stringify({
    status: statusCode,
    result: payload
  });

  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}
