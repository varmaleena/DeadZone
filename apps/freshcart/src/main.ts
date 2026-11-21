import { readCart, addItem, setQuantity, cartTotal, money, clearCart } from './cart';
import { markPlaced, queueOrder, readOrders, startOrderSync, submitOrder, syncOrders } from './orders';
import './style.css';
const fixed = (import.meta as unknown as { env: Record<string, string> }).env.VITE_OFFLINE_FIX === 'true';
const products = [
  'Orchard apples',
  'Golden pears',
  'Garden carrots',
  'Baby spinach',
  'Vine tomatoes',
  'Oat milk',
  'Sourdough loaf',
  'Brown eggs',
  'Wildflower honey',
  'Rolled oats',
  'Basmati rice',
  'Roasted coffee',
];
const photos = [
  'apples',
  'pears',
  'carrots',
  'spinach',
  'tomatoes',
  'milk',
  'bread',
  'eggs',
  'honey',
  'oats',
  'rice',
  'coffee',
];
const groups = [
  'Fruit & vegetables',
  'Fruit & vegetables',
  'Fruit & vegetables',
  'Fruit & vegetables',
  'Fruit & vegetables',
  'Dairy & eggs',
  'Bakery',
  'Dairy & eggs',
  'Pantry',
  'Pantry',
  'Pantry',
  'Beverages',
];
const units = [
  '1 kg',
  '500 g',
  '500 g',
  '200 g',
  '500 g',
  '1 litre',
  '400 g',
  '6 pieces',
  '250 g',
  '500 g',
  '1 kg',
  '250 g',
];
const photo = (name: string) => '/images/' + (photos[products.indexOf(name)] || 'apples') + '.jpg';
function basketBar() {
  const count = readCart().reduce((sum, item) => sum + item.quantity, 0);
  const bar = document.querySelector('#basket-bar');
  // The floating "View basket" bar is for browsing; it's redundant where the basket is already shown.
  const onBasketPage = ['/cart', '/checkout', '/order-confirmation'].includes(location.pathname);
  if (bar) {
    bar.innerHTML = count
      ? `<span><strong>${count} items</strong> · ${money(cartTotal())}</span><a href="/cart">View basket →</a>`
      : '';
    bar.classList.toggle('visible', count > 0 && !onBasketPage);
  }
  const badge = document.querySelector('#basket-count');
  if (badge) badge.textContent = String(count);
}

const STATUS_LABEL: Record<string, string> = {
  placed: 'Placed',
  synced: 'Placed',
  queued: 'Saved on this device · will send when online',
};
const statusLabel = (status: string) => STATUS_LABEL[status] ?? status;

/** In-app navigation without a full page reload (also keeps the app usable offline). */
function navigate(path: string) {
  history.pushState({}, '', path);
  void render();
}

const root = document.querySelector<HTMLDivElement>('#app')!;
let generation = 0;
const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const spinner =
  '<div class="loading-state"><span>Loading</span><div role="progressbar" aria-label="Loading" class="loading-track"><i></i></div></div>';
