// ===================================
// GLOBAL VARIABLES
// ===================================
// Cart is loaded from database (no localStorage)
let cart = [];

// Suppress verbose logs in production to avoid leaking internal state
// Console errors and warnings are preserved.
(function () {
    try {
        const host = (location && location.hostname) || '';
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
        if (!isLocal) {
            console.log = function () {};
            console.debug = function () {};
        }
    } catch (e) {
        // ignore
    }
})();
let cartTotal = 0;
let cartSessionId = sessionStorage.getItem('ace1_session_id') || generateSessionId();
let cartLoaded = false;

// Cart cross-page consistency helpers
const CART_CACHE_KEY = 'ace1_cart_cache_v1';
let cartSyncTimer = null;
let cartSyncInFlight = null;

function publishCartUpdate() {
    // Keep other modules (e.g. checkout.js) in sync
    window.cart = cart;
    try {
        window.dispatchEvent(new CustomEvent('ace1:cart-updated', { detail: { cart } }));
    } catch {
        // ignore
    }
}

function saveCartCache(pendingSync) {
    try {
        sessionStorage.setItem(
            CART_CACHE_KEY,
            JSON.stringify({
                updatedAt: Date.now(),
                pendingSync: !!pendingSync,
                cart
            })
        );
    } catch {
        // ignore
    }
}

function loadCartCache() {
    try {
        const raw = sessionStorage.getItem(CART_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.cart)) return null;
        return parsed;
    } catch {
        return null;
    }
}

function getCartDom() {
    return {
        cartCount: document.getElementById('cart-count'),
        cartItems: document.getElementById('cart-items'),
        cartTotalElement: document.getElementById('cart-total')
    };
}

function scheduleCartSync() {
    if (cartSyncTimer) {
        clearTimeout(cartSyncTimer);
    }

    cartSyncTimer = setTimeout(() => {
        cartSyncTimer = null;
        cartSyncInFlight = (async () => {
            await syncCartToDatabase();
        })().finally(() => {
            cartSyncInFlight = null;
        });
    }, 150);
}

// Ensure global header/footer elements are present across all pages
(function ensureGlobalLayoutElements() {
    const nav = document.getElementById('navbar');
    if (nav && !document.getElementById('search-overlay')) {
        nav.insertAdjacentHTML('afterend', `
    <!-- Search Overlay -->
    <div class="search-overlay" id="search-overlay">
        <div class="search-container">
            <input type="text" class="search-input" placeholder="Search for products...">
            <button class="search-close" id="search-close">
                <i class="fas fa-times"></i>
            </button>
        </div>
    </div>`);
    }

    const footerLinks = document.querySelector('.footer .footer-links');
    if (footerLinks && !footerLinks.querySelector('#clearCacheBtn')) {
        const cacheLink = document.createElement('a');
        cacheLink.href = '#';
        cacheLink.id = 'clearCacheBtn';
        cacheLink.title = 'Clear browser cache';
        cacheLink.textContent = '🧹 Clear Cache';
        cacheLink.style.color = '#ff8c00';
        cacheLink.style.fontWeight = '600';
        footerLinks.appendChild(cacheLink);
    }
})();

function ensureShowcaseBanner() {
    try {
        if (sessionStorage.getItem('ace1_hide_showcase_banner') === '1') return;
        if (document.getElementById('showcase-banner')) return;

        const nav = document.getElementById('navbar');
        if (!nav || !nav.parentNode) return;

        const banner = document.createElement('div');
        banner.id = 'showcase-banner';
        banner.className = 'showcase-banner';
        banner.innerHTML = `
            <div class="showcase-banner-content">
                <div class="showcase-banner-text">
                    <i class="fas fa-bolt" aria-hidden="true"></i>
                    <span><strong>Showcase mode:</strong> explore the collection, request a demo, or reach out for bulk orders.</span>
                </div>
                <div class="showcase-banner-actions">
                    <a class="showcase-banner-link" href="contact.html">Contact Us</a>
                    <button type="button" class="showcase-banner-dismiss" aria-label="Dismiss banner">&times;</button>
                </div>
            </div>
        `;

        nav.insertAdjacentElement('afterend', banner);

        const dismiss = banner.querySelector('.showcase-banner-dismiss');
        dismiss?.addEventListener('click', () => {
            banner.remove();
            sessionStorage.setItem('ace1_hide_showcase_banner', '1');
        });
    } catch (e) {
        // non-critical UI
    }
}

