// Checkout and Payment Manager
class CheckoutManager {
    constructor() {
        this.cartItems = [];
        this.subtotal = 0;
        this.tax = 0;
        this.shipping = 0;
        this.total = 0;
        this.discount = 0;
        this.init();
    }

    init() {
        this.loadCartItems();
        this.calculateTotals();
        this.displayCartItems();
        this.setupEventListeners();
        this.loadUserInfo();
    }

    setupEventListeners() {
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
    }

    loadCartItems() {
        // Cart state is maintained via session/DB, not localStorage
        // This method is now a no-op; cart items are fetched from window.cart if available
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
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked');
        
        if (!paymentMethod) {
            this.showNotification('Please select a payment method', 'error');
            return;
        }

        const orderData = this.collectOrderData();

        if (paymentMethod.value === 'razorpay') {
            this.initiateRazorpayPayment(orderData);
        } else if (paymentMethod.value === 'cod') {
            this.processCODOrder(orderData);
        }
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
        const EDGE_URL = window.__ACE1_EDGE_CREATE_ORDER__ || '';
        if (EDGE_URL) {
            this.serverOrder = null;
            try {
                // Try to get a Supabase session token if available to authenticate the request
                const supabase = window.getSupabase?.();
                let token = '';
                try {
                    token = (await supabase?.auth.getSession())?.data?.session?.access_token || '';
                } catch (e) {
                    // ignore
                }

                const resp = await fetch(EDGE_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ items: this.cartItems, shipping: orderData.shipping })
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
        const config = window.RAZORPAY_CONFIG || {
            KEY_ID: 'rzp_test_your_key_here',
            COMPANY_NAME: 'Ace#1',
            THEME_COLOR: '#FF6B00'
        };

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
            // Simulate API call
            await this.simulateAPICall();

            orderData.paymentMethod = 'cod';
            orderData.paymentStatus = 'pending';

            this.saveOrder(orderData);
            this.redirectToConfirmation(orderData.orderId);

        } catch (error) {
            this.showNotification('Order failed. Please try again.', 'error');
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
