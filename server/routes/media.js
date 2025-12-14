import crypto from 'crypto';
import { Router } from 'express';
import { authGuard } from '../middleware/auth.js';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

function generateUploadSignature({ fileName, folder, mimeType, nonce, timestamp }, secretKey) {
  const canonicalString =
    `fileName=${fileName}` +
    `&folder=${folder}` +
    `&mimeType=${mimeType}` +
    `&nonce=${nonce}` +
    `&timestamp=${timestamp}`;

  return crypto
    .createHmac('sha256', secretKey)
    .update(canonicalString)
    .digest('base64');
}

router.post('/presign', authGuard, (req, res) => {
  const { mimeType, folder } = req.body || {};
  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return res.status(400).json({ error: 'Unsupported or missing mimeType.' });
  }

  if (!process.env.MEDIA_UPLOAD_URL) {
    return res.status(500).json({ error: 'MEDIA_UPLOAD_URL is not configured on the server.' });
  }

  const uploadSecret = process.env.MEDIA_UPLOAD_SECRET_KEY || process.env.OTP_SECRET_KEY;
  if (!uploadSecret) {
    return res.status(500).json({ error: 'MEDIA_UPLOAD_SECRET_KEY is not configured on the server.' });
  }

  const targetFolder = sanitizeFolder(folder);
  const fileName = buildFileName(targetFolder, mimeType);

  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const signature = generateUploadSignature(
    { fileName, folder: targetFolder, mimeType, nonce, timestamp },
    uploadSecret
  );

  res.json({
    uploadUrl: process.env.MEDIA_UPLOAD_URL,
    fileName,
    folder: targetFolder,
    mimeType,
    nonce,
    timestamp,
    signature,
    headers: {
      // Frontend can use this to send the request to the Apps Script endpoint
      'X-Requested-By': 'blanc',
    },
    instructions:
      'Send a POST multipart/form-data with fields "file" (binary), "fileName", "folder", "mimeType", "nonce", "timestamp", and "signature" to uploadUrl. The script will respond with a public link.',
  });
});

function buildFileName(folder, mimeType) {
  const extension = mimeType.split('/')[1] || 'bin';
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  const prefix = folder ? `${folder}_` : '';
  return `${prefix}CH-${timestamp}-${token}.${extension}`;
}

function sanitizeFolder(folder) {
  if (!folder) return 'media';
  return String(folder).replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
}

export default router;
