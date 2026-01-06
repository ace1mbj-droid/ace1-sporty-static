// Checkout and Payment Manager
class CheckoutManager {
    constructor() {
        this.cartItems = [];
        this.subtotal = 0;
        this.tax = 0;
        this.shipping = 0;
        this.total = 0;
        this.discount = 0;
        void this.init();
    }

    async init() {
        // Attach listeners ASAP (inline suggestions + button handlers)
        this.setupEventListeners();

        await this.loadCartItems();
        this.calculateTotals();
        this.displayCartItems();
        this.loadUserInfo();
    }

    setupEventListeners() {
        if (this._listenersSetup) return;
        this._listenersSetup = true;

        // Keep checkout in sync if cart changes while this page is open
        window.addEventListener('ace1:cart-updated', () => {
            this.cartItems = window.cart || [];
            this.calculateTotals();
            this.displayCartItems();
        });

        // Continue to payment
        const continueBtn = document.getElementById('continue-to-payment');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.proceedToPayment());
        }

        // Back to shipping
        const backBtn = document.getElementById('back-to-shipping');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.backToShipping());
        }

        // Place order
        const placeOrderBtn = document.getElementById('place-order-btn');
        if (placeOrderBtn) {
            placeOrderBtn.addEventListener('click', () => this.placeOrder());
        }

        // Apply promo code
        const applyPromoBtn = document.getElementById('apply-promo');
        if (applyPromoBtn) {
            applyPromoBtn.addEventListener('click', () => this.applyPromoCode());
        }

        // PIN code validation
        const pincodeInput = document.getElementById('pincode');
        if (pincodeInput) {
            pincodeInput.addEventListener('blur', () => this.validatePincode());
        }

        // Inline suggestions for shipping fields
        try {
            this.setupInlineSuggestions();
        } catch (e) {
            console.warn('Checkout inline suggestions skipped:', e);
        }
    }

    // ===================================
    // INLINE SUGGESTIONS (CHECKOUT)
    // ===================================
    getLocalList(key, limit = 30) {
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed.map(v => String(v || '').trim()).filter(Boolean).slice(0, limit);
        } catch {
            return [];
        }
    }

    setLocalList(key, values, limit = 30) {
        try {
            const list = Array.from(new Set((values || []).map(v => String(v || '').trim()).filter(Boolean)));
            localStorage.setItem(key, JSON.stringify(list.slice(0, limit)));
        } catch {
            // ignore
        }
    }

    addLocalListValue(key, value, limit = 30) {
        const v = String(value || '').trim();
        if (!v) return;
        const current = this.getLocalList(key, limit);
        const next = [v, ...current.filter(x => x.toLowerCase() !== v.toLowerCase())].slice(0, limit);
        this.setLocalList(key, next, limit);
    }

    createInlineSuggestDropdown(anchorEl) {
        if (!anchorEl) return null;
        const host = anchorEl.closest('.form-group') || anchorEl.parentElement;
        if (!host) return null;
        host.classList.add('ace1-inline-suggest-wrap');
        let dd = host.querySelector('.ace1-inline-suggest');
        if (!dd) {
            dd = document.createElement('div');
            dd.className = 'ace1-inline-suggest';
            dd.hidden = true;
            host.appendChild(dd);
        }
        return dd;
    }

    bindInlineSuggest(inputEl, getItems) {
        if (!inputEl || inputEl.dataset.inlineSuggestBound === '1') return;
        inputEl.dataset.inlineSuggestBound = '1';

        const dropdown = this.createInlineSuggestDropdown(inputEl);
        if (!dropdown) return;

        let activeIndex = -1;
        let lastItems = [];

        const close = () => {
            dropdown.hidden = true;
            dropdown.innerHTML = '';
            activeIndex = -1;
            lastItems = [];
        };

        const escapeHtml = (s) => String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const render = (items) => {
            lastItems = items || [];
            activeIndex = -1;
            if (!lastItems.length) {
                close();
                return;
            }
            dropdown.innerHTML = lastItems
                .slice(0, 8)
                .map((txt, idx) => `<button type="button" class="ace1-inline-suggest-item" data-idx="${idx}">${escapeHtml(txt)}</button>`)
                .join('');
            dropdown.hidden = false;
        };

        const updateActive = () => {
            const btns = Array.from(dropdown.querySelectorAll('.ace1-inline-suggest-item'));
            btns.forEach((b, i) => {
                if (i === activeIndex) b.classList.add('is-active');
                else b.classList.remove('is-active');
            });
            const active = btns[activeIndex];
            if (active) active.scrollIntoView({ block: 'nearest' });
        };

        const pick = (idx) => {
            const v = lastItems[idx];
            if (!v) return;
            inputEl.value = v;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            close();
        };

        dropdown.addEventListener('mousedown', (e) => e.preventDefault());
        dropdown.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('.ace1-inline-suggest-item');
            const idx = btn ? parseInt(btn.dataset.idx, 10) : NaN;
            if (Number.isFinite(idx)) pick(idx);
        });

        inputEl.addEventListener('input', () => {
            const q = String(inputEl.value || '').trim().toLowerCase();
            const items = (getItems?.() || [])
                .map(v => String(v || '').trim())
                .filter(Boolean);
            const filtered = q ? items.filter(v => v.toLowerCase().includes(q)) : items;
            render(Array.from(new Set(filtered)).slice(0, 8));
        });

        inputEl.addEventListener('keydown', (e) => {
            if (dropdown.hidden) return;
            const btns = dropdown.querySelectorAll('.ace1-inline-suggest-item');
            if (!btns.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(btns.length - 1, activeIndex + 1);
                updateActive();
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(0, activeIndex - 1);
                updateActive();
                return;
            }
            if (e.key === 'Enter') {
                if (activeIndex >= 0) {
                    e.preventDefault();
                    pick(activeIndex);
                }
                return;
            }
            if (e.key === 'Escape') {
                close();
            }
        });

        inputEl.addEventListener('blur', () => {
            setTimeout(close, 120);
        });
    }

    setupInlineSuggestions() {
        const address = document.getElementById('address');
        const city = document.getElementById('city');
        const pincode = document.getElementById('pincode');

        this.bindInlineSuggest(address, () => this.getLocalList('ace1_checkout_address_suggestions_v1', 30));
        this.bindInlineSuggest(city, () => this.getLocalList('ace1_checkout_city_suggestions_v1', 30));
        this.bindInlineSuggest(pincode, () => this.getLocalList('ace1_checkout_pincode_suggestions_v1', 30));

        const persist = () => this.saveCheckoutSuggestionSnapshot();
        address?.addEventListener('blur', persist);
        city?.addEventListener('blur', persist);
        pincode?.addEventListener('blur', persist);
    }

    saveCheckoutSuggestionSnapshot() {
        // Store last-used values as future inline suggestions (no server writes)
        this.addLocalListValue('ace1_checkout_address_suggestions_v1', document.getElementById('address')?.value, 30);
        this.addLocalListValue('ace1_checkout_city_suggestions_v1', document.getElementById('city')?.value, 30);
        this.addLocalListValue('ace1_checkout_pincode_suggestions_v1', document.getElementById('pincode')?.value, 30);
    }

    async loadCartItems() {
        // Cart state is maintained via session/DB, not localStorage
        // Prefer the shared loader if available so checkout gets fresh data.
        try {
            if (typeof window.loadCartFromDatabase === 'function') {
                await window.loadCartFromDatabase();
            }
        } catch {
            // ignore
        }

        this.cartItems = window.cart || [];
    }

    loadUserInfo() {
        const user = window.databaseAuth?.getCurrentUser();
        if (user) {
            const firstNameInput = document.getElementById('first-name');
            const lastNameInput = document.getElementById('last-name');
            const emailInput = document.getElementById('email');
            const phoneInput = document.getElementById('phone');

            if (firstNameInput) firstNameInput.value = user.firstName || '';
            if (lastNameInput) lastNameInput.value = user.lastName || '';
            if (emailInput) emailInput.value = user.email || '';
            if (phoneInput) phoneInput.value = user.phone || '';
        }
    }

    displayCartItems() {
        const itemsContainer = document.getElementById('checkout-items');
        if (!itemsContainer) return;

        if (this.cartItems.length === 0) {
            itemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
            return;
        }

        itemsContainer.innerHTML = this.cartItems.map(item => `
            <div class="checkout-item">
                <img src="${item.image || 'images/product-placeholder.jpg'}" alt="${item.name}">
                <div class="checkout-item-info">
                    <h4>${item.name}</h4>
                    <p>Qty: ${item.quantity}</p>
                    ${item.size ? `<p>Size: ${item.size}</p>` : ''}
                </div>
                <div class="checkout-item-price">
                    ₹${(item.price * item.quantity).toLocaleString('en-IN')}
                </div>
            </div>
        `).join('');
    }

    calculateTotals() {
        // Product prices already include GST (MRP)
        const mrpTotal = this.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Calculate base price (excluding GST) - reverse calculate from MRP
        // If MRP includes 18% GST: Base Price = MRP / 1.18
        this.subtotal = Math.round(mrpTotal / 1.18);
        
        // Calculate GST (18% of base price)
        this.tax = Math.round(this.subtotal * 0.18);
        
        // Free shipping for orders above ₹5000
        this.shipping = mrpTotal >= 5000 ? 0 : 200;
        
        // Calculate total (MRP + Shipping - Discount)
        this.total = mrpTotal + this.shipping - this.discount;

        this.updateSummaryDisplay();
    }

    updateSummaryDisplay() {
        const subtotalEl = document.getElementById('subtotal');
        const shippingEl = document.getElementById('shipping');
        const taxEl = document.getElementById('tax');
        const totalEl = document.getElementById('total');

        if (subtotalEl) subtotalEl.textContent = `₹${this.subtotal.toLocaleString('en-IN')}`;
        if (shippingEl) shippingEl.textContent = this.shipping === 0 ? 'Free' : `₹${this.shipping.toLocaleString('en-IN')}`;
        if (taxEl) taxEl.textContent = `₹${this.tax.toLocaleString('en-IN')}`;
        if (totalEl) totalEl.textContent = `₹${this.total.toLocaleString('en-IN')}`;
    }

    validateShippingForm() {
        const form = document.getElementById('shipping-form');
        if (!form) return false;

        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }

        return true;
    }

    proceedToPayment() {
        if (!this.validateShippingForm()) {
            return;
        }

        // Persist for inline suggestions next time
        try {
            this.saveCheckoutSuggestionSnapshot();
        } catch {
            // ignore
        }

        // Hide shipping section, show payment section
        const shippingSection = document.getElementById('shipping-section');
        const paymentSection = document.getElementById('payment-section');

        if (shippingSection) shippingSection.style.display = 'none';
        if (paymentSection) paymentSection.style.display = 'block';

        // Update progress
        this.updateProgress(2);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    backToShipping() {
        const shippingSection = document.getElementById('shipping-section');
        const paymentSection = document.getElementById('payment-section');

        if (shippingSection) shippingSection.style.display = 'block';
        if (paymentSection) paymentSection.style.display = 'none';

        this.updateProgress(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateProgress(step) {
        const steps = document.querySelectorAll('.progress-step');
        steps.forEach((stepEl, index) => {
            if (index < step) {
                stepEl.classList.add('active');
            } else {
                stepEl.classList.remove('active');
            }
        });
    }

    async placeOrder() {
        // Maintenance mode guard (keeps checkout usable but prevents placing orders)
        const settings = window.__siteSettings;
        const maintenanceMode = Boolean(window.ACE1_MAINTENANCE_MODE || (settings && settings.maintenance_mode));
        if (maintenanceMode) {
            this.showNotification('Orders are temporarily paused. Please check back soon.', 'info');
            return;
        }

        try {
            if (!this.cartItems || this.cartItems.length === 0) {
                this.showNotification('Your cart is empty', 'error');
                return;
            }

            // Ensure shipping details are valid before placing an order.
            if (!this.validateShippingForm()) return;

            // Persist for inline suggestions next time
            try {
                this.saveCheckoutSuggestionSnapshot();
            } catch {
                // ignore
            }

            const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'cod';
            const orderData = this.collectOrderData();

            if (paymentMethod === 'cod') {
                await this.processCODOrder(orderData);
                return;
            }

            // Future-proofing: if more payment methods are enabled later.
            if (paymentMethod === 'razorpay') {
                await this.initiateRazorpayPayment(orderData);
                return;
            }

            this.showNotification('Unsupported payment method', 'error');
        } catch (e) {
            console.error('placeOrder failed:', e);
            this.showNotification(e?.message || 'Order failed. Please try again.', 'error');
        }
    }

    getEdgeCreateOrderUrl() {
        try {
            const explicit = window.__ACE1_EDGE_CREATE_ORDER__ || '';
            if (explicit) return explicit;
            const base = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || window.SUPABASE_URL || '';
            if (!base) return '';
            return `${String(base).replace(/\/$/, '')}/functions/v1/create-order`;
        } catch {
            return '';
        }
    }

    getSupabaseAccessTokenSafe() {
        return (async () => {
            try {
                const supabase = window.getSupabase?.();
                return (await supabase?.auth.getSession())?.data?.session?.access_token || '';
            } catch {
                return '';
            }
        })();
    }

    mapCartForServer() {
        return (this.cartItems || []).map((item) => ({
            id: item.id,
            qty: item.qty != null ? item.qty : (item.quantity != null ? item.quantity : 1),
            size: item.size || ''
        }));
    }


    collectOrderData() {
        const form = document.getElementById('shipping-form');
        const formData = new FormData(form);

        return {
            orderId: 'ACE' + Date.now(),
            items: this.cartItems,
            shipping: {
                firstName: document.getElementById('first-name').value,
                lastName: document.getElementById('last-name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                address: document.getElementById('address').value,
                address2: document.getElementById('address2').value,
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                pincode: document.getElementById('pincode').value,
                country: document.getElementById('country').value
            },
            pricing: {
                subtotal: this.subtotal,
                shipping: this.shipping,
                tax: this.tax,
                discount: this.discount,
                total: this.total
            },
            createdAt: new Date().toISOString()
        };
    }

    async initiateRazorpayPayment(orderData) {
        // If an Edge Function endpoint is configured, try to create the order server-side
        // so the backend can create the Razorpay order and create a payments record.
        // This stores the server response on `this.serverOrder` so we skip duplicating
        // order creation on the client after payment.
        const EDGE_URL = this.getEdgeCreateOrderUrl();
        if (EDGE_URL) {
            this.serverOrder = null;
            try {
                const token = await this.getSupabaseAccessTokenSafe();
                if (!token) throw new Error('Please login to continue');

                const resp = await fetch(EDGE_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ cart: this.mapCartForServer(), shipping: orderData.shipping, payment_method: 'razorpay' })
                });

                const json = await resp.json().catch(() => ({}));
                if (resp.ok && json) {
                    // We expect { orderId, razor } back from the Edge function
                    this.serverOrder = json;
                } else {
                    console.warn('Edge create-order response not ok, falling back to client flow', json);
                }
            } catch (err) {
                console.warn('Edge create-order request failed, falling back to client flow:', err?.message || err);
            }
        }
        // Get Razorpay config
        const config = window.RAZORPAY_CONFIG;
        if (!config || !config.KEY_ID) {
            throw new Error('Razorpay configuration not loaded. Please check RAZORPAY_CONFIG.');
        }

        // Razorpay configuration
        const options = {
            key: config.KEY_ID, // Your Razorpay key
            amount: this.total * 100, // Amount in paise
            currency: 'INR',
            name: config.COMPANY_NAME,
            description: 'Terahertz Technology Footwear',
            image: config.COMPANY_LOGO || '',
            order_id: (this.serverOrder?.razor?.id) || orderData.orderId,
            handler: (response) => {
                this.handlePaymentSuccess(orderData, response);
            },
            prefill: {
                name: `${orderData.shipping.firstName} ${orderData.shipping.lastName}`,
                email: orderData.shipping.email,
                contact: orderData.shipping.phone
            },
            notes: {
                address: orderData.shipping.address
            },
            theme: {
                color: config.THEME_COLOR
            },
            modal: {
                ondismiss: () => {
                    this.showNotification('Payment cancelled', 'info');
                }
            }
        };

        // Check if Razorpay is loaded
        if (typeof Razorpay !== 'undefined') {
            const razorpay = new Razorpay(options);
            razorpay.open();
        } else {
            this.showNotification('Payment gateway not available. Please try again later.', 'error');
            console.log('Razorpay integration ready. Add your API key to js/razorpay-config.js');
            
            // For demo purposes, simulate successful payment
            setTimeout(() => {
                this.handlePaymentSuccess(orderData, {
                    razorpay_payment_id: 'demo_' + Date.now(),
                    razorpay_order_id: (this.serverOrder?.razor?.id) || orderData.orderId,
                    razorpay_signature: 'demo_signature'
                });
            }, 1000);
        }
    }

    async processCODOrder(orderData) {
        try {
            const EDGE_URL = this.getEdgeCreateOrderUrl();
            if (!EDGE_URL) throw new Error('Order service not configured');

            const token = await this.getSupabaseAccessTokenSafe();
            if (!token) throw new Error('Please login to place an order');

            const resp = await fetch(EDGE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ cart: this.mapCartForServer(), shipping: orderData.shipping, payment_method: 'cod' })
            });

            const json = await resp.json().catch(() => ({}));
            if (!resp.ok || !json?.orderId) {
                throw new Error(json?.error || 'Failed to place order');
            }

            // Cart is cleared server-side; no localStorage needed
            this.redirectToConfirmation(json.orderId);

        } catch (error) {
            this.showNotification('Order failed. Please try again.', 'error');
            throw error;
        }
    }

    handlePaymentSuccess(orderData, paymentResponse) {
        orderData.paymentMethod = 'razorpay';
        orderData.paymentStatus = 'paid';
        orderData.paymentDetails = paymentResponse;

        // If the order was created on the server (Edge Function) then the server
        // already inserted an order + payment record; the Razorpay webhook should
        // mark the payment as captured and update the order status. In that case
        // we avoid creating a duplicate order client-side.
        if (this.serverOrder && this.serverOrder.orderId) {
            // Cart is cleared server-side; no localStorage needed
            this.redirectToConfirmation(this.serverOrder.orderId);
            return;
        }

        // Fallback: persist order via client/service
        this.saveOrder(orderData);
        this.redirectToConfirmation(orderData.orderId);
    }

    async saveOrder(orderData) {
        // Use Supabase to save order
        if (window.supabaseService && window.supabaseService.supabase) {
            try {
                const user = window.databaseAuth?.getCurrentUser();
                const userId = user?.id || null;
                
                const orderItems = orderData.items.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    price: item.price,
                    size: item.size || '',
                    color: item.color || ''
                }));

                const result = await window.supabaseService.createOrder({
                    userId: userId,
                    totalAmount: orderData.pricing.total,
                    subtotal: orderData.pricing.subtotal,
                    tax: orderData.pricing.tax,
                    shipping: orderData.pricing.shipping,
                    discount: orderData.pricing.discount,
                    paymentMethod: orderData.paymentMethod || 'cod',
                    paymentStatus: orderData.paymentStatus || 'pending',
                    shippingAddress: orderData.shipping,
                    items: orderItems
                });

                if (result.success) {
                    console.log('✅ Order saved to database:', result.order);
                    // Clear cart from database and localStorage
                    await this.clearCart();
                } else {
                    console.error('Failed to save order to database:', result.error);
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error saving order:', error);
                showNotification('Error placing order. Please try again.', 'error');
                throw error;
            }
        } else {
            throw new Error('Order service not available');
        }
    }

    async clearCart() {
        try {
            // Clear from database if authenticated
            if (window.databaseAuth?.getCurrentUser()) {
                const supabase = window.getSupabase?.();
                if (supabase) {
                    const user = window.databaseAuth.getCurrentUser();
                    await supabase
                        .from('shopping_carts')
                        .delete()
                        .eq('user_id', user.id);
                }
            }
            
            // Cart is cleared server-side; no localStorage needed
        } catch (error) {
            console.warn('Error clearing cart:', error);
        }
    }

    redirectToConfirmation(orderId) {
        window.location.href = `order-confirmation.html?order=${orderId}`;
    }

    applyPromoCode() {
        const promoInput = document.getElementById('promo-input');
        const code = promoInput?.value.trim().toUpperCase();

        if (!code) {
            this.showNotification('Please enter a promo code', 'error');
            return;
        }

        // Demo promo codes
        const promoCodes = {
            'FIRST10': { type: 'percentage', value: 10, minOrder: 0 },
            'SAVE500': { type: 'fixed', value: 500, minOrder: 5000 },
            'WELCOME': { type: 'percentage', value: 15, minOrder: 3000 }
        };

        const promo = promoCodes[code];

        if (!promo) {
            this.showNotification('Invalid promo code', 'error');
            return;
        }

        if (this.subtotal < promo.minOrder) {
            this.showNotification(`Minimum order of ₹${promo.minOrder.toLocaleString()} required`, 'error');
            return;
        }

        if (promo.type === 'percentage') {
            this.discount = Math.round(this.subtotal * (promo.value / 100));
        } else {
            this.discount = promo.value;
        }

        this.calculateTotals();
        this.showNotification(`Promo code applied! You saved ₹${this.discount.toLocaleString()}`, 'success');
    }

    validatePincode() {
        const pincodeInput = document.getElementById('pincode');
        const pincode = pincodeInput?.value;

        if (pincode && pincode.length === 6) {
            // In production, validate PIN code via API
            // For demo, show success
            this.showNotification('Delivery available in your area', 'success');
        }
    }

    showEmptyCart() {
        const container = document.querySelector('.checkout-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-bag"></i>
                    <h2>Your cart is empty</h2>
                    <p>Add some products to your cart to proceed with checkout</p>
                    <a href="products.html" class="btn btn-primary">Browse Products</a>
                </div>
            `;
        }
    }

    async simulateAPICall() {
        return new Promise(resolve => setTimeout(resolve, 1000));
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// Initialize checkout manager
document.addEventListener('DOMContentLoaded', () => {
    new CheckoutManager();
});
