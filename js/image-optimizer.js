// ===================================
// IMAGE OPTIMIZATION & LAZY LOADING
// ===================================
// Improves page load speed by lazy loading images

class ImageOptimizer {
    constructor() {
        this.lazyImages = [];
        this.imageObserver = null;
        this.init();
    }

    init() {
        // Add lazy loading to all images
        this.setupLazyLoading();
        
        // Add responsive image loading
        this.setupResponsiveImages();
        
        // Preload critical images
        this.preloadCriticalImages();
        
        console.log('✅ Image Optimizer initialized');
    }

    setupLazyLoading() {
        // Get all images
        const images = document.querySelectorAll('img');
        
        // Check if IntersectionObserver is supported
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        this.loadImage(img);
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px' // Start loading 50px before image enters viewport
            });

            images.forEach(img => {
                // Skip images that should load immediately
                if (img.classList.contains('no-lazy')) {
                    return;
                }

                // Store original src
                if (img.src && !img.dataset.src) {
                    img.dataset.src = img.src;
                    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%23f0f0f0"/%3E%3C/svg%3E';
                }

                // Add loading class
                img.classList.add('lazy-loading');
                
                // Observe the image
                this.imageObserver.observe(img);
            });
        } else {
            // Fallback for browsers without IntersectionObserver
            images.forEach(img => this.loadImage(img));
        }
    }

    loadImage(img) {
        const src = img.dataset.src;
        if (!src) return;

        // Create new image to preload
        const tempImg = new Image();
        
        tempImg.onload = () => {
            img.src = src;
            img.classList.remove('lazy-loading');
            img.classList.add('lazy-loaded');
        };

        tempImg.onerror = () => {
            // Use placeholder on error
            img.src = 'images/placeholder.jpg';
            img.classList.remove('lazy-loading');
            img.classList.add('lazy-error');
        };

        tempImg.src = src;
    }

    setupResponsiveImages() {
        const images = document.querySelectorAll('img');
        
        images.forEach(img => {
            // Add decoding="async" for better performance
            img.decoding = 'async';
            
            // Add loading="lazy" for native lazy loading
            if (!img.classList.contains('no-lazy')) {
                img.loading = 'lazy';
            }
        });
    }

    preloadCriticalImages() {
        // Preload images that are above the fold
        const criticalImages = document.querySelectorAll('.hero img, .banner img, .no-lazy');
        
        criticalImages.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.classList.remove('lazy-loading');
            }
            img.loading = 'eager'; // Load immediately
        });
    }

    // Utility: Convert image URLs to optimized versions
    optimizeImageUrl(url, width = 800) {
        // For external images (like i.ibb.co), add width parameter if supported
        if (url.includes('i.ibb.co')) {
            // ImgBB doesn't support URL parameters, images load as-is
            return url;
        }
        
        if (url.includes('unsplash.com')) {
            // Unsplash supports width parameter
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}w=${width}&auto=format&q=75`;
        }
        
        if (url.includes('ui-avatars.com')) {
            // Already optimized
            return url;
        }
        
        return url;
    }

    // Progressive image loading with blur effect
    addBlurEffect() {
        const style = document.createElement('style');
        style.textContent = `
            img.lazy-loading {
                filter: blur(10px);
                transition: filter 0.3s;
            }
            img.lazy-loaded {
                filter: blur(0);
            }
            img {
                background: #f0f0f0;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.imageOptimizer = new ImageOptimizer();
    window.imageOptimizer.addBlurEffect();
});

// Export for use in other modules
window.ImageOptimizer = ImageOptimizer;
