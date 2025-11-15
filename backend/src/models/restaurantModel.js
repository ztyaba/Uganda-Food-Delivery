const { readDatabase, transact } = require('../utils/db');

function listRestaurants() {
  const db = readDatabase();
  return db.restaurants;
}

function findRestaurantById(id) {
  const db = readDatabase();
  return db.restaurants.find((restaurant) => restaurant.id === id);
}

function listByVendor(vendorId) {
  const db = readDatabase();
  return db.restaurants.filter((restaurant) => restaurant.vendorId === vendorId);
}

function addMenuItem(restaurantId, item) {
  return transact((db) => {
    const restaurant = db.restaurants.find((entry) => entry.id === restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }
    restaurant.menu.push(item);
    return item;
  });
}

module.exports = {
  listRestaurants,
  findRestaurantById,
  listByVendor,
  addMenuItem
};