function initBackToTopButton() {
    if (document.getElementById('back-to-top')) return;

    const button = document.createElement('button');
    button.id = 'back-to-top';
    button.className = 'back-to-top';
    button.type = 'button';
    button.setAttribute('aria-label', 'Back to top');
    button.innerHTML = '<i class="fas fa-arrow-up" aria-hidden="true"></i>';

    document.body.appendChild(button);

    const toggle = () => {
        if (window.scrollY > 420) button.classList.add('show');
        else button.classList.remove('show');
    };

    window.addEventListener('scroll', toggle, { passive: true });
    toggle();

    button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function initFloatingHelpDock() {
    if (document.getElementById('floating-help')) return;

    const dock = document.createElement('div');
    dock.id = 'floating-help';
    dock.className = 'floating-help';
    dock.innerHTML = `
        <a class="floating-help-btn primary" href="contact.html" aria-label="Contact Ace#1">
            <i class="fas fa-headset" aria-hidden="true"></i>
            <span>Talk to us</span>
        </a>
        <a class="floating-help-btn" href="size-guide.html" aria-label="View size guide">
            <i class="fas fa-ruler" aria-hidden="true"></i>
            <span>Size guide</span>
        </a>
    `;

    document.body.appendChild(dock);
}

function ensureTrustStrip() {
    try {
        if (document.getElementById('trust-strip')) return;
        if (window.location.pathname.includes('admin')) return;

        const hero = document.querySelector('.page-hero') || document.querySelector('.hero-section') || document.querySelector('.page-header');
        const anchor = hero?.nextElementSibling || document.querySelector('main') || document.body;
        if (!anchor) return;

        const section = document.createElement('section');
        section.id = 'trust-strip';
        section.className = 'trust-strip';
        section.innerHTML = `
            <div class="container">
                <div class="trust-grid">
                    <div class="trust-item">
                        <i class="fas fa-shoe-prints" aria-hidden="true"></i>
                        <div>
                            <h4>Everyday Comfort</h4>
                            <p>Soft cushioning and breathable builds for long wear.</p>
                        </div>
                    </div>
                    <div class="trust-item">
                        <i class="fas fa-feather" aria-hidden="true"></i>
                        <div>
                            <h4>Lightweight Feel</h4>
                            <p>Designed to keep movement easy and effortless.</p>
                        </div>
                    </div>
                    <div class="trust-item">
                        <i class="fas fa-shield-halved" aria-hidden="true"></i>
                        <div>
                            <h4>Durable Build</h4>
                            <p>Materials chosen for everyday resilience.</p>
                        </div>
                    </div>
                    <div class="trust-item">
                        <i class="fas fa-bolt" aria-hidden="true"></i>
                        <div>
                            <h4>Ready for Action</h4>
                            <p>Great for walks, shifts, and on-the-go days.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (hero && hero.parentNode) {
            hero.insertAdjacentElement('afterend', section);
        } else if (anchor.firstElementChild) {
            anchor.insertAdjacentElement('afterbegin', section);
        } else {
            anchor.appendChild(section);
        }
    } catch (e) {
        // non-critical UI
    }
}

function ensureGlobalCtaStrip() {
    try {
        if (document.getElementById('global-cta-strip')) return;
        if (window.location.pathname.includes('admin')) return;

        const footer = document.querySelector('footer');
        if (!footer || !footer.parentNode) return;

        const cta = document.createElement('section');
        cta.id = 'global-cta-strip';
        cta.className = 'cta-strip';
        cta.innerHTML = `
            <div class="container cta-strip-content">
                <div>
                    <p class="cta-kicker">Need help choosing?</p>
                    <h3>Get a personalized recommendation</h3>
                    <p>Tell us how you plan to use the shoes — we’ll guide you to the best fit.</p>
                </div>
                <div class="cta-actions">
                    <a class="btn btn-primary" href="contact.html">Talk to our team</a>
                    <a class="btn btn-outline" href="size-guide.html">View size guide</a>
                </div>
            </div>
        `;

        footer.insertAdjacentElement('beforebegin', cta);
    } catch (e) {
        // non-critical UI
    }
}


// Main Site button in nav panel removed

// ===================================
// CATEGORY SYNC (FOOTER SHOP LINKS)
// ===================================
async function syncPrimaryCategoryPageLinks() {
    try {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) return;

        // Add more entries here when new primary-category pages are created.
        const pageDefs = [
            { key: 'clothing', href: 'clothing.html', label: 'Clothing', insertAfter: 'shoes.html' },
            { key: 'accessories', href: 'accessories.html', label: 'Accessories', insertAfter: 'clothing.html' }
        ];

        const availabilityByKey = new Map();

        for (const def of pageDefs) {
            let countQuery = supabase
                .from('products')
                .select('id', { count: 'exact', head: true })
                .eq('primary_category', def.key)
                .eq('is_active', true)
                .is('deleted_at', null)
                .or('is_locked.is.null,is_locked.eq.false')
                .eq('status', 'available');

            // Only consider products that can actually be purchased.
            // stock_quantity is maintained by Admin save + inventory adjustments.
            countQuery = countQuery.gt('stock_quantity', 0);

            const { count, error } = await countQuery;

            if (error) throw error;
            availabilityByKey.set(def.key, (count || 0) > 0);
        }

        const navMenu = document.getElementById('nav-menu') || document.querySelector('.nav-menu');
        if (navMenu) {
            pageDefs.forEach(def => {
                const available = availabilityByKey.get(def.key);

                // Find existing link (if any)
                const existingLink = navMenu.querySelector(`a[href="${def.href}"]`);

                if (!available) {
                    if (existingLink) {
                        const li = existingLink.closest('li');
                        if (li) li.remove();
                        else existingLink.remove();
                    }
                    return;
                }

                if (!existingLink) {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = def.href;
                    a.className = 'nav-link';
                    a.textContent = def.label;
                    li.appendChild(a);

                    const anchor = def.insertAfter
                        ? navMenu.querySelector(`a[href="${def.insertAfter}"]`)
                        : null;
                    const anchorLi = anchor ? anchor.closest('li') : null;
                    if (anchorLi && anchorLi.parentNode === navMenu) {
                        anchorLi.insertAdjacentElement('afterend', li);
                    } else {
                        navMenu.appendChild(li);
                    }
                }
            });

            // Ensure active link state for the current page
            const path = window.location.pathname || '';
            pageDefs.forEach(def => {
                const link = navMenu.querySelector(`a[href="${def.href}"]`);
                if (!link) return;
                if (path.includes(def.href)) link.classList.add('active');
            });
        }

        // Hide any footer or other links pointing to gated pages when unavailable
        pageDefs.forEach(def => {
            const available = availabilityByKey.get(def.key);
            document.querySelectorAll(`a[href="${def.href}"]`).forEach(a => {
                const li = a.closest('li');
                if (li) li.style.display = available ? '' : 'none';
                else a.style.display = available ? '' : 'none';
            });
        });
    } catch (err) {
        console.log('Primary category page link sync skipped:', err);
    }
}

async function syncFooterShopLinks() {
    try {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) return;

        const { data: categories, error } = await supabase
            .from('categories')
            .select('name, slug')
            .order('name');

        if (error) throw error;

        const cats = (categories || [])
            .map(c => ({
                name: c.name,
                slug: String(c.slug || c.name || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/\-+/g, '-')
            }))
            .filter(c => c.slug);

        // If products page provides an explicit hook, prefer that
        const explicit = document.getElementById('footer-shop-links');
        if (explicit) {
            explicit.innerHTML = `<li><a href="shoes.html">All Products</a></li>` +
                cats.map(c => `<li><a href="shoes.html?category=${encodeURIComponent(c.slug)}">${c.name || c.slug}</a></li>`).join('');
        }

        // Otherwise, update any footer column titled "Shop"
        document.querySelectorAll('.footer .footer-column').forEach(col => {
            const title = col.querySelector('h4');
            const ul = col.querySelector('ul');
            if (!title || !ul) return;
            if (title.textContent.trim().toLowerCase() !== 'shop') return;

            ul.innerHTML = `<li><a href="shoes.html">All Products</a></li>` +
                cats.map(c => `<li><a href="shoes.html?category=${encodeURIComponent(c.slug)}">${c.name || c.slug}</a></li>`).join('');
        });
    } catch (err) {
        console.log('Footer category sync skipped:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Replace text logos with the site logo image.
    applySiteLogo();
    // Best-effort: keep storefront aligned with Admin > Site Settings.
    syncSiteSettings();
    // Best-effort sync; if Supabase is unavailable on a page, it simply no-ops.
    syncFooterShopLinks();
    // Show/hide primary-category pages (e.g., Clothing) based on inventory.
    syncPrimaryCategoryPageLinks();
    // Add UI enhancements across the storefront.
    ensureShowcaseBanner();
    initFloatingHelpDock();
    initBackToTopButton();
    ensureTrustStrip();
    ensureGlobalCtaStrip();
    // Scroll-reveal animations for cards
    initScrollReveal();
    // Animated counters for stat numbers
    initAnimatedCounters();
    // Newsletter strip before footer
    ensureNewsletterStrip();
    // Track page view for analytics
    trackPageView();
});

function initScrollReveal() {
    try {
        if (!('IntersectionObserver' in window)) return;
        const targets = document.querySelectorAll(
            '.why-card, .tech-deep-card, .why-choose-card, .benefit-detail-card, .value-card, .team-member, .stat-card, .step-card, .timeline-item, .promise-item, .info-card'
        );
        if (!targets.length) return;

        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('sr-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        targets.forEach(el => {
            el.classList.add('sr-hidden');
            obs.observe(el);
        });
    } catch (e) {
        // non-critical UI
    }
}

function initAnimatedCounters() {
    try {
        const counters = document.querySelectorAll('.stat-number');
        if (!counters.length || !('IntersectionObserver' in window)) return;

        counters.forEach(el => {
            const raw = el.textContent.trim();
            const hasPercent = raw.includes('%');
            const hasPlus = raw.includes('+');
            const numVal = parseInt(raw.replace(/[^\d]/g, ''), 10);
            if (isNaN(numVal) || numVal === 0) return;

            el.dataset.target = numVal;
            el.dataset.suffix = (hasPercent ? '%' : '') + (hasPlus ? '+' : '');
        });

        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                const target = parseInt(el.dataset.target, 10);
                const suffix = el.dataset.suffix || '';
                if (isNaN(target)) return;

                let current = 0;
                const step = Math.max(1, Math.ceil(target / 60));
                const timer = setInterval(() => {
                    current += step;
                    if (current >= target) {
                        current = target;
                        clearInterval(timer);
                    }
                    el.textContent = current.toLocaleString() + suffix;
                }, 18);

                obs.unobserve(el);
            });
        }, { threshold: 0.3 });

        counters.forEach(c => obs.observe(c));
    } catch (e) {
        // non-critical UI
    }
}

function ensureNewsletterStrip() {
    try {
        if (document.getElementById('newsletter-strip')) return;
        if (window.location.pathname.includes('admin')) return;

        const footer = document.querySelector('footer');
        if (!footer || !footer.parentNode) return;

        const strip = document.createElement('section');
        strip.id = 'newsletter-strip';
        strip.className = 'newsletter-strip';
        strip.innerHTML = `
            <div class="container newsletter-strip-content">
                <div class="newsletter-text">
                    <h3><i class="fas fa-paper-plane"></i> Stay in the Loop</h3>
                    <p>Get early access to new drops, exclusive offers, and Ace#1 updates.</p>
                </div>
                <form class="newsletter-form" onsubmit="event.preventDefault(); this.querySelector('button').textContent='Subscribed ✓'; this.querySelector('input').disabled=true;">
                    <input type="email" placeholder="Enter your email" required aria-label="Email for newsletter">
                    <button type="submit" class="btn btn-primary">Subscribe</button>
                </form>
            </div>
        `;

        // Insert before footer but after the CTA strip (if present)
        const ctaStrip = document.getElementById('global-cta-strip');
        if (ctaStrip && ctaStrip.nextElementSibling) {
            ctaStrip.insertAdjacentElement('afterend', strip);
        } else {
            footer.insertAdjacentElement('beforebegin', strip);
        }
    } catch (e) {
        // non-critical UI
    }
}

function applySiteLogo() {
    const logoUrl = 'images/ace1-logo-bw.svg';

    // Update any existing logo images
    document.querySelectorAll('img.site-logo-img, img.footer-logo-img').forEach(img => {
        img.src = logoUrl;
        img.alt = 'Ace#1';
    });

    // Navbar logo (ensure one exists)
    const navLink = document.querySelector('.nav-logo a');
    if (navLink && !navLink.querySelector('img.site-logo-img')) {
        const img = document.createElement('img');
        img.className = 'site-logo-img';
        img.src = logoUrl;
        img.alt = 'Ace#1';
        img.decoding = 'async';
        img.loading = 'eager';

        while (navLink.firstChild) navLink.removeChild(navLink.firstChild);
        navLink.appendChild(img);
    }

    // Footer logo(s) (ensure one exists)
    document.querySelectorAll('.footer-logo').forEach(footerLogo => {
        if (footerLogo.querySelector('img.site-logo-img')) return;

        const img = document.createElement('img');
        img.className = 'site-logo-img footer-logo-img';
        img.src = logoUrl;
        img.alt = 'Ace#1';
        img.decoding = 'async';
        img.loading = 'lazy';

        while (footerLogo.firstChild) footerLogo.removeChild(footerLogo.firstChild);
        footerLogo.appendChild(img);
    });
}

// ===================================
// SITE SETTINGS SYNC (ADMIN → STOREFRONT)
// ===================================
async function syncSiteSettings() {
    try {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) return;

        const { data: rows, error } = await supabase
            .from('site_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        const settings = rows?.[0] || null;
        if (!settings) return;

        window.__siteSettings = settings;
        window.ACE1_MAINTENANCE_MODE = !!settings.maintenance_mode;

        applySiteSettingsToDom(settings);
    } catch (err) {
        // Non-fatal: site works with baked-in content.
        console.log('Site settings sync skipped:', err);
    }
}

function applySiteSettingsToDom(settings) {
    if (!settings) return;

    const isIndex = window.location.pathname.endsWith('/') || window.location.pathname.endsWith('/index.html') || window.location.pathname.endsWith('index.html');
    if (isIndex && settings.site_title) {
        document.title = settings.site_title;
    }

    if (isIndex && settings.site_description) {
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', settings.site_description);
    }

    // Update all Instagram links to the configured handle
    if (settings.instagram_url) {
        document.querySelectorAll('a[href*="instagram.com"]').forEach(a => {
            a.setAttribute('href', settings.instagram_url);
        });
    }

    // Update mailto links
    if (settings.contact_email) {
        document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
            a.setAttribute('href', `mailto:${settings.contact_email}`);
        });
    }

    // Update tel links
    if (settings.contact_phone) {
        const telValue = String(settings.contact_phone).replace(/\s+/g, '');
        document.querySelectorAll('a[href^="tel:"]').forEach(a => {
            a.setAttribute('href', `tel:${telValue}`);
        });
    }
}

// ===================================
// PAGE VIEW TRACKING (FOOTFALL ANALYTICS)
// ===================================
function getVisitorId() {
    // Get or create persistent visitor ID (stored in localStorage for cross-session tracking)
    let visitorId = localStorage.getItem('ace1_visitor_id');
    if (!visitorId) {
        visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
        localStorage.setItem('ace1_visitor_id', visitorId);
    }
    return visitorId;
}

function getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
}

async function trackPageView() {
    try {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        if (!supabase) return;

        // Skip tracking for admin pages
        if (window.location.pathname.includes('admin')) return;

        const visitorId = getVisitorId();
        const sessionId = sessionStorage.getItem('ace1_session_id') || generateSessionId();
        
        // Get current user if logged in
        let userId = null;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                userId = session.user.id;
            }
        } catch (e) {
            // User not logged in, that's fine
        }

        // Record page view
        const { error } = await supabase
            .from('page_views')
            .insert({
                visitor_id: visitorId,
                page_url: window.location.pathname + window.location.search,
                page_title: document.title,
                referrer: document.referrer || null,
                user_agent: navigator.userAgent,
                session_id: sessionId,
                device_type: getDeviceType(),
                user_id: userId
            });

        if (error) {
            console.debug('Page view tracking skipped:', error.message);
        }
    } catch (err) {
        // Silent fail - tracking shouldn't break the site
        console.debug('Page view tracking error:', err);
    }
}

// Generate session ID for anonymous users (stored in sessionStorage for current tab)
function generateSessionId() {
    // Use a cryptographically secure random value as the unpredictable component (16 bytes => 32 hex chars)
    const randomBytes = new Uint8Array(16);
    window.crypto.getRandomValues(randomBytes);
    const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const sessionId = 'session_' + Date.now() + '_' + hex;
    sessionStorage.setItem('ace1_session_id', sessionId);
    return sessionId;
}

// ===================================
// NAVIGATION
// ===================================
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');

// Sticky navbar on scroll
window.addEventListener('scroll', () => {
    if (navbar) {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }
});

// Mobile menu toggle
if (hamburger && navMenu) {
    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navMenu.classList.contains('active') && 
            !navMenu.contains(e.target) && 
            !hamburger.contains(e.target)) {
            navMenu.classList.remove('active');
            hamburger.classList.remove('active');
        }
    });
}

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        if (navMenu) navMenu.classList.remove('active');
        if (hamburger) hamburger.classList.remove('active');
    });
});

// ===================================
// SEARCH FUNCTIONALITY
// ===================================
const searchBtn = document.getElementById('search-btn');
const searchOverlay = document.getElementById('search-overlay');
const searchClose = document.getElementById('search-close');
const searchInput = document.querySelector('.search-input');

// Search state
let searchDebounceTimer = null;
let searchResultsContainer = null;
let searchActiveIndex = -1;

// Initialize search results container
function initSearchResults() {
    if (!searchOverlay || document.getElementById('search-results')) return;
    
    const searchContainer = searchOverlay.querySelector('.search-container');
    if (searchContainer) {
        // Add search results container
        searchResultsContainer = document.createElement('div');
        searchResultsContainer.id = 'search-results';
        searchResultsContainer.className = 'search-results';
        searchResultsContainer.innerHTML = '<p class="search-hint">Start typing to search products...</p>';
        searchContainer.appendChild(searchResultsContainer);
        
        // Add styles for search results
        if (!document.getElementById('search-results-styles')) {
            const styles = document.createElement('style');
            styles.id = 'search-results-styles';
            styles.textContent = `
                .search-results {
                    max-height: 60vh;
                    overflow-y: auto;
                    padding: 20px 0;
                }
                .search-hint {
                    color: #888;
                    text-align: center;
                    padding: 20px;
                }
                .search-result-item {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 15px;
                    background: white;
                    border-radius: 10px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border: none;
                    width: 100%;
                    text-align: left;
                }
                .search-result-item:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                }
                .search-result-item.is-active {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                }
                .search-result-item:focus {
                    outline: none;
                }
                .search-result-image {
                    width: 70px;
                    height: 70px;
                    object-fit: cover;
                    border-radius: 8px;
                }
                .search-result-info {
                    flex: 1;
                }
                .search-result-name {
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 5px;
                }
                .search-result-category {
                    font-size: 12px;
                    color: #888;
                    text-transform: uppercase;
                }
                .search-result-price {
                    font-weight: 700;
                    color: #FF6B00;
                    font-size: 18px;
                }
                .search-no-results {
                    text-align: center;
                    padding: 40px 20px;
                    color: #666;
                }
                .search-no-results i {
                    font-size: 48px;
                    color: #ddd;
                    margin-bottom: 15px;
                }
                .search-loading {
                    text-align: center;
                    padding: 30px;
                    color: #888;
                }
                .search-loading i {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styles);
        }
    }
}

