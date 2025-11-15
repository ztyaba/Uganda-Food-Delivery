const jwt = require('jsonwebtoken');

const APP_SECRET = process.env.APP_SECRET || 'development-secret';
const TOKEN_TTL = '12h';

function signToken(payload) {
  return jwt.sign(payload, APP_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  return jwt.verify(token, APP_SECRET);
}

module.exports = {
  signToken,
  verifyToken
};
