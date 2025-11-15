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
