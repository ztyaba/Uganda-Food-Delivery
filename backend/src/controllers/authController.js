const { findByEmail, findById } = require('../models/userModel');
const { verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/token');
const { walletSummary } = require('../models/walletModel');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = signToken({ sub: user.id, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
        wallet: walletSummary(user.role, user.id)
      }
    });
  } catch (error) {
    next(error);
  }
}

function profile(req, res, next) {
  try {
    const user = findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user.id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
      wallet: walletSummary(user.role, user.id)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  profile
};