// Perform search
async function performSearch(query) {
    if (!searchResultsContainer) {
        searchResultsContainer = document.getElementById('search-results');
    }
    if (!searchResultsContainer) return;
    
    query = query.trim().toLowerCase();
    
    if (query.length < 2) {
        searchResultsContainer.innerHTML = '<p class="search-hint">Type at least 2 characters to search...</p>';
        searchActiveIndex = -1;
        return;
    }
    
    // Show loading
    searchResultsContainer.innerHTML = '<div class="search-loading"><i class="fas fa-spinner"></i> Searching...</div>';
    
    try {
        const supabase = window.getSupabase ? window.getSupabase() : null;
        
        if (!supabase) {
            searchResultsContainer.innerHTML = '<p class="search-hint">Search unavailable. Please refresh the page.</p>';
            return;
        }
        
        const getProjectUrl = () => (
            (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || window.SUPABASE_URL || 'https://vorqavsuqcjnkjzwkyzr.supabase.co'
        );

        const getImageUrl = (storagePath) => {
            if (!storagePath) return 'images/placeholder.jpg';
            if (typeof storagePath === 'string' && storagePath.startsWith('http')) return storagePath;
            const projectUrl = getProjectUrl().replace(/\/$/, '');
            return `${projectUrl}/storage/v1/object/public/Images/${storagePath}`;
        };

        // Search products by name, description, or category
        const { data: products, error } = await supabase
            .from('products')
            .select(`
                id,
                name,
                description,
                category,
                price_cents,
                is_active,
                is_locked,
                status,
                product_images (
                    storage_path
                )
            `)
            .eq('is_active', true)
            .is('deleted_at', null)
            .or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`)
            .limit(10);
        
        if (error) throw error;
        
        if (!products || products.length === 0) {
            searchResultsContainer.innerHTML = `
                <div class="search-no-results">
                    <i class="fas fa-search"></i>
                    <p>No products found for "<strong>${escapeHTML(query)}</strong>"</p>
                    <p style="font-size: 14px; margin-top: 10px;">Try different keywords or browse our <a href="products.html" style="color: #FF6B00;">products page</a></p>
                </div>
            `;
            searchActiveIndex = -1;
            return;
        }
        
        const availableProducts = (products || []).filter(p => {
            if (p && p.is_locked) return false;
            const status = (p && p.status) ? String(p.status).toLowerCase() : null;
            if (status && status !== 'available') return false;
            return true;
        });
        
        // Render results
        if (!availableProducts.length) {
            searchResultsContainer.innerHTML = `
                <div class="search-no-results">
                    <i class="fas fa-search"></i>
                    <p>No products found for "<strong>${escapeHTML(query)}</strong>"</p>
                    <p style="font-size: 14px; margin-top: 10px;">Try different keywords or browse our <a href="products.html" style="color: #FF6B00;">products page</a></p>
                </div>
            `;
            searchActiveIndex = -1;
            return;
        }

        searchResultsContainer.innerHTML = availableProducts.map((product, idx) => {
            const imageUrl = getImageUrl(product.product_images?.[0]?.storage_path);
            const price = (product.price_cents / 100).toLocaleString('en-IN');
            const href = `products.html?search=${encodeURIComponent(product.name)}`;

            return `
                <button type="button" class="search-result-item" data-href="${href}" data-index="${idx}">
                    <img src="${imageUrl}" alt="${product.name}" class="search-result-image" onerror="this.src='images/placeholder.jpg'">
                    <div class="search-result-info">
                        <div class="search-result-name">${highlightMatch(product.name, query)}</div>
                        <div class="search-result-category">${product.category || 'Footwear'}</div>
                    </div>
                    <div class="search-result-price">₹${price}</div>
                </button>
            `;
        }).join('');

        // Reset active index and bind click handler (event delegation)
        searchActiveIndex = -1;
        if (!searchResultsContainer.dataset.bound) {
            searchResultsContainer.addEventListener('click', (e) => {
                const btn = e.target?.closest?.('.search-result-item');
                const href = btn?.dataset?.href;
                if (href) window.location.href = href;
            });
            searchResultsContainer.dataset.bound = '1';
        }
        
        // Add "View All" link if there might be more results
        if (availableProducts.length >= 10) {
            searchResultsContainer.innerHTML += `
                <a href="products.html?search=${encodeURIComponent(query)}" style="display: block; text-align: center; padding: 15px; color: #FF6B00; font-weight: 600; text-decoration: none;">
                    View all results <i class="fas fa-arrow-right"></i>
                </a>
            `;
        }
        
    } catch (error) {
        console.error('Search error:', error);
        searchResultsContainer.innerHTML = '<p class="search-hint">Search error. Please try again.</p>';
        searchActiveIndex = -1;
    }
}

// Simple HTML escaping utility
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight matching text
function highlightMatch(text, query) {
    if (!query) return text;
    const safe = escapeRegex(query);
    const regex = new RegExp(`(${safe})`, 'gi');
    return text.replace(regex, '<mark style="background: #FFE0B2; padding: 0 2px;">$1</mark>');
}

function updateActiveSearchResult() {
    if (!searchResultsContainer) return;
    const items = Array.from(searchResultsContainer.querySelectorAll('.search-result-item'));
    items.forEach((el, i) => {
        if (i === searchActiveIndex) el.classList.add('is-active');
        else el.classList.remove('is-active');
    });

    const active = items[searchActiveIndex];
    if (active && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest' });
    }
}

searchBtn?.addEventListener('click', () => {
    searchOverlay.classList.add('active');
    initSearchResults();
    document.querySelector('.search-input')?.focus();
});

searchClose?.addEventListener('click', () => {
    searchOverlay.classList.remove('active');
    if (searchInput) searchInput.value = '';
    if (searchResultsContainer) {
        searchResultsContainer.innerHTML = '<p class="search-hint">Start typing to search products...</p>';
    }
    searchActiveIndex = -1;
});

searchOverlay?.addEventListener('click', (e) => {
    if (e.target === searchOverlay) {
        searchOverlay.classList.remove('active');
    }
});

// Search input handler with debounce
searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        performSearch(e.target.value);
    }, 300);
});

// Keyboard navigation for search results
searchInput?.addEventListener('keydown', (e) => {
    if (!searchOverlay?.classList.contains('active')) return;

    if (e.key === 'Escape') {
        searchOverlay.classList.remove('active');
        searchActiveIndex = -1;
        return;
    }

    const items = searchResultsContainer
        ? Array.from(searchResultsContainer.querySelectorAll('.search-result-item'))
        : [];

    if (e.key === 'ArrowDown') {
        if (!items.length) return;
        e.preventDefault();
        searchActiveIndex = Math.min(items.length - 1, searchActiveIndex + 1);
        updateActiveSearchResult();
        return;
    }

    if (e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        searchActiveIndex = Math.max(0, searchActiveIndex - 1);
        updateActiveSearchResult();
        return;
    }

    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (searchActiveIndex >= 0 && items[searchActiveIndex]?.dataset?.href) {
            e.preventDefault();
            window.location.href = items[searchActiveIndex].dataset.href;
            return;
        }
        if (query.length >= 2) {
            window.location.href = `products.html?search=${encodeURIComponent(query)}`;
        }
    }
});

// ===================================
// USER PROFILE/LOGIN BUTTON
// ===================================
const userBtn = document.querySelector('.user-btn');
const userLink = document.querySelector('a.icon-btn[href="login.html"]');

// Handle user button clicks (for pages with button.user-btn)
userBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Check if we have a database session (use window.databaseAuth for proper check)
    const isAuthenticated = window.databaseAuth?.isAuthenticated?.() || false;
    
    if (isAuthenticated) {
        // Has session, go to profile/admin
        const user = window.databaseAuth?.getCurrentUser();
        if (user?.role === 'admin' || user?.email === 'hello@ace1.in') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'user-profile.html';
        }
        return;
    }
    
    // No session, check if Supabase OAuth session exists
    try {
        const supabase = window.getSupabase?.();
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session && session.user) {
                // Has OAuth session, go to profile (it will sync)
                window.location.href = 'user-profile.html';
                return;
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
    
    // No session at all, go to login
    window.location.href = 'login.html';
});

// Handle user link clicks (for pages with a.icon-btn link)
userLink?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        // Check database auth first
        if (window.databaseAuth && window.databaseAuth.isAuthenticated()) {
            const user = window.databaseAuth.getCurrentUser();
            if (user) {
                // Check if admin
                if (user.role === 'admin' || user.email === 'hello@ace1.in') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'user-profile.html';
                }
                return;
            }
        }
        
        // Fallback to OAuth check
        const supabase = window.getSupabase?.();
        if (supabase) {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                // Check if admin from database
                const isAdmin = await window.databaseAuth?.isUserAdmin(user.id);
                if (isAdmin) {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'user-profile.html';
                }
            } else {
                window.location.href = 'login.html';
            }
        } else {
            // Not logged in
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        window.location.href = 'login.html';
    }
});

// ===================================
// SHOPPING CART
// ===================================
const cartBtn = document.getElementById('cart-btn');
const cartSidebar = document.getElementById('cart-sidebar');
const cartClose = document.getElementById('cart-close');
const cartOverlay = document.getElementById('cart-overlay');
const cartCount = document.getElementById('cart-count');
const cartItems = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');

function getSupabaseProjectUrl() {
    return (
        (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) ||
        window.SUPABASE_URL ||
        'https://vorqavsuqcjnkjzwkyzr.supabase.co'
    ).replace(/\/$/, '');
}

function resolveProductImageUrl(imageOrStoragePath) {
    if (!imageOrStoragePath) return 'images/placeholder.jpg';
    if (typeof imageOrStoragePath === 'string' && imageOrStoragePath.startsWith('http')) return imageOrStoragePath;

    const storagePath = String(imageOrStoragePath);
    // Encode while keeping path separators
    const encodedPath = encodeURIComponent(storagePath).replace(/%2F/g, '/');
    return `${getSupabaseProjectUrl()}/storage/v1/object/public/Images/${encodedPath}`;
}

async function ace1IsLoggedIn() {
    try {
        if (window.databaseAuth?.isAuthenticated?.()) return true;

        const supabase = window.getSupabase?.();
        if (!supabase) return false;
        const { data: { session } } = await supabase.auth.getSession();
        return !!session?.user;
    } catch {
        return false;
    }
}

function ace1RedirectToLogin() {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.href = `login.html?return=${encodeURIComponent(returnTo)}`;
}

// Open cart (requires login)
cartBtn?.addEventListener('click', async () => {
    const loggedIn = await ace1IsLoggedIn();
    if (!loggedIn) {
        ace1RedirectToLogin();
        return;
    }

    if (cartSidebar) {
        cartSidebar.classList.add('active');
        cartOverlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
});

// Close cart
const closeCart = () => {
    if (cartSidebar) {
        cartSidebar.classList.remove('active');
        cartOverlay?.classList.remove('active');
        document.body.style.overflow = '';
    }
};

cartClose?.addEventListener('click', closeCart);
cartOverlay?.addEventListener('click', closeCart);

// Add to cart functionality
document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const productId = btn.dataset.id;
        addToCart(productId);
        
        // Visual feedback
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-shopping-bag"></i>';
        }, 1000);
    });
});

async function addToCart(productId, selectedSize = null) {
    try {
        if (window.ACE1_MAINTENANCE_MODE) {
            showNotification('Orders are temporarily paused. Please check back soon.', 'info');
            return;
        }

        // Cart requires login (requested behavior).
        const loggedIn = await ace1IsLoggedIn();
        if (!loggedIn) {
            ace1RedirectToLogin();
            return;
        }

        // Try to get product from Supabase first
        const supabase = window.getSupabase();
        const { data: product, error } = await supabase
            .from('products')
            .select(`
                *,
                inventory(stock, size),
                product_images(storage_path)
            `)
            .eq('id', productId)
            .eq('is_active', true)
            .is('deleted_at', null)
            .single();

        if (error || !product) {
            // Fallback to local products
            const products = {
                '1': { id: 1, name: 'THz Runner Pro', price: 14999, image: 'images/product-1.jpg', stock_quantity: 0 },
                '2': { id: 2, name: 'Elite Sport THz', price: 17499, image: 'images/product-2.jpg', stock_quantity: 0 },
                '3': { id: 3, name: 'Wellness Walk', price: 12999, image: 'images/product-3.jpg', stock_quantity: 0 },
                '4': { id: 4, name: 'Urban Flex THz', price: 11999, image: 'images/product-4.jpg', stock_quantity: 0 }
            };
            
            const localProduct = products[productId];
            if (!localProduct) return;
            
            // Check stock
            if (localProduct.stock_quantity === 0 || localProduct.is_locked) {
                showNotification('This product is currently out of stock', 'error');
                return;
            }
            
            addProductToCart({ ...localProduct, size: selectedSize });
        } else {
            // Calculate total stock from inventory table
            const totalStock = (product.inventory || []).reduce((sum, inv) => sum + (inv.stock || 0), 0);
            
            // Check stock and availability from Supabase
            if (product.is_locked) {
                showNotification('This product is currently unavailable', 'error');
                return;
            }
            if (product.status && String(product.status).toLowerCase() !== 'available') {
                showNotification('This product is currently unavailable', 'error');
                return;
            }
            if (totalStock === 0) {
                showNotification('This product is currently out of stock', 'error');
                return;
            }
            
            // Convert Supabase product to cart format
            const cartProduct = {
                id: product.id,
                name: product.name,
                price: (product.price !== undefined && product.price !== null && String(product.price) !== '')
                    ? Number(product.price)
                    : (Number(product.price_cents || 0) / 100),
                image: product.image_url || product.product_images?.[0]?.storage_path || 'images/placeholder.jpg',
                stock_quantity: totalStock,
                size: selectedSize
            };
            
            addProductToCart(cartProduct);
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showNotification('Error adding product to cart', 'error');
    }
}

// Expose for dynamically-rendered product pages (e.g. shoes.html uses window.addToCart)
window.addToCart = addToCart;


// Ensure cart loads from database/session on page load
document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadCartFromDatabase === 'function') {
        loadCartFromDatabase();
    }
});

function addProductToCart(product) {
    // Ensure price is a number (handle both price (rupees) and price_cents (paise/cents) from Supabase)
    const hasRupeePrice = product.price !== undefined && product.price !== null && String(product.price) !== '';
    const price = hasRupeePrice ? Number(product.price) : (Number(product.price_cents || 0) / 100);
    if (price <= 0) {
        showNotification('Error: Product price not available', 'error');
        return;
    }
    
    // Check if product already in cart
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        // Check if we can add more based on stock
        if (product.stock_quantity && existingItem.quantity >= product.stock_quantity) {
            showNotification('Maximum available quantity already in cart', 'error');
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, price, quantity: 1 });
    }
    
    updateCart();
    
    // Show notification
    showNotification('Product added to cart!', 'success');
}

function updateCart() {
    // Persist the in-memory cart for other scripts/pages
    publishCartUpdate();

    // Mark as pending sync so fast navigation won't reload stale DB state
    saveCartCache(true);

    // Render immediately (optimistic UI), then sync in background
    renderCart();
    scheduleCartSync();
}

function updateQuantity(e) {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;

    const productId = btn.dataset.id;
    const item = cart.find(i => String(i.id) === String(productId));
    
    if (!item) return;
    
    if (btn.classList.contains('plus')) {
        item.quantity += 1;
    } else if (btn.classList.contains('minus')) {
        item.quantity -= 1;
        if (item.quantity <= 0) {
            cart = cart.filter(i => String(i.id) !== String(productId));
        }
    }
    
    updateCart();
}

function removeFromCart(e) {
    const btn = e.target.closest('.remove-item');
    if (!btn) return;
    const productId = btn.dataset.id;
    cart = cart.filter(i => String(i.id) !== String(productId));
    updateCart();
    showNotification('Product removed from cart');
}

// Sync cart to database (for both authenticated and anonymous users)
async function syncCartToDatabase() {
    try {
        const supabase = window.getSupabase?.();
        if (!supabase) {
            // No Supabase available - just render local cart
            renderCart();
            return;
        }
        
        const user = window.AuthManager?.getCurrentUser();
        
        if (user) {
            // Authenticated user - use user_id
            // Delete old cart entries for this user
            // For authenticated users, store cart items in cart_items linked to a shopping_carts row
            // Remove any existing cart rows for this user and create a fresh cart
            await supabase.from('shopping_carts').delete().eq('user_id', user.id);

            // Create a new shopping_carts row for this user and get its id
            const newCartRes = await supabase.from('shopping_carts').insert({ user_id: user.id }).select('id').limit(1).single();
            const userCartId = newCartRes?.data?.id;

            // Insert new cart_items
            if (cart.length > 0 && userCartId) {
                const cartItemsData = cart.map(item => ({
                    cart_id: userCartId,
                    product_id: item.id,
                    quantity: item.quantity,
                    size: item.size || null
                }));
                await supabase.from('cart_items').insert(cartItemsData);
            }
        } else {
            // Anonymous user - use session_id via RPC functions
            // Clear existing session cart
            await supabase.rpc('clear_cart_by_session', { p_session_id: cartSessionId });
            
            // Add items one by one (RPC function handles duplicates)
            for (const item of cart) {
                await supabase.rpc('add_to_cart_by_session', {
                    p_session_id: cartSessionId,
                    p_product_id: item.id,
                    p_quantity: item.quantity,
                    p_size: item.size || null
                });
            }
        }

        // Mark local cache as synced
        saveCartCache(false);
    } catch (error) {
        console.log('Cart sync to database failed:', error);
    }
}

// Load cart from database
async function loadCartFromDatabase() {
    if (cartLoaded) return; // Only load once

    // If we just changed cart on a previous page and navigated quickly,
    // prefer the cached cart to avoid briefly reloading stale DB data.
    const cached = loadCartCache();
    if (cached?.pendingSync && (Date.now() - (cached.updatedAt || 0) < 12000)) {
        cart = cached.cart;
        cartLoaded = true;
        publishCartUpdate();
        renderCart();
        scheduleCartSync();
        return;
    }
    
    try {
        const supabase = window.getSupabase?.();
        if (!supabase) return;
        
        const user = window.AuthManager?.getCurrentUser();
        let data = null;
        
        if (user) {
            // Authenticated user - load cart via cart_items
            // First get cart ids for this user, then fetch cart_items for those carts
            const cartsRes = await supabase.from('shopping_carts').select('id').eq('user_id', user.id);
            if (cartsRes.error || !cartsRes.data || cartsRes.data.length === 0) {
                data = [];
            } else {
                const cartIds = cartsRes.data.map(c => c.id);
                const itemsRes = await supabase
                    .from('cart_items')
                    .select('id, product_id, quantity, size, products(id, name, price_cents, image_url, product_images(storage_path), inventory(stock, size))')
                    .in('cart_id', cartIds);
                if (!itemsRes.error && itemsRes.data) {
                    data = itemsRes.data.map(row => ({
                        id: row.id,
                        product_id: row.product_id,
                        quantity: row.quantity,
                        size: row.size,
                        products: row.products
                    }));
                } else {
                    data = [];
                }
            }
        } else {
                // Anonymous user - load by session_id using RPC (safer than Edge Function for now)
                const cartSessionId = sessionStorage.getItem('ace1_session_id');
                if (!cartSessionId) {
                    data = [];
                } else {
                    const rpcRes = await supabase.rpc('get_cart_by_session', { p_session_id: cartSessionId });
                    if (!rpcRes.error && rpcRes.data) {
                        // rpc returns rows of (id, product_id, quantity, size, added_at)
                        // fetch product details for those product_ids
                        const productIds = rpcRes.data.map(r => r.product_id);
                        if (productIds.length === 0) {
                            data = [];
                        } else {
                            const prodRes = await supabase.from('products').select('id, name, price_cents, image_url, product_images(storage_path)').in('id', productIds);
                            const invRes = await supabase.from('inventory').select('product_id, stock, size').in('product_id', productIds);

                            const invMap = {};
                            (invRes.data || []).forEach(i => { invMap[i.product_id] = invMap[i.product_id] || []; invMap[i.product_id].push({ stock: i.stock, size: i.size }); });

                            data = rpcRes.data.map(r => ({ id: r.id, product_id: r.product_id, quantity: r.quantity, size: r.size, products: (prodRes.data || []).find(p => p.id === r.product_id) ? { ...(prodRes.data || []).find(p => p.id === r.product_id), inventory: invMap[r.product_id] || [] } : null }));
                        }
                    } else {
                        // Network hiccups or backend errors shouldn't break the UI; fall back to empty cart.
                        console.log('Cart RPC load error:', rpcRes.error);
                        data = [];
                }
            }
        }
        
        if (data && data.length > 0) {
            // Convert database items to cart format
            cart = data.map(item => {
                // Calculate total stock from inventory
                const totalStock = (item.products?.inventory || []).reduce((sum, inv) => sum + (inv.stock || 0), 0);
                return {
                    id: item.product_id,
                    name: item.products?.name || 'Unknown Product',
                    price: item.products?.price_cents ? item.products.price_cents / 100 : 0,
                    image: item.products?.image_url || item.products?.product_images?.[0]?.storage_path || 'images/placeholder.jpg',
                    stock_quantity: totalStock,
                    quantity: item.quantity,
                    size: item.size
                };
            });
            
            cartLoaded = true;
            // Re-render cart with database data
            renderCart();
        } else {
            cart = [];
            cartLoaded = true;
            renderCart();
        }
    } catch (error) {
        console.log('Failed to load cart from database:', error);
        cart = [];
        cartLoaded = true;
        renderCart();
    }
}

// Render cart UI without syncing to database
function renderCart() {
    publishCartUpdate();
    const cached = loadCartCache();
    saveCartCache(!!cached?.pendingSync);

    const { cartCount: countEl, cartItems: itemsEl, cartTotalElement: totalEl } = getCartDom();

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (countEl) {
        countEl.textContent = totalItems;
    }

    // If cart UI not present on this page, stop here
    if (!itemsEl || !totalEl) {
        return;
    }

    cartTotal = cart.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * item.quantity), 0);
    totalEl.textContent = `₹${cartTotal.toLocaleString('en-IN')}`;

    if (cart.length === 0) {
        itemsEl.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-bag"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        return;
    }

    itemsEl.innerHTML = cart.map(item => {
        const price = parseFloat(item.price || 0);
        const imageUrl = resolveProductImageUrl(item.image);
        const sizeLabel = item.size ? `<span class="cart-item-size">Size: ${item.size}</span>` : '';
        return `
            <div class="cart-item" data-id="${item.id}">
                <img src="${imageUrl}" alt="${item.name}" onerror="this.src='images/placeholder.jpg'">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>₹${price.toLocaleString('en-IN')}</p>
                    ${sizeLabel}
                    <div class="cart-item-quantity">
                        <button class="qty-btn minus" data-id="${item.id}">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn plus" data-id="${item.id}">+</button>
                    </div>
                </div>
                <button class="remove-item" data-id="${item.id}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', updateQuantity);
    });

    document.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', removeFromCart);
    });
}

