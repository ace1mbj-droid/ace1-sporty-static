// ===================================
// CACHE BUSTER & BROWSER CACHE CLEANER
// ===================================
// Ensures users always get the latest version of the website
// Clears browser cache on page load

(function() {
    'use strict';

    // ===================================
    // CONFIGURATION
    // ===================================
    const CACHE_VERSION = 'v1.0.' + Date.now(); // Unique version per deployment
    const FORCE_RELOAD_INTERVAL = 3600000; // 1 hour in milliseconds
    
    // ===================================
    // CLEAR BROWSER CACHE
    // ===================================
    function clearBrowserCache() {
        try {
            console.log('🧹 Clearing browser cache...');

            // 1. Clear Service Worker caches
            if ('caches' in window) {
                caches.keys().then(function(cacheNames) {
                    cacheNames.forEach(function(cacheName) {
                        console.log('Deleting cache:', cacheName);
                        caches.delete(cacheName);
                    });
                });
            }

            // 2. Clear localStorage cache items (preserve user session)
            const itemsToPreserve = [
                'ace1_user',
                'ace1_token',
                'ace1_admin',
                'ace1_cart',
                'userEmail'
            ];

            // Remove old cache items
            const cacheKeys = Object.keys(localStorage).filter(key => 
                key.includes('cache') || 
                key.includes('cached') ||
                key.includes('_timestamp') ||
                key.includes('products_cache') ||
                key.includes('categories_cache')
            );

            cacheKeys.forEach(key => {
                if (!itemsToPreserve.includes(key)) {
                    localStorage.removeItem(key);
                    console.log('Removed cache:', key);
                }
            });

            // 3. Clear sessionStorage cache (safe to clear all)
            const sessionCacheKeys = Object.keys(sessionStorage).filter(key =>
                key.includes('cache') || key.includes('cached')
            );
            sessionCacheKeys.forEach(key => {
                sessionStorage.removeItem(key);
            });

            console.log('✅ Browser cache cleared successfully');
            
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    // ===================================
    // VERSION CHECK & FORCE RELOAD
    // ===================================
    function checkVersion() {
        const lastVersion = localStorage.getItem('ace1_version');
        const lastReload = localStorage.getItem('ace1_last_reload');
        const now = Date.now();

        // Check if version changed or if it's been too long
        if (lastVersion !== CACHE_VERSION) {
            console.log('🔄 New version detected, clearing cache...');
            clearBrowserCache();
            localStorage.setItem('ace1_version', CACHE_VERSION);
            localStorage.setItem('ace1_last_reload', now.toString());
            return true;
        }

        // Force reload after interval (to ensure fresh data)
        if (lastReload) {
            const timeSinceReload = now - parseInt(lastReload);
            if (timeSinceReload > FORCE_RELOAD_INTERVAL) {
                console.log('⏰ Cache refresh interval reached, clearing cache...');
                clearBrowserCache();
                localStorage.setItem('ace1_last_reload', now.toString());
                return true;
            }
        } else {
            localStorage.setItem('ace1_last_reload', now.toString());
        }

        return false;
    }

    // ===================================
    // ADD CACHE BUSTING TO SCRIPTS/STYLES
    // ===================================
    function addCacheBustingParams() {
        const timestamp = Date.now();
        
        // Add timestamp to all script tags (except external CDNs)
        document.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            if (src && !src.includes('http') && !src.includes('?')) {
                script.src = src + '?v=' + timestamp;
            }
        });

        // Add timestamp to all stylesheet links (except external CDNs)
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.includes('http') && !href.includes('?')) {
                link.href = href + '?v=' + timestamp;
            }
        });

        console.log('✅ Cache busting parameters added to assets');
    }

    // ===================================
    // DISABLE BROWSER CACHE VIA META
    // ===================================
    function addNoCacheMetaTags() {
        // Only add if not already present
        if (!document.querySelector('meta[http-equiv="Cache-Control"]')) {
            const metaTags = [
                { 'http-equiv': 'Cache-Control', content: 'no-cache, no-store, must-revalidate' },
                { 'http-equiv': 'Pragma', content: 'no-cache' },
                { 'http-equiv': 'Expires', content: '0' }
            ];

            metaTags.forEach(attrs => {
                const meta = document.createElement('meta');
                Object.keys(attrs).forEach(key => {
                    meta.setAttribute(key, attrs[key]);
                });
                document.head.appendChild(meta);
            });

            console.log('✅ No-cache meta tags added');
        }
    }

    // ===================================
    // CLEAR SPECIFIC PRODUCT/DATA CACHES
    // ===================================
    function clearDataCaches() {
        const dataCacheKeys = [
            'ace1_products_cache',
            'ace1_categories_cache',
            'ace1_products_updated',
            'ace1_cart_cache',
            'ace1_wishlist_cache'
        ];

        dataCacheKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log('Cleared data cache:', key);
            }
        });
    }

    // ===================================
    // UNREGISTER OLD SERVICE WORKERS
    // ===================================
    function unregisterServiceWorkers() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                registrations.forEach(function(registration) {
                    console.log('Unregistering service worker:', registration.scope);
                    registration.unregister();
                });
            });
        }
    }

    // ===================================
    // MAIN EXECUTION
    // ===================================
    function init() {
        console.log('🚀 Cache Buster initialized');

        // 1. Add no-cache meta tags
        addNoCacheMetaTags();

        // 2. Check version and clear cache if needed
        const versionChanged = checkVersion();

        // 3. Always clear data caches (products, etc.) on every page load
        clearDataCaches();

        // 4. Unregister any old service workers
        unregisterServiceWorkers();

        // 5. Add cache busting parameters to assets
        // (Run after DOM is loaded)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addCacheBustingParams);
        } else {
            addCacheBustingParams();
        }

        // 6. Clear browser cache periodically
        if (versionChanged) {
            console.log('✅ Full cache clear completed');
        }

        // 7. Set up periodic cache clearing (every 5 minutes while page is open)
        setInterval(() => {
            console.log('🔄 Periodic cache maintenance...');
            clearDataCaches();
        }, 300000); // 5 minutes
    }

    // ===================================
    // PUBLIC API
    // ===================================
    window.CacheBuster = {
        clear: clearBrowserCache,
        clearData: clearDataCaches,
        version: CACHE_VERSION,
        forceReload: function() {
            clearBrowserCache();
            clearDataCaches();
            location.reload(true);
        }
    };

    // Run on page load
    init();

    console.log('✅ Cache Buster loaded - Version:', CACHE_VERSION);
})();
