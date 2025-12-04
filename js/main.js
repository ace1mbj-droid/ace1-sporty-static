// ===================================
// GLOBAL VARIABLES
// ===================================
// Load cart from localStorage
let cart = JSON.parse(localStorage.getItem('ace1_cart') || '[]');
let cartTotal = 0;

// ===================================
// NAVIGATION
// ===================================
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');

// Sticky navbar on scroll
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu toggle
hamburger?.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
});

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
    });
});

// ===================================
// SEARCH FUNCTIONALITY
// ===================================
const searchBtn = document.getElementById('search-btn');
const searchOverlay = document.getElementById('search-overlay');
const searchClose = document.getElementById('search-close');

searchBtn?.addEventListener('click', () => {
    searchOverlay.classList.add('active');
    document.querySelector('.search-input').focus();
});

searchClose?.addEventListener('click', () => {
    searchOverlay.classList.remove('active');
});

searchOverlay?.addEventListener('click', (e) => {
    if (e.target === searchOverlay) {
        searchOverlay.classList.remove('active');
    }
});

// ===================================
// USER PROFILE/LOGIN BUTTON
// ===================================
const userBtn = document.querySelector('.user-btn');
const userLink = document.querySelector('a.icon-btn[href="login.html"]');

// Handle user button clicks (for pages with button.user-btn)
userBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // First check if we have a database token
    const hasToken = localStorage.getItem('ace1_token');
    
    if (hasToken) {
        // Has token, go to profile/admin
        const user = window.databaseAuth?.getCurrentUser();
        if (user?.role === 'admin' || user?.email === 'hello@ace1.in') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'user-profile.html';
        }
        return;
    }
    
    // No token, check if Supabase OAuth session exists
    try {
        const supabase = window.getSupabase?.();
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session && session.user) {
                // Has OAuth session, go to profile (it will sync)
                window.location.href = 'user-profile.html';
                return;
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
    
    // No session at all, go to login
    window.location.href = 'login.html';
});

// Handle user link clicks (for pages with a.icon-btn link)
userLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        // Check database auth first
        if (window.databaseAuth && window.databaseAuth.isAuthenticated()) {
            const user = window.databaseAuth.getCurrentUser();
            if (user) {
                // Check if admin
                if (user.role === 'admin' || user.email === 'hello@ace1.in') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'user-profile.html';
                }
                return;
            }
        }
        
        // Fallback to OAuth check
        const supabase = window.getSupabase?.();
        if (supabase) {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                // Check if admin
                const isAdmin = localStorage.getItem('ace1_admin') === 'true';
                if (isAdmin) {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'user-profile.html';
                }
            } else {
                window.location.href = 'login.html';
            }
        } else {
            // Not logged in
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        window.location.href = 'login.html';
    }
});

// ===================================
// SHOPPING CART
// ===================================
const cartBtn = document.getElementById('cart-btn');
const cartSidebar = document.getElementById('cart-sidebar');
const cartClose = document.getElementById('cart-close');
const cartOverlay = document.getElementById('cart-overlay');
const cartCount = document.getElementById('cart-count');
const cartItems = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');

// Open cart
cartBtn?.addEventListener('click', () => {
    cartSidebar.classList.add('active');
    cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
});

// Close cart
const closeCart = () => {
    cartSidebar.classList.remove('active');
    cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
};

cartClose?.addEventListener('click', closeCart);
cartOverlay?.addEventListener('click', closeCart);

// Add to cart functionality
document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const productId = btn.dataset.id;
        addToCart(productId);
        
        // Visual feedback
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-shopping-bag"></i>';
        }, 1000);
    });
});

async function addToCart(productId) {
    try {
        // Try to get product from Supabase first
        const supabase = window.getSupabase();
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) {
            // Fallback to local products
            const products = {
                '1': { id: 1, name: 'THz Runner Pro', price: 14999, image: 'images/product-1.jpg', stock_quantity: 0 },
                '2': { id: 2, name: 'Elite Sport THz', price: 17499, image: 'images/product-2.jpg', stock_quantity: 0 },
                '3': { id: 3, name: 'Wellness Walk', price: 12999, image: 'images/product-3.jpg', stock_quantity: 0 },
                '4': { id: 4, name: 'Urban Flex THz', price: 11999, image: 'images/product-4.jpg', stock_quantity: 0 }
            };
            
            const localProduct = products[productId];
            if (!localProduct) return;
            
            // Check stock
            if (localProduct.stock_quantity === 0 || localProduct.is_locked) {
                showNotification('This product is currently out of stock', 'error');
                return;
            }
            
            addProductToCart(localProduct);
        } else {
            // Check stock and availability from Supabase
            if (product.is_locked) {
                showNotification('This product is currently unavailable', 'error');
                return;
            }
            if (product.stock_quantity === 0) {
                showNotification('This product is currently out of stock', 'error');
                return;
            }
            
            // Convert Supabase product to cart format
            const cartProduct = {
                id: product.id,
                name: product.name,
                price: parseFloat(product.price),
                image: product.image_url || 'images/placeholder.jpg',
                stock_quantity: product.stock_quantity
            };
            
            addProductToCart(cartProduct);
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showNotification('Error adding product to cart', 'error');
    }
}

