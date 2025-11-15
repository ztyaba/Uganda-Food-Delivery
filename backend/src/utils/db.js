const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'db', 'database.json');

function readDatabase() {
  const content = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(content);
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function transact(mutator) {
  const data = readDatabase();
  const result = mutator(data);
  writeDatabase(data);
  return result;
}

module.exports = {
  readDatabase,
  writeDatabase,
  transact,
  DB_FILE
};
