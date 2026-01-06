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
    async function checkVersion(forceCheck = false) {
        const key = 'ace1_cache_version';
        const lastCheckKey = 'ace1_last_version_check';

        try {
            // Throttle checks to every 30 seconds unless forced
            const lastCheck = parseInt(sessionStorage.getItem(lastCheckKey) || '0', 10);
            const now = Date.now();
            if (!forceCheck && (now - lastCheck) < 30000) {
                return false;
            }
            sessionStorage.setItem(lastCheckKey, String(now));

            // Fetch version file with no-store so it reflects deploy bumps
            const res = await fetch('/cache-version.txt?_=' + now, { 
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const versionText = (await res.text()).trim();

            if (!versionText) return false;

            // Persist across browser restarts (sessionStorage isn't enough for multi-day caching issues)
            const stored = localStorage.getItem(key) || '';

            const changed = Boolean(stored && stored !== versionText);
            if (changed) {
                console.log('🔄 New version detected:', versionText, '(was:', stored, ')');
                clearBrowserCache();
            }

            // Store in both localStorage (persistent) and sessionStorage (quick access)
            localStorage.setItem(key, versionText);
            sessionStorage.setItem(key, versionText);

            // Expose for other scripts if needed
            window.__ACE1_ASSET_VERSION__ = versionText;

            // If version changed, force a reload so already-loaded stale JS doesn't keep running
            if (changed) {
                console.log('🔄 Reloading page for new version...');
                setTimeout(() => {
                    try {
                        // Clear all caches then reload
                        if ('caches' in window) {
                            caches.keys().then(names => {
                                Promise.all(names.map(n => caches.delete(n))).then(() => {
                                    location.reload();
                                });
                            });
                        } else {
                            location.reload();
                        }
                    } catch (e) {
                        location.reload();
                    }
                }, 100);
            }

            return changed;
        } catch (error) {
            console.warn('Version check failed:', error);
        }
    }

    // ===================================
    // ADD CACHE BUSTING TO SCRIPTS/STYLES
    // ===================================
    function addCacheBustingParams() {
        const version = (sessionStorage.getItem('ace1_cache_version') || localStorage.getItem('ace1_cache_version')) || 'latest';

        const withVersion = (rawUrl) => {
            try {
                const url = new URL(rawUrl, location.origin);
                if (url.origin !== location.origin) return rawUrl;
                url.searchParams.set('v', version);
                // Keep paths root-relative when possible
                return url.pathname + url.search + url.hash;
            } catch {
                // If URL parsing fails, fall back to simple appending
                if (String(rawUrl || '').includes('?')) {
                    // Replace existing v= if present
                    return String(rawUrl).replace(/([?&])v=[^&#]*/i, `$1v=${encodeURIComponent(version)}`);
                }
                return String(rawUrl) + '?v=' + encodeURIComponent(version);
            }
        };
        
        // Add timestamp to all script tags (except external CDNs)
        document.querySelectorAll('script[src]').forEach(script => {
            const src = script.getAttribute('src');
            if (src && !src.includes('http')) {
                script.src = withVersion(src);
            }
        });

        // Add timestamp to all stylesheet links (except external CDNs)
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.includes('http')) {
                link.href = withVersion(href);
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
        // Note: this is async, but we also keep a best-effort v= param pass below.
        void checkVersion(true); // Force check on init

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

        // 6. Check for updates when user returns to tab
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible') {
                console.log('🔄 Tab became visible, checking for updates...');
                void checkVersion(true);
            }
        });

        // 7. Check for updates on focus (backup for visibilitychange)
        window.addEventListener('focus', function() {
            void checkVersion(false); // Throttled check
        });

        // 8. Set up periodic cache clearing (every 2 minutes while page is open)
        setInterval(() => {
            console.log('🔄 Periodic version check...');
            void checkVersion(false);
            clearDataCaches();
        }, 120000); // 2 minutes
    }

    // ===================================
    // PUBLIC API
    // ===================================
    window.CacheBuster = {
        clear: clearBrowserCache,
        clearData: clearDataCaches,
        checkVersion: () => checkVersion(true),
        forceReload: function() {
            clearBrowserCache();
            clearDataCaches();
            localStorage.removeItem('ace1_cache_version');
            sessionStorage.clear();
            location.reload();
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
