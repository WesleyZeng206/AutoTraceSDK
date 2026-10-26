import crypto from 'crypto';
import { config } from '../config';

export const verifyKey = (header: string | string[] | undefined): boolean => {
  const key = config.security.adminApiKey;
  const provided = Array.isArray(header) ? header[0] : header;

  if (!key) {
    console.error('[SECURITY] API_KEY is not configured, denying aggregator access. ');
    return false;
  }

  if (!provided) return false;

  const a = Buffer.from(key);
  const b = Buffer.from(provided);

  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }

  return crypto.timingSafeEqual(a, b);
};
