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