// ===================================
// PRODUCT FILTERS
// ===================================
const filterBtns = document.querySelectorAll('.filter-btn');
const productCards = document.querySelectorAll('.product-card');

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        filterBtns.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');
        
        const filter = btn.dataset.filter;
        
        productCards.forEach(card => {
            if (filter === 'all') {
                card.style.display = 'block';
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'scale(1)';
                }, 10);
            } else {
                if (card.dataset.category === filter) {
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'scale(1)';
                    }, 10);
                } else {
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        card.style.display = 'none';
                    }, 300);
                }
            }
        });
    });
});

// ===================================
// SMOOTH SCROLLING
// ===================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const href = this.getAttribute('href');
        if (!href || href === '#') return;
        let target = null;
        try {
            target = document.querySelector(href);
        } catch {
            return;
        }
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ===================================
// NEWSLETTER FORM
// ===================================
const newsletterForm = document.getElementById('newsletter-form');

newsletterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    
    // In a real app, this would send to a server
    showNotification('Thank you for subscribing!');
    e.target.reset();
});

// Add notification styles dynamically
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 100px;
        right: 20px;
        background: white;
        padding: 20px 30px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 15px;
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        font-weight: 500;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-success {
        border-left: 4px solid #00C853;
    }
    
    .notification-success i {
        color: #00C853;
        font-size: 20px;
    }
    
    .notification-error {
        border-left: 4px solid #FF3D00;
    }
    
    .notification-error i {
        color: #FF3D00;
        font-size: 20px;
    }
    
    .cart-item {
        display: flex;
        gap: 15px;
        padding: 20px;
        border-bottom: 1px solid #e5e5e5;
        position: relative;
    }
    
    .cart-item img {
        width: 80px;
        height: 80px;
        object-fit: cover;
        border-radius: 10px;
    }
    
    .cart-item-info {
        flex: 1;
    }
    
    .cart-item-info h4 {
        font-size: 16px;
        margin-bottom: 5px;
    }
    
    .cart-item-info p {
        color: #666;
        font-weight: 600;
        margin-bottom: 5px;
    }
    
    .cart-item-size {
        display: inline-block;
        font-size: 12px;
        color: #888;
        background: #f5f5f5;
        padding: 2px 8px;
        border-radius: 4px;
        margin-bottom: 8px;
    }
    
    .cart-item-quantity {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .qty-btn {
        width: 36px;
        height: 36px;
        min-width: 44px;
        min-height: 44px;
        border: 1px solid #e5e5e5;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
        background: white;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    }
    
    .qty-btn:hover {
        background: #f5f5f5;
        border-color: #000;
    }
    
    .qty-btn:active {
        transform: scale(0.95);
    }
    
    .remove-item {
        position: absolute;
        top: 15px;
        right: 15px;
        width: 36px;
        height: 36px;
        min-width: 44px;
        min-height: 44px;
        border-radius: 50%;
        color: #666;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        touch-action: manipulation;
    }
    
    .remove-item:hover {
        background: #fee;
        color: #f44;
    }
    
    .remove-item:active {
        transform: scale(0.95);
    }
    
    /* Mobile touch optimizations */
    @media (hover: none) and (pointer: coarse) {
        .qty-btn, .remove-item {
            min-width: 44px;
            min-height: 44px;
        }
    }
`;
document.head.appendChild(notificationStyles);

// ===================================
// SCROLL ANIMATIONS
// ===================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for scroll animations
document.querySelectorAll('.feature-card, .product-card, .testimonial-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// ===================================
// QUICK VIEW MODAL (placeholder)
// ===================================
if (!document.getElementById('quick-view-modal')) {
    document.querySelectorAll('.quick-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showNotification('Quick view coming soon!', 'success');
        });
    });
}

// ===================================
// INITIALIZE
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
    // Load cart from database first
    await loadCartFromDatabase();
    
    // Refresh product displays if admin updated products
    refreshProductsIfNeeded();

    // Keep featured products in sync with admin changes
    setupHomepageRealtimeFeaturedSync();
    
    console.log('Ace#1 Marketplace loaded successfully!');
});

function setupHomepageRealtimeFeaturedSync() {
    try {
        const productsGrid = document.getElementById('products-grid');
        if (!productsGrid) return;
        if (productsGrid.dataset.productsSource !== 'featured') return;
        if (window.__ace1HomepageFeaturedRealtimeSetup) return;

        if (typeof window.getSupabase !== 'function') return;
        const supabase = window.getSupabase();
        if (!supabase || typeof supabase.channel !== 'function') return;

        window.__ace1HomepageFeaturedRealtimeSetup = true;

        let timer = null;
        let inFlight = null;

        const schedule = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(async () => {
                if (inFlight) return;
                inFlight = (async () => {
                    try {
                        await refreshProductsIfNeeded();
                    } catch (e) {
                        console.warn('Featured products realtime refresh failed:', e);
                    }
                })();
                try {
                    await inFlight;
                } finally {
                    inFlight = null;
                }
            }, 400);
        };

        const channel = supabase
            .channel('ace1-homepage-featured-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, schedule)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, schedule)
            .subscribe();

        window.addEventListener('beforeunload', () => {
            try {
                supabase.removeChannel(channel);
            } catch (e) {
                // ignore
            }
        });
    } catch (e) {
        console.warn('Homepage realtime sync skipped:', e);
    }
}

// Refresh products from Supabase if admin made changes
async function refreshProductsIfNeeded() {
    const productsGrid = document.getElementById('products-grid');
    if (!productsGrid) return;

    // Only run on the featured-products section (homepage featured grid).
    // Other pages (e.g., clothing.html) also have #products-grid and are managed by products.js.
    if (productsGrid.dataset.productsSource !== 'featured') return;
    
    try {
        if (typeof window.getSupabase !== 'function') {
            // Supabase not initialized on this page; silently skip.
            return;
        }

        const supabase = window.getSupabase();
        
        // Fetch all active products with related data (matches products.js)
        const { data: products, error } = await supabase
            .from('products')
            .select(`
                *,
                product_images (
                    storage_path,
                    alt
                ),
                inventory (
                    stock,
                    size
                )
            `)
            .eq('is_active', true)
            .is('deleted_at', null)
            .eq('show_on_index', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        console.log(`✅ Loaded ${products?.length || 0} fresh products from Supabase`);
        
        if (!products || products.length === 0) {
            console.log('No products to display');
            return;
        }
        
        const getProjectUrl = () => (
            (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || window.SUPABASE_URL || 'https://vorqavsuqcjnkjzwkyzr.supabase.co'
        );

        // Helper function to convert storage path to public URL (matches products.js)
        const getImageUrl = (storagePath) => {
            if (!storagePath) return 'images/placeholder.jpg';
            const projectUrl = getProjectUrl().replace(/\/$/, '');
            const storagePrefix = `${projectUrl}/storage`;
            if (typeof storagePath === 'string' && storagePath.startsWith(storagePrefix)) return storagePath;
            if (typeof storagePath === 'string' && storagePath.startsWith('http')) return storagePath;
            if (typeof storagePath === 'string' && (storagePath.includes('.jpg') || storagePath.includes('.png') || storagePath.includes('.jpeg') || storagePath.includes('.gif') || storagePath.includes('.webp'))) {
                return `images/${storagePath.toLowerCase()}`;
            }
            return `${projectUrl}/storage/v1/object/public/Images/${storagePath}`;
        };
        
        // Process products with proper image URLs and inventory (matches products.js)
        const processedProducts = (products || []).map(product => ({
            ...product,
            image_url: getImageUrl(product.product_images?.[0]?.storage_path) || 'images/placeholder.jpg',
            stock_quantity: (product.inventory || []).reduce((sum, inv) => sum + (inv.stock || 0), 0),
            price: (product.price_cents / 100).toFixed(2)
        })).filter(product => {
            if (product && product.is_locked) return false;
            const status = (product && product.status) ? String(product.status).toLowerCase() : null;
            if (status && status !== 'available') return false;
            return true;
        });
        
        // Render products with same template as products.js
        productsGrid.innerHTML = processedProducts.map(product => `
            <div class="product-card" data-product-id="${product.id}" data-category="${(product.category || 'casual').toLowerCase()}">
                <div class="product-image">
                    <img src="${product.image_url || 'images/placeholder.jpg'}" alt="${product.name}" onerror="this.src='images/placeholder.jpg'">
                    ${product.is_locked ? '<div class="product-badge bg-gray">Locked</div>' : ''}
                    ${product.stock_quantity === 0 ? '<div class="product-badge bg-red">Out of Stock</div>' : ''}
                    ${product.stock_quantity > 0 && product.stock_quantity < 10 ? '<div class="product-badge bg-orange">Low Stock</div>' : ''}
                    <div class="product-overlay">
                        <button class="quick-view-btn" data-product-id="${product.id}">Quick View</button>
                    </div>
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${(product.description || '').substring(0, 100)}...</p>
                    <div class="product-rating">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star-half-alt"></i>
                        <span>(${Math.floor(Math.random() * 200 + 50)})</span>
                    </div>
                    <div class="product-footer">
                        <span class="product-price">₹${parseFloat(product.price).toLocaleString('en-IN')}</span>
                        ${(!product.is_locked && product.stock_quantity > 0 && (product.status === undefined || String(product.status).toLowerCase() === 'available'))
                            ? `<button class="add-to-cart-btn" data-id="${product.id}" aria-label="Add ${product.name} to cart" title="Add to cart">
                                <i class="fas fa-shopping-bag" aria-hidden="true"></i><span class="sr-only">Add to cart</span>
                               </button>`
                            : `<button class="add-to-cart-btn" disabled>
                                <i class="fas fa-times-circle" style="margin-right: 8px;" aria-hidden="true"></i><span class="sr-only">${product.is_locked ? 'Unavailable' : 'Out of Stock'}</span>
                               </button>`
                        }
                    </div>
                </div>
            </div>
        `).join('');
        
        // Re-attach event listeners
        document.querySelectorAll('.add-to-cart-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = btn.dataset.id;
                if (window.addToCart) {
                    window.addToCart(productId);
                }
            });
        });
        
        // Re-attach Quick View handlers
        if (window.attachQuickViewHandlers) {
            window.attachQuickViewHandlers();
        }
        
        // Re-attach category filter handlers
        attachCategoryFilters();
        
        console.log(`✅ Homepage products updated from database (${processedProducts.length} products)`);
        
    } catch (error) {
        // Avoid polluting console with errors for transient network/config issues.
        console.log('Could not refresh featured products:', error?.message || String(error));
    }
}

// Attach category filter functionality
function attachCategoryFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const productsGrid = document.getElementById('products-grid');
    
    if (!filterBtns.length || !productsGrid) return;
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            const productCards = productsGrid.querySelectorAll('.product-card');
            
            productCards.forEach(card => {
                const category = card.dataset.category;
                
                if (filter === 'all') {
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'scale(1)';
                    }, 10);
                } else {
                    if (category === filter) {
                        card.style.display = 'block';
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'scale(1)';
                        }, 10);
                    } else {
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.8)';
                        setTimeout(() => {
                            card.style.display = 'none';
                        }, 300);
                    }
                }
            });
        });
    });
}

// ===================================
// KEYBOARD SHORTCUTS
// ===================================
document.addEventListener('keydown', (e) => {
    // Press 'Escape' to close modals
    if (e.key === 'Escape') {
        searchOverlay.classList.remove('active');
        closeCart();
    }
    
    // Press 'S' to open search (when not typing in an input)
    if (e.key === 's' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        searchOverlay.classList.add('active');
        document.querySelector('.search-input').focus();
    }
});

// ===================================
// CHECKOUT INTEGRATION
// ===================================
const checkoutBtn = document.querySelector('.cart-footer .btn-primary');
if (checkoutBtn) {
    checkoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        // Check the in-memory cart loaded from database
        if (cart.length === 0) {
            showNotification('Your cart is empty', 'error');
            return;
        }

        // Ensure the latest cart state is synced before navigating
        try {
            if (cartSyncInFlight) {
                await cartSyncInFlight;
            } else {
                await syncCartToDatabase();
            }
        } catch {
            // ignore sync errors; navigation still proceeds
        }

        window.location.href = 'checkout.html';
    });
}

// ===================================
// NOTIFICATIONS SYSTEM
// ===================================
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Make functions globally available
window.showNotification = showNotification;
window.addToCart = addToCart;

// ===================================
// QUICK VIEW MODAL
// ===================================
const quickViewModal = document.getElementById('quick-view-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalCloseBtn = document.getElementById('modal-close-btn');

// Sample product data - replace with actual data from Supabase
let currentQuickViewProduct = null;

// Open Quick View Modal
function openQuickView(productData) {
    currentQuickViewProduct = productData;

    // Reset any previous selections inside the modal
    try {
        quickViewModal?.querySelectorAll('.size-option.selected').forEach(btn => btn.classList.remove('selected'));
    } catch {
        // ignore
    }
    
    // Get proper image URL
    const imageUrl = productData.image_url || productData.image || 'images/placeholder.jpg';
    
    // Get proper price (handle both price and price_cents)
    let price = productData.price;
    if (typeof price === 'string') {
        price = parseFloat(price);
    }
    if (!price && productData.price_cents) {
        price = (productData.price_cents / 100);
    }
    
    // Populate modal with product data
    document.getElementById('qv-image').src = imageUrl;
    document.getElementById('qv-image').onerror = () => {
        document.getElementById('qv-image').src = 'images/placeholder.jpg';
    };
    document.getElementById('qv-name').textContent = productData.name;
    document.getElementById('qv-category').textContent = productData.category || 'Sneakers';
    document.getElementById('qv-price').textContent = `₹${price ? parseFloat(price).toLocaleString('en-IN') : '0'}`;
    // Strip optional "Added <date>" lines from description (not relevant in quick view)
    const rawDesc = productData.description || 'Description coming soon.';
    const sanitizedDesc = rawDesc.replace(/(^|\n)\s*Added\s+\d{1,2}\s+\w+\s+\d{4}\s*(\n|$)/ig, '\n').trim();
    document.getElementById('qv-description').textContent = sanitizedDesc || 'Description coming soon.';
    
    // Populate size options dynamically from inventory (show only available sizes)
    const sizesContainer = document.querySelector('#qv-sizes .size-options');
    if (sizesContainer) {
        sizesContainer.innerHTML = '';
        const inventory = productData.inventory || [];
        const availableSizes = inventory.filter(i => (i.stock || 0) > 0).map(i => ({ size: i.size, stock: i.stock }));

        if (availableSizes.length === 0) {
            // If no inventory info or no available sizes, hide size selector
            document.getElementById('qv-sizes').style.display = 'none';
        } else {
            document.getElementById('qv-sizes').style.display = '';
            availableSizes.forEach(s => {
                const btn = document.createElement('button');
                btn.className = 'size-option';
                btn.dataset.size = String(s.size);
                btn.textContent = String(s.size);
                if (!s.stock || s.stock === 0) btn.disabled = true;
                sizesContainer.appendChild(btn);
            });
        }
    }
    
    // Stock status
    const stockEl = document.getElementById('qv-stock');
    const addToCartBtn = document.getElementById('qv-add-to-cart');
    const stock = productData.stock_quantity !== undefined ? productData.stock_quantity : 0;
    
    if (stock === 0 || productData.is_locked) {
        stockEl.className = 'qv-stock out-of-stock';
        stockEl.innerHTML = '<i class="fas fa-times-circle"></i> Out of Stock';
        addToCartBtn.disabled = true;
    } else if (stock < 10) {
        stockEl.className = 'qv-stock low-stock';
        stockEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> Only ${stock} left`;
        addToCartBtn.disabled = false;
    } else {
        stockEl.className = 'qv-stock in-stock';
        stockEl.innerHTML = '<i class="fas fa-check-circle"></i> In Stock';
        addToCartBtn.disabled = false;
    }
    
    // Show modal
    quickViewModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Quick View Modal
