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
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { hashPassword, randomId } from './crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');
const DB_PATH = join(DATA_DIR, 'db.json');

function seedData() {
  const now = new Date().toISOString();

  const dispatcherId = randomId('usr_');
  const managerId = randomId('usr_');
  const vendorId = randomId('ven_');
  const vendorUserId = randomId('usr_');
  const vendorWalletId = randomId('wal_');
  const driverOneId = randomId('drv_');
  const driverOneUserId = randomId('usr_');
  const driverOneWalletId = randomId('wal_');
  const driverTwoId = randomId('drv_');
  const driverTwoUserId = randomId('usr_');
  const driverTwoWalletId = randomId('wal_');

  const restaurants = [
    {
      id: randomId('rst_'),
      vendorId,
      name: 'Mama Naki Kitchen',
      description: 'Beloved Kampala street classics made fresh with farm produce.',
      cuisine: 'Ugandan Homestyle',
      etaRange: '35-45 min',
      rating: 4.8,
      heroImage:
        'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80',
      tags: ['Rolex', 'Matooke', 'Street Food'],
      pickupAddress: 'Bukoto St, Kampala',
      pickupLocation: { lat: 0.3458, lng: 32.5936 },
      menu: [
        {
          id: randomId('itm_'),
          name: 'Kampala Rolex Wrap',
          description: 'Free-range eggs, tomatoes and cabbage rolled in a soft chapati.',
          price: 15000,
          image:
            'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80',
          tags: ['Popular']
        },
        {
          id: randomId('itm_'),
          name: 'Spiced Beef Pilau',
          description: 'Basmati rice cooked with cardamom, cinnamon and tender beef.',
          price: 28000,
          image:
            'https://images.unsplash.com/photo-1604908176997-12518821b521?auto=format&fit=crop&w=600&q=80',
          tags: ['Large']
        },
        {
          id: randomId('itm_'),
          name: 'Matooke with Groundnut Sauce',
          description: 'Steamed matooke served with creamy roasted groundnut sauce.',
          price: 23000,
          image:
            'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
          tags: ['Vegetarian']
        },
        {
          id: randomId('itm_'),
          name: 'Fresh Passion Juice',
          description: 'Cold-pressed passion fruit juice sweetened with local honey.',
          price: 7000,
          image:
            'https://images.unsplash.com/photo-1527169402691-feff5539e52c?auto=format&fit=crop&w=600&q=80',
          tags: ['Drink']
        }
      ]
    },
    {
      id: randomId('rst_'),
      vendorId,
      name: 'Jinja Grill House',
      description: 'Smoky Nile perch, nyama choma and charcoal grilled vegetables.',
      cuisine: 'BBQ & Grill',
      etaRange: '45-55 min',
      rating: 4.6,
      heroImage:
        'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=800&q=80',
      tags: ['Grill', 'Nile Perch', 'Nyama Choma'],
      pickupAddress: 'Lugogo Mall, Kampala',
      pickupLocation: { lat: 0.3325, lng: 32.5961 },
      menu: [
        {
          id: randomId('itm_'),
          name: 'Charcoal Nile Perch',
          description: 'Lake Victoria perch marinated with lemon, garlic and herbs.',
          price: 36000,
          image:
            'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=600&q=80',
          tags: ['Signature']
        },
        {
          id: randomId('itm_'),
          name: 'Nyama Choma Platter',
          description: 'Goat ribs, plantain and kachumbari with roasted chilli dip.',
          price: 42000,
          image:
            'https://images.unsplash.com/photo-1615937691196-01e5346d5cfd?auto=format&fit=crop&w=600&q=80',
          tags: ['Sharing']
        },
        {
          id: randomId('itm_'),
          name: 'Grilled Veggie Skewers',
          description: 'Charred courgette, peppers and onions brushed with peanut glaze.',
          price: 18000,
          image:
            'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=600&q=80',
          tags: ['Vegan']
        }
      ]
    }
  ];

  const deliveryZones = [
    {
      id: 'zone_central',
      name: 'Central Kampala',
      description: 'CBD, Kololo, Nakasero and Makerere',
      deliveryFee: 5000,
      center: { lat: 0.3476, lng: 32.5825 }
    },
    {
      id: 'zone_kira',
      name: 'Kira & Najjera',
      description: 'Kira, Najjera, Kiwatule, Ntinda',
      deliveryFee: 7000,
      center: { lat: 0.372, lng: 32.6333 }
    },
    {
      id: 'zone_entebbe',
      name: 'Entebbe Road',
      description: 'Lubowa, Zana, Kajjansi and Entebbe town',
      deliveryFee: 10000,
      center: { lat: 0.05, lng: 32.46 }
    }
  ];

  return {
    meta: {
      createdAt: now,
      updatedAt: now,
      currency: 'UGX'
    },
    users: [
      {
        id: dispatcherId,
        name: 'Control Center',
        email: 'dispatch@ugandafood.app',
        role: 'dispatcher',
        password: hashPassword('Dispatch#2024')
      },
      {
        id: managerId,
        name: 'Field Manager',
        email: 'manager@ugandafood.app',
        role: 'manager',
        password: hashPassword('Manager#2024')
      },
      {
        id: vendorUserId,
        name: 'Mama Naki',
        email: 'vendor@ugandafood.app',
        role: 'vendor',
        vendorId,
        password: hashPassword('Vendor#2024'),
        payoutMethods: ['mobile_money', 'cashapp', 'venmo']
      },
      {
        id: driverOneUserId,
        name: 'Amina Nalule',
        email: 'driver@ugandafood.app',
        role: 'driver',
        driverId: driverOneId,
        password: hashPassword('Driver#2024'),
        payoutMethods: ['mobile_money', 'cashapp', 'venmo']
      },
      {
        id: driverTwoUserId,
        name: 'Brian Okello',
        email: 'driver2@ugandafood.app',
        role: 'driver',
        driverId: driverTwoId,
        password: hashPassword('Driver#2024'),
        payoutMethods: ['mobile_money', 'cashapp', 'venmo']
      }
    ],
    vendors: [
      {
        id: vendorId,
        name: 'Mama Naki Collective',
        phone: '+256 780 123456',
        settlementAccounts: {
          mobile_money: '+256 780 123456',
          cashapp: '$mamanaki',
          venmo: '@mamanaki'
        }
      }
    ],
    drivers: [
      {
        id: driverOneId,
        userId: driverOneUserId,
        name: 'Amina Nalule',
        phone: '+256 700 123456',
        vehicle: 'Motorbike - UBH 452K',
        payoutPreference: 'mobile_money',
        serviceZones: ['zone_central', 'zone_kira']
      },
      {
        id: driverTwoId,
        userId: driverTwoUserId,
        name: 'Brian Okello',
        phone: '+256 772 998877',
        vehicle: 'Motorbike - UBN 225T',
        payoutPreference: 'mobile_money',
        serviceZones: ['zone_central', 'zone_entebbe']
      }
    ],
    restaurants,
    deliveryZones,
    wallets: [
      {
        id: vendorWalletId,
        ownerType: 'vendor',
        ownerId: vendorId,
        balance: 0,
        currency: 'UGX'
      },
      {
        id: driverOneWalletId,
        ownerType: 'driver',
        ownerId: driverOneId,
        balance: 0,
        currency: 'UGX'
      },
      {
        id: driverTwoWalletId,
        ownerType: 'driver',
        ownerId: driverTwoId,
        balance: 0,
        currency: 'UGX'
      }
    ],
    withdrawals: [],
    orders: [],
    payments: [],
    events: []
  };
}

