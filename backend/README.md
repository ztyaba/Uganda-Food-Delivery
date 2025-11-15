# Uganda Food Delivery API

The Uganda Food Delivery API powers the multi-role platform for customers, restaurants, and drivers. It exposes REST endpoints secured with JWT, manages order lifecycle events, and keeps vendor/driver wallets in sync with customer payments.

## Features
- CommonJS Express server hardened with Helmet and CORS controls
- PBKDF2 password hashing with bcryptjs fallback for compatibility
- Role-specific routing for customers, vendors, drivers, and wallets
- JSON file datastore with transactional helpers
- Order lifecycle automation and wallet settlement flows

## Getting started
```bash
cd backend
npm install
npm start
```

The API listens on `PORT` (defaults to `4000`). Create a `.env` file to override configuration:

```
PORT=4000
APP_SECRET=super-secure-secret
```

## Default accounts
| Role | Email | Password |
| ---- | ----- | -------- |
| Customer | customer@ugandafood.app | Customer#2024 |
| Vendor | vendor@ugandafood.app | Vendor#2024 |
| Driver | driver@ugandafood.app | Driver#2024 |
| Admin | admin@ugandafood.app | Admin#2024 |

Use the admin account for seeding restaurants or managing payouts programmatically.

## Scripts
- `npm start` – run the production server
- `npm run dev` – run with `nodemon` for rapid development
- `npm run lint` – lint the codebase with the StandardJS preset

## Project structure
```
src/
  controllers/
  db/
  middleware/
  models/
  routes/
  utils/
  server.js
```

All business logic lives in controllers and models, while routes remain thin and middleware encapsulates authentication concerns.
