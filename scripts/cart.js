import { simulateStripeCheckout } from './stripe-mock.js';

let products = [];
const cart = new Map();

async function fetchProducts(){
  const res = await fetch('/ace1-sporty-static/data/products.json');
  if(!res.ok) throw new Error('Failed to load products');
  products = await res.json();
  renderProducts();
}

function renderProducts(){
  const grid = document.getElementById('product-grid');
  const template = document.getElementById('product-card-template');
  products.forEach(p =>{
    const node = template.content.cloneNode(true);
    const card = node.querySelector('.product-card');
    card.querySelector('img').src = p.image;
    card.querySelector('img').alt = p.name;
    card.querySelector('h4').textContent = p.name;
    card.querySelector('.price').textContent = `${formatPrice(p.price)}`;
    card.querySelector('.badge.sale').textContent = p.sale ? `-${Math.round(((p.oldPrice||p.price)-p.price)/(p.oldPrice||p.price)*100)}%` : '';
    if(!p.sale) card.querySelector('.badge.sale').style.display = 'none';

    const quickBtn = card.querySelector('.btn-quick');
    quickBtn.addEventListener('click', ()=> addToCart(p.id));

    grid.appendChild(node);
  });
}

function addToCart(productId){
  const p = products.find(x => x.id === productId);
  if(!p) return;
  const qty = cart.get(productId) || 0;
  cart.set(productId, qty + 1);
  updateCartUI();
}

function removeFromCart(productId){
  cart.delete(productId);
  updateCartUI();
}

function updateCartUI(){
  const count = Array.from(cart.values()).reduce((s, n)=> s + n, 0);
  document.getElementById('cart-count').textContent = count;

  const itemsContainer = document.getElementById('cart-items');
  itemsContainer.innerHTML = '';
  let total = 0;
  cart.forEach((qty,id)=>{
    const p = products.find(x=>x.id===id);
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `<div class="cart-row">
        <img src="${p.image}" alt="${p.name}"/>
        <div class="meta">
          <div class="title">${p.name}</div>
          <div class="qty">Qty: ${qty}</div>
        </div>
        <div class="price">${formatPrice(p.price*qty)}</div>
        <button class="btn ghost remove">Remove</button>
      </div>`;
    el.querySelector('.remove').addEventListener('click', ()=> { removeFromCart(id); });
    itemsContainer.appendChild(el);
    total += p.price*qty;
  });
  document.getElementById('cart-total').textContent = formatPrice(total);
}

function formatPrice(val){
  return `$${val.toFixed(0)}`;
}

function openCart(){
  document.getElementById('cart-modal').setAttribute('aria-hidden','false');
}
function closeCart(){
  document.getElementById('cart-modal').setAttribute('aria-hidden','true');
}

async function onCheckout(){
  const items = [];
  cart.forEach((qty, id)=>{
    const p = products.find(x=>x.id===id);
    items.push({id: p.id, name: p.name, qty, price: p.price});
  });
  if(items.length === 0){
    alert('Cart is empty');
    return;
  }
    try{
    document.getElementById('checkout').textContent = 'Processing...';

    // If you set an Edge Function endpoint, call it (recommended). Otherwise use demo Stripe mock.
    const EDGE_URL = window.__ACE1_EDGE_CREATE_ORDER__ || '';
    if(EDGE_URL){
      // optional: attach Supabase session token if available
      const token = window.__ACE1_SUPABASE_SESSION_TOKEN__ || '';
      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ cart: items, shipping: {} })
      });
      const data = await resp.json();
      if(!resp.ok){ throw new Error(data?.error || 'Edge function failed'); }
      // If using Razorpay: data.razor contains order id and details
      alert('Create-order succeeded (demo) — order id: ' + data.orderId);
      document.getElementById('checkout').textContent = 'Checkout (Demo)';
      cart.clear();
      updateCartUI();
      closeCart();
      return;
    }

    const res = await simulateStripeCheckout(items);
    document.getElementById('checkout').textContent = 'Checkout (Demo)';
    if(res.status === 'success'){
      alert('Payment succeeded (demo) — session: ' + res.sessionId);
      cart.clear();
      updateCartUI();
      closeCart();
    }
  }catch(err){
    document.getElementById('checkout').textContent = 'Checkout (Demo)';
    alert('Checkout failed — ' + err.message);
  }
}

export function initCart(){
  document.getElementById('cart-toggle').addEventListener('click', openCart);
  document.getElementById('close-cart').addEventListener('click', closeCart);
  document.getElementById('checkout').addEventListener('click', onCheckout);
  fetchProducts().catch(console.error);
}

// If loaded direct in page, auto-init
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=> initCart());
} else {
  initCart();
}
