# Uganda Food Delivery Frontend

A polished, multi-role React application styled with Tailwind CSS and animated with Framer Motion. The app offers dedicated experiences for customers, vendors, and drivers while sharing a cohesive design language.

## Highlights
- Mobile-first layouts inspired by Uber Eats and DoorDash
- Animated transitions, carousels, and cart micro-interactions powered by Framer Motion
- Role-specific dashboards with charts, maps, and live order timelines
- React context providers for authentication and cart management
- Axios-powered API client that automatically injects JWT credentials

## Getting started
```bash
cd frontend
npm install
npm start
```

The development server listens on port 5173. Configure the backend origin via environment variables in a `.env` file:

```
VITE_API_BASE_URL=https://your-api.onrender.com
```

> **Tip:** Provide the backend origin without a trailing slash. The frontend automatically appends `/api` to reach the REST routes, so `https://your-api.onrender.com` becomes `https://your-api.onrender.com/api`.

VITE_API_BASE_URL=https://your-api.onrender.com/api
```

## Available scripts
- `npm start` – launch the Vite development server (with Tailwind JIT)
- `npm run build` – generate an optimized production bundle
- `npm run preview` – preview the production build locally

## Project structure
```
src/
  components/   # shared UI primitives and composites
  contexts/     # global app state providers (auth, cart)
  hooks/        # reusable data-fetching and animation hooks
  pages/        # route-level screens by role
  styles/       # Tailwind entrypoint and design tokens
```

## Design system
The Tailwind configuration defines custom colors, gradients, shadows, and typography to maintain consistency across all surfaces. Motion tokens keep animations cohesive across the customer, vendor, and driver spaces.
