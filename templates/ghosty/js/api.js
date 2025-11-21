// API Configuration and Integration Module
// This module handles all API calls for the Ace#1 e-commerce platform

class APIClient {
    constructor() {
        // Configure your API base URL here
        this.baseURL = this.getAPIBaseURL();
        this.timeout = 30000; // 30 seconds
        this.headers = {
            'Content-Type': 'application/json',
        };
    }

    getAPIBaseURL() {
        // Auto-detect environment
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Local development: frontend often runs on 3000; backend API runs on 4000
            return 'http://localhost:4000/api';
        } else if (hostname.includes('staging')) {
            // Staging environment
            return 'https://staging-api.ace1.com/api';
        } else {
            // Production environment
            return 'https://api.ace1.com/api';
        }
        
        // Or simply set your API URL directly:
        // return 'https://your-backend-url.com/api';
    }

    // Get authentication token from localStorage
    getAuthToken() {
        return localStorage.getItem('ace1_token');
    }

    // Set authentication headers
    setAuthHeaders() {
        const token = this.getAuthToken();
        if (token) {
            this.headers['Authorization'] = `Bearer ${token}`;
        }
    }

    // Generic API request method
    async request(endpoint, method = 'GET', data = null) {
        this.setAuthHeaders();

        const config = {
            method: method,
            headers: this.headers,
            signal: AbortSignal.timeout(this.timeout)
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, config);
            
            // Handle different response statuses
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new APIError(
                    error.message || 'Request failed',
                    response.status,
                    error
                );
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new APIError('Request timeout', 408);
            }
            throw error;
        }
    }

    // ===================================
    // AUTHENTICATION ENDPOINTS
    // ===================================
    
    async register(userData) {
        return this.request('/auth/register', 'POST', {
            first_name: userData.firstName,
            last_name: userData.lastName,
            email: userData.email,
            phone: userData.phone,
            password: userData.password,
            newsletter: userData.newsletter
        });
    }

    async login(credentials) {
        return this.request('/auth/login', 'POST', {
            email: credentials.email,
            password: credentials.password,
            remember: credentials.remember
        });
    }

    async logout() {
        return this.request('/auth/logout', 'POST');
    }

    async refreshToken() {
        return this.request('/auth/refresh', 'POST');
    }

    async forgotPassword(email) {
        return this.request('/auth/forgot-password', 'POST', { email });
    }

    async resetPassword(token, newPassword) {
        return this.request('/auth/reset-password', 'POST', {
            token,
            password: newPassword
        });
    }

    // ===================================
    // USER ENDPOINTS
    // ===================================
    
    async getUserProfile() {
        return this.request('/user/profile', 'GET');
    }

    async updateUserProfile(userData) {
        return this.request('/user/profile', 'PUT', userData);
    }

    async changePassword(passwordData) {
        return this.request('/user/change-password', 'POST', {
            current_password: passwordData.currentPassword,
            new_password: passwordData.newPassword
        });
    }

    async getUserAddresses() {
        return this.request('/user/addresses', 'GET');
    }

    async addAddress(address) {
        return this.request('/user/addresses', 'POST', address);
    }

    async updateAddress(addressId, address) {
        return this.request(`/user/addresses/${addressId}`, 'PUT', address);
    }

    async deleteAddress(addressId) {
        return this.request(`/user/addresses/${addressId}`, 'DELETE');
    }

    // ===================================
    // PRODUCT ENDPOINTS
    // ===================================
    
    async getProducts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/products?${queryString}`, 'GET');
    }

    async getProduct(productId) {
        return this.request(`/products/${productId}`, 'GET');
    }

    async searchProducts(query, filters = {}) {
        return this.request('/products/search', 'POST', {
            query,
            filters
        });
    }

    async getProductsByCategory(category, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/products/category/${category}?${queryString}`, 'GET');
    }

    // ===================================
    // CART ENDPOINTS
    // ===================================
    
    async getCart() {
        return this.request('/cart', 'GET');
    }

    async addToCart(productId, quantity = 1, size = null) {
        return this.request('/cart/add', 'POST', {
            product_id: productId,
            quantity,
            size
        });
    }

    async updateCartItem(itemId, quantity) {
        return this.request(`/cart/items/${itemId}`, 'PUT', { quantity });
    }

    async removeFromCart(itemId) {
        return this.request(`/cart/items/${itemId}`, 'DELETE');
    }

    async clearCart() {
        return this.request('/cart/clear', 'POST');
    }

    // ===================================
    // ORDER ENDPOINTS
    // ===================================
    
    async createOrder(orderData) {
        return this.request('/orders', 'POST', {
            shipping_address: orderData.shipping,
            payment_method: orderData.paymentMethod,
            items: orderData.items,
            promo_code: orderData.promoCode
        });
    }

    async getOrders(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/orders?${queryString}`, 'GET');
    }

    async getOrder(orderId) {
        return this.request(`/orders/${orderId}`, 'GET');
    }

    async cancelOrder(orderId) {
        return this.request(`/orders/${orderId}/cancel`, 'POST');
    }

    async trackOrder(orderId) {
        return this.request(`/orders/${orderId}/track`, 'GET');
    }

    // ===================================
    // PAYMENT ENDPOINTS
    // ===================================
    
    async createPaymentIntent(orderId, amount) {
        return this.request('/payments/create', 'POST', {
            order_id: orderId,
            amount
        });
    }

    async verifyPayment(paymentData) {
        return this.request('/payments/verify', 'POST', paymentData);
    }

    async applyPromoCode(code) {
        return this.request('/promo/validate', 'POST', { code });
    }

    // ===================================
    // REVIEW ENDPOINTS
    // ===================================
    
    async getProductReviews(productId, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/products/${productId}/reviews?${queryString}`, 'GET');
    }

    async submitReview(productId, reviewData) {
        return this.request(`/products/${productId}/reviews`, 'POST', {
            rating: reviewData.rating,
            title: reviewData.title,
            comment: reviewData.comment
        });
    }

    async updateReview(reviewId, reviewData) {
        return this.request(`/reviews/${reviewId}`, 'PUT', reviewData);
    }

    async deleteReview(reviewId) {
        return this.request(`/reviews/${reviewId}`, 'DELETE');
    }

    async markReviewHelpful(reviewId, helpful = true) {
        return this.request(`/reviews/${reviewId}/helpful`, 'POST', { helpful });
    }

    // ===================================
    // WISHLIST ENDPOINTS
    // ===================================
    
    async getWishlist() {
        return this.request('/wishlist', 'GET');
    }

    async addToWishlist(productId) {
        return this.request('/wishlist/add', 'POST', { product_id: productId });
    }

    async removeFromWishlist(productId) {
        return this.request(`/wishlist/remove/${productId}`, 'DELETE');
    }

    // ===================================
    // UTILITY ENDPOINTS
    // ===================================
    
    async validatePincode(pincode) {
        return this.request('/utils/validate-pincode', 'POST', { pincode });
    }

    async checkDelivery(pincode, productId) {
        return this.request('/utils/check-delivery', 'POST', {
            pincode,
            product_id: productId
        });
    }

    async getStates() {
        return this.request('/utils/states', 'GET');
    }

    // ===================================
    // ADMIN ENDPOINTS (if user is admin)
    // ===================================
    
    async getAdminStats() {
        return this.request('/admin/stats', 'GET');
    }

    async getAllOrders() {
        return this.request('/admin/orders', 'GET');
    }

    async updateOrderStatus(orderId, status) {
        return this.request(`/admin/orders/${orderId}/status`, 'PUT', { status });
    }

    async getAllUsers() {
        return this.request('/admin/users', 'GET');
    }

    async createProduct(productData) {
        return this.request('/admin/products', 'POST', productData);
    }

    async updateProduct(productId, productData) {
        return this.request(`/admin/products/${productId}`, 'PUT', productData);
    }

    async deleteProduct(productId) {
        return this.request(`/admin/products/${productId}`, 'DELETE');
    }
}

// Custom API Error class
class APIError extends Error {
    constructor(message, statusCode, data = {}) {
        super(message);
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.data = data;
    }

    isAuthError() {
        return this.statusCode === 401 || this.statusCode === 403;
    }

    isNotFound() {
        return this.statusCode === 404;
    }

    isServerError() {
        return this.statusCode >= 500;
    }
}

// Create global API client instance
const api = new APIClient();

// Make it globally available
window.api = api;
window.APIError = APIError;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIClient, APIError };
}