function shell() {
  root.innerHTML = `<header><div class="header-inner"><a href="/" data-nav class="brand">Fresh<span>Cart</span></a><nav>${[
    ['/', 'Shop'],
    ['/cart', 'Cart'],
    ['/checkout', 'Checkout'],
    ['/profile', 'Profile'],
    ['/orders', 'Orders'],
  ]
    .map(
      ([path, label]) =>
        `<a data-nav href="${path}" ${location.pathname === path ? 'aria-current="page"' : ''}>${label}</a>`,
    )
    .join(
      '',
    )}</nav><a class="header-basket" href="/cart" aria-label="View basket">Basket <b id="basket-count">${readCart().reduce((sum, item) => sum + item.quantity, 0)}</b></a><span id="connection" class="connection ${navigator.onLine ? '' : 'offline'}"><i></i>${navigator.onLine ? 'Online' : 'Offline'}</span></div></header><main><div class="breadcrumb">FreshCart <span>/</span> ${location.pathname === '/' ? 'Shop' : escape(location.pathname.slice(1))}</div><section id="screen"></section></main><div id="basket-bar" class="basket-bar"></div><footer class="shop-footer"><span class="brand">Fresh<span>Cart</span></span><p>Good food. Close to home.</p><span>Fresh groceries, everyday essentials.</span></footer>`;
  root.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        history.pushState({}, '', a.pathname);
        void render();
      }),
  );
}
async function render() {
  const current = ++generation;
  shell();
  const screen = document.querySelector<HTMLElement>('#screen')!;
  basketBar();
  const route = location.pathname;
  if (route === '/order-confirmation') {
    const order = readOrders().find((item) => item.id === new URLSearchParams(location.search).get('id'));
    screen.innerHTML = order
      ? `<div class="confirmation"><span class="confirmed-mark">✓</span><h1>${order.status === 'queued' ? 'Order saved' : 'Order placed'}</h1><p>Order ${escape(order.id.slice(0, 8))} · ${escape(statusLabel(order.status))}</p><p>${(order.items || []).map((item) => escape(item.name) + ' × ' + item.quantity).join(', ')}</p><p>Delivery to ${order.address.map(escape).join(', ')}</p><a class="action-link" href="/orders">View your orders →</a><a class="secondary-link" href="/">Continue shopping</a></div>`
      : '<h1>Order not found</h1><a href="/orders">View orders</a>';
    return;
  }
  if (route === '/cart') {
    const cart = readCart();
    screen.innerHTML = `<h1>Your basket</h1>${cart.length ? cart.map((item, index) => `<article class="basket-item"><img src="${photo(item.name)}" alt="${escape(item.name)}"><h2>${escape(item.name)}</h2><p>${money(item.unitCents)} each · ${money(item.unitCents * item.quantity)}</p><button data-qty="${index}" data-delta="-1" aria-label="Decrease ${escape(item.name)}">−</button><span style="padding:16px">${item.quantity}</span><button data-qty="${index}" data-delta="1" aria-label="Increase ${escape(item.name)}">+</button><button data-remove="${index}">Remove ${escape(item.name)}</button></article>`).join('') : '<p>Your basket is empty. Add products from the shop.</p>'}<h2>Total ${money(cartTotal(cart))}</h2>${cart.length ? '<div class="basket-actions"><a class="action-link" href="/checkout">Continue to checkout →</a><a href="/">Continue shopping</a></div>' : '<a href="/">Browse products</a>'}`;
    screen.querySelectorAll<HTMLButtonElement>('[data-qty]').forEach(
      (button) =>
        (button.onclick = () => {
          const item = cart[Number(button.dataset.qty)];
          setQuantity(item.name, item.unitCents, item.quantity + Number(button.dataset.delta));
          void render();
        }),
    );
    screen.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(
      (button) =>
        (button.onclick = () => {
          const item = cart[Number(button.dataset.remove)];
          setQuantity(item.name, item.unitCents, 0);
          void render();
        }),
    );
    return;
  }
  if (route === '/checkout') {
    const cart = readCart();
    screen.innerHTML = `<div class="page-intro"><h1>Checkout</h1><p>A few details, and you're all set.</p></div><form class="checkout-layout"><div class="address-card"><div class="card-heading"><span class="step-number">1</span><h2>Shipping address</h2></div><p class="card-subtitle">Where should we deliver your groceries?</p><div class="form-grid"><label class="full">Full name <span>*</span><input id="name" required autocomplete="name" placeholder="Your full name"></label><label class="full">Street address <span>*</span><input id="street" required autocomplete="street-address" placeholder="House number and street"></label><label>City <span>*</span><input id="city" required autocomplete="address-level2" placeholder="City"></label><label>Postal code<input id="pin" autocomplete="postal-code" placeholder="Postal code"></label></div><div class="payment-section"><div class="card-heading"><span class="step-number">2</span><h2>Payment method</h2></div><div class="payment-option"><span class="radio-dot"></span><div><strong>Pay on delivery</strong><p>Pay when your groceries arrive.</p></div></div></div><div class="delivery-note"><span>Delivery information</span><p>Your order and address stay on this device while you are offline.</p></div></div><div class="order-card"><div class="summary-heading"><h2>Order summary</h2><a href="/cart">Edit basket</a></div><div class="summary-items">${cart.length ? cart.map((item) => `<div class="summary-item"><img class="product-mini" src="${photo(item.name)}" alt="${escape(item.name)}"><div><strong>${escape(item.name)}</strong><small>Qty ${item.quantity} · ${money(item.unitCents)} each</small></div><b>${money(item.quantity * item.unitCents)}</b></div>`).join('') : '<p class="empty-summary">Your basket is empty. <a href="/">Browse products</a></p>'}</div><div class="summary-totals"><p><span>Subtotal</span><span>${money(cartTotal(cart))}</span></p><p><span>Delivery</span><span class="free-delivery">Free</span></p><div class="grand-total"><span>Total</span><strong>${money(cartTotal(cart))}</strong></div></div><button id="place-order">Place order</button><p id="notice" role="status"></p><p class="checkout-caption">Your address is used to prepare this order.</p></div></form>`;
    screen.querySelector('#place-order')!.textContent = 'Place order · ' + money(cartTotal());
    const form = screen.querySelector<HTMLFormElement>('form')!;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const button = screen.querySelector<HTMLButtonElement>('button')!;
      const notice = screen.querySelector<HTMLElement>('#notice')!;
      const address = Array.from(form.querySelectorAll('input')).map((i) => i.value);
      const processing = (text: string) =>
        `<div class="loading-state"><span>${text}</span><div role="progressbar" aria-label="${text}" class="loading-track"><i></i></div></div>`;

      if (fixed) {
        // Offline-ready: save on the device first, then send. If the connection drops, keep the
        // address and the order, and place it automatically when the connection returns.
        let saved;
        try {
          saved = queueOrder(address, readCart());
        } catch {
          notice.textContent = 'Could not save this order. Your address is preserved; please retry.';
          return;
        }
        clearCart();
        basketBar();
        button.disabled = true;
        const confirmation = '/order-confirmation?id=' + saved.id;
        const showLink = () => {
          if (screen.querySelector('#confirmation-link')) return;
          const next = document.createElement('a');
          next.id = 'confirmation-link';
          next.className = 'action-link';
          next.href = confirmation;
          next.textContent = 'View order confirmation →';
          notice.after(next);
        };
        const place = async () => {
          await submitOrder();
          markPlaced(saved.id);
          void syncOrders().catch(() => undefined);
        };
        notice.innerHTML = processing('Placing your order…');
        try {
          await place();
          navigate(confirmation);
        } catch {
          if (!notice.isConnected) return;
          notice.textContent =
            "You're offline — we'll place your order when you're back. Your address and basket are saved on this device.";
          showLink();
          window.addEventListener(
            'online',
            async () => {
              if (!notice.isConnected) return;
              notice.innerHTML = processing('Back online — placing your order…');
              try {
                await place();
                if (notice.isConnected) notice.textContent = '✓ Back online — your order has been placed.';
              } catch {
                if (notice.isConnected)
                  notice.textContent = 'Still offline. Your order is saved and will be placed automatically.';
              }
            },
            { once: true },
          );
        }
        return;
      }

      // Standard (buggy) build: works online, but if the connection drops while the order is
      // processing it fails, wipes the form and leaves the spinner running — the bug Deadzone finds.
      button.disabled = true;
      notice.innerHTML = processing('Placing your order…');
      try {
        await submitOrder();
        const order = queueOrder(address, readCart(), 'placed');
        clearCart();
        navigate('/order-confirmation?id=' + order.id);
      } catch {
        form.reset();
        notice.innerHTML = spinner;
      }
    };
    return;
  }
  screen.innerHTML = spinner;
  await new Promise((resolve) => setTimeout(resolve, 400));
  try {
    const response = await fetch('/api/products.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to fetch');
    await response.json();
    if (current !== generation) return;
    if (route === '/') {
      localStorage.setItem('freshcart-products', JSON.stringify(products));
      showProducts(products);
    } else if (route === '/profile')
      screen.innerHTML =
        '<h1>Your profile</h1><article><h2>Asha Rao</h2><p>12 Lake View Rd · Springfield</p></article>';
    else if (route === '/orders') {
      const orders = readOrders();
      screen.innerHTML =
        '<h1>Your orders</h1>' +
        (orders.length
          ? orders
              .map(
                (order) =>
                  `<article><h2>Order ${escape(order.id.slice(0, 8))}</h2><p>${escape(statusLabel(order.status))} · ${new Date(order.createdAt).toLocaleString()}</p><p>${(order.items || []).map((item) => `${escape(item.name)} × ${item.quantity}`).join(', ') || 'No product details recorded'}</p></article>`,
              )
              .join('')
          : '<p>No orders yet. Your saved orders will appear here.</p>');
      localStorage.setItem('freshcart-history', screen.innerHTML);
    } else screen.innerHTML = '<h1>Page not found</h1><a href="/">Return to shop</a>';
  } catch {
    if (current !== generation) return;
    if (fixed) {
      if (route === '/') {
        const cached = JSON.parse(localStorage.getItem('freshcart-products') || '[]');
        showProducts(cached);
        screen.insertAdjacentHTML('afterbegin', '<aside>Offline — showing saved items</aside>');
      } else if (route === '/profile') {
        screen.innerHTML =
          '<h1>You’re offline</h1><p>Your profile will be available when you reconnect.</p><button id="retry">Retry</button>';
        screen.querySelector<HTMLButtonElement>('button')!.onclick = () => void render();
      } else
        screen.innerHTML =
          '<aside>Offline — showing saved orders</aside>' +
          (localStorage.getItem('freshcart-history') || '<h1>Your orders</h1><p>No saved orders yet.</p>');
    } else if (route === '/profile') screen.innerHTML = '<p role="alert">TypeError: Failed to fetch</p>';
    else if (route === '/orders') screen.innerHTML = '';
  }
  function showProducts(items: string[]) {
    screen.innerHTML = `<div class="store-toolbar"><label class="store-search">Search your daily essentials<input id="product-search" type="search" placeholder="Search fruits, milk, bread and more"></label><a href="/profile">Add your delivery details →</a></div><div class="grocery-hero"><div><p class="eyebrow">FRESH PICKS, EVERY DAY</p><h1>Your everyday essentials.<br>One happy basket.</h1><p>Fresh produce, pantry favourites and everything in between.</p><a href="#products" class="action-link">Start shopping ↓</a></div><img src="/images/tomatoes.jpg" alt="Fresh ripe tomatoes"></div><div class="category-list" role="group" aria-label="Product categories">${['All', 'Fruit & vegetables', 'Dairy & eggs', 'Bakery', 'Pantry', 'Beverages'].map((category) => `<button type="button" data-category="${category}" aria-pressed="${category === 'All'}">${category}</button>`).join('')}</div><div class="product-heading"><div><p class="eyebrow">GOOD FOOD. CLOSE TO HOME.</p><h2>Shop your favourites</h2></div><span id="product-count">${items.length} products</span></div><div class="grid product-grid" id="products">${items
      .map((name) => {
        const i = products.indexOf(name);
        return `<article data-name="${escape(name.toLowerCase())}" data-group="${groups[i]}"><div class="product-image"><img src="${photo(name)}" alt="${escape(name)}" loading="eager"><span>FRESH PICK</span></div><p class="product-brand">FRESHCART</p><h2>${escape(name)}</h2><p class="product-unit">${units[i]}</p><div class="product-bottom"><strong>${money(200 + i * 45)}</strong><button data-product="${i}" class="add">Add to basket</button></div></article>`;
      })
      .join('')}<p id="no-products" hidden>No products match your search. Try another category.</p></div>`;
    let category = 'All';
    const filter = () => {
      const query = screen.querySelector<HTMLInputElement>('#product-search')!.value.toLowerCase().trim();
      let count = 0;
      screen.querySelectorAll<HTMLElement>('.product-grid article').forEach((card) => {
        card.hidden = !(category === 'All' || card.dataset.group === category) || !card.dataset.name?.includes(query);
        if (!card.hidden) count++;
      });
      screen.querySelector('#product-count')!.textContent = count + ' products';
      screen.querySelector<HTMLElement>('#no-products')!.hidden = count > 0;
    };
    screen.querySelector<HTMLInputElement>('#product-search')!.oninput = filter;
    screen.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(
      (button) =>
        (button.onclick = () => {
          category = button.dataset.category!;
          screen
            .querySelectorAll('[data-category]')
            .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
          filter();
        }),
    );
    screen.querySelectorAll<HTMLButtonElement>('.add').forEach(
      (button) =>
        (button.onclick = () => {
          const index = Number(button.dataset.product);
          try {
            addItem(products[index], 200 + index * 45);
            button.textContent = 'Added · ' + readCart().find((item) => item.name === products[index])?.quantity;
            basketBar();
          } catch {
            button.textContent = 'Could not save - retry';
          }
        }),
    );
  }
}
function updateConnection() {
  const chip = document.querySelector('#connection');
  if (chip) {
    chip.classList.toggle('offline', !navigator.onLine);
    chip.innerHTML = '<i></i>' + (navigator.onLine ? 'Online' : 'Offline');
  }
}
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
// Same-origin links navigate inside the app instead of reloading the page.
root.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const link = (event.target as Element).closest('a');
  if (!link || link.target || link.hasAttribute('download') || link.origin !== location.origin) return;
  if (link.hash && link.pathname === location.pathname) return; // in-page anchors such as #products
  event.preventDefault();
  navigate(link.pathname + link.search);
});
window.addEventListener('popstate', () => void render());
if (fixed)
  startOrderSync(() => {
    /* Queue remains on device for retry. */
  });
else
  window.addEventListener('online', () => {
    // The standard build reloads data on reconnect, but a failed checkout stays broken.
    if (location.pathname !== '/checkout') void render();
  });
void render();
