# Uganda Food Delivery – Secure Control Center

A modern, real-time food delivery platform tailored for Ugandan operators that unifies customer payments, driver payouts and live delivery tracking in a single secure control center.

The project is intentionally dependency-light and runs without external packages so it can operate in restricted or offline environments.

## Features

- **Unified payments ledger** – track inbound payments from customers and outbound payouts to drivers with tamper-evident timelines.
- **Dispatcher-friendly dashboard** – responsive control center with live metrics, delivery timelines and assignment workflows.
- **Real-time event stream** – Server-Sent Events (SSE) keeps the UI synchronized as orders are created, updated or paid.
- **Secure authentication** – PBKDF2 hashed credentials and HMAC-signed access tokens protect every request.
- **File-backed datastore** – resilient JSON datastore with automatic seeding and audit events.
- **Offline-ready stack** – zero third-party dependencies; everything runs on vanilla Node.js and browser APIs.

## Getting started

1. **Install Node.js** – version 18 or newer is recommended.
2. **Run the server**
   ```bash
   cd server
   npm start
   ```
3. **Open the control center** – navigate to [http://localhost:3000](http://localhost:3000).

### Default credentials

Two sample accounts are seeded automatically:

| Role        | Email                        | Password        |
|-------------|------------------------------|-----------------|
| Dispatcher  | `dispatch@ugandafood.app`    | `Dispatch#2024` |
| Field Lead  | `manager@ugandafood.app`     | `Manager#2024`  |

Use the dispatcher account to explore all flows.

## Development notes

- Datastore lives at `data/db.json`. It is created on first launch.
- Server endpoints are namespaced under `/api/*` and guarded by signed bearer tokens.
- Real-time updates are delivered through `/api/stream` using SSE.
- The front-end is a vanilla ES module app served from `/client`.

## Security highlights

- Credentials hashed with PBKDF2 (310k iterations, SHA-256).
- Custom JWT-style tokens signed with HMAC-SHA256 using `APP_SECRET` (override in environment).
- Requests guarded with security headers (HSTS recommended when deploying behind TLS).
- Payment and status events recorded with ISO timestamps to support reconciliation audits.

## Extending the platform

- Integrate with mobile money or card processors by enhancing the `/api/orders/:id/payments` route.
- Connect to GPS trackers to push live driver coordinates through additional SSE events.
- Replace the JSON datastore with PostgreSQL or another RDBMS by re-implementing `server/src/db.js`.
- Harden deployment with HTTPS termination, reverse proxying and rotating JWT secrets.

## License

MIT – see [`LICENSE`](LICENSE) if provided, otherwise treat as MIT for demonstration purposes.