function closeQuickView() {
    quickViewModal.classList.remove('active');
    document.body.style.overflow = '';
    currentQuickViewProduct = null;
}

// Event Listeners for Quick View
if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeQuickView);
}

if (modalOverlay) {
    modalOverlay.addEventListener('click', closeQuickView);
}

// ESC key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && quickViewModal?.classList.contains('active')) {
        closeQuickView();
    }
});

// Size selection
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('size-option')) {
        document.querySelectorAll('.size-option').forEach(btn => btn.classList.remove('selected'));
        e.target.classList.add('selected');
    }
});

// Enable/disable Add to Cart / Buy Now depending on whether a size is required and selected
function updateQuickViewActionButtons() {
    const sizesContainer = document.querySelector('#qv-sizes .size-options');
    const addToCartBtn = document.getElementById('qv-add-to-cart');
    const buyNowBtn = document.getElementById('qv-buy-now');

    if (!addToCartBtn && !buyNowBtn) return;

    const hasSizes = sizesContainer && sizesContainer.children.length > 0 && document.getElementById('qv-sizes')?.style.display !== 'none';
    const selected = document.querySelector('#quick-view-modal .size-option.selected');

    if (hasSizes) {
        const enabled = !!selected;
        if (addToCartBtn) addToCartBtn.disabled = !enabled;
        if (buyNowBtn) buyNowBtn.disabled = !enabled;
    } else {
        // No sizes required
        if (addToCartBtn) addToCartBtn.disabled = false;
        if (buyNowBtn) buyNowBtn.disabled = false;
    }
}

