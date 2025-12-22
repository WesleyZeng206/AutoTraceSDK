import crypto from 'crypto';

export const verifyKey = (header: string | string[] | undefined): boolean => {
  const key = process.env.API_KEY;
  if (!key) return true;

  const provided = Array.isArray(header) ? header[0] : header;

  if (!provided) return false;

  const a = Buffer.from(key);
  const b = Buffer.from(provided);

  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }

  return crypto.timingSafeEqual(a, b);
};
