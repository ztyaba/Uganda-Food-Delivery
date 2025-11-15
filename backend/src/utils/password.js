const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `${salt}:${derived.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }
  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':');
    const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived);
  }
  if (storedHash.startsWith('$2')) {
    return bcrypt.compareSync(password, storedHash);
  }
  return false;
}

module.exports = {
  hashPassword,
  verifyPassword
};