// Highlight and focus the quick-view sizes area to guide the user
function highlightQuickViewSizes() {
    try {
        const sizesHost = document.getElementById('qv-sizes');
        const sizesContainer = document.querySelector('#qv-sizes .size-options');
        if (!sizesHost || !sizesContainer) return;

        // Add highlight class
        sizesHost.classList.add('highlight');

        // Focus first selectable size button
        const firstSelectable = sizesContainer.querySelector('.size-option:not([disabled])');
        if (firstSelectable && typeof firstSelectable.focus === 'function') {
            firstSelectable.focus({ preventScroll: false });
        }

        // Scroll into view if needed
        sizesHost.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Remove highlight after animation
        setTimeout(() => sizesHost.classList.remove('highlight'), 900);
    } catch (e) {
        // ignore
    }
}

// Keep action buttons in sync when user selects a size
document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('size-option')) {
        setTimeout(updateQuickViewActionButtons, 0);
    }
});

// Add to cart from Quick View
document.getElementById('qv-add-to-cart')?.addEventListener('click', () => {
    if (currentQuickViewProduct && !currentQuickViewProduct.is_locked && currentQuickViewProduct.stock_quantity > 0) {
        // If sizes are shown, require a selection
        const sizesContainer = document.querySelector('#qv-sizes .size-options');
        const hasSizes = sizesContainer && sizesContainer.children.length > 0 && document.getElementById('qv-sizes')?.style.display !== 'none';
        let selectedSizeBtn = document.querySelector('#quick-view-modal .size-option.selected');

        if (hasSizes && !selectedSizeBtn) {
            showNotification('Please select a size before adding to cart', 'error');
            return;
        }

        // Use selected size (may be null if no sizes required)
        if (!selectedSizeBtn) selectedSizeBtn = document.querySelector('#quick-view-modal .size-option:not([disabled])');
        const selectedSize = selectedSizeBtn?.dataset.size || selectedSizeBtn?.textContent?.trim() || null;

        addToCart(currentQuickViewProduct.id, selectedSize);
        closeQuickView();
    }
});

