(function () {
  const restaurantList = document.getElementById('restaurant-list');
  const restaurantTemplate = document.getElementById('restaurant-template');
  const menuTemplate = document.getElementById('menu-item-template');
  const cartContainer = document.getElementById('cart-items');
  const placeOrderBtn = document.getElementById('place-order');
  const orderStatus = document.getElementById('order-status');

  let currentRestaurant = null;
  let cart = [];

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      maximumFractionDigits: 0
    }).format(value);
  }

  function renderCart() {
    cartContainer.innerHTML = '';
    if (!cart.length) {
      cartContainer.innerHTML = '<p>No items yet.</p>';
      placeOrderBtn.disabled = true;
      return;
    }

    cart.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <span>${item.name}</span>
        <div>
          <span>${formatCurrency(item.price)}</span>
          <button class="remove" data-index="${index}">Remove</button>
        </div>
      `;
      cartContainer.appendChild(row);
    });

    cartContainer.querySelectorAll('.remove').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        cart.splice(index, 1);
        renderCart();
      });
    });

    placeOrderBtn.disabled = false;
  }

  function renderRestaurants(restaurants) {
    restaurantList.innerHTML = '';
    restaurants.forEach((restaurant) => {
      const node = restaurantTemplate.content.cloneNode(true);
      node.querySelector('.restaurant-name').textContent = restaurant.name;
      node.querySelector('.restaurant-meta').textContent = `${restaurant.cuisine} · ${formatCurrency(
        restaurant.deliveryFee
      )} delivery · ${restaurant.estimatedTime} mins`;

      const menuRoot = node.querySelector('.menu');
      restaurant.menu.forEach((item) => {
        const menuNode = menuTemplate.content.cloneNode(true);
        const button = menuNode.querySelector('.add-item');
        const price = menuNode.querySelector('.price');
        button.textContent = item.name;
        price.textContent = formatCurrency(item.price);
        button.addEventListener('click', () => {
          currentRestaurant = restaurant.id;
          cart.push({
            id: item.id,
            name: item.name,
            price: item.price
          });
          renderCart();
        });
        menuRoot.appendChild(menuNode);
      });

      restaurantList.appendChild(node);
    });
  }

  async function loadRestaurants() {
    try {
      const { restaurants } = await window.Api.listRestaurants();
      renderRestaurants(restaurants);
    } catch (err) {
      restaurantList.innerHTML = '<p class="error">Unable to load restaurants.</p>';
      console.error(err);
    }
  }

  placeOrderBtn.addEventListener('click', async () => {
    if (!currentRestaurant || !cart.length) {
      return;
    }
    placeOrderBtn.disabled = true;
    orderStatus.textContent = 'Sending order...';
    try {
      const payload = {
        restaurantId: currentRestaurant,
        items: cart.map((item) => ({ id: item.id, name: item.name, price: item.price })),
        customer: {
          name: 'Guest User'
        }
      };
      const { order } = await window.Api.createOrder(payload);
      orderStatus.textContent = `Order ${order.id} placed! Status: ${order.status}`;
      cart = [];
      renderCart();
    } catch (err) {
      orderStatus.textContent = err.message;
      placeOrderBtn.disabled = false;
    }
  });

  loadRestaurants();
  renderCart();
})();
import * as api from './api.js';

const state = {
  activeRole: 'customer',
  catalog: { restaurants: [], deliveryZones: [] },
  catalogLoaded: false,
  sessions: {
    vendor: null,
    driver: null
  },
  customer: {
    selectedRestaurantId: null,
    cart: [],
    trackingCode: null,
    trackedOrder: null,
    trackerInterval: null,
    isSubmitting: false
  },
  authLoading: {
    vendor: false,
    driver: false
  }
};

const root = document.getElementById('view-root');
const toastStack = document.getElementById('toast');
const roleButtons = Array.from(document.querySelectorAll('.role-button'));

const currencyFormatter = new Intl.NumberFormat('en-UG', {
  style: 'currency',
  currency: 'UGX',
  maximumFractionDigits: 0
});

const statusLabels = {
  placed: 'Placed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  accepted: 'Driver assigned',
  picked_up: 'Picked up',
  en_route: 'En route',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

function el(tag, options = {}, ...children) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text != null) element.textContent = options.text;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value != null) {
        element.setAttribute(key, value);
      }
    });
  }
  children.flat().forEach((child) => {
    if (child == null) return;
    element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return element;
}

function formatCurrency(amount) {
  return currencyFormatter.format(Math.max(0, Number(amount) || 0));
}

function formatTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatStatus(status) {
  return statusLabels[status] || status;
}

function showToast(message, type = 'info') {
  if (!toastStack) return;
  const toast = el('div', { className: `toast${type !== 'info' ? ' ' + type : ''}` }, message);
  toastStack.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4200);
}

roleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const role = button.dataset.role;
    setActiveRole(role);
  });
});

init();

async function init() {
  await loadCatalog();
  updateNav();
  render();
}

function updateNav() {
  roleButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.role === state.activeRole);
  });
}

function setActiveRole(role) {
  if (state.activeRole === role) return;
  if (state.activeRole === 'vendor') disconnectSse('vendor');
  if (state.activeRole === 'driver') disconnectSse('driver');
  state.activeRole = role;
  updateNav();
  render();
  if (role === 'vendor' && state.sessions.vendor) {
    connectSse('vendor');
    if (!state.sessions.vendor.orders.length) {
      loadSessionData('vendor');
    }
  }
  if (role === 'driver' && state.sessions.driver) {
    connectSse('driver');
    if (!state.sessions.driver.orders.length) {
      loadSessionData('driver');
    }
  }
}

async function loadCatalog() {
  try {
    const data = await api.fetchPublicCatalog();
    state.catalog = data;
    state.catalogLoaded = true;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function render() {
  if (!root) return;
  root.innerHTML = '';
  if (state.activeRole === 'customer') {
    root.appendChild(renderCustomerView());
  } else if (state.activeRole === 'vendor') {
    root.appendChild(renderVendorView());
  } else if (state.activeRole === 'driver') {
    root.appendChild(renderDriverView());
  }
}

// Customer experience -----------------------------------------------------

function renderCustomerView() {
  const container = el('div', { className: 'customer-view' });
  container.appendChild(renderCustomerHero());
  container.appendChild(renderTrackingSearch());
  container.appendChild(renderRestaurantSection());
  if (state.customer.selectedRestaurantId) {
    container.appendChild(renderMenuAndCart());
  }
  if (state.customer.trackedOrder) {
    container.appendChild(renderOrderTracker(state.customer.trackedOrder));
  }
  return container;
}

function renderCustomerHero() {
  const hero = el('section', { className: 'hero-card' });
  hero.append(
    el('h2', { text: 'Local food delivered with mobile money precision.' }),
    el('p', {
      text:
        'Browse top Kampala kitchens, pay securely through mobile money or cash apps and watch your courier move across the city in real time.'
    })
  );
  const actions = el('div', { className: 'hero-actions' });
  actions.append(
    el(
      'button',
      {
        className: 'primary-button',
        attrs: { type: 'button' }
      },
      'Start an order'
    ),
    el(
      'button',
      {
        className: 'secondary-button',
        attrs: { type: 'button' }
      },
      'Track existing order'
    )
  );
  hero.appendChild(actions);
  return hero;
}

function renderRestaurantSection() {
  const section = el('section');
  section.appendChild(el('h2', { className: 'section-title', text: 'Popular nearby kitchens' }));
  const grid = el('div', { className: 'restaurant-grid' });
  if (!state.catalog.restaurants.length) {
    grid.appendChild(el('div', { className: 'empty-state', text: 'Loading restaurants…' }));
  } else {
    state.catalog.restaurants.forEach((restaurant) => {
      const card = el('article', {
        className: `restaurant-card${state.customer.selectedRestaurantId === restaurant.id ? ' active' : ''}`
      });
      const image = el('img', {
        attrs: { src: restaurant.heroImage, alt: `${restaurant.name} hero` }
      });
      const body = el('div', { className: 'card-body' });
      body.append(
        el('h3', { text: restaurant.name }),
        el('span', { className: 'tag-strip', text: `${restaurant.cuisine} • ${restaurant.etaRange} • ⭐ ${restaurant.rating}` }),
        el('div', {
          className: 'tag-strip'
        },
        restaurant.tags.map((tag) => el('span', { className: 'tag-pill', text: tag })))
      );
      card.append(image, body);
      card.addEventListener('click', () => {
        state.customer.selectedRestaurantId = restaurant.id;
        if (!state.customer.cart.length || state.customer.cart[0]?.restaurantId !== restaurant.id) {
          state.customer.cart = [];
        }
        render();
      });
      grid.appendChild(card);
    });
  }
  section.appendChild(grid);
  return section;
}

function renderMenuAndCart() {
  const container = el('div', { className: 'split-grid' });
  const restaurant = state.catalog.restaurants.find((item) => item.id === state.customer.selectedRestaurantId);
  if (!restaurant) {
    container.appendChild(el('div', { className: 'empty-state', text: 'Select a restaurant to view the menu.' }));
    return container;
  }
  const menuPanel = el('section', { className: 'menu-panel' });
  menuPanel.appendChild(el('h3', { text: `${restaurant.name} menu` }));
  const grid = el('div', { className: 'menu-grid' });
  restaurant.menu.forEach((item) => {
    const card = el('article', { className: 'menu-item' });
    card.append(
      el('h4', { text: item.name }),
      el('p', { text: item.description }),
      el('strong', { text: formatCurrency(item.price) }),
      el(
        'button',
        {
          className: 'primary-button',
          attrs: { type: 'button' }
        },
        'Add to cart'
      )
    );
    card.querySelector('button').addEventListener('click', () => addItemToCart(restaurant.id, item.id));
    grid.appendChild(card);
  });
  menuPanel.appendChild(grid);
  container.appendChild(menuPanel);
  container.appendChild(renderCartPanel(restaurant));
  return container;
}

function addItemToCart(restaurantId, menuItemId) {
  const restaurant = state.catalog.restaurants.find((item) => item.id === restaurantId);
  const menuItem = restaurant?.menu.find((item) => item.id === menuItemId);
  if (!restaurant || !menuItem) return;
  const existing = state.customer.cart.find((item) => item.menuItemId === menuItemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.customer.cart.push({
      restaurantId,
      menuItemId,
      name: menuItem.name,
      price: menuItem.price,
      quantity: 1
    });
  }
  render();
}

function adjustCartItem(menuItemId, delta) {
  const entry = state.customer.cart.find((item) => item.menuItemId === menuItemId);
  if (!entry) return;
  entry.quantity += delta;
  if (entry.quantity <= 0) {
    state.customer.cart = state.customer.cart.filter((item) => item.menuItemId !== menuItemId);
  }
  render();
}

function renderCartPanel(restaurant) {
  const panel = el('section', { className: 'cart-panel' });
  panel.appendChild(el('h3', { text: 'Your order' }));
  if (!state.customer.cart.length) {
    panel.appendChild(el('div', { className: 'cart-empty', text: 'Add dishes to begin checkout.' }));
    return panel;
  }
  const items = el('div', { className: 'cart-items' });
  state.customer.cart.forEach((item) => {
    const row = el('div', { className: 'cart-row' });
    row.append(
      el('div', { text: `${item.name}` }),
      (() => {
        const controls = el('div', { className: 'qty-controls' });
        const decrement = el('button', { attrs: { type: 'button' }, text: '−' });
        const qty = el('span', { text: String(item.quantity) });
        const increment = el('button', { attrs: { type: 'button' }, text: '+' });
        decrement.addEventListener('click', () => adjustCartItem(item.menuItemId, -1));
        increment.addEventListener('click', () => adjustCartItem(item.menuItemId, 1));
        controls.append(decrement, qty, increment);
        return controls;
      })(),
      el('strong', { text: formatCurrency(item.price * item.quantity) })
    );
    items.appendChild(row);
  });
  panel.appendChild(items);
  const subtotal = state.customer.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const summary = el('div', { className: 'summary-row' });
  summary.append(el('span', { text: 'Subtotal' }), el('span', { text: formatCurrency(subtotal) }));
  panel.appendChild(summary);
  const form = el('form', { className: 'checkout-form' });
  form.innerHTML = `
    <label>Full name<input name="customerName" required placeholder="Customer name" /></label>
    <label>Phone number<input name="customerPhone" required placeholder="Mobile money number" /></label>
    <label>Delivery address<input name="dropoffAddress" required placeholder="Estate, street &amp; block" /></label>
    <label>Delivery zone
      <select name="dropoffZoneId" required>
        <option value="">Select delivery zone</option>
        ${state.catalog.deliveryZones
          .map((zone) => `<option value="${zone.id}">${zone.name} • ${formatCurrency(zone.deliveryFee)}</option>`)
          .join('')}
      </select>
    </label>
    <label>Notes for the kitchen<textarea name="notes" placeholder="Allergies, delivery instructions, etc."></textarea></label>
  `;
  const submit = el(
    'button',
    {
      className: 'primary-button',
      attrs: { type: 'submit', disabled: state.customer.isSubmitting ? 'disabled' : null }
    },
    state.customer.isSubmitting ? 'Placing order…' : 'Place order & track'
  );
  form.appendChild(submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitCustomerOrder(form, restaurant);
  });
  panel.appendChild(form);
  return panel;
}

async function submitCustomerOrder(form, restaurant) {
  if (!restaurant || !state.customer.cart.length) {
    showToast('Add menu items before placing an order.', 'error');
    return;
  }
  const formData = new FormData(form);
  const payload = {
    restaurantId: restaurant.id,
    customerName: formData.get('customerName')?.toString().trim(),
    customerPhone: formData.get('customerPhone')?.toString().trim(),
    dropoffAddress: formData.get('dropoffAddress')?.toString().trim(),
    dropoffZoneId: formData.get('dropoffZoneId'),
    notes: formData.get('notes')?.toString().trim() || '',
    items: state.customer.cart.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity }))
  };
  if (!payload.customerName || !payload.customerPhone || !payload.dropoffAddress || !payload.dropoffZoneId) {
    showToast('Please complete the delivery details.', 'error');
    return;
  }
  state.customer.isSubmitting = true;
  render();
  try {
    const result = await api.createCustomerOrder(payload);
    const order = result.order;
    state.customer.cart = [];
    state.customer.isSubmitting = false;
    state.customer.trackedOrder = order;
    state.customer.trackingCode = order.trackingCode;
    showToast('Order placed! Tracking live updates.', 'success');
    startTracking(order.trackingCode, order);
  } catch (err) {
    state.customer.isSubmitting = false;
    showToast(err.message, 'error');
    render();
  }
}

function renderTrackingSearch() {
  const card = el('section', { className: 'tracking-search' });
  card.appendChild(el('h3', { text: 'Already ordered? Track it here.' }));
  const form = el('form');
  const input = el('input', {
    attrs: {
      name: 'trackingCode',
      placeholder: 'Enter tracking code (e.g. UG-2024-0001)',
      value: state.customer.trackingCode || ''
    }
  });
  const submit = el('button', { className: 'secondary-button', attrs: { type: 'submit' } }, 'Track order');
  form.append(input, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = input.value.trim();
    if (!code) {
      showToast('Enter a tracking code to monitor your order.', 'error');
      return;
    }
    startTracking(code);
  });
  if (state.customer.trackedOrder) {
    const stop = el(
      'button',
      {
        className: 'secondary-button',
        attrs: { type: 'button' }
      },
      'Stop tracking'
    );
    stop.addEventListener('click', () => stopTracking());
    form.appendChild(stop);
  }
  card.appendChild(form);
  return card;
}

function renderOrderTracker(order) {
  const tracker = el('section', { className: 'order-tracker' });
  const header = el('div', { className: 'tracking-header' });
  const status = el('span', {
    className: 'status-pill',
    attrs: { 'data-status': order.status },
    text: `${formatStatus(order.status)} • ${order.code}`
  });
  header.append(status);
  tracker.appendChild(header);

  const infoRow = el('div', { className: 'order-info-row' });
  infoRow.append(
    el('div', {},
      el('strong', { text: 'Restaurant' }),
      el('p', { text: order.restaurant?.name || '—' })
    ),
    el('div', {},
      el('strong', { text: 'Delivering to' }),
      el('p', { text: order.dropoffAddress || '—' })
    ),
    el('div', {},
      el('strong', { text: 'Driver' }),
      el('p', { text: order.driver ? `${order.driver.name} (${order.driver.phone})` : 'Waiting for assignment' })
    )
  );
  tracker.appendChild(infoRow);

  const mapWrapper = el('div', { className: 'route-map' });
  tracker.appendChild(mapWrapper);
  renderRouteMap(mapWrapper, order);

  const timeline = el('div', { className: 'timeline' });
  order.timeline.forEach((event) => {
    timeline.appendChild(
      el(
        'div',
        { className: 'timeline-item' },
        el('strong', { text: event.title }),
        el('span', { text: event.detail }),
        el('span', { text: formatTime(event.createdAt) })
      )
    );
  });
  tracker.appendChild(timeline);

  const totals = el('div', { className: 'order-totals' });
  totals.append(
    el('span', { text: `Subtotal ${formatCurrency(order.charges?.subtotal || 0)}` }),
    el('span', { text: `Delivery ${formatCurrency(order.charges?.deliveryFee || 0)}` }),
    el('span', { text: `Total ${formatCurrency(order.charges?.total || 0)}` })
  );
  tracker.appendChild(totals);

  const actions = el('div', { className: 'tracking-actions' });
  const refresh = el('button', { className: 'secondary-button', attrs: { type: 'button' } }, 'Refresh status');
  refresh.addEventListener('click', () => loadTrackedOrder({ silent: true }));
  actions.appendChild(refresh);
  tracker.appendChild(actions);

  return tracker;
}

function startTracking(code, initialOrder = null) {
  stopTracking();
  state.customer.trackingCode = code;
  if (initialOrder) {
    state.customer.trackedOrder = initialOrder;
  }
  loadTrackedOrder({ silent: Boolean(initialOrder) });
  state.customer.trackerInterval = setInterval(() => loadTrackedOrder({ silent: true }), 6500);
  render();
}

function stopTracking() {
  if (state.customer.trackerInterval) {
    clearInterval(state.customer.trackerInterval);
  }
  state.customer.trackerInterval = null;
  state.customer.trackedOrder = null;
  state.customer.trackingCode = null;
  render();
}

async function loadTrackedOrder({ silent = false } = {}) {
  if (!state.customer.trackingCode) return;
  try {
    const response = await api.trackOrder(state.customer.trackingCode);
    state.customer.trackedOrder = response.order;
    if (!silent) {
      showToast('Order status refreshed.', 'success');
    }
    render();
  } catch (err) {
    showToast(err.message, 'error');
    stopTracking();
  }
}

function renderRouteMap(container, order) {
  container.innerHTML = '';
  const pickup = order.pickupLocation;
  const dropoff = order.dropoffLocation;
  if (!pickup || !dropoff) {
    container.appendChild(el('div', { text: 'Waiting for live location data…' }));
    return;
  }
  const progress = Math.min(1, Math.max(0, order.progress ?? 0));
  const driverPoint = order.driverLocation || interpolatePoint(pickup, dropoff, progress);
  const points = [pickup, dropoff, driverPoint].filter(Boolean);
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const padding = 0.01;
  const minLat = Math.min(...lats) - padding;
  const maxLat = Math.max(...lats) + padding;
  const minLng = Math.min(...lngs) - padding;
  const maxLng = Math.max(...lngs) + padding;
  const project = (point) => {
    const x = ((point.lng - minLng) / (maxLng - minLng || 1)) * 100;
    const y = (1 - (point.lat - minLat) / (maxLat - minLat || 1)) * 100;
    return { x, y };
  };
  const pickupPoint = project(pickup);
  const dropoffPoint = project(dropoff);
  const driverProjected = project(driverPoint);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const routeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  routeLine.setAttribute('x1', pickupPoint.x);
  routeLine.setAttribute('y1', pickupPoint.y);
  routeLine.setAttribute('x2', dropoffPoint.x);
  routeLine.setAttribute('y2', dropoffPoint.y);
  routeLine.setAttribute('class', 'route-line');
  svg.appendChild(routeLine);

  const progressLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  progressLine.setAttribute('x1', pickupPoint.x);
  progressLine.setAttribute('y1', pickupPoint.y);
  progressLine.setAttribute('x2', driverProjected.x);
  progressLine.setAttribute('y2', driverProjected.y);
  progressLine.setAttribute('class', 'progress-line');
  svg.appendChild(progressLine);

  svg.appendChild(createMarkerCircle(pickupPoint, 'marker-pickup'));
  svg.appendChild(createMarkerCircle(dropoffPoint, 'marker-dropoff'));
  svg.appendChild(createMarkerCircle(driverProjected, 'marker-driver', 4.5));

  container.appendChild(svg);
}

function createMarkerCircle(point, className, radius = 4) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', point.x);
  circle.setAttribute('cy', point.y);
  circle.setAttribute('r', radius);
  circle.setAttribute('class', className);
  return circle;
}

function interpolatePoint(start, end, t) {
  return {
    lat: start.lat + (end.lat - start.lat) * t,
    lng: start.lng + (end.lng - start.lng) * t
  };
}

// Vendor dashboard -------------------------------------------------------

function renderVendorView() {
  const session = state.sessions.vendor;
  if (!session) {
    return renderAuthCard('vendor');
  }
  const container = el('div', { className: 'dashboard vendor-dashboard' });
  const header = el('div', { className: 'dashboard-header' });
  header.append(
    el('div', {}, el('h2', { text: `Welcome back, ${session.user.name}` }), el('p', { text: 'Monitor kitchen orders, payments and rider payouts.' })),
    el(
      'button',
      { className: 'secondary-button', attrs: { type: 'button' } },
      'Sign out'
    )
  );
  header.querySelector('button').addEventListener('click', () => logout('vendor'));
  container.appendChild(header);
  container.appendChild(renderWalletCard(session, 'vendor'));
  container.appendChild(renderWithdrawForm(session, 'vendor'));
  if (session.isLoading && !session.orders.length) {
    container.appendChild(el('div', { className: 'empty-state', text: 'Loading orders…' }));
  } else {
    container.appendChild(renderVendorOrders(session));
  }
  return container;
}

function renderVendorOrders(session) {
  const section = el('section', { className: 'order-list' });
  const active = session.orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
  const completed = session.orders.filter((order) => ['delivered', 'cancelled'].includes(order.status));
  const activeBlock = el('div');
  activeBlock.appendChild(el('h3', { text: 'Active orders' }));
  if (!active.length) {
    activeBlock.appendChild(el('div', { className: 'empty-state', text: 'No active orders. Customers see you in the catalog.' }));
  } else {
    active.forEach((order) => activeBlock.appendChild(createVendorOrderCard(order, session)));
  }
  section.appendChild(activeBlock);
  if (completed.length) {
    const completedBlock = el('div');
    completedBlock.appendChild(el('h3', { text: 'Recently completed' }));
    completed.slice(0, 5).forEach((order) => completedBlock.appendChild(createVendorOrderCard(order, session)));
    section.appendChild(completedBlock);
  }
  return section;
}

function createVendorOrderCard(order, session) {
  const card = el('article', { className: 'order-card' });
  const header = el('header');
  header.append(
    el('h3', { text: `${order.code} • ${order.customerName}` }),
    el('span', { className: 'status-pill', attrs: { 'data-status': order.status }, text: formatStatus(order.status) })
  );
  card.appendChild(header);
  const meta = el('div', { className: 'order-meta' });
  meta.append(
    el('span', { text: `Deliver to: ${order.dropoffAddress}` }),
    el('span', { text: `Contact: ${order.customerPhone}` }),
    el('span', { text: `Driver: ${order.driver?.name || 'Not assigned'}` })
  );
  card.appendChild(meta);
  const items = el('div', { className: 'item-list' });
  order.items.forEach((item) => {
    items.appendChild(el('div', { text: `${item.quantity} × ${item.name}` }));
  });
  card.appendChild(items);
  const totals = el('div', { className: 'order-totals' });
  totals.append(
    el('span', { text: `Total ${formatCurrency(order.charges?.total)}` }),
    el('span', { text: `Customer paid ${formatCurrency(order.inboundPaid)}` }),
    el('span', { text: `Driver paid ${formatCurrency(order.outboundPaid)}` })
  );
  card.appendChild(totals);

  const payments = el('div', { className: 'order-payments' });
  if (order.charges?.total && order.inboundPaid < order.charges.total) {
    payments.appendChild(el('span', { className: 'badge warning', text: `UGX ${formatCurrency(order.charges.total - order.inboundPaid)} still due from customer` }));
  } else {
    payments.appendChild(el('span', { className: 'badge success', text: 'Customer payment captured' }));
  }
  if (order.driver) {
    const due = Math.max(0, (order.charges?.deliveryFee || 0) - order.outboundPaid);
    payments.appendChild(
      el('span', {
        className: `badge ${due > 0 ? 'warning' : 'success'}`,
        text: due > 0 ? `UGX ${formatCurrency(due)} owed to driver` : 'Driver payout recorded'
      })
    );
  }
  card.appendChild(payments);

  card.appendChild(renderVendorActions(order, session));
  return card;
}

function renderVendorActions(order, session) {
  const actions = el('div', { className: 'order-actions' });
  const canUpdate = !['delivered', 'cancelled'].includes(order.status);
  if (order.status === 'placed') {
    actions.appendChild(createActionButton('Start preparing', () => updateOrderStatus('vendor', order, 'preparing'), 'primary'));
  }
  if (order.status === 'preparing') {
    actions.appendChild(createActionButton('Ready for pickup', () => updateOrderStatus('vendor', order, 'ready_for_pickup'), 'primary'));
  }
  if (['ready_for_pickup', 'accepted'].includes(order.status)) {
    actions.appendChild(renderAssignDriverForm(order, session));
  }
  if (canUpdate) {
    actions.appendChild(createActionButton('Cancel order', () => updateOrderStatus('vendor', order, 'cancelled'), 'danger'));
  }
  if (order.charges?.total && order.inboundPaid < order.charges.total) {
    actions.appendChild(renderPaymentDetails(order, 'inbound', order.charges.total - order.inboundPaid));
  }
  if (order.driver && order.charges?.deliveryFee && order.outboundPaid < order.charges.deliveryFee) {
    actions.appendChild(renderPaymentDetails(order, 'outbound', order.charges.deliveryFee - order.outboundPaid));
  }
  return actions;
}

function createActionButton(label, handler, variant) {
  const button = el('button', {
    className: `action-button${variant ? ' ' + variant : ''}`,
    attrs: { type: 'button' }
  }, label);
  button.addEventListener('click', handler);
  return button;
}

function renderAssignDriverForm(order, session) {
  const form = el('form', { className: 'payment-details assign-driver' });
  form.appendChild(el('strong', { text: 'Assign rider' }));
  const select = el('select', {});
  select.appendChild(el('option', { attrs: { value: '' }, text: 'Select driver' }));
  session.drivers.forEach((driver) => {
    select.appendChild(el('option', { attrs: { value: driver.id }, text: `${driver.name} • ${driver.phone}` }));
  });
  const submit = el('button', { className: 'secondary-button', attrs: { type: 'submit' } }, 'Assign driver');
  form.append(select, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!select.value) {
      showToast('Select a driver to assign.', 'error');
      return;
    }
    try {
      await api.assignDriver(session.token, order.id, select.value);
      showToast('Driver assigned.', 'success');
      await loadSessionData('vendor');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  return form;
}

function renderPaymentDetails(order, direction, defaultAmount) {
  const details = el('details', { className: 'payment-details', open: false });
  details.appendChild(el('summary', { text: direction === 'inbound' ? 'Record customer payment' : 'Pay assigned driver' }));
  const form = el('form', { className: 'payment-form' });
  const amount = el('input', {
    attrs: {
      type: 'number',
      min: '1000',
      step: '1000',
      required: 'true',
      value: Math.max(0, Math.round(defaultAmount || 0)) || ''
    }
  });
  const channel = el('select');
  ['mobile_money', 'cashapp', 'venmo'].forEach((value) => {
    const label = value === 'mobile_money' ? 'Mobile Money' : value === 'cashapp' ? 'Cash App' : 'Venmo';
    channel.appendChild(el('option', { attrs: { value }, text: label }));
  });
  const reference = el('input', { attrs: { placeholder: 'Reference (optional)' } });
  const submit = el('button', { className: 'primary-button', attrs: { type: 'submit' } }, 'Save payment');
  form.append(amount, channel, reference, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!amount.value) {
      showToast('Enter an amount to record.', 'error');
      return;
    }
    try {
      await api.recordPayment(state.sessions.vendor.token, order.id, {
        direction,
        amount: Number(amount.value),
        channel: channel.value,
        reference: reference.value || undefined,
        driverId: order.driver?.id || undefined
      });
      showToast('Payment saved.', 'success');
      await loadSessionData('vendor');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  details.appendChild(form);
  return details;
}

function renderWalletCard(session, role) {
  const wallet = session.wallet || { balance: 0, currency: 'UGX' };
  const card = el('section', { className: 'wallet-card' });
  card.append(
    el('span', { text: role === 'vendor' ? 'Vendor wallet balance' : 'Driver wallet balance' }),
    el('strong', { text: formatCurrency(wallet.balance) }),
    el('span', { text: 'Transfer earnings to mobile money or cash app instantly.' })
  );
  return card;
}

function renderWithdrawForm(session, role) {
  const form = el('form', { className: 'withdraw-form' });
  const amount = el('input', {
    attrs: { type: 'number', placeholder: 'Amount (UGX)', min: '1000', step: '1000', required: 'true' }
  });
  const channel = el('select');
  ['mobile_money', 'cashapp', 'venmo'].forEach((value) => {
    const label = value === 'mobile_money' ? 'Mobile Money' : value === 'cashapp' ? 'Cash App' : 'Venmo';
    channel.appendChild(el('option', { attrs: { value }, text: label }));
  });
  const destination = el('input', { attrs: { placeholder: 'Destination account / handle', required: 'true' } });
  channel.addEventListener('change', () => {
    const preset = presetDestination(role, session, channel.value);
    if (preset) {
      destination.value = preset;
    }
  });
  destination.value = presetDestination(role, session, channel.value) || '';
  const submit = el('button', { className: 'secondary-button', attrs: { type: 'submit' } }, 'Send to wallet');
  form.append(amount, channel, destination, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!amount.value) {
      showToast('Enter an amount to withdraw.', 'error');
      return;
    }
    try {
      await api.withdraw(session.token, {
        amount: Number(amount.value),
        channel: channel.value,
        destination: destination.value
      });
      showToast('Withdrawal scheduled.', 'success');
      await loadSessionData(role);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  return form;
}

function presetDestination(role, session, channel) {
  if (role === 'vendor') {
    return session.profile?.vendor?.settlementAccounts?.[channel] || '';
  }
  if (role === 'driver') {
    if (channel === 'mobile_money') {
      return session.profile?.driver?.phone || '';
    }
    return session.profile?.driver?.payoutPreference === channel ? session.profile?.driver?.phone || '' : '';
  }
  return '';
}

function renderAuthCard(role) {
  const card = el('section', { className: 'auth-card' });
  const title = role === 'vendor' ? 'Vendor sign in' : 'Driver sign in';
  card.appendChild(el('h2', { text: title }));
  const form = el('form');
  const email = el('input', { attrs: { type: 'email', name: 'email', placeholder: 'Email', required: 'true' } });
  const password = el('input', { attrs: { type: 'password', name: 'password', placeholder: 'Password', required: 'true' } });
  const submit = el(
    'button',
    {
      className: 'primary-button',
      attrs: { type: 'submit', disabled: state.authLoading[role] ? 'disabled' : null }
    },
    state.authLoading[role] ? 'Signing in…' : 'Sign in'
  );
  form.append(email, password, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleLogin(role, email.value, password.value);
  });
  card.appendChild(form);
  card.appendChild(
    el('p', {
      text:
        role === 'vendor'
          ? 'Use vendor@ugandafood.app / Vendor#2024 to explore the kitchen portal.'
          : 'Use driver@ugandafood.app / Driver#2024 to explore courier tools.'
    })
  );
  return card;
}

async function handleLogin(role, email, password) {
  if (!email || !password) {
    showToast('Enter your email and password.', 'error');
    return;
  }
  state.authLoading[role] = true;
  render();
  try {
    const { token, user } = await api.login(email, password);
    state.sessions[role] = {
      token,
      user,
      orders: [],
      availableOrders: [],
      restaurants: [],
      drivers: [],
      wallet: null,
      profile: null,
      isLoading: false,
      sse: null
    };
    showToast(`Signed in as ${user.name}.`, 'success');
    await loadSessionProfile(role);
    await loadSessionData(role);
    if (state.activeRole === role) {
      connectSse(role);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    state.authLoading[role] = false;
    render();
  }
}

async function loadSessionProfile(role) {
  const session = state.sessions[role];
  if (!session) return;
  try {
    const profile = await api.fetchProfile(session.token);
    session.profile = profile;
    if (profile.wallet) {
      session.wallet = profile.wallet;
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadSessionData(role, { silent = false } = {}) {
  const session = state.sessions[role];
  if (!session) return;
  if (!silent) {
    session.isLoading = true;
    render();
  }
  try {
    const data = await api.fetchOrders(session.token);
    session.orders = data.orders || [];
    session.wallet = data.wallet || session.wallet;
    if (role === 'vendor') {
      session.restaurants = data.restaurants || [];
      session.drivers = data.drivers || [];
    }
    if (role === 'driver') {
      session.availableOrders = data.availableOrders || [];
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    session.isLoading = false;
    render();
  }
}

function logout(role) {
  const session = state.sessions[role];
  if (!session) return;
  disconnectSse(role);
  state.sessions[role] = null;
  showToast('Signed out.', 'info');
  render();
}

function connectSse(role) {
  const session = state.sessions[role];
  if (!session || !session.token) return;
  disconnectSse(role);
  const source = api.openStream(session.token);
  const refresh = () => loadSessionData(role, { silent: true });
  ['order_created', 'order_updated', 'payment_recorded'].forEach((eventName) => {
    source.addEventListener(eventName, refresh);
  });
  source.addEventListener('wallet_updated', (event) => {
    try {
      const payload = JSON.parse(event.data);
      const ownerId = role === 'vendor' ? session.user.vendorId : session.user.driverId;
      if (payload.ownerType === role && payload.ownerId === ownerId) {
        loadSessionData(role, { silent: true });
      }
    } catch (err) {
      // ignore parse errors
    }
  });
  source.onerror = () => {
    source.close();
    session.sse = null;
    setTimeout(() => {
      if (state.activeRole === role) {
        connectSse(role);
      }
    }, 5000);
  };
  session.sse = source;
}

function disconnectSse(role) {
  const session = state.sessions[role];
  if (session?.sse) {
    session.sse.close();
    session.sse = null;
  }
}

async function updateOrderStatus(role, order, status, extra = {}) {
  const session = state.sessions[role];
  if (!session) return;
  try {
    await api.updateStatus(session.token, order.id, { status, ...extra });
    showToast('Order updated.', 'success');
    await loadSessionData(role);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Driver experience ------------------------------------------------------

function renderDriverView() {
  const session = state.sessions.driver;
  if (!session) {
    return renderAuthCard('driver');
  }
  const container = el('div', { className: 'dashboard driver-dashboard' });
  const header = el('div', { className: 'dashboard-header' });
  header.append(
    el('div', {}, el('h2', { text: `Hi ${session.user.name}, ready to roll.` }), el('p', { text: 'Claim pickups, update delivery status and withdraw payouts.' })),
    el(
      'button',
      { className: 'secondary-button', attrs: { type: 'button' } },
      'Sign out'
    )
  );
  header.querySelector('button').addEventListener('click', () => logout('driver'));
  container.appendChild(header);
  container.appendChild(renderWalletCard(session, 'driver'));
  container.appendChild(renderWithdrawForm(session, 'driver'));

  if (session.isLoading && !session.orders.length) {
    container.appendChild(el('div', { className: 'empty-state', text: 'Loading your queue…' }));
    return container;
  }

  if (session.availableOrders?.length) {
    const availableBlock = el('section');
    availableBlock.appendChild(el('h3', { text: 'Ready for pickup' }));
    session.availableOrders.forEach((order) => {
      availableBlock.appendChild(createAvailableOrderCard(order, session));
    });
    container.appendChild(availableBlock);
  }

  const active = session.orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
  const completed = session.orders.filter((order) => ['delivered', 'cancelled'].includes(order.status));
  const activeBlock = el('section');
  activeBlock.appendChild(el('h3', { text: 'My deliveries' }));
  if (!active.length) {
    activeBlock.appendChild(el('div', { className: 'empty-state', text: 'No active deliveries. Grab one from the list above.' }));
  } else {
    active.forEach((order) => activeBlock.appendChild(createDriverOrderCard(order, session)));
  }
  container.appendChild(activeBlock);
  if (completed.length) {
    const completedBlock = el('section');
    completedBlock.appendChild(el('h3', { text: 'Recently delivered' }));
    completed.slice(0, 5).forEach((order) => completedBlock.appendChild(createDriverOrderCard(order, session)));
    container.appendChild(completedBlock);
  }
  return container;
}

function createAvailableOrderCard(order, session) {
  const card = el('article', { className: 'order-card' });
  card.appendChild(el('h3', { text: `${order.restaurant?.name || 'Pickup'} • ${order.code}` }));
  card.appendChild(el('p', { text: `Pickup: ${order.pickupAddress}` }));
  card.appendChild(el('p', { text: `Deliver to: ${order.dropoffAddress}` }));
  const accept = createActionButton('Accept order', async () => {
    try {
      await api.driverAccept(session.token, order.id);
      showToast('Order accepted. Head to the restaurant!', 'success');
      await loadSessionData('driver');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, 'primary');
  card.appendChild(el('div', { className: 'order-actions' }, accept));
  return card;
}

function createDriverOrderCard(order, session) {
  const card = el('article', { className: 'order-card' });
  card.appendChild(el('h3', { text: `${order.code} • ${formatStatus(order.status)}` }));
  card.appendChild(el('div', { className: 'order-meta' }, el('span', { text: `Pickup: ${order.pickupAddress}` }), el('span', { text: `Dropoff: ${order.dropoffAddress}` }), el('span', { text: `Customer: ${order.customerName}` })));
  const paymentBadge = el('div', { className: 'order-payments' });
  const due = Math.max(0, (order.charges?.deliveryFee || 0) - order.outboundPaid);
  paymentBadge.appendChild(
    el('span', { className: `badge ${due > 0 ? 'warning' : 'success'}`, text: due > 0 ? `Vendor owes ${formatCurrency(due)}` : 'Payout recorded' })
  );
  card.appendChild(paymentBadge);
  card.appendChild(renderDriverActions(order, session));
  return card;
}

function renderDriverActions(order, session) {
  const actions = el('div', { className: 'order-actions' });
  if (['accepted', 'ready_for_pickup'].includes(order.status)) {
    actions.appendChild(createActionButton('Picked up', () => updateDriverStatus(order, 'picked_up', session), 'primary'));
  }
  if (order.status === 'picked_up') {
    actions.appendChild(createActionButton('Heading to customer', () => updateDriverStatus(order, 'en_route', session), 'primary'));
  }
  if (order.status === 'en_route') {
    actions.appendChild(createActionButton('Delivered', () => updateDriverStatus(order, 'delivered', session), 'primary'));
  }
  return actions;
}

async function updateDriverStatus(order, status, session) {
  try {
    const payload = { status };
    if (status === 'picked_up') {
      payload.driverLocation = order.pickupLocation;
    }
    if (status === 'en_route') {
      payload.driverLocation = interpolatePoint(order.pickupLocation, order.dropoffLocation, 0.75);
    }
    if (status === 'delivered') {
      payload.driverLocation = order.dropoffLocation;
    }
    await api.updateStatus(session.token, order.id, payload);
    showToast('Delivery status updated.', 'success');
    await loadSessionData('driver');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
import {
  assignDriver,
  createOrder,
  fetchMetrics,
  fetchOrder,
  fetchOrders,
  login,
  openEventStream,
  recordPayment,
  setToken,
  updateStatus
} from './api.js';
import { getToken } from './api.js';

const app = document.getElementById('app');
const USER_KEY = 'uganda_food_delivery_user';

let state = {
  user: null,
  orders: [],
  drivers: [],
  metrics: null,
  selectedOrder: null,
  selectedDriver: null,
  timeline: [],
  ui: {
    detailOpen: false,
    createOpen: false
  },
  flash: null,
  streamConnected: false
};

let eventSource = null;

const STATUS_BADGES = {
  pending: 'warning',
  accepted: 'info',
  picked_up: 'info',
  en_route: 'info',
  delivered: 'success',
  cancelled: 'danger'
};

function setState(partial) {
  state = {
    ...state,
    ...partial,
    ui: {
      ...state.ui,
      ...(partial.ui || {})
    }
  };
  render();
}

function formatCurrency(value) {
  if (typeof value !== 'number') return 'UGX 0';
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric'
  })} • ${date.toLocaleTimeString('en-UG', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

function statusBadge(status) {
  const tone = STATUS_BADGES[status] || 'info';
  const label = status.replace('_', ' ');
  return `<span class="badge ${tone}">${label}</span>`;
}

function showFlash(message, tone = 'info') {
  setState({
    flash: {
      message,
      tone,
      timestamp: Date.now()
    }
  });
  setTimeout(() => {
    if (state.flash && Date.now() - state.flash.timestamp >= 3000) {
      setState({ flash: null });
    }
  }, 3200);
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Signing in…';
  const email = form.email.value.trim();
  const password = form.password.value;
  try {
    const { token, user } = await login({ email, password });
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ user });
    await loadInitialData();
    showFlash('Welcome back! Live operations restored.', 'success');
  } catch (err) {
    showFlash(err.message || 'Authentication failed', 'danger');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Sign in';
  }
}

function renderLogin() {
  app.innerHTML = `
    <div class="card login-card">
      <div class="brand-header">
        <span class="brand-badge">UF</span>
        <div>
          <h1>Uganda Food Delivery</h1>
          <p class="text-muted">Secure control center for riders, payouts and customer payments.</p>
        </div>
      </div>
      <form id="loginForm" class="form-group" autocomplete="on">
        <div class="form-group">
          <label for="email">Email address</label>
          <input type="email" id="email" name="email" placeholder="dispatch@ugandafood.app" required />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" placeholder="••••••••" required />
        </div>
        <button type="submit" class="primary">Sign in</button>
        <p class="text-muted" style="font-size:0.85rem;">
          Use the default dispatcher credentials provided in the README to explore the platform.
        </p>
      </form>
    </div>
  `;
  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', handleLoginSubmit);
}

function renderMetrics(metrics) {
  if (!metrics) {
    return `
      <div class="metric-card">
        <span class="text-muted">Loading metrics…</span>
      </div>
    `;
  }
  const cards = [
    { label: 'Active Orders', value: metrics.totalOrders, tone: 'info' },
    { label: 'Delivered Today', value: metrics.delivered, tone: 'success' },
    { label: 'In Progress', value: metrics.inProgress, tone: 'warning' },
    { label: 'Cancelled', value: metrics.cancelled, tone: 'danger' },
    { label: 'Inbound Payments', value: formatCurrency(metrics.totalInbound), tone: 'success' },
    { label: 'Driver Payouts', value: formatCurrency(metrics.totalOutbound), tone: 'info' }
  ];
  return cards
    .map(
      (card) => `
        <div class="metric-card">
          <span class="text-muted">${card.label}</span>
          <span class="metric-value">${card.value}</span>
        </div>
      `
    )
    .join('');
}

function renderOrdersTable(orders) {
  if (!orders.length) {
    return `
      <tr>
        <td colspan="6" class="text-muted" style="padding:2rem; text-align:center;">No orders yet. Create one to begin tracking payments and riders.</td>
      </tr>
    `;
  }
  return orders
    .map((order) => `
      <tr data-order-row="${order.id}">
        <td>
          <strong>${order.code}</strong>
          <div class="text-muted" style="font-size:0.8rem;">${formatDate(order.createdAt)}</div>
        </td>
        <td>
          ${order.customerName}
          <div class="text-muted" style="font-size:0.8rem;">${order.customerPhone}</div>
        </td>
        <td>${statusBadge(order.status)}</td>
        <td>${order.driverId ? `<span class="text-muted">${state.drivers.find((d) => d.id === order.driverId)?.name || 'Assigned'}</span>` : '<span class="text-muted">Unassigned</span>'}</td>
        <td>
          ${formatCurrency(order.totalAmount)}
          <div class="text-muted" style="font-size:0.8rem;">Paid ${formatCurrency(order.inboundPaid)}</div>
        </td>
        <td>${formatDate(order.expectedDeliveryTime)}</td>
      </tr>
    `)
    .join('');
}

function renderTimeline(timeline) {
  if (!timeline.length) {
    return '<p class="text-muted">No events recorded yet.</p>';
  }
  return timeline
    .map(
      (event) => `
        <div class="timeline-item">
          <strong>${event.title}</strong>
          <div class="text-muted" style="font-size:0.8rem;">${formatDate(event.createdAt)}</div>
          <p class="text-muted" style="margin:0.25rem 0 0;">${event.detail}</p>
        </div>
      `
    )
    .join('');
}

function renderSelectedOrder(order) {
  if (!order) {
    return `
      <div class="text-muted">Select an order to see live tracking, payments and rider status.</div>
    `;
  }
  const driver = state.drivers.find((item) => item.id === order.driverId);
  return `
    <header>
      <div>
        <h2>${order.code}</h2>
        <p class="text-muted" style="margin-top:0.25rem;">${order.customerName} • ${order.customerPhone}</p>
      </div>
      <button id="closeDrawer" class="secondary">Close</button>
    </header>
    <div class="order-items">
      <div class="order-item"><span>Status</span><span>${statusBadge(order.status)}</span></div>
      <div class="order-item"><span>Driver</span><span>${driver ? driver.name : 'Unassigned'}</span></div>
      <div class="order-item"><span>Total</span><span>${formatCurrency(order.totalAmount)}</span></div>
      <div class="order-item"><span>Customer paid</span><span>${formatCurrency(order.inboundPaid)}</span></div>
      <div class="order-item"><span>Payouts</span><span>${formatCurrency(order.outboundPaid)}</span></div>
      <div class="order-item"><span>Expected</span><span>${formatDate(order.expectedDeliveryTime)}</span></div>
    </div>
    <section>
      <h3>Update status</h3>
      <form id="orderStatusForm" class="form-group">
        <select name="status" required>
          ${['pending', 'accepted', 'picked_up', 'en_route', 'delivered', 'cancelled']
            .map((status) => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${status.replace('_', ' ')}</option>`)
            .join('')}
        </select>
        <label style="font-size:0.85rem;" class="text-muted">Adjust ETA</label>
        <input type="datetime-local" name="expectedDeliveryTime" value="${order.expectedDeliveryTime ? new Date(order.expectedDeliveryTime).toISOString().slice(0, 16) : ''}" />
        <button type="submit" class="primary">Save status</button>
      </form>
    </section>
    <section>
      <h3>Record payment</h3>
      <form id="paymentForm" class="form-group">
        <input type="number" name="amount" step="1" min="1" placeholder="Amount" required />
        <select name="direction" required>
          <option value="inbound">Customer payment</option>
          <option value="outbound">Driver payout</option>
        </select>
        <input type="text" name="channel" placeholder="Channel (mobile money, card, cash)" />
        <input type="text" name="reference" placeholder="Reference" />
        <button type="submit" class="primary">Record payment</button>
      </form>
    </section>
    <section>
      <h3>Assign driver</h3>
      <form id="driverForm" class="form-group">
        <select name="driverId" required>
          <option value="">Select driver…</option>
          ${state.drivers
            .map((driverOption) => `<option value="${driverOption.id}" ${driver?.id === driverOption.id ? 'selected' : ''}>${driverOption.name}</option>`)
            .join('')}
        </select>
        <input type="number" name="payoutAmount" placeholder="Payout amount (optional)" min="0" step="1" />
        <button type="submit" class="primary">Assign driver</button>
      </form>
    </section>
    <section>
      <h3>Timeline</h3>
      <div class="timeline">${renderTimeline(state.timeline)}</div>
    </section>
  `;
}

function renderCreateOrder() {
  return `
    <header>
      <div>
        <h2>New delivery</h2>
        <p class="text-muted" style="margin-top:0.25rem;">Capture customer details, delivery route and initial payment.</p>
      </div>
      <button id="closeCreateDrawer" class="secondary">Close</button>
    </header>
    <form id="createOrderForm" class="form-group" autocomplete="off">
      <input name="customerName" placeholder="Customer name" required />
      <input name="customerPhone" placeholder="Customer phone" required />
      <input name="pickupAddress" placeholder="Pickup address" required />
      <input name="dropoffAddress" placeholder="Drop-off address" required />
      <textarea name="items" rows="3" placeholder="Items (one per line, e.g. Rolex x2)"></textarea>
      <input name="totalAmount" type="number" min="1" step="1" placeholder="Total amount (UGX)" required />
      <fieldset style="border:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0.75rem;">
        <legend class="text-muted" style="font-size:0.85rem;">Initial payment (optional)</legend>
        <input name="initialAmount" type="number" min="0" step="1" placeholder="Amount received" />
        <input name="initialChannel" placeholder="Channel (mobile money, card, cash)" />
        <input name="initialReference" placeholder="Reference" />
      </fieldset>
      <textarea name="notes" rows="2" placeholder="Delivery notes (optional)"></textarea>
      <button type="submit" class="primary">Create order</button>
    </form>
  `;
}

function renderDashboard() {
  const { orders, metrics, ui, selectedOrder } = state;
  app.innerHTML = `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="brand-header">
          <span class="brand-badge">UF</span>
          <div>
            <h2>Operations</h2>
            <p class="text-muted" style="margin-top:0.25rem;">${state.streamConnected ? 'Live updates streaming' : 'Realtime offline'}</p>
          </div>
        </div>
        <div class="user-card">
          <span class="text-muted" style="font-size:0.85rem;">Logged in as</span>
          <strong>${state.user.name}</strong>
          <span class="text-muted" style="font-size:0.85rem;">${state.user.role}</span>
          <button id="logoutBtn" class="secondary" style="margin-top:1rem;">Sign out</button>
        </div>
        <nav>
          <button class="active secondary">Live control</button>
          <button id="openCreateDrawer" class="primary">Create order</button>
        </nav>
        <div class="user-card">
          <span class="text-muted" style="font-size:0.8rem;">Secure datastore</span>
          <strong style="font-size:0.95rem;">Encrypted tokens</strong>
          <span class="text-muted" style="font-size:0.75rem;">All payments are recorded with tamper-evident history.</span>
        </div>
      </aside>
      <main class="main">
        ${state.flash ? `<div class="card" data-tone="${state.flash.tone}">${state.flash.message}</div>` : ''}
        <section class="metrics-grid">${renderMetrics(metrics)}</section>
        <section class="orders-card">
          <header style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h2>Live orders</h2>
              <p class="text-muted" style="margin-top:0.25rem;">Securely track customer payments and driver payouts in real-time.</p>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button id="refreshOrders" class="secondary">Refresh</button>
              <button id="openCreateDrawerInline" class="primary">New order</button>
            </div>
          </header>
          <table class="orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Driver</th>
                <th>Payments</th>
                <th>ETA</th>
              </tr>
            </thead>
            <tbody>
              ${renderOrdersTable(orders)}
            </tbody>
          </table>
        </section>
      </main>
    </div>
    <div class="drawer ${ui.detailOpen ? 'open' : ''}" id="orderDrawer">
      ${renderSelectedOrder(selectedOrder)}
    </div>
    <div class="drawer ${ui.createOpen ? 'open' : ''}" id="createDrawer">
      ${renderCreateOrder()}
    </div>
  `;
  bindDashboardEvents();
}

function bindDashboardEvents() {
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('refreshOrders')?.addEventListener('click', async () => {
    await refreshOrders();
    showFlash('Orders refreshed', 'info');
  });
  const openCreateButtons = [
    document.getElementById('openCreateDrawer'),
    document.getElementById('openCreateDrawerInline')
  ].filter(Boolean);
  openCreateButtons.forEach((btn) =>
    btn.addEventListener('click', () => setState({ ui: { createOpen: true } }))
  );
  document.getElementById('closeCreateDrawer')?.addEventListener('click', () => setState({ ui: { createOpen: false } }));
  document.getElementById('closeDrawer')?.addEventListener('click', () => setState({ ui: { detailOpen: false }, selectedOrder: null, timeline: [] }));

  document.querySelectorAll('[data-order-row]')?.forEach((row) => {
    row.addEventListener('click', async () => {
      const id = row.getAttribute('data-order-row');
      await openOrder(id);
    });
  });

  const statusForm = document.getElementById('orderStatusForm');
  statusForm?.addEventListener('submit', handleStatusSubmit);

  const paymentForm = document.getElementById('paymentForm');
  paymentForm?.addEventListener('submit', handlePaymentSubmit);

  const driverForm = document.getElementById('driverForm');
  driverForm?.addEventListener('submit', handleDriverSubmit);

  const createForm = document.getElementById('createOrderForm');
  createForm?.addEventListener('submit', handleCreateOrderSubmit);
}

async function openOrder(id) {
  try {
    const { order, timeline } = await fetchOrder(id);
    setState({ selectedOrder: order, timeline, ui: { detailOpen: true } });
  } catch (err) {
    showFlash(err.message || 'Unable to open order', 'danger');
  }
}

async function handleStatusSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Saving…';
  const payload = {
    status: form.status.value,
    expectedDeliveryTime: form.expectedDeliveryTime.value ? new Date(form.expectedDeliveryTime.value).toISOString() : undefined
  };
  try {
    const { order } = await updateStatus(state.selectedOrder.id, payload);
    const updatedOrders = state.orders.map((item) => (item.id === order.id ? order : item));
    setState({ orders: updatedOrders, selectedOrder: order });
    showFlash('Status updated', 'success');
    await reloadTimeline(order.id);
  } catch (err) {
    showFlash(err.message || 'Failed to update status', 'danger');
  } finally {
    button.disabled = false;
    button.textContent = 'Save status';
  }
}

async function handlePaymentSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Recording…';
  const payload = {
    amount: Number(form.amount.value),
    direction: form.direction.value,
    channel: form.channel.value || undefined,
    reference: form.reference.value || undefined
  };
  try {
    await recordPayment(state.selectedOrder.id, payload);
    showFlash('Payment recorded', 'success');
    await refreshOrders();
    await reloadTimeline(state.selectedOrder.id);
    await openOrder(state.selectedOrder.id);
    form.reset();
  } catch (err) {
    showFlash(err.message || 'Failed to record payment', 'danger');
  } finally {
    button.disabled = false;
    button.textContent = 'Record payment';
  }
}

