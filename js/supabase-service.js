// ===================================
// SUPABASE SERVICE LAYER
// ===================================
// Handles all database operations for the e-commerce platform

class SupabaseService {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
    }

    // Initialize service
    async init() {
        this.supabase = window.getSupabase();
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        // Check for existing session
        const { data } = await this.supabase.auth.getSession();
        this.currentUser = data.session?.user || null;
        
        // Listen for auth changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            this.currentUser = session?.user || null;
            
            if (event === 'SIGNED_IN') {
                console.log('✅ User signed in:', this.currentUser.email);
            } else if (event === 'SIGNED_OUT') {
                console.log('👋 User signed out');
            }
        });
        
        return this;
    }

    // ===================================
    // AUTHENTICATION
    // ===================================
    
    async register(email, password, userData) {
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: userData.firstName,
                        last_name: userData.lastName,
                        phone: userData.phone
                    }
                }
            });

            if (error) throw error;

            // Create user profile in database
            if (data.user) {
                await this.createUserProfile({
                    id: data.user.id,
                    email: data.user.email,
                    first_name: userData.firstName,
                    last_name: userData.lastName,
                    phone: userData.phone
                });
            }

            return { success: true, user: data.user };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    async login(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            
            this.currentUser = data.user;
            return { success: true, user: data.user, session: data.session };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            this.currentUser = null;
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    async resetPassword(email) {
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`
            });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            return { success: false, error: error.message };
        }
    }

    async updatePassword(newPassword) {
        try {
            const { error } = await this.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Password update error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // USER PROFILE
    // ===================================

    async createUserProfile(profileData) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .insert([profileData])
                .select()
                .single();

            if (error) throw error;
            return { success: true, profile: data };
        } catch (error) {
            console.error('Create profile error:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserProfile(userId = null) {
        try {
            const id = userId || this.currentUser?.id;
            if (!id) throw new Error('No user ID provided');

            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return { success: true, profile: data };
        } catch (error) {
            console.error('Get profile error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateUserProfile(updates) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('users')
                .update(updates)
                .eq('id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, profile: data };
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // ADDRESSES
    // ===================================

    async getAddresses() {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('addresses')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .order('is_default', { ascending: false });

            if (error) throw error;
            return { success: true, addresses: data };
        } catch (error) {
            console.error('Get addresses error:', error);
            return { success: false, error: error.message };
        }
    }

    async addAddress(addressData) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            // If this is set as default, unset other defaults
            if (addressData.is_default) {
                await this.supabase
                    .from('addresses')
                    .update({ is_default: false })
                    .eq('user_id', this.currentUser.id);
            }

            const { data, error } = await this.supabase
                .from('addresses')
                .insert([{
                    ...addressData,
                    user_id: this.currentUser.id
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, address: data };
        } catch (error) {
            console.error('Add address error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateAddress(addressId, updates) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('addresses')
                .update(updates)
                .eq('id', addressId)
                .eq('user_id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, address: data };
        } catch (error) {
            console.error('Update address error:', error);
            return { success: false, error: error.message };
        }
    }

    async deleteAddress(addressId) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { error } = await this.supabase
                .from('addresses')
                .delete()
                .eq('id', addressId)
                .eq('user_id', this.currentUser.id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Delete address error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // PRODUCTS
    // ===================================

    async getProducts(filters = {}) {
        try {
            let query = this.supabase
                .from('products')
                .select('*');

            // Apply filters
            if (filters.category) {
                query = query.eq('category', filters.category);
            }
            if (filters.minPrice) {
                query = query.gte('price', filters.minPrice);
            }
            if (filters.maxPrice) {
                query = query.lte('price', filters.maxPrice);
            }
            if (filters.search) {
                query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
            }
            if (filters.inStock) {
                query = query.gt('stock', 0);
            }

            // Sorting
            if (filters.sortBy) {
                const [field, order] = filters.sortBy.split(':');
                query = query.order(field, { ascending: order === 'asc' });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, products: data };
        } catch (error) {
            console.error('Get products error:', error);
            return { success: false, error: error.message };
        }
    }

    async getProduct(productId) {
        try {
            const { data, error } = await this.supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .single();

            if (error) throw error;
            return { success: true, product: data };
        } catch (error) {
            console.error('Get product error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // CART
    // ===================================

    async getCart() {
        try {
            if (!this.currentUser) {
                // Return localStorage cart for non-authenticated users
                const localCart = JSON.parse(localStorage.getItem('ace1_cart') || '[]');
                return { success: true, cart: localCart };
            }

            const { data, error } = await this.supabase
                .from('cart_items')
                .select(`
                    *,
                    product:products(*)
                `)
                .eq('user_id', this.currentUser.id);

            if (error) throw error;
            return { success: true, cart: data };
        } catch (error) {
            console.error('Get cart error:', error);
            return { success: false, error: error.message };
        }
    }

    async addToCart(productId, quantity = 1, size = null, color = null) {
        try {
            if (!this.currentUser) {
                // Handle localStorage cart
                const cart = JSON.parse(localStorage.getItem('ace1_cart') || '[]');
                const existingItem = cart.find(item => 
                    item.productId === productId && 
                    item.size === size && 
                    item.color === color
                );

                if (existingItem) {
                    existingItem.quantity += quantity;
                } else {
                    cart.push({ productId, quantity, size, color });
                }

                localStorage.setItem('ace1_cart', JSON.stringify(cart));
                return { success: true, cart };
            }

            // Check if item already exists
            const { data: existing } = await this.supabase
                .from('cart_items')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .eq('product_id', productId)
                .eq('size', size || '')
                .eq('color', color || '')
                .single();

            if (existing) {
                // Update quantity
                const { data, error } = await this.supabase
                    .from('cart_items')
                    .update({ quantity: existing.quantity + quantity })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, item: data };
            } else {
                // Insert new item
                const { data, error } = await this.supabase
                    .from('cart_items')
                    .insert([{
                        user_id: this.currentUser.id,
                        product_id: productId,
                        quantity,
                        size: size || '',
                        color: color || ''
                    }])
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, item: data };
            }
        } catch (error) {
            console.error('Add to cart error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateCartItem(itemId, quantity) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('cart_items')
                .update({ quantity })
                .eq('id', itemId)
                .eq('user_id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, item: data };
        } catch (error) {
            console.error('Update cart error:', error);
            return { success: false, error: error.message };
        }
    }

    async removeFromCart(itemId) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { error } = await this.supabase
                .from('cart_items')
                .delete()
                .eq('id', itemId)
                .eq('user_id', this.currentUser.id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Remove from cart error:', error);
            return { success: false, error: error.message };
        }
    }

    async clearCart() {
        try {
            if (!this.currentUser) {
                localStorage.removeItem('ace1_cart');
                return { success: true };
            }

            const { error } = await this.supabase
                .from('cart_items')
                .delete()
                .eq('user_id', this.currentUser.id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Clear cart error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // ORDERS
    // ===================================

    async createOrder(orderData) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            // Create order
            const { data: order, error: orderError } = await this.supabase
                .from('orders')
                .insert([{
                    user_id: this.currentUser.id,
                    total_amount: orderData.totalAmount,
                    subtotal: orderData.subtotal,
                    tax: orderData.tax,
                    shipping: orderData.shipping,
                    discount: orderData.discount || 0,
                    payment_method: orderData.paymentMethod,
                    payment_status: orderData.paymentStatus || 'pending',
                    shipping_address: orderData.shippingAddress,
                    status: 'processing'
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            // Create order items
            const orderItems = orderData.items.map(item => ({
                order_id: order.id,
                product_id: item.productId,
                quantity: item.quantity,
                price: item.price,
                size: item.size || '',
                color: item.color || ''
            }));

            const { error: itemsError } = await this.supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // Clear cart after successful order
            await this.clearCart();

            return { success: true, order };
        } catch (error) {
            console.error('Create order error:', error);
            return { success: false, error: error.message };
        }
    }

    async getOrders() {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    order_items(
                        *,
                        product:products(*)
                    )
                `)
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, orders: data };
        } catch (error) {
            console.error('Get orders error:', error);
            return { success: false, error: error.message };
        }
    }

    async getOrder(orderId) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    order_items(
                        *,
                        product:products(*)
                    )
                `)
                .eq('id', orderId)
                .eq('user_id', this.currentUser.id)
                .single();

            if (error) throw error;
            return { success: true, order: data };
        } catch (error) {
            console.error('Get order error:', error);
            return { success: false, error: error.message };
        }
    }

    async cancelOrder(orderId) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', orderId)
                .eq('user_id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;
            return { success: true, order: data };
        } catch (error) {
            console.error('Cancel order error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // REVIEWS
    // ===================================

    async getReviews(productId) {
        try {
            const { data, error } = await this.supabase
                .from('reviews')
                .select(`
                    *,
                    user:users(first_name, last_name)
                `)
                .eq('product_id', productId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, reviews: data };
        } catch (error) {
            console.error('Get reviews error:', error);
            return { success: false, error: error.message };
        }
    }

    async submitReview(productId, reviewData) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('reviews')
                .insert([{
                    user_id: this.currentUser.id,
                    product_id: productId,
                    rating: reviewData.rating,
                    title: reviewData.title,
                    comment: reviewData.comment,
                    verified_purchase: reviewData.verifiedPurchase || false
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, review: data };
        } catch (error) {
            console.error('Submit review error:', error);
            return { success: false, error: error.message };
        }
    }

    async voteReview(reviewId, helpful) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            // Check if user already voted
            const { data: existing } = await this.supabase
                .from('review_votes')
                .select('*')
                .eq('review_id', reviewId)
                .eq('user_id', this.currentUser.id)
                .single();

            if (existing) {
                // Update existing vote
                const { error } = await this.supabase
                    .from('review_votes')
                    .update({ helpful })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                // Create new vote
                const { error } = await this.supabase
                    .from('review_votes')
                    .insert([{
                        review_id: reviewId,
                        user_id: this.currentUser.id,
                        helpful
                    }]);

                if (error) throw error;
            }

            return { success: true };
        } catch (error) {
            console.error('Vote review error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // WISHLIST
    // ===================================

    async getWishlist() {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('wishlist')
                .select(`
                    *,
                    product:products(*)
                `)
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, wishlist: data };
        } catch (error) {
            console.error('Get wishlist error:', error);
            return { success: false, error: error.message };
        }
    }

    async addToWishlist(productId) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { data, error } = await this.supabase
                .from('wishlist')
                .insert([{
                    user_id: this.currentUser.id,
                    product_id: productId
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, item: data };
        } catch (error) {
            console.error('Add to wishlist error:', error);
            return { success: false, error: error.message };
        }
    }

    async removeFromWishlist(productId) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');

            const { error } = await this.supabase
                .from('wishlist')
                .delete()
                .eq('user_id', this.currentUser.id)
                .eq('product_id', productId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Remove from wishlist error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Initialize and export service
const supabaseService = new SupabaseService();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await supabaseService.init();
        console.log('✅ Supabase service initialized');
    } catch (error) {
        console.error('❌ Supabase service initialization failed:', error);
    }
});

// Export for global access
window.supabaseService = supabaseService;
