const { verifyToken } = require('../utils/token');
const { findById } = require('../models/userModel');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [, token] = header.split(' ');
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const payload = verifyToken(token);
    const user = findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRoles
};