// Buy Now: add to cart then go to checkout
document.getElementById('qv-buy-now')?.addEventListener('click', async () => {
    if (currentQuickViewProduct && !currentQuickViewProduct.is_locked && currentQuickViewProduct.stock_quantity > 0) {
        // If sizes are shown, require a selection
        const sizesContainer = document.querySelector('#qv-sizes .size-options');
        const hasSizes = sizesContainer && sizesContainer.children.length > 0 && document.getElementById('qv-sizes')?.style.display !== 'none';
        let selectedSizeBtn = document.querySelector('#quick-view-modal .size-option.selected');

        if (hasSizes && !selectedSizeBtn) {
            showNotification('Please select a size before checkout', 'error');
            return;
        }

        if (!selectedSizeBtn) selectedSizeBtn = document.querySelector('#quick-view-modal .size-option:not([disabled])');
        const selectedSize = selectedSizeBtn?.dataset.size || selectedSizeBtn?.textContent?.trim() || null;

        try {
            await addToCart(currentQuickViewProduct.id, selectedSize);
            setTimeout(() => {
                closeQuickView();
                window.location.href = 'checkout.html';
            }, 150);
        } catch (e) {
            console.error('Buy now failed:', e);
        }
    }
});

// Attach Quick View to all quick view buttons
function attachQuickViewHandlers() {
    document.querySelectorAll('.quick-view-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const productCard = btn.closest('.product-card');
            
            // Try to get product ID from data attribute
            const productId = btn.dataset.productId || productCard?.dataset.productId;
            
            // Try Supabase first if available
            if (productId && typeof window.getSupabase === 'function') {
                try {
                    const supabase = window.getSupabase();
                    const { data: product, error } = await supabase
                        .from('products')
                        .select(`
                            *,
                            product_images (
                                storage_path,
                                alt
                            ),
                            inventory (
                                stock,
                                size
                            )
                        `)
                        .eq('id', productId)
                        .eq('is_active', true)
                        .is('deleted_at', null)
                        .single();
                    
                    if (product && !error) {
                        if (product.is_locked || (product.status && String(product.status).toLowerCase() !== 'available')) {
                            showNotification('This product is currently unavailable', 'error');
                            return;
                        }

                        const getProjectUrl = () => (
                            (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || window.SUPABASE_URL || 'https://vorqavsuqcjnkjzwkyzr.supabase.co'
                        );

                        // Helper function to convert storage path to public URL
                        const getImageUrl = (storagePath) => {
                            if (!storagePath) return 'images/placeholder.jpg';
                            const projectUrl = getProjectUrl().replace(/\/$/, '');
                            const storagePrefix = `${projectUrl}/storage`;
                            if (typeof storagePath === 'string' && storagePath.startsWith(storagePrefix)) return storagePath;
                            if (typeof storagePath === 'string' && storagePath.startsWith('http')) return storagePath;
                            if (typeof storagePath === 'string' && (storagePath.includes('.jpg') || storagePath.includes('.png') || storagePath.includes('.jpeg') || storagePath.includes('.gif') || storagePath.includes('.webp'))) {
                                return `images/${storagePath.toLowerCase()}`;
                            }
                            return `${projectUrl}/storage/v1/object/public/Images/${storagePath}`;
                        };
                        
                        // Process product with proper image URL and inventory
                        const processedProduct = {
                            ...product,
                            image_url: getImageUrl(product.product_images?.[0]?.storage_path) || 'images/placeholder.jpg',
                            stock_quantity: (product.inventory || []).reduce((sum, inv) => sum + (inv.stock || 0), 0),
                            price: (product.price_cents / 100).toFixed(2)
                        };
                        
                        openQuickView(processedProduct);
                        return;
                    }
                } catch (error) {
                    console.log('Supabase not available, using fallback data');
                }
            }
            
            // Fallback: Extract data from card
            const badgeText = (productCard?.querySelector('.product-badge')?.textContent || '').toLowerCase();
            const productData = {
                id: productId || Date.now(),
                name: productCard?.querySelector('.product-name, h3')?.textContent || 'Product',
                price: parseInt(productCard?.querySelector('.product-price, .price')?.textContent?.replace(/[^\d]/g, '') || '0'),
                image: productCard?.querySelector('img')?.src || 'images/placeholder.png',
                image_url: productCard?.querySelector('img')?.src || 'images/placeholder.png',
                category: productCard?.querySelector('.product-category')?.textContent || 'Sneakers',
                description: productCard?.querySelector('.product-description')?.textContent || 'Premium quality sneakers with exceptional comfort and style.',
                stock_quantity: badgeText.includes('out of stock') ? 0 : (badgeText.includes('low stock') ? 5 : 50),
                is_locked: badgeText.includes('locked') || badgeText.includes('unavailable')
            };
            
            openQuickView(productData);
        });
    });
}