function addProductToCart(product) {
    // Check if product already in cart
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        // Check if we can add more based on stock
        if (product.stock_quantity && existingItem.quantity >= product.stock_quantity) {
            showNotification('Maximum available quantity already in cart', 'error');
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    updateCart();
    
    // Show notification
    showNotification('Product added to cart!', 'success');
}

function updateCart() {
    // Save cart to localStorage
    localStorage.setItem('ace1_cart', JSON.stringify(cart));
    
    // Update cart count
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    // Update cart total
    cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotalElement.textContent = `₹${cartTotal.toLocaleString('en-IN')}`;
    
    // Update cart items display
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-bag"></i>
                <p>Your cart is empty</p>
            </div>
        `;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item" data-id="${item.id}">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='images/placeholder.jpg'">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>₹${item.price.toLocaleString('en-IN')}</p>
                    <div class="cart-item-quantity">
                        <button class="qty-btn minus" data-id="${item.id}">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn plus" data-id="${item.id}">+</button>
                    </div>
                </div>
                <button class="remove-item" data-id="${item.id}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        
        // Add event listeners for quantity buttons and remove buttons
        document.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', updateQuantity);
        });
        
        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', removeFromCart);
        });
    }
}

function updateQuantity(e) {
    const productId = parseInt(e.target.dataset.id);
    const item = cart.find(item => item.id === productId);
    
    if (!item) return;
    
    if (e.target.classList.contains('plus')) {
        item.quantity += 1;
    } else if (e.target.classList.contains('minus')) {
        item.quantity -= 1;
        if (item.quantity <= 0) {
            cart = cart.filter(item => item.id !== productId);
        }
    }
    
    updateCart();
}

function removeFromCart(e) {
    const productId = parseInt(e.target.closest('.remove-item').dataset.id);
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    showNotification('Product removed from cart');
}

// ===================================
// PRODUCT FILTERS
// ===================================
const filterBtns = document.querySelectorAll('.filter-btn');
const productCards = document.querySelectorAll('.product-card');

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        filterBtns.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');
        
        const filter = btn.dataset.filter;
        
        productCards.forEach(card => {
            if (filter === 'all') {
                card.style.display = 'block';
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'scale(1)';
                }, 10);
            } else {
                if (card.dataset.category === filter) {
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'scale(1)';
                    }, 10);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        card.style.display = 'none';
                    }, 300);
                }
            }
        });
    });
});

// ===================================
// SMOOTH SCROLLING
// ===================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===================================
// NEWSLETTER FORM
// ===================================
const newsletterForm = document.getElementById('newsletter-form');

newsletterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    
    // In a real app, this would send to a server
    showNotification('Thank you for subscribing!');
    e.target.reset();
});

// ===================================
// NOTIFICATION SYSTEM
// ===================================
function showNotification(message, type = 'success') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add notification styles dynamically
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 100px;
        right: 20px;
        background: white;
        padding: 20px 30px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 15px;
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        font-weight: 500;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-success {
        border-left: 4px solid #00C853;
    }
    
    .notification-success i {
        color: #00C853;
        font-size: 20px;
    }
    
    .notification-error {
        border-left: 4px solid #FF3D00;
    }
    
    .notification-error i {
        color: #FF3D00;
        font-size: 20px;
    }
    
    .cart-item {
        display: flex;
        gap: 15px;
        padding: 20px;
        border-bottom: 1px solid #e5e5e5;
        position: relative;
    }
    
    .cart-item img {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 10px;
    }
    
    .cart-item-info {
        flex: 1;
    }
    
    .cart-item-info h4 {
        font-size: 16px;
        margin-bottom: 5px;
    }
    
    .cart-item-info p {
        color: #666;
        font-weight: 600;
        margin-bottom: 10px;
    }
    
    .cart-item-quantity {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .qty-btn {
        width: 28px;
        height: 28px;
        border: 1px solid #e5e5e5;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        background: white;
    }
    
    .qty-btn:hover {
        background: #f5f5f5;
        border-color: #000;
    }
    
    .remove-item {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        color: #666;
    }
    
    .remove-item:hover {
        background: #fee;
        color: #f44;
    }
`;
document.head.appendChild(notificationStyles);

// ===================================
// SCROLL ANIMATIONS
// ===================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for scroll animations
document.querySelectorAll('.feature-card, .product-card, .testimonial-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// ===================================
// QUICK VIEW MODAL (placeholder)
// ===================================
document.querySelectorAll('.quick-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showNotification('Quick view coming soon!', 'success');
    });
});

