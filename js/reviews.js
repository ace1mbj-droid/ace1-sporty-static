// Product Reviews Manager
class ProductReviewsManager {
    constructor() {
        this.allReviews = [];
        this.reviews = [];
        this.productId = null;
        this.init();
    }

    init() {
        this.productId = this.getProductIdFromURL();
        this.loadReviews();
        this.setupEventListeners();
        this.displayReviews();
        this.calculateRatingSummary();
    }

    getProductIdFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id') || 'default';
    }

    setupEventListeners() {
        // Review form submission
        const reviewForm = document.getElementById('review-form');
        if (reviewForm) {
            reviewForm.addEventListener('submit', (e) => this.handleReviewSubmit(e));
        }

        // Star rating selection
        const starBtns = document.querySelectorAll('.star-rating-btn');
        starBtns.forEach((star, index) => {
            star.addEventListener('click', () => this.selectRating(index + 1));
        });

        // Review filters
        const filterBtns = document.querySelectorAll('.review-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.filterReviews(e));
        });

        // Sort reviews
        const sortSelect = document.getElementById('review-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => this.sortReviews(e.target.value));
        }

        // Helpful/Not Helpful buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('.helpful-btn')) {
                this.markHelpful(e.target.closest('.helpful-btn'));
            }
        });
    }

    async loadReviews() {
        // Load from database; no localStorage fallback
        if (window.getSupabase?.()) {
            await this.loadReviewsFromDatabase();
        } else {
            // No fallback: require Supabase
            this.reviews = [];
            console.warn('Supabase not available; reviews disabled.');
        }
    }

    async loadReviewsFromDatabase() {
        try {
            const supabase = window.getSupabase?.();
            if (!supabase) throw new Error('Supabase not available');
            
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('product_id', this.productId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            // Convert database format to display format
            this.allReviews = (data || []).map(review => ({
                id: review.id,
                userId: review.user_id,
                userName: review.user_name,
                rating: review.rating,
                title: review.title,
                comment: review.comment,
                date: new Date(review.created_at).toISOString().split('T')[0],
                helpful: review.helpful_count || 0,
                notHelpful: review.unhelpful_count || 0,
                verified: review.verified_purchase || false
            }));
        } catch (error) {
            console.warn('Failed to load reviews from database:', error);
            // No fallback to localStorage; reviews unavailable
            this.allReviews = [];
        }
        this.reviews = [...this.allReviews];
    }

    getDefaultReviews() {
        // Sample reviews for demonstration
        return [
            {
                id: 1,
                userId: 'user1',
                userName: 'Rajesh Kumar',
                rating: 5,
                title: 'Amazing comfort and technology!',
                comment: 'I\'ve been using these shoes for a month now, and I can definitely feel the difference. The terahertz technology really seems to help with circulation. Highly recommended!',
                date: '2025-11-05',
                helpful: 24,
                notHelpful: 2,
                verified: true
            },
            {
                id: 2,
                userId: 'user2',
                userName: 'Priya Sharma',
                rating: 4,
                title: 'Great shoes, worth the price',
                comment: 'Very comfortable and stylish. The quality is excellent. Only wish they came in more color options.',
                date: '2025-11-08',
                helpful: 15,
                notHelpful: 1,
                verified: true
            },
            {
                id: 3,
                userId: 'user3',
                userName: 'Amit Patel',
                rating: 5,
                title: 'Best running shoes I\'ve owned',
                comment: 'Perfect for my daily runs. The cushioning is excellent and my feet don\'t hurt anymore after long runs. The terahertz technology is a game changer!',
                date: '2025-11-10',
                helpful: 18,
                notHelpful: 0,
                verified: true
            }
        ];
    }

    async handleReviewSubmit(e) {
        e.preventDefault();

        // Check if user is logged in
        const user = window.AuthManager?.getCurrentUser();
        
        if (!user) {
            this.showNotification('Please login to submit a review', 'error');
            setTimeout(() => {
                window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
            }, 1500);
            return;
        }

        const formData = new FormData(e.target);
        const rating = parseInt(document.querySelector('.star-rating-btn.selected')?.dataset.rating || 0);

        if (rating === 0) {
            this.showNotification('Please select a rating', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const supabase = window.getSupabase?.();
            if (!supabase) throw new Error('Database not available');
            
            // Save to database
            const { data, error } = await supabase
                .from('reviews')
                .insert({
                    product_id: this.productId,
                    user_id: user.id,
                    user_email: user.email,
                    user_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                    rating: rating,
                    title: formData.get('title'),
                    comment: formData.get('comment'),
                    verified_purchase: true
                })
                .select()
                .single();

            if (error) throw error;

            // Add to source + view
            const newReview = {
                id: data.id,
                userId: data.user_id,
                userName: data.user_name,
                rating: data.rating,
                title: data.title,
                comment: data.comment,
                date: new Date(data.created_at).toISOString().split('T')[0],
                helpful: 0,
                notHelpful: 0,
                verified: true
            };

            this.allReviews.unshift(newReview);
            this.reviews = [newReview, ...this.reviews];
            this.showNotification('Review submitted successfully!', 'success');

            // Reset form and stars
            e.target.reset();
            document.querySelectorAll('.star-rating-btn').forEach(star => star.classList.remove('selected'));
            this.displayReviews();
            this.calculateRatingSummary();
        } catch (error) {
            console.error('Error submitting review:', error);
            this.showNotification('Failed to submit review. Please try again.', 'error');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    selectRating(rating) {
        const stars = document.querySelectorAll('.star-rating-btn');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('selected');
            } else {
                star.classList.remove('selected');
            }
        });
    }

    displayReviews() {
        const reviewsList = document.getElementById('reviews-list');
        if (!reviewsList) return;

        if (this.reviews.length === 0) {
            reviewsList.innerHTML = `
                <div class="no-reviews">
                    <i class="fas fa-star"></i>
                    <h3>No reviews yet</h3>
                    <p>Be the first to review this product!</p>
                </div>
            `;
            return;
        }

        const escapeHtml = (val = '') => String(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        reviewsList.innerHTML = this.reviews.map(review => `
            <div class="review-card">
                <div class="review-header">
                    <div class="review-user">
                        <div class="user-avatar">
                            ${escapeHtml(review.userName.charAt(0) || '?')}
                        </div>
                        <div>
                            <h4>${escapeHtml(review.userName)} ${review.verified ? '<i class="fas fa-check-circle verified"></i>' : ''}</h4>
                            <div class="review-rating">
                                ${this.generateStars(review.rating)}
                            </div>
                        </div>
                    </div>
                    <span class="review-date">${this.formatDate(review.date)}</span>
                </div>
                <div class="review-content">
                    <h4>${escapeHtml(review.title)}</h4>
                    <p>${escapeHtml(review.comment)}</p>
                </div>
                <div class="review-footer">
                    <span>Was this helpful?</span>
                    <div class="review-actions">
                        <button class="helpful-btn" data-review-id="${review.id}" data-type="helpful">
                            <i class="fas fa-thumbs-up"></i> Yes (${review.helpful})
                        </button>
                        <button class="helpful-btn" data-review-id="${review.id}" data-type="not-helpful">
                            <i class="fas fa-thumbs-down"></i> No (${review.notHelpful})
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    calculateRatingSummary() {
        const summaryContainer = document.getElementById('rating-summary');
        if (!summaryContainer || this.reviews.length === 0) return;

        const totalReviews = this.reviews.length;
        const averageRating = this.reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
        
        const ratingCounts = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0};
        this.reviews.forEach(r => ratingCounts[r.rating]++);

        summaryContainer.innerHTML = `
            <div class="rating-overview">
                <div class="average-rating">
                    <h2>${averageRating.toFixed(1)}</h2>
                    <div class="stars">${this.generateStars(Math.round(averageRating))}</div>
                    <p>${totalReviews} reviews</p>
                </div>
                <div class="rating-breakdown">
                    ${[5, 4, 3, 2, 1].map(star => `
                        <div class="rating-bar">
                            <span>${star} <i class="fas fa-star"></i></span>
                            <div class="bar">
                                <div class="bar-fill" style="width: ${(ratingCounts[star] / totalReviews) * 100}%"></div>
                            </div>
                            <span>${ratingCounts[star]}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    generateStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i - 0.5 <= rating) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }

    filterReviews(e) {
        const rating = parseInt(e.currentTarget.dataset.rating);
        
        // Update active button
        document.querySelectorAll('.review-filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.currentTarget.classList.add('active');

        if (rating === 0) {
            this.reviews = [...this.allReviews];
        } else {
            this.reviews = this.allReviews.filter(r => r.rating === rating);
        }
        
        this.displayReviews();
    }

    sortReviews(sortBy) {
        switch(sortBy) {
            case 'newest':
                this.reviews = [...this.reviews].sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'oldest':
                this.reviews = [...this.reviews].sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'highest':
                this.reviews = [...this.reviews].sort((a, b) => b.rating - a.rating);
                break;
            case 'lowest':
                this.reviews = [...this.reviews].sort((a, b) => a.rating - b.rating);
                break;
            case 'helpful':
                this.reviews = [...this.reviews].sort((a, b) => b.helpful - a.helpful);
                break;
        }
        this.displayReviews();
    }

    async markHelpful(button) {
        const reviewId = parseInt(button.dataset.reviewId);
        const type = button.dataset.type;
        
        const review = this.reviews.find(r => r.id === reviewId);
        if (!review) return;

        const btn = button;
        btn.disabled = true;

        const delta = type === 'helpful' ? { key: 'helpful', amount: 1 } : { key: 'notHelpful', amount: 1 };
        review[delta.key] += delta.amount;
        this.displayReviews();

        try {
            await this.updateReviewHelpfulness(review.id, type);
        } catch (err) {
            // Roll back on failure
            review[delta.key] -= delta.amount;
            console.warn('Failed to update review helpfulness:', err);
            this.displayReviews();
        } finally {
            btn.disabled = false;
        }
    }

    async updateReviewHelpfulness(reviewId, type) {
        try {
            const supabase = window.getSupabase?.();
            if (!supabase) throw new Error('Database not available');
            
            const column = type === 'helpful' ? 'helpful_count' : 'unhelpful_count';
            
            // Get current review
            const { data: currentReview, error: selectError } = await supabase
                .from('reviews')
                .select(column)
                .eq('id', reviewId)
                .single();
            
            if (selectError) throw selectError;
            
            // Update with incremented count
            const newCount = (currentReview[column] || 0) + 1;
            const { error: updateError } = await supabase
                .from('reviews')
                .update({ [column]: newCount })
                .eq('id', reviewId);
            
            if (updateError) throw updateError;
        } catch (error) {
            console.warn('Failed to update review helpfulness:', error);
            throw error;
        }
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-IN', options);
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// Auto-initialize on product pages
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('reviews-section')) {
        new ProductReviewsManager();
    }
});

// Export for use in other modules
window.ProductReviewsManager = ProductReviewsManager;
