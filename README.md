# Uganda Food Delivery

A lightweight demo food delivery application featuring a static client and a small Node.js API. Customers can browse restaurants, add menu items to a cart, and submit a basic order. The data is stored in a local JSON file for easy development.

## Getting started

1. Install Node.js 18 or newer (Node 22 works as well).
2. Install dependencies:

   ```bash
   cd server
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Open `http://localhost:3000` in your browser.

The API serves the static client and exposes the following endpoints:

- `GET /api/restaurants` – List available restaurants and menu items.
- `GET /api/restaurants/:id` – Get details for a single restaurant.
- `POST /api/orders` – Submit a new order.
- `GET /api/orders/:id` – Retrieve an order by its id.

Orders are appended to `server/data/db.json`. Delete that file to reset the dataset.
