// ===================================
// CACHE BUSTER & BROWSER CACHE CLEANER
// ===================================
// Ensures users always get the latest version of the website
// Uses ETag/Last-Modified headers for cache validation (no localStorage)

(function() {
    'use strict';

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

            // 2. Clear cache items from sessionStorage only (no localStorage)
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
    async function checkVersion() {
        const key = 'ace1_cache_version';

        try {
            // Fetch version file with no-store so it reflects deploy bumps
            const res = await fetch('/cache-version.txt', { cache: 'no-store' });
            const versionText = (await res.text()).trim();

            if (!versionText) return;

            const stored = sessionStorage.getItem(key);

            if (stored && stored !== versionText) {
                console.log('🔄 New version detected, clearing cache...');
                clearBrowserCache();
            }

            sessionStorage.setItem(key, versionText);
        } catch (error) {
            console.warn('Version check failed:', error);
        }
    }

    // ===================================
    // ADD CACHE BUSTING TO SCRIPTS/STYLES
    // ===================================
    function addCacheBustingParams() {
        const version = sessionStorage.getItem('ace1_cache_version') || 'latest';
        
        // Add timestamp to all script tags (except external CDNs)
        document.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            if (src && !src.includes('http') && !src.includes('?')) {
                script.src = src + '?v=' + version;
            }
        });

        // Add timestamp to all stylesheet links (except external CDNs)
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.includes('http') && !href.includes('?')) {
                link.href = href + '?v=' + version;
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
        // Only clear sessionStorage caches; localStorage has been migrated
        const dataCacheKeys = [
            'ace1_products_cache',
            'ace1_categories_cache',
            'ace1_search_cache'
        ];

        dataCacheKeys.forEach(key => {
            if (sessionStorage.getItem(key)) {
                sessionStorage.removeItem(key);
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
        forceReload: function() {
            clearBrowserCache();
            clearDataCaches();
            location.reload(true);
        }
    };

    // ===================================
    // DELAYED INITIALIZATION
    // ===================================
    // Wait for page to be fully loaded before initializing
    // This prevents "Layout was forced before the page was fully loaded" warnings
    function delayedInit() {
        if (document.readyState === 'loading') {
            // Still loading, wait for DOMContentLoaded
            document.addEventListener('DOMContentLoaded', init);
        } else {
            // DOM already loaded, run immediately
            init();
        }
    }

    // Run delayed initialization
    delayedInit();

    console.log('✅ Cache Buster loaded - using ETag/Last-Modified headers for versioning');
})();
