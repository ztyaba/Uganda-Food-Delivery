# Uganda Food Delivery – Real-time ordering & logistics

Uganda Food Delivery is a full-stack sample platform inspired by apps like Grubhub that lets customers browse Kampala kitchens, place delivery orders, track couriers on a live map, and keep payments flowing to vendors and drivers. The project ships with three tailored portals that share the same lightweight Node.js backend.

## Experience highlights

### Customer app
- Browse a curated catalog of Ugandan restaurants with rich menus and hero photography.
- Build a cart, choose a delivery zone, and submit secure orders without creating an account.
- Receive an instant tracking code that renders live status updates, payment progress, and a dynamic route map that moves with the rider.

### Vendor console
- Log in to view active, completed, and cancelled orders scoped to your kitchen.
- Mark orders through preparing → ready for pickup → completed flows and assign available riders.
- Capture customer payments (mobile money, Cash App, Venmo) and record driver payouts with automatic wallet balance updates.
- Trigger withdrawals to real-world payout methods directly from the in-app vendor wallet.

### Driver tools
- Sign in to claim open pickups, see contact details, and progress deliveries with one-tap status updates.
- Preview how much the vendor still owes and watch wallet balances increase as payouts are recorded.
- Move earned funds to mobile money or cash apps using the embedded withdrawal flow.

## Running the project locally

1. **Install Node.js** – version 18 or newer is recommended.
2. **Start the server**
   ```bash
   cd server
   npm start
   ```
3. **Open the app** at [http://localhost:3000](http://localhost:3000) to access the customer portal. Use the navigation pills in the header to switch between the customer, vendor, and driver experiences.

### Demo credentials

| Portal  | Email                         | Password       |
|---------|-------------------------------|----------------|
| Vendor  | `vendor@ugandafood.app`       | `Vendor#2024`  |
| Driver  | `driver@ugandafood.app`       | `Driver#2024`  |
| Driver 2| `driver2@ugandafood.app`      | `Driver#2024`  |

The datastore also seeds dispatcher accounts (`dispatch@ugandafood.app`) if you wish to extend the backend with additional admin tooling.

## Architecture overview

- **Backend** – A dependency-free Node.js service located in `server/src` that handles authentication, order management, wallet accounting, and Server-Sent Events (SSE) for live refreshes.
- **Datastore** – JSON file persisted to `data/db.json` with seeded restaurants, delivery zones, menu items, vendors, drivers, wallets, and audit events.
- **Front-end** – Vanilla JavaScript single page interface in `client/` that renders role-specific dashboards, performs fetch requests, and draws delivery progress on a lightweight SVG route map.

### Key API routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/public/restaurants` | `GET` | Public catalog with restaurants and delivery zones. |
| `/api/public/orders` | `POST` | Create a customer order (no authentication required). |
| `/api/public/orders/:trackingCode` | `GET` | Retrieve public tracking data for an order. |
| `/api/auth/login` | `POST` | Obtain a bearer token for vendors or drivers. |
| `/api/orders` | `GET` | Role-aware order listing (vendor-only, driver-only, or dispatcher). |
| `/api/orders/:id/status` | `POST` | Advance order status and optional driver location. |
| `/api/orders/:id/assign-driver` | `POST` | Assign a driver (vendor/dispatcher only). |
| `/api/orders/:id/payments` | `POST` | Record inbound (customer) or outbound (driver) payments. |
| `/api/wallets/withdraw` | `POST` | Move wallet balances to mobile money, Cash App, or Venmo. |
| `/api/stream` | `GET` | SSE channel used by vendor/driver portals for real-time updates. |

## Extending the app

- Replace the JSON datastore with PostgreSQL or MongoDB by reimplementing the helpers in `server/src/db.js`.
- Add more delivery zones, restaurants, or menu variations by updating the seed data.
- Integrate a mapping SDK or GPS tracker to feed precise driver coordinates into the SSE stream.
- Swap the vanilla UI for a component framework (React/Vue/Svelte) if you prefer structured state management.

## License

MIT – for demonstration and educational purposes.