async function handleDriverSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Assigning…';
  const payload = {
    driverId: form.driverId.value,
    payoutAmount: form.payoutAmount.value ? Number(form.payoutAmount.value) : undefined
  };
  try {
    const { order } = await assignDriver(state.selectedOrder.id, payload);
    const updatedOrders = state.orders.map((item) => (item.id === order.id ? order : item));
    setState({ orders: updatedOrders, selectedOrder: order });
    showFlash('Driver assignment saved', 'success');
    await reloadTimeline(order.id);
  } catch (err) {
    showFlash(err.message || 'Failed to assign driver', 'danger');
  } finally {
    button.disabled = false;
    button.textContent = 'Assign driver';
  }
}

function parseItems(raw) {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/(.+?)\s+x\s*(\d+)/i);
      if (match) {
        return { name: match[1].trim(), quantity: Number(match[2]) };
      }
      return { name: line, quantity: 1 };
    });
}

async function handleCreateOrderSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Creating…';
  const payload = {
    customerName: form.customerName.value.trim(),
    customerPhone: form.customerPhone.value.trim(),
    pickupAddress: form.pickupAddress.value.trim(),
    dropoffAddress: form.dropoffAddress.value.trim(),
    totalAmount: Number(form.totalAmount.value),
    notes: form.notes.value.trim(),
    items: parseItems(form.items.value)
  };
  if (form.initialAmount.value) {
    payload.initialPayment = {
      amount: Number(form.initialAmount.value),
      channel: form.initialChannel.value || 'mobile_money',
      reference: form.initialReference.value || undefined
    };
  }
  try {
    const { order } = await createOrder(payload);
    setState({
      orders: [order, ...state.orders],
      ui: { createOpen: false }
    });
    showFlash('Order created successfully', 'success');
    form.reset();
  } catch (err) {
    showFlash(err.message || 'Failed to create order', 'danger');
  } finally {
    button.disabled = false;
    button.textContent = 'Create order';
  }
}

