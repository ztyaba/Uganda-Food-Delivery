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
