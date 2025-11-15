const { readDatabase, transact } = require('../utils/db');
const { hashPassword } = require('../utils/password');

function findByEmail(email) {
  const db = readDatabase();
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

function findById(id) {
  const db = readDatabase();
  return db.users.find((user) => user.id === id);
}

function createUser({ role, email, fullName, password }) {
  return transact((db) => {
    const exists = db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      throw new Error('Email already registered');
    }
    const newUser = {
      id: `user_${role}_${Date.now()}`,
      role,
      email,
      fullName,
      passwordHash: hashPassword(password),
      walletId: null
    };
    db.users.push(newUser);
    return newUser;
  });
}

module.exports = {
  findByEmail,
  findById,
  createUser
};