// ===================================
// INITIALIZE
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    updateCart();
    
    // Refresh product displays if admin updated products
    refreshProductsIfNeeded();
    
    console.log('Ace#1 Marketplace loaded successfully!');
});

// Refresh products from Supabase if admin made changes
async function refreshProductsIfNeeded() {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return; // Not on index page
    
    try {
        const supabase = window.getSupabase();
        
        // Fetch all active products with related data (matches products.js)
        const { data: products, error } = await supabase
            .from('products')
            .select(`
                *,
                product_images (
                    storage_path,
                    alt
                ),
                inventory (
                    stock,
                    size
                )
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        console.log(`✅ Loaded ${products?.length || 0} fresh products from Supabase`);
        
        if (!products || products.length === 0) {
            console.log('No products to display');
            return;
        }
        
        // Helper function to convert storage path to public URL (matches products.js)
        const getImageUrl = (storagePath) => {
            if (!storagePath) return 'images/placeholder.jpg';
            if (storagePath.startsWith('https://vorqavsuqcjnkjzwkyzr.supabase.co/storage')) return storagePath;
            if (storagePath.startsWith('http')) return storagePath;
            if (storagePath.includes('.jpg') || storagePath.includes('.png') || storagePath.includes('.jpeg') || storagePath.includes('.gif') || storagePath.includes('.webp')) {
                return `images/${storagePath.toLowerCase()}`;
            }
            const projectUrl = 'https://vorqavsuqcjnkjzwkyzr.supabase.co';
            return `${projectUrl}/storage/v1/object/public/Images/${storagePath}`;
        };
        
        // Process products with proper image URLs and inventory (matches products.js)
        const processedProducts = (products || []).map(product => ({
            ...product,
            image_url: getImageUrl(product.product_images?.[0]?.storage_path) || 'images/placeholder.jpg',
            stock_quantity: product.inventory?.[0]?.stock || 0,
            price: (product.price_cents / 100).toFixed(2)
        }));
        
        // Render products with same template as products.js
        productsGrid.innerHTML = processedProducts.map(product => `
            <div class="product-card" data-product-id="${product.id}" data-category="${(product.category || 'casual').toLowerCase()}">
                <div class="product-image">
                    <img src="${product.image_url || 'images/placeholder.jpg'}" alt="${product.name}" onerror="this.src='images/placeholder.jpg'">
                    ${product.is_locked ? '<div class="product-badge bg-gray">Locked</div>' : ''}
                    ${product.stock_quantity === 0 ? '<div class="product-badge bg-red">Out of Stock</div>' : ''}
                    ${product.stock_quantity > 0 && product.stock_quantity < 10 ? '<div class="product-badge bg-orange">Low Stock</div>' : ''}
                    <div class="product-overlay">
                        <button class="quick-view-btn" data-product-id="${product.id}">Quick View</button>
                    </div>
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${(product.description || '').substring(0, 100)}...</p>
                    <div class="product-rating">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star-half-alt"></i>
                        <span>(${Math.floor(Math.random() * 200 + 50)})</span>
                    </div>
                    <div class="product-footer">
                        <span class="product-price">₹${parseFloat(product.price).toLocaleString('en-IN')}</span>
                        ${(!product.is_locked && product.stock_quantity > 0 && (product.status === undefined || String(product.status).toLowerCase() === 'available'))
                            ? `<button class="add-to-cart-btn" data-id="${product.id}">
                                <i class="fas fa-shopping-bag"></i>
                               </button>`
                            : `<button class="add-to-cart-btn" disabled>
                                <i class="fas fa-times-circle" style="margin-right: 5px;"></i> ${product.is_locked ? 'Unavailable' : 'Out of Stock'}
                               </button>`
                        }
                    </div>
                </div>
            </div>
        `).join('');
        
        // Re-attach event listeners
        document.querySelectorAll('.add-to-cart-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = btn.dataset.id;
                if (window.addToCart) {
                    window.addToCart(productId);
                }
            });
        });
        
        // Re-attach Quick View handlers
        if (window.attachQuickViewHandlers) {
            window.attachQuickViewHandlers();
        }
        
        // Re-attach category filter handlers
        attachCategoryFilters();
        
        console.log(`✅ Homepage products updated from database (${processedProducts.length} products)`);
        
    } catch (error) {
        console.error('Could not refresh products:', error.message);
    }
}

// Attach category filter functionality
function attachCategoryFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const productsGrid = document.getElementById('products-grid');
    
    if (!filterBtns.length || !productsGrid) return;
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            const productCards = productsGrid.querySelectorAll('.product-card');
            
            productCards.forEach(card => {
                const category = card.dataset.category;
                
                if (filter === 'all') {
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'scale(1)';
                    }, 10);
                } else {
                    if (category === filter) {
                        card.style.display = 'block';
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'scale(1)';
                        }, 10);
                    } else {
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.8)';
                        setTimeout(() => {
                            card.style.display = 'none';
                        }, 300);
                    }
                }
            });
        });
    });
}

// ===================================
// KEYBOARD SHORTCUTS
// ===================================
document.addEventListener('keydown', (e) => {
    // Press 'Escape' to close modals
    if (e.key === 'Escape') {
        searchOverlay.classList.remove('active');
        closeCart();
    }
    
    // Press 'S' to open search (when not typing in an input)
    if (e.key === 's' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        searchOverlay.classList.add('active');
        document.querySelector('.search-input').focus();
    }
});

// ===================================
// CHECKOUT INTEGRATION
// ===================================
const checkoutBtn = document.querySelector('.cart-footer .btn-primary');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        const cart = JSON.parse(localStorage.getItem('ace1_cart') || '[]');
        
        if (cart.length === 0) {
            showNotification('Your cart is empty', 'error');
            return;
        }
        
        // Redirect to checkout page
        window.location.href = 'checkout.html';
    });
}

// ===================================
// NOTIFICATIONS SYSTEM
// ===================================
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Make functions globally available
window.showNotification = showNotification;
window.addToCart = addToCart;

// ===================================
// QUICK VIEW MODAL
// ===================================
const quickViewModal = document.getElementById('quick-view-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalCloseBtn = document.getElementById('modal-close-btn');

// Sample product data - replace with actual data from Supabase
let currentQuickViewProduct = null;

// Open Quick View Modal
function openQuickView(productData) {
    currentQuickViewProduct = productData;
    
    // Get proper image URL
    const imageUrl = productData.image_url || productData.image || 'images/placeholder.jpg';
    
    // Get proper price (handle both price and price_cents)
    let price = productData.price;
    if (typeof price === 'string') {
        price = parseFloat(price);
    }
    if (!price && productData.price_cents) {
        price = (productData.price_cents / 100);
    }
    
    // Populate modal with product data
    document.getElementById('qv-image').src = imageUrl;
    document.getElementById('qv-image').onerror = () => {
        document.getElementById('qv-image').src = 'images/placeholder.jpg';
    };
    document.getElementById('qv-name').textContent = productData.name;
    document.getElementById('qv-category').textContent = productData.category || 'Sneakers';
    document.getElementById('qv-price').textContent = `₹${price ? parseFloat(price).toLocaleString('en-IN') : '0'}`;
    document.getElementById('qv-description').textContent = productData.description || 'Premium quality sneakers with exceptional comfort and style.';
    
    // Stock status
    const stockEl = document.getElementById('qv-stock');
    const addToCartBtn = document.getElementById('qv-add-to-cart');
    const stock = productData.stock_quantity !== undefined ? productData.stock_quantity : 0;
    
    if (stock === 0 || productData.is_locked) {
        stockEl.className = 'qv-stock out-of-stock';
        stockEl.innerHTML = '<i class="fas fa-times-circle"></i> Out of Stock';
        addToCartBtn.disabled = true;
    } else if (stock < 10) {
        stockEl.className = 'qv-stock low-stock';
        stockEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> Only ${stock} left`;
        addToCartBtn.disabled = false;
    } else {
        stockEl.className = 'qv-stock in-stock';
        stockEl.innerHTML = '<i class="fas fa-check-circle"></i> In Stock';
        addToCartBtn.disabled = false;
    }
    
    // Show modal
    quickViewModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Quick View Modal
function closeQuickView() {
    quickViewModal.classList.remove('active');
    document.body.style.overflow = '';
    currentQuickViewProduct = null;
}

// Event Listeners for Quick View
if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeQuickView);
}