async function reloadTimeline(orderId) {
  try {
    const { timeline } = await fetchOrder(orderId);
    setState({ timeline });
  } catch (err) {
    console.error('Failed to reload timeline', err);
  }
}

async function refreshOrders() {
  try {
    const { orders, drivers } = await fetchOrders();
    setState({ orders, drivers });
  } catch (err) {
    showFlash(err.message || 'Unable to refresh orders', 'danger');
  }
}

async function loadInitialData() {
  try {
    const [ordersResponse, metricsResponse] = await Promise.all([fetchOrders(), fetchMetrics()]);
    setState({
      orders: ordersResponse.orders,
      drivers: ordersResponse.drivers,
      metrics: metricsResponse.metrics
    });
    connectStream();
  } catch (err) {
    showFlash(err.message || 'Unable to load data', 'danger');
  }
}

function connectStream() {
  if (eventSource) {
    eventSource.close();
  }
  eventSource = openEventStream(handleRealtimeEvent);
  if (eventSource) {
    eventSource.onopen = () => setState({ streamConnected: true });
    eventSource.onerror = () => setState({ streamConnected: false });
  }
}

async function handleRealtimeEvent(event) {
  switch (event.type) {
    case 'order_created': {
      const { order } = event.data;
      setState({ orders: [order, ...state.orders] });
      showFlash(`New order ${order.code} received`, 'info');
      break;
    }
    case 'order_updated': {
      const { order } = event.data;
      const updated = state.orders.map((item) => (item.id === order.id ? order : item));
      setState({ orders: updated });
      if (state.selectedOrder?.id === order.id) {
        await openOrder(order.id);
      }
      break;
    }
    case 'payment_recorded': {
      const { orderId } = event.data;
      await refreshOrders();
      if (state.selectedOrder?.id === orderId) {
        await openOrder(orderId);
      }
      showFlash('Payment update received', 'success');
      break;
    }
    default:
      break;
  }
}

function handleLogout() {
  setToken(null);
  localStorage.removeItem(USER_KEY);
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  state = {
    ...state,
    user: null,
    orders: [],
    drivers: [],
    metrics: null,
    selectedOrder: null,
    timeline: [],
    ui: { detailOpen: false, createOpen: false }
  };
  render();
}

async function bootstrap() {
  const token = getToken();
  if (token) {
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedUser) {
      try {
        setState({ user: JSON.parse(storedUser) });
      } catch (err) {
        console.warn('Failed to parse stored user', err);
      }
    }
    try {
      await loadInitialData();
      if (!state.user) {
        setState({ user: { name: 'Control Center', role: 'dispatcher' } });
      }
      showFlash('Session restored', 'success');
    } catch (err) {
      console.warn('Session restore failed', err);
      setToken(null);
      render();
    }
  } else {
    render();
  }
}

function render() {
  if (!state.user) {
    renderLogin();
  } else {
    renderDashboard();
  }
}

bootstrap();
