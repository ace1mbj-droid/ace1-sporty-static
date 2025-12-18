// ===================================
// REAL-TIME REVIEWS SYSTEM
// ===================================
// Handles real-time product reviews with user authentication

class ReviewsManager {
    constructor() {
        this.supabase = null;
        this.currentProductId = null;
        this.currentUser = null;
        this.init();
    }

    async init() {
        this.supabase = window.getSupabase();
        if (!this.supabase) {
            console.error('❌ Supabase not initialized');
            return;
        }

        this.currentUser = window.databaseAuth?.getCurrentUser();
        console.log('✅ Reviews Manager initialized');
    }

    // ===================================
    // LOAD REVIEWS FOR A PRODUCT
    // ===================================
    async loadReviews(productId, containerSelector = '#reviews-container') {
        try {
            this.currentProductId = productId;
            const container = document.querySelector(containerSelector);
            
            if (!container) {
                console.error('Reviews container not found');
                return;
            }

            // Show loading
            container.innerHTML = '<div class="loading-reviews"><i class="fas fa-spinner fa-spin"></i> Loading reviews...</div>';

            // Fetch reviews from database
            const { data: reviews, error } = await this.supabase
                .from('reviews')
                .select(`
                    *,
                    users (
                        first_name,
                        last_name,
                        avatar
                    )
                `)
                .eq('product_id', productId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Calculate average rating
            const avgRating = reviews.length > 0 
                ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                : 0;

            // Render reviews
            this.renderReviews(reviews, avgRating, container);

            // Setup real-time updates
            this.setupRealtimeUpdates(productId, container);

        } catch (error) {
            console.error('Load reviews error:', error);
            const container = document.querySelector(containerSelector);
            if (container) {
                container.innerHTML = '<p class="error-message">Failed to load reviews. Please try again.</p>';
            }
        }
    }

    // ===================================
    // RENDER REVIEWS HTML
    // ===================================
    renderReviews(reviews, avgRating, container) {
        const reviewCount = reviews.length;

        let html = `
            <div class="reviews-section">
                <div class="reviews-header">
                    <h3>Customer Reviews</h3>
                    <div class="rating-summary">
                        <div class="average-rating">
                            <span class="rating-number">${avgRating}</span>
                            <div class="stars">${this.renderStars(parseFloat(avgRating))}</div>
                            <span class="review-count">${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}</span>
                        </div>
                    </div>
                </div>

                ${this.renderReviewForm()}

                <div class="reviews-list">
        `;

        if (reviews.length === 0) {
            html += `
                <div class="no-reviews">
                    <i class="fas fa-star"></i>
                    <p>No reviews yet. Be the first to review this product!</p>
                </div>
            `;
        } else {
            reviews.forEach(review => {
                html += this.renderReviewItem(review);
            });
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Attach event listeners
        this.attachEventListeners();
    }

    // ===================================
    // RENDER SINGLE REVIEW
    // ===================================
    renderReviewItem(review) {
        const userName = review.users 
            ? `${review.users.first_name || ''} ${review.users.last_name || ''}`.trim() || 'Anonymous'
            : 'Anonymous';
        
        const userAvatar = review.users?.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName);
        const reviewDate = new Date(review.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `
            <div class="review-item" data-review-id="${review.id}">
                <div class="review-header">
                    <img src="${userAvatar}" alt="${userName}" class="reviewer-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}'">
                    <div class="reviewer-info">
                        <div class="reviewer-name">
                            ${userName}
                            ${review.verified_purchase ? '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified Purchase</span>' : ''}
                        </div>
                        <div class="review-meta">
                            <div class="review-rating">${this.renderStars(review.rating)}</div>
                            <span class="review-date">${reviewDate}</span>
                        </div>
                    </div>
                </div>
                
                ${review.title ? `<h4 class="review-title">${this.escapeHtml(review.title)}</h4>` : ''}
                
                <p class="review-comment">${this.escapeHtml(review.comment)}</p>
                
                ${review.images && review.images.length > 0 ? `
                    <div class="review-images">
                        ${review.images.map(img => `<img src="${img}" alt="Review image" class="review-image">`).join('')}
                    </div>
                ` : ''}
                
                <div class="review-actions">
                    <button class="helpful-btn" data-review-id="${review.id}">
                        <i class="fas fa-thumbs-up"></i> Helpful (${review.helpful_count || 0})
                    </button>
                </div>
            </div>
        `;
    }

    // ===================================
    // RENDER REVIEW FORM
    // ===================================
    renderReviewForm() {
        return `
            <div class="review-form-container">
                <div class="login-prompt">
                    <i class="fas fa-user-check"></i>
                    <p>Reviews can only be submitted from your delivered orders in <strong>My Profile &gt; Orders</strong>.</p>
                    <a class="btn btn-primary" href="user-profile.html?tab=orders">Go to My Orders</a>
                </div>
            </div>
        `;
    }

    // ===================================
    // SUBMIT REVIEW
    // ===================================
    async submitReview(formData) {
        // Direct review submission is disabled on product pages
        this.showNotification('Please review from your delivered orders in My Profile.', 'info');
    }

    // ===================================
    // SETUP REALTIME UPDATES
    // ===================================
    setupRealtimeUpdates(productId, container) {
        // Subscribe to real-time changes
        const subscription = this.supabase
            .channel(`reviews:${productId}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'reviews',
                    filter: `product_id=eq.${productId}`
                },
                (payload) => {
                    console.log('📢 Review update received:', payload);
                    
                    // Reload reviews when any change happens
                    this.loadReviews(productId);
                }
            )
            .subscribe();

        // Store subscription for cleanup
        this.currentSubscription = subscription;
    }

    // ===================================
    // MARK REVIEW AS HELPFUL
    // ===================================
    async markHelpful(reviewId) {
        try {
            // Get current helpful count
            const { data: review } = await this.supabase
                .from('reviews')
                .select('helpful_count')
                .eq('id', reviewId)
                .single();

            if (!review) return;

            // Increment helpful count
            const { error } = await this.supabase
                .from('reviews')
                .update({ helpful_count: (review.helpful_count || 0) + 1 })
                .eq('id', reviewId);

            if (error) throw error;

            this.showNotification('Thanks for your feedback!', 'success');

        } catch (error) {
            console.error('Mark helpful error:', error);
        }
    }

    // ===================================
    // ATTACH EVENT LISTENERS
    // ===================================
    attachEventListeners() {
        // Review form submission
        const form = document.getElementById('review-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = {
                    rating: document.querySelector('input[name="rating"]:checked')?.value,
                    title: document.getElementById('review-title')?.value,
                    comment: document.getElementById('review-comment')?.value
                };

                if (!formData.rating) {
                    this.showNotification('Please select a rating', 'error');
                    return;
                }

                await this.submitReview(formData);
            });
        }

        // Helpful buttons
        document.querySelectorAll('.helpful-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reviewId = e.currentTarget.dataset.reviewId;
                this.markHelpful(reviewId);
                e.currentTarget.disabled = true;
                e.currentTarget.innerHTML = '<i class="fas fa-check"></i> Helpful';
            });
        });

        // Star rating visual feedback
        document.querySelectorAll('.rating-input label').forEach(label => {
            label.addEventListener('mouseenter', function() {
                const input = this.previousElementSibling;
                const value = input.value;
                document.querySelectorAll('.rating-input label').forEach((l, i) => {
                    if (5 - i <= value) {
                        l.style.color = '#ffc107';
                    } else {
                        l.style.color = '#ddd';
                    }
                });
            });
        });

        document.querySelector('.rating-input')?.addEventListener('mouseleave', function() {
            const checked = document.querySelector('input[name="rating"]:checked');
            document.querySelectorAll('.rating-input label').forEach(l => {
                l.style.color = '#ddd';
            });
            if (checked) {
                const value = checked.value;
                document.querySelectorAll('.rating-input label').forEach((l, i) => {
                    if (5 - i <= value) {
                        l.style.color = '#ffc107';
                    }
                });
            }
        });
    }

    // ===================================
    // HELPER METHODS
    // ===================================
    renderStars(rating) {
        let stars = '';
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars && hasHalfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Cleanup subscriptions
    destroy() {
        if (this.currentSubscription) {
            this.supabase.removeChannel(this.currentSubscription);
        }
    }
}

// Initialize globally
const reviewsManager = new ReviewsManager();
window.reviewsManager = reviewsManager;

console.log('✅ Reviews Manager loaded');
