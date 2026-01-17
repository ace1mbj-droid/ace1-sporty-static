// ===================================
// CACHE BUSTER & BROWSER CACHE CLEANER
// ===================================
// Ensures users always get the latest version of the website
// Stateless: does not rely on localStorage/sessionStorage for versioning

(function() {
    'use strict';

    // In-memory version state (no local persistence)
    let currentVersion = '';
    let lastVersionCheckAt = 0;

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

            console.log('✅ Browser cache cleared successfully');
            
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    // ===================================
    // VERSION CHECK & FORCE RELOAD
    // ===================================
    async function checkVersion(forceCheck = false) {
        try {
            const now = Date.now();

            // Throttle checks to every 30 seconds unless forced
            if (!forceCheck && (now - lastVersionCheckAt) < 30000) {
                return { changed: false, version: currentVersion || 'latest' };
            }
            lastVersionCheckAt = now;

            // Fetch version file with no-store so it reflects deploy bumps
            const res = await fetch('/cache-version.txt?_=' + now, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const versionText = (await res.text()).trim();
            const nextVersion = versionText || 'latest';

            // Expose for other scripts if needed (in-memory only)
            window.__ACE1_ASSET_VERSION__ = nextVersion;

            const changed = Boolean(currentVersion && currentVersion !== nextVersion);
            if (changed) {
                console.log('🔄 New version detected:', nextVersion, '(was:', currentVersion, ')');
                clearBrowserCache();

                // Reload after clearing caches so already-loaded stale JS doesn't keep running
                setTimeout(() => {
                    try {
                        if ('caches' in window) {
                            caches.keys().then(names => {
                                Promise.all(names.map(n => caches.delete(n))).then(() => location.reload());
                            });
                        } else {
                            location.reload();
                        }
                    } catch (e) {
                        location.reload();
                    }
                }, 100);
            }

            currentVersion = nextVersion;
            return { changed, version: nextVersion };
        } catch (error) {
            // Degrade quietly if the version endpoint is unavailable (offline, blocked, etc.)
            console.debug('Version check skipped:', error);
            return { changed: false, version: currentVersion || 'latest' };
        }
    }

    // ===================================
    // ADD CACHE BUSTING TO SCRIPTS/STYLES
    // ===================================
    function addCacheBustingParams(version) {
        const safeVersion = version || currentVersion || 'latest';

        const withVersion = (rawUrl) => {
            try {
                const url = new URL(rawUrl, location.origin);
                if (url.origin !== location.origin) return rawUrl;
                url.searchParams.set('v', safeVersion);
                // Keep paths root-relative when possible
                return url.pathname + url.search + url.hash;
            } catch {
                // If URL parsing fails, fall back to simple appending
                if (String(rawUrl || '').includes('?')) {
                    // Replace existing v= if present
                    return String(rawUrl).replace(/([?&])v=[^&#]*/i, `$1v=${encodeURIComponent(safeVersion)}`);
                }
                return String(rawUrl) + '?v=' + encodeURIComponent(safeVersion);
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

        console.log('✅ Cache busting parameters added to assets (v=' + safeVersion + ')');
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
        // Intentionally no-op here.
        // The product/cart/session storage is handled by their respective modules.
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

        // 2. Check version and apply cache-busting params
        // (We do not persist version locally; we fetch it each time.)
        const applyVersionedAssets = async () => {
            const res = await checkVersion(true);
            addCacheBustingParams(res.version);
        };

        // 4. Unregister any old service workers
        unregisterServiceWorkers();

        // 3. Add cache busting parameters to assets (after DOM is loaded)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => { void applyVersionedAssets(); });
        } else {
            void applyVersionedAssets();
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
