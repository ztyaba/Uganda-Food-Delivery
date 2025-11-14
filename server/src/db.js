import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { hashPassword, randomId } from './crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data');
const DB_PATH = join(DATA_DIR, 'db.json');

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
