(() => {
    const DEFAULT_STATS = {
        happyCustomers: 5200,
        satisfactionRate: 98,
        productModels: 18,
        countriesServed: 25
    };

    const STAT_TARGETS = {
        'happy-customers': { key: 'happyCustomers', suffix: '+' },
        'satisfaction-rate': { key: 'satisfactionRate', suffix: '%' },
        'product-models': { key: 'productModels', suffix: '' },
        'countries-served': { key: 'countriesServed', suffix: '+' }
    };

    let statsLoaded = false;

    const parseShippingAddress = (rawPayload) => {
        if (!rawPayload) return null;
        if (typeof rawPayload === 'object') return rawPayload;
        try {
            return JSON.parse(rawPayload);
        } catch (error) {
            console.warn('Unable to parse shipping_address', error);
            return null;
        }
    };

    const normalizeCount = (value, fallback) => (typeof value === 'number' ? Math.max(0, Math.round(value)) : fallback);

    const animateCounter = (elementId, target, suffix = '') => {
        const element = document.getElementById(elementId);
        if (!element) return;

        const sanitizedTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
        const duration = 2000;
        const frames = Math.max(10, duration / 16);
        const increment = sanitizedTarget / frames;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= sanitizedTarget) {
                current = sanitizedTarget;
                clearInterval(timer);
            }
            element.textContent = `${Math.floor(current).toLocaleString()}${suffix}`;
        }, 16);
    };

    const fetchStats = async () => {
        const supabase = window.getSupabase?.();
        if (!supabase) {
            return null;
        }

        try {
            const [ordersResult, productsResult, reviewsTotal, reviewsPositive, shippingResult] = await Promise.all([
                supabase.from('orders').select('id', { count: 'exact', head: true }),
                supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
                    .eq('is_active', true)
                    .is('deleted_at', null),
                supabase.from('reviews').select('id', { count: 'exact', head: true }),
                supabase.from('reviews').select('id', { count: 'exact', head: true }).gte('rating', 4),
                supabase
                    .from('orders')
                    .select('shipping_address')
                    .not('shipping_address', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(500)
            ]);

            const uniqueCountries = new Set();
            (shippingResult?.data || []).forEach((row) => {
                const address = parseShippingAddress(row?.shipping_address);
                const rawCountry = address?.country || address?.countryCode || address?.country_code;
                if (rawCountry) {
                    uniqueCountries.add(String(rawCountry).trim());
                }
            });

            const totalReviewCount = reviewsTotal?.count ?? 0;
            const positiveReviewCount = reviewsPositive?.count ?? 0;
            const satisfactionRate = totalReviewCount > 0
                ? Math.min(100, Math.round((positiveReviewCount / totalReviewCount) * 100))
                : DEFAULT_STATS.satisfactionRate;

            return {
                happyCustomers: normalizeCount(ordersResult?.count, DEFAULT_STATS.happyCustomers),
                productModels: normalizeCount(productsResult?.count, DEFAULT_STATS.productModels),
                satisfactionRate,
                countriesServed: uniqueCountries.size > 0 ? uniqueCountries.size : DEFAULT_STATS.countriesServed
            };
        } catch (error) {
            console.error('About page: failed to load stats', error);
            return null;
        }
    };

    const loadStats = async () => {
        const data = await fetchStats();
        const metrics = { ...DEFAULT_STATS, ...(data || {}) };

        Object.entries(STAT_TARGETS).forEach(([elementId, meta]) => {
            const target = metrics[meta.key] ?? DEFAULT_STATS[meta.key] ?? 0;
            animateCounter(elementId, target, meta.suffix);
        });
    };

    const observeStatsSection = () => {
        const statsSection = document.querySelector('.stats-section');
        if (!statsSection) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && !statsLoaded) {
                    statsLoaded = true;
                    loadStats();
                    observer.disconnect();
                }
            });
        }, { threshold: 0.5 });

        observer.observe(statsSection);
    };

    const setupSurveyModal = () => {
        const modal = document.getElementById('surveyModal');
        const form = document.getElementById('surveyForm');
        const thankYou = document.getElementById('thankYouMessage');

        const showModal = () => {
            if (modal) {
                modal.style.display = 'block';
            }
            if (form) {
                form.style.display = 'block';
                form.reset();
            }
            if (thankYou) {
                thankYou.style.display = 'none';
            }
        };

        const hideModal = () => {
            if (modal) {
                modal.style.display = 'none';
            }
            if (form) {
                form.style.display = 'block';
            }
        };

        window.openSurvey = () => showModal();
        window.closeSurvey = () => hideModal();

        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                hideModal();
            }
        });

        form?.addEventListener('submit', (event) => {
            event.preventDefault();
            if (form) {
                form.style.display = 'none';
            }
            if (thankYou) {
                thankYou.style.display = 'block';
            }
            setTimeout(() => hideModal(), 3000);
        });
    };

    document.addEventListener('DOMContentLoaded', () => {
        observeStatsSection();
        setupSurveyModal();
    });
})();