if (modalOverlay) {
    modalOverlay.addEventListener('click', closeQuickView);
}

// ESC key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && quickViewModal?.classList.contains('active')) {
        closeQuickView();
    }
});

// Size selection
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('size-option')) {
        document.querySelectorAll('.size-option').forEach(btn => btn.classList.remove('selected'));
        e.target.classList.add('selected');
    }
});

// Add to cart from Quick View
document.getElementById('qv-add-to-cart')?.addEventListener('click', () => {
    if (currentQuickViewProduct && !currentQuickViewProduct.is_locked && currentQuickViewProduct.stock_quantity > 0) {
        addToCart(currentQuickViewProduct.id);
        closeQuickView();
    }
});

// Attach Quick View to all quick view buttons
function attachQuickViewHandlers() {
    document.querySelectorAll('.quick-view-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const productCard = btn.closest('.product-card');
            
            // Try to get product ID from data attribute
            const productId = btn.dataset.productId || productCard?.dataset.productId;
            
            // Try Supabase first if available
            if (productId && typeof window.getSupabase === 'function') {
                try {
                    const supabase = window.getSupabase();
                    const { data: product, error } = await supabase
                        .from('products')
                        .select(`
                            *,
                            product_images (
                                storage_path,
                                alt
                            ),
                            inventory (
                                stock,
                                size
                            )
                        `)
                        .eq('id', productId)
                        .single();
                    
                    if (product && !error) {
                        // Helper function to convert storage path to public URL
                        const getImageUrl = (storagePath) => {
                            if (!storagePath) return 'images/placeholder.jpg';
                            if (storagePath.startsWith('https://vorqavsuqcjnkjzwkyzr.supabase.co/storage')) return storagePath;
                            if (storagePath.startsWith('http')) return storagePath;
                            if (storagePath.includes('.jpg') || storagePath.includes('.png') || storagePath.includes('.jpeg') || storagePath.includes('.gif') || storagePath.includes('.webp')) {
                                return `images/${storagePath.toLowerCase()}`;
                            }
                            const projectUrl = 'https://vorqavsuqcjnkjzwkyzr.supabase.co';
                            return `${projectUrl}/storage/v1/object/public/Images/${storagePath}`;
                        };
                        
                        // Process product with proper image URL and inventory
                        const processedProduct = {
                            ...product,
                            image_url: getImageUrl(product.product_images?.[0]?.storage_path) || 'images/placeholder.jpg',
                            stock_quantity: product.inventory?.[0]?.stock || 0,
                            price: (product.price_cents / 100).toFixed(2)
                        };
                        
                        openQuickView(processedProduct);
                        return;
                    }
                } catch (error) {
                    console.log('Supabase not available, using fallback data');
                }
            }
            
            // Fallback: Extract data from card
            const badgeText = (productCard?.querySelector('.product-badge')?.textContent || '').toLowerCase();
            const productData = {
                id: productId || Date.now(),
                name: productCard?.querySelector('.product-name, h3')?.textContent || 'Product',
                price: parseInt(productCard?.querySelector('.product-price, .price')?.textContent?.replace(/[^\d]/g, '') || '0'),
                image: productCard?.querySelector('img')?.src || 'images/placeholder.png',
                image_url: productCard?.querySelector('img')?.src || 'images/placeholder.png',
                category: productCard?.querySelector('.product-category')?.textContent || 'Sneakers',
                description: productCard?.querySelector('.product-description')?.textContent || 'Premium quality sneakers with exceptional comfort and style.',
                stock_quantity: badgeText.includes('out of stock') ? 0 : (badgeText.includes('low stock') ? 5 : 50),
                is_locked: badgeText.includes('locked') || badgeText.includes('unavailable')
            };
            
            openQuickView(productData);
        });
    });
}

// Initialize Quick View on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachQuickViewHandlers);
} else {
    attachQuickViewHandlers();
}

// Make Quick View functions globally available
window.openQuickView = openQuickView;
window.closeQuickView = closeQuickView;
window.attachQuickViewHandlers = attachQuickViewHandlers;
