# Uganda Food Delivery Platform

A production-grade, multi-role food delivery platform inspired by Uber Eats, rebuilt from the ground up with a modern UX, rich animations, and a CommonJS Node.js backend. The system includes distinct customer, vendor, and driver experiences that stay in sync through a shared API and wallet infrastructure.

## Project structure
```
/                       # Monorepo root
├── backend/            # Node.js + Express API (CommonJS)
│   ├── src/
│   │   ├── controllers/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── server.js
│   └── package.json
└── frontend/           # React + Tailwind + Framer Motion app
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── contexts/
    │   ├── hooks/
    │   ├── pages/
    │   └── styles/
    └── package.json
```

## Quick start
### Backend
```bash
cd backend
npm install
npm start
```
The API listens on `http://localhost:4000` by default. Configure `PORT` and `APP_SECRET` via environment variables if needed.

### Frontend
```bash
cd frontend
npm install
npm start
```
The React app launches on `http://localhost:5173` and expects the backend to be reachable at `VITE_API_BASE_URL` (defaults to `http://localhost:4000/api`). The URL should point to your backend root without a trailing slash; the UI will automatically append `/api` as needed.

## Demo credentials
| Role | Email | Password |
| ---- | ----- | -------- |
| Customer | customer@ugandafood.app | Customer#2024 |
| Vendor | vendor@ugandafood.app | Vendor#2024 |
| Driver | driver@ugandafood.app | Driver#2024 |

## Key features
- **Customer app**: animated browsing, sticky cart micro-interactions, expressive checkout, and real-time tracking with a live map.
- **Vendor app**: kitchen dashboard, animated status updates, revenue metrics, and wallet payouts to mobile money or US fintech rails.
- **Driver app**: fluid job acceptance, navigation-ready map previews, and earnings management with animated progress.
- **Secure backend**: CommonJS Express server with JWT auth, PBKDF2 passwords, and wallet accounting for customer→vendor→driver flows.
- **Render-ready**: both packages run with `npm install && npm start`, avoiding ES modules to keep deployment frictionless.

## Testing
Manual testing can be performed by running the backend server and frontend dev server simultaneously. The backend includes a `/health` endpoint for Render health checks.
