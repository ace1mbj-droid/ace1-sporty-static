// ===================================
// E-COMMERCE BACKEND API SERVICE
// ===================================
// Complete backend functions for managing orders, cart, checkout

class EcommerceBackend {
    constructor() {
        this.supabase = null;
        this.init();
    }

    async init() {
        this.supabase = window.getSupabase();
        if (!this.supabase) {
            console.error('❌ Supabase not initialized');
            return;
        }
        console.log('✅ E-commerce Backend initialized');
    }

    // ===================================
    // CART MANAGEMENT
    // ===================================

    async addToCart(productId, quantity = 1, options = {}) {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Please login to add items to cart' };
            }

            // Check if item already exists in cart
            const { data: existing } = await this.supabase
                .from('cart_items')
                .select('*')
                .eq('user_id', userId)
                .eq('product_id', productId)
                .eq('size', options.size || null)
                .eq('color', options.color || null)
                .single();

            if (existing) {
                // Update quantity
                const { data, error } = await this.supabase
                    .from('cart_items')
                    .update({ 
                        quantity: existing.quantity + quantity,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, data };
            } else {
                // Add new item
                const { data, error } = await this.supabase
                    .from('cart_items')
                    .insert([{
                        user_id: userId,
                        product_id: productId,
                        quantity: quantity,
                        size: options.size || null,
                        color: options.color || null,
                        custom_options: options.custom || null
                    }])
                    .select()
                    .single();

                if (error) throw error;
                return { success: true, data };
            }
        } catch (error) {
            console.error('Add to cart error:', error);
            return { success: false, error: error.message };
        }
    }

    async getCart() {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { data, error } = await this.supabase
                .from('cart_items')
                .select(`
                    *,
                    products (
                        id,
                        name,
                        price_cents,
                        is_active,
                        product_images (
                            storage_path
                        ),
                        inventory (
                            stock
                        )
                    )
                `)
                .eq('user_id', userId);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get cart error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateCartQuantity(cartItemId, quantity) {
        try {
            if (quantity <= 0) {
                return await this.removeFromCart(cartItemId);
            }

            const { data, error } = await this.supabase
                .from('cart_items')
                .update({ quantity })
                .eq('id', cartItemId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Update cart error:', error);
            return { success: false, error: error.message };
        }
    }

    async removeFromCart(cartItemId) {
        try {
            const { error } = await this.supabase
                .from('cart_items')
                .delete()
                .eq('id', cartItemId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Remove from cart error:', error);
            return { success: false, error: error.message };
        }
    }

    async clearCart() {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { error } = await this.supabase
                .from('cart_items')
                .delete()
                .eq('user_id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Clear cart error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // ORDER MANAGEMENT
    // ===================================

    async createOrder(orderData) {
        try {
            const userId = this.getCurrentUserId();
            
            // Generate order number
            const orderNumber = 'ACE' + new Date().getTime().toString().slice(-10);

            // Calculate totals
            const subtotal = orderData.items.reduce((sum, item) => 
                sum + (item.price * item.quantity), 0
            );
            
            const shippingCost = orderData.shippingCost || 0;
            const taxAmount = orderData.taxAmount || 0;
            const discountAmount = orderData.discountAmount || 0;
            const totalAmount = subtotal + shippingCost + taxAmount - discountAmount;

            // Create order
            const { data: order, error: orderError } = await this.supabase
                .from('orders')
                .insert([{
                    order_number: orderNumber,
                    user_id: userId,
                    status: 'pending',
                    payment_status: 'pending',
                    payment_method: orderData.paymentMethod,
                    
                    // Customer info
                    customer_email: orderData.email,
                    customer_name: orderData.fullName,
                    customer_phone: orderData.phone,
                    
                    // Shipping address
                    shipping_full_name: orderData.shippingAddress.fullName,
                    shipping_phone: orderData.shippingAddress.phone,
                    shipping_address_line1: orderData.shippingAddress.addressLine1,
                    shipping_address_line2: orderData.shippingAddress.addressLine2,
                    shipping_city: orderData.shippingAddress.city,
                    shipping_state: orderData.shippingAddress.state,
                    shipping_postal_code: orderData.shippingAddress.postalCode,
                    shipping_country: orderData.shippingAddress.country || 'India',
                    
                    // Pricing
                    subtotal: subtotal,
                    discount_amount: discountAmount,
                    shipping_cost: shippingCost,
                    tax_amount: taxAmount,
                    total_amount: totalAmount,
                    
                    coupon_code: orderData.couponCode || null,
                    customer_notes: orderData.notes || null
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            // Create order items
            const orderItems = orderData.items.map(item => ({
                order_id: order.id,
                product_id: item.productId,
                product_name: item.name,
                product_sku: item.sku,
                product_image: item.image,
                quantity: item.quantity,
                size: item.size,
                color: item.color,
                price: item.price,
                total: item.price * item.quantity
            }));

            const { error: itemsError } = await this.supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // Update product stock
            for (const item of orderData.items) {
                await this.supabase.rpc('decrement_stock', {
                    product_id: item.productId,
                    quantity: item.quantity
                });
            }

            // Clear cart after order
            if (userId) {
                await this.clearCart();
            }

            return { 
                success: true, 
                order: order,
                orderNumber: orderNumber 
            };
        } catch (error) {
            console.error('Create order error:', error);
            return { success: false, error: error.message };
        }
    }

    async getOrder(orderId) {
        try {
            const { data, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        products (
                            name,
                            product_images (
                                storage_path
                            )
                        )
                    )
                `)
                .eq('id', orderId)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get order error:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserOrders() {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { data, error } = await this.supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        products (
                            name,
                            product_images (
                                storage_path
                            )
                        )
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get user orders error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            const updates = { status };
            
            // Add timestamps based on status
            if (status === 'confirmed') {
                updates.confirmed_at = new Date().toISOString();
            } else if (status === 'shipped') {
                updates.shipped_at = new Date().toISOString();
            } else if (status === 'delivered') {
                updates.delivered_at = new Date().toISOString();
            } else if (status === 'cancelled') {
                updates.cancelled_at = new Date().toISOString();
            }

            const { data, error } = await this.supabase
                .from('orders')
                .update(updates)
                .eq('id', orderId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Update order status error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // WISHLIST MANAGEMENT
    // ===================================

    async addToWishlist(productId) {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Please login to add to wishlist' };
            }

            const { data, error } = await this.supabase
                .from('wishlist')
                .insert([{
                    user_id: userId,
                    product_id: productId
                }])
                .select()
                .single();

            if (error) {
                if (error.code === '23505') { // Duplicate key
                    return { success: false, error: 'Already in wishlist' };
                }
                throw error;
            }

            return { success: true, data };
        } catch (error) {
            console.error('Add to wishlist error:', error);
            return { success: false, error: error.message };
        }
    }

    async removeFromWishlist(productId) {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { error } = await this.supabase
                .from('wishlist')
                .delete()
                .eq('user_id', userId)
                .eq('product_id', productId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Remove from wishlist error:', error);
            return { success: false, error: error.message };
        }
    }

    async getWishlist() {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { data, error } = await this.supabase
                .from('wishlist')
                .select(`
                    *,
                    products (
                        id,
                        name,
                        price_cents,
                        is_active,
                        product_images (
                            storage_path
                        ),
                        inventory (
                            stock
                        )
                    )
                `)
                .eq('user_id', userId);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get wishlist error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // REVIEWS MANAGEMENT
    // ===================================

    async addReview(productId, rating, title, comment, orderId = null) {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Please login to add a review' };
            }

            if (!orderId) {
                return { success: false, error: 'Order reference required to review' };
            }

            // Verify the product exists in the user’s delivered order
            const { data: orderItem, error: orderCheckError } = await this.supabase
                .from('order_items')
                .select('id, order:orders(user_id, status)')
                .eq('order_id', orderId)
                .eq('product_id', productId)
                .eq('orders.user_id', userId)
                .single();

            if (orderCheckError || !orderItem) {
                return { success: false, error: 'You can only review products you purchased' };
            }

            if (orderItem.order?.status !== 'delivered') {
                return { success: false, error: 'You can review a product after it is delivered' };
            }

            // Prevent duplicate reviews for the same order + product
            const { data: existingReview } = await this.supabase
                .from('reviews')
                .select('id')
                .eq('user_id', userId)
                .eq('product_id', productId)
                .eq('order_id', orderId)
                .maybeSingle();

            if (existingReview) {
                return { success: false, error: 'You have already reviewed this product for this order' };
            }

            const { data, error } = await this.supabase
                .from('reviews')
                .insert([{
                    product_id: productId,
                    user_id: userId,
                    order_id: orderId,
                    rating: rating,
                    title: title,
                    comment: comment,
                    verified_purchase: true
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Add review error:', error);
            return { success: false, error: error.message };
        }
    }

    async getProductReviews(productId) {
        try {
            const { data, error } = await this.supabase
                .from('reviews')
                .select(`
                    *,
                    users (first_name, last_name, avatar)
                `)
                .eq('product_id', productId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get reviews error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // ADDRESS MANAGEMENT
    // ===================================

    async saveAddress(addressData) {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { data, error } = await this.supabase
                .from('addresses')
                .insert([{
                    user_id: userId,
                    ...addressData
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Save address error:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserAddresses() {
        try {
            const userId = this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { data, error } = await this.supabase
                .from('addresses')
                .select('*')
                .eq('user_id', userId)
                .order('is_default', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get addresses error:', error);
            return { success: false, error: error.message };
        }
    }

    // ===================================
    // HELPER METHODS
    // ===================================

    getCurrentUserId() {
        const user = window.databaseAuth?.getCurrentUser();
        return user?.id || null;
    }

    formatPrice(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    }

    calculateCartTotal(cartItems) {
        return cartItems.reduce((sum, item) => {
            const price = item.products?.price_cents ? item.products.price_cents / 100 : 0;
            return sum + (price * item.quantity);
        }, 0);
    }
}

// Initialize and export
const ecommerceBackend = new EcommerceBackend();
window.ecommerceBackend = ecommerceBackend;

console.log('✅ E-commerce Backend API loaded');
