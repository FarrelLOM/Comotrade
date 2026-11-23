import { createHash } from 'node:crypto';

export function buildCloudinarySignature({ timestamp, folder, publicId, apiSecret }) {
  if (!apiSecret) throw new Error('Cloudinary API secret is not configured.');
  const params = {};
  if (folder) params.folder = folder;
  if (publicId) params.public_id = publicId;
  if (timestamp) params.timestamp = String(timestamp);
  const payload = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

export function isValidCloudinaryOrLocalUrl(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith('/')) return true;
  try {
    const url = new URL(normalized);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}
