import crypto from 'crypto';

const APP_SECRET = process.env.APP_SECRET || 'uganda-food-delivery-secret-key-change-me';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedValue) {
  if (!storedValue) return false;
  const [salt, originalHash] = storedValue.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

export function createToken(payload, expiresInSeconds = 60 * 60 * 12) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: issuedAt, exp: issuedAt + expiresInSeconds };

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(body)}`;
  const signature = crypto.createHmac('sha256', APP_SECRET).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedBody, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedBody}`;
  const expectedSignature = crypto.createHmac('sha256', APP_SECRET).update(unsigned).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
  } catch (err) {
    return null;
  }
  const payload = JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    return null;
  }
  return payload;
}

export function randomId(prefix = '') {
  if (crypto.randomUUID) {
    return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return (
    prefix +
    crypto
      .randomBytes(12)
      .toString('hex')
      .slice(0, 12)
  );
}
