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
            const sessionId = sessionStorage.getItem('ace1_session_id');
            
            if (!this.currentUser) {
                // Anonymous user - get cart by session_id from database
                if (!sessionId) {
                    return { success: true, cart: [] };
                }
                
                // Use Edge Function to properly handle session variables for RLS
                const response = await fetch('https://vorqavsuqcjnkjzwkyzr.supabase.co/functions/v1/get_cart_with_session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.supabase.supabaseKey}`
                    },
                    body: JSON.stringify({ session_id: sessionId })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        return { success: true, cart: result.data };
                    } else {
                        console.error('Cart load error:', result.error);
                        return { success: true, cart: [] };
                    }
                } else {
                    console.error('Cart load failed:', response.status);
                    return { success: true, cart: [] };
                }
            }

            const { data, error } = await this.supabase
                .from('shopping_carts')
                .select(`
                    *,
                    product:products(*)
                `)
                .eq('user_id', this.currentUser.id);

            if (error) throw error;
            return { success: true, cart: data || [] };
        } catch (error) {
            console.error('Get cart error:', error);
            return { success: false, error: error.message };
        }
    }

    async addToCart(productId, quantity = 1, size = null, color = null) {
        try {
            const sessionId = sessionStorage.getItem('ace1_session_id');
            
            if (!this.currentUser) {
                // Anonymous user - add to cart by session_id in database
                if (!sessionId) {
                    return { success: false, error: 'No session ID' };
                }
                
                const { data, error } = await this.supabase.rpc('add_to_cart_by_session', {
                    p_session_id: sessionId,
                    p_product_id: productId,
                    p_quantity: quantity,
                    p_size: size
                });
                
                if (error) throw error;
                return { success: true, itemId: data };
            }

            // Check if item already exists
            const { data: existing } = await this.supabase
                .from('shopping_carts')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .eq('product_id', productId)
                .eq('size', size || '')
                .single();

            if (existing) {
                // Update quantity
                const { data, error } = await this.supabase
                    .from('shopping_carts')
                    .update({ quantity: existing.quantity + quantity })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, item: data };
            } else {
                // Insert new item
                const { data, error } = await this.supabase
                    .from('shopping_carts')
                    .insert([{
                        user_id: this.currentUser.id,
                        product_id: productId,
                        quantity,
                        size: size || ''
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
            const sessionId = sessionStorage.getItem('ace1_session_id');
            
            if (!this.currentUser) {
                // Anonymous user - update by session_id
                // Note: itemId should be product_id for anonymous users
                if (!sessionId) {
                    return { success: false, error: 'No session ID' };
                }
                
                const { data, error } = await this.supabase.rpc('update_cart_item_by_session', {
                    p_session_id: sessionId,
                    p_product_id: itemId, // Using product_id for anonymous
                    p_quantity: quantity
                });
                
                if (error) throw error;
                return { success: true };
            }

            const { data, error } = await this.supabase
                .from('shopping_carts')
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
            const sessionId = sessionStorage.getItem('ace1_session_id');
            
            if (!this.currentUser) {
                // Anonymous user - remove by session_id
                if (!sessionId) {
                    return { success: false, error: 'No session ID' };
                }
                
                const { data, error } = await this.supabase.rpc('remove_from_cart_by_session', {
                    p_session_id: sessionId,
                    p_product_id: itemId // Using product_id for anonymous
                });
                
                if (error) throw error;
                return { success: true };
            }

            const { error } = await this.supabase
                .from('shopping_carts')
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
            const sessionId = sessionStorage.getItem('ace1_session_id');
            
            if (!this.currentUser) {
                // Anonymous user - clear by session_id
                if (sessionId) {
                    await this.supabase.rpc('clear_cart_by_session', { p_session_id: sessionId });
                }
                return { success: true };
            }

            const { error } = await this.supabase
                .from('shopping_carts')
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

            // First, validate stock availability for all items
            for (const item of orderData.items) {
                const { data: inventoryData, error: invError } = await this.supabase
                    .from('inventory')
                    .select('id, stock, size')
                    .eq('product_id', item.productId)
                    .eq('size', item.size || '')
                    .single();

                if (invError && invError.code !== 'PGRST116') {
                    // PGRST116 is "no rows returned" - handle as out of stock
                    throw invError;
                }

                const availableStock = inventoryData?.stock || 0;
                if (availableStock < item.quantity) {
                    throw new Error(`Insufficient stock for product. Available: ${availableStock}, Requested: ${item.quantity}`);
                }
            }

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

            // Create order items and deduct stock
            const orderItems = [];
            for (const item of orderData.items) {
                orderItems.push({
                    order_id: order.id,
                    product_id: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    size: item.size || '',
                    color: item.color || ''
                });

                // Deduct stock from inventory
                const { error: updateError } = await this.supabase.rpc('decrement_stock', {
                    p_product_id: item.productId,
                    p_size: item.size || '',
                    p_quantity: item.quantity
                });

                // If RPC doesn't exist, use direct update
                if (updateError && updateError.code === '42883') {
                    // Function doesn't exist - use direct update
                    const { data: currentInv } = await this.supabase
                        .from('inventory')
                        .select('id, stock')
                        .eq('product_id', item.productId)
                        .eq('size', item.size || '')
                        .single();

                    if (currentInv) {
                        await this.supabase
                            .from('inventory')
                            .update({ stock: Math.max(0, currentInv.stock - item.quantity) })
                            .eq('id', currentInv.id);
                    }
                } else if (updateError) {
                    console.error('Stock update error:', updateError);
                }
            }

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

    async createReviewFromOrder({ orderId, productId, rating, title, comment }) {
        try {
            if (!this.currentUser) throw new Error('User not authenticated');
            if (!orderId || !productId) throw new Error('Order and product are required');

            // Ensure the order belongs to the user and contains the product
            const { data: orderItem, error: orderError } = await this.supabase
                .from('order_items')
                .select('id, order:orders(user_id, status)')
                .eq('order_id', orderId)
                .eq('product_id', productId)
                .eq('orders.user_id', this.currentUser.id)
                .single();

            if (orderError || !orderItem) {
                throw new Error('You can only review products you purchased');
            }

            if (orderItem.order?.status !== 'delivered') {
                throw new Error('You can review after the order is delivered');
            }

            // Prevent duplicate reviews for the same order/product
            const { data: existing } = await this.supabase
                .from('reviews')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('product_id', productId)
                .eq('order_id', orderId)
                .maybeSingle();

            if (existing) {
                throw new Error('You have already reviewed this product for this order');
            }

            const userMeta = this.currentUser.user_metadata || {};
            const reviewerName = `${userMeta.first_name || userMeta.given_name || ''} ${userMeta.last_name || userMeta.family_name || ''}`.trim();

            const { data, error: insertError } = await this.supabase
                .from('reviews')
                .insert({
                    product_id: productId,
                    order_id: orderId,
                    user_id: this.currentUser.id,
                    user_email: this.currentUser.email || null,
                    user_name: reviewerName || this.currentUser.email || 'User',
                    rating: parseInt(rating, 10),
                    title: title || null,
                    comment,
                    verified_purchase: true
                })
                .select()
                .single();

            if (insertError) throw insertError;
            return { success: true, review: data };
        } catch (error) {
            console.error('Create review error:', error);
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
        // Direct submissions are disabled; enforce order-linked reviews only
        return { success: false, error: 'Please submit reviews from your delivered orders (Profile > Orders)' };
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
            const sessionId = sessionStorage.getItem('ace1_session_id');
            
            if (!this.currentUser) {
                // Anonymous user - get wishlist by session_id from database
                if (!sessionId) {
                    return { success: true, wishlist: [] };
                }
                
                const { data, error } = await this.supabase
                    .from('wishlists')
                    .select(`
                        *,
                        products (
                            id,
                            name,
                            price_cents,
                            image_url,
                            product_images (
                                storage_path
                            ),
                            inventory (
                                stock
                            )
                        )
                    `)
                    .eq('session_id', sessionId);
                
                return { success: true, wishlist: [] };
            }

            const { data, error } = await this.supabase
                .from('wishlists')
                .select(`
                    *,
                    product:products(*)
                `)
                .eq('user_id', this.currentUser.id)
                .order('added_at', { ascending: false });

            if (error) throw error;
            return { success: true, wishlist: data || [] };
        } catch (error) {
            console.error('Get wishlist error:', error);
            return { success: false, error: error.message };
        }
    }

    async addToWishlist(productId) {
        try {
            const sessionId = sessionStorage.getItem('ace1_session_id');
            
            if (!this.currentUser) {
                // Anonymous user - add to wishlist by session_id in database
                if (!sessionId) {
                    return { success: false, error: 'No session ID' };
                }
                
                const { data, error } = await this.supabase.rpc('add_to_wishlist_by_session', {
                    p_session_id: sessionId,
                    p_product_id: productId
                });
                
                if (error) throw error;
                return { success: true, itemId: data };
            }

            const { data, error } = await this.supabase
                .from('wishlists')
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
            const sessionId = sessionStorage.getItem('ace1_session_id');
            
            if (!this.currentUser) {
                // Anonymous user - remove from wishlist by session_id
                if (!sessionId) {
                    return { success: false, error: 'No session ID' };
                }
                
                const { data, error } = await this.supabase.rpc('remove_from_wishlist_by_session', {
                    p_session_id: sessionId,
                    p_product_id: productId
                });
                
                if (error) throw error;
                return { success: true };
            }

            const { error } = await this.supabase
                .from('wishlists')
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