// Initialize Quick View on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachQuickViewHandlers);
} else {
    attachQuickViewHandlers();
}

// Make Quick View functions globally available
window.openQuickView = openQuickView;
window.closeQuickView = closeQuickView;
window.attachQuickViewHandlers = attachQuickViewHandlers;

// ===================================
// FOOTER LOGIN BUTTONS
// ===================================
const FOOTER_LOGIN_EXCLUSIONS = new Set([
    'admin.html',
    'admin-login.html',
    'login.html',
    'register.html',
    'forgot-password.html',
    'update-password.html',
    'auth-callback.html',
    'auth-test.html'
]);

function injectFooterLoginButtons() {
    const pathName = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (FOOTER_LOGIN_EXCLUSIONS.has(pathName)) {
        return;
    }

    const footer = document.querySelector('.footer');
    if (!footer) {
        return;
    }

    // Secret admin access: triple-click (or triple-tap) the copyright text
    // to navigate to admin login. No visible buttons for customers.
    const footerBottom = footer.querySelector('.footer-bottom');
    if (!footerBottom) return;

    const copyrightEl = footerBottom.querySelector('p');
    if (!copyrightEl || copyrightEl.dataset.adminBound) return;
    copyrightEl.dataset.adminBound = 'true';

    let tapCount = 0;
    let tapTimer = null;

    copyrightEl.addEventListener('click', function () {
        tapCount++;
        if (tapTimer) clearTimeout(tapTimer);
        tapTimer = setTimeout(function () { tapCount = 0; }, 800);
        if (tapCount >= 3) {
            tapCount = 0;
            window.location.href = 'admin-login.html';
        }
    });
    // Keep cursor default so it doesn't hint at interactivity
    copyrightEl.style.cursor = 'default';
    copyrightEl.style.userSelect = 'none';
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooterLoginButtons);
} else {
    injectFooterLoginButtons();
}

function bindClearCacheButton() {
    const btn = document.getElementById('clearCacheBtn');
    if (!btn || btn.dataset.bound === 'true') {
        return;
    }

    btn.dataset.bound = 'true';
    btn.addEventListener('click', (event) => {
        event.preventDefault();
        if (window.CacheBuster && typeof window.CacheBuster.forceReload === 'function') {
            alert('🧹 Clearing cache and reloading...');
            window.CacheBuster.forceReload();
        } else {
            window.location.reload();
        }
    });
}

// --- Animations loader: loads lightweight animations.js which auto-applies data-animate attributes
(function () {
    function loadAnimationsScript() {
        try {
            const s = document.createElement('script');
            s.src = 'js/animations.js';
            s.defer = true;
            document.head.appendChild(s);
        } catch (e) {
            // ignore
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAnimationsScript);
    } else {
        loadAnimationsScript();
    }
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindClearCacheButton);
} else {
    bindClearCacheButton();
}

// Export functions for use by other modules
window.loadCartFromDatabase = loadCartFromDatabase;
window.updateCartCount = function() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const el = document.getElementById('cart-count');
    if (el) el.textContent = totalItems;
};