function ensureDb() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DB_PATH)) {
    const seed = seedData();
function ensureDb() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DB_PATH)) {
    const now = new Date().toISOString();
    const defaultPassword = hashPassword('Dispatch#2024');
    const seed = {
      meta: {
        createdAt: now,
        updatedAt: now,
        currency: 'UGX'
      },
      users: [
        {
          id: randomId('usr_'),
          name: 'Control Center',
          email: 'dispatch@ugandafood.app',
          role: 'dispatcher',
          password: defaultPassword
        },
        {
          id: randomId('usr_'),
          name: 'Field Manager',
          email: 'manager@ugandafood.app',
          role: 'manager',
          password: hashPassword('Manager#2024')
        }
      ],
      drivers: [
        {
          id: randomId('drv_'),
          name: 'Amina Nalule',
          phone: '+256 700 123456',
          payoutPreference: 'mobile_money'
        },
        {
          id: randomId('drv_'),
          name: 'Brian Okello',
          phone: '+256 772 998877',
          payoutPreference: 'bank_transfer'
        }
      ],
      orders: [],
      payments: [],
      events: []
    };
    writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
  }
}

export function readDb() {
  ensureDb();
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}

export function writeDb(data) {
  const next = { ...data, meta: { ...(data.meta || {}), updatedAt: new Date().toISOString() } };
  writeFileSync(DB_PATH, JSON.stringify(next, null, 2));
}

export function updateDb(updater) {
  const db = readDb();
  const result = updater(db);
  writeDb(db);
  return result;
}

export function getDbPath() {
  ensureDb();
  return DB_PATH;
}
