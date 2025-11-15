const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function readDb() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function listRestaurants() {
  return readDb().restaurants;
}

function findRestaurant(id) {
  return listRestaurants().find((item) => item.id === id);
}

function createOrder(payload) {
  const db = readDb();
  const order = {
    id: `order-${Date.now()}`,
    restaurantId: payload.restaurantId,
    items: payload.items || [],
    customer: payload.customer || {},
    notes: payload.notes || '',
    status: 'pending',
    placedAt: new Date().toISOString()
  };

  db.orders.push(order);
  writeDb(db);
  return order;
}

function getOrder(id) {
  const db = readDb();
  return db.orders.find((item) => item.id === id) || null;
}

module.exports = {
  DB_PATH,
  readDb,
  writeDb,
  listRestaurants,
  findRestaurant,
  createOrder,
  getOrder
};
