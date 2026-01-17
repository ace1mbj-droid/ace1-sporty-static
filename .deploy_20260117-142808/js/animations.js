(function () {
  function applyDefaults() {
    const selectors = [
      'main .container',
      '.product-card',
      '.product-list > *',
      '.hero',
      '.feature',
      '.nav-container',
      'footer .container',
      '.cta',
      '.card',
      '.shop-main'
    ];

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.hasAttribute('data-animate')) el.setAttribute('data-animate', 'fade-up');
        if (!el.classList.contains('stagger') && el.children.length > 2 && el.querySelectorAll(':scope > *').length > 1) {
          // make it staggered if it has multiple direct children
          el.classList.add('stagger');
        }
        // add subtle button hover class
        const btns = el.querySelectorAll('button, .btn, .cta-button, a.button');
        btns.forEach(b => b.classList.add('button-animated'));
      });
    });
  }

  // Persistent observer used for dynamically added elements
  let obs = null;
  function initObserver() {
    // Respect user preference for reduced motion — if set, do nothing
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (obs) return; // already initialized

    obs = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        const el = entry.target;
        if (entry.intersectionRatio > 0.08) {
          const anim = el.getAttribute('data-animate') || 'fade-up';
          el.classList.add('in');
          if (!el.classList.contains(anim)) el.classList.add(anim);
          // for containers that want stagger children
          if (el.classList.contains('stagger')) {
            el.classList.add('in');
            Array.from(el.children).forEach((child, i) => {
              const delay = i * (parseInt(getComputedStyle(el).getPropertyValue('--anim-stagger-step')) || 60);
              setTimeout(() => child.classList.add('in'), delay);
            });
          }
          // optionally unobserve if we don't want repeated animations
          observer.unobserve(el);
        }
      });
    }, { threshold: [0.08] });

    document.querySelectorAll('[data-animate]').forEach(el => {
      if (!el.hasAttribute('data-animate-observed')) {
        obs.observe(el);
        el.setAttribute('data-animate-observed', '1');
      }
    });
  }

  function initAnimations() {
    try {
      // Skip applying and observing if user prefers reduced motion
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      applyDefaults();
      initObserver();

      // Listen for dynamic product renders and apply to new elements
      document.addEventListener('ace1:products-rendered', () => {
        try {
          applyDefaults();
          if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            initObserver();
            // Observe newly added elements
            document.querySelectorAll('[data-animate]:not([data-animate-observed])').forEach(el => {
              if (typeof obs !== 'undefined' && obs) {
                obs.observe(el);
                el.setAttribute('data-animate-observed','1');
              }
            });
          }
        } catch (e) { console.error('Products render animation hook failed:', e); }
      });
    } catch (e) {
      console.error('Animations init failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimations);
  } else {
    initAnimations();
  }
})();
