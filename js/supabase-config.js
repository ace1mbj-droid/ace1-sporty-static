// ===================================
// SUPABASE CONFIGURATION
// ===================================
// Configured on: December 3, 2025
const HOSTED_SUPABASE_URL = 'https://vorqavsuqcjnkjzwkyzr.supabase.co';

const SUPABASE_CONFIG = {
    url: HOSTED_SUPABASE_URL,
    // anonKey must not be hardcoded in source. Provide it at runtime via:
    // 1) window.SUPABASE_ANON_KEY = '<anon key>' (set by server-side injection), or
    // 2) <meta name="supabase-anon-key" content="<anon key>"> in the page head
    // If neither is present the client will still initialize but requests requiring anon key will log a warning.
    anonKey: (typeof window.SUPABASE_ANON_KEY !== 'undefined' && window.SUPABASE_ANON_KEY) ||
             (document.querySelector('meta[name="supabase-anon-key"]') && document.querySelector('meta[name="supabase-anon-key"]').getAttribute('content')) ||
             ''
};

function assertHostedSupabaseConfig() {
    try {
        const configured = new URL(SUPABASE_CONFIG.url);
        const expected = new URL(HOSTED_SUPABASE_URL);

        const invalidHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
        if (invalidHostnames.has(configured.hostname)) {
            throw new Error(`Refusing to run against local Supabase host: ${configured.hostname}`);
        }

        if (configured.origin !== expected.origin) {
            throw new Error(`SUPABASE_CONFIG.url must match hosted project: ${expected.origin}`);
        }

        if (!configured.hostname.endsWith('.supabase.co')) {
            throw new Error('SUPABASE_CONFIG.url must be a *.supabase.co URL');
        }

        return true;
    } catch (error) {
        console.error('❌ Invalid Supabase configuration (hosted-only mode).');
        console.error(`   Expected: ${HOSTED_SUPABASE_URL}`);
        console.error(`   Received: ${SUPABASE_CONFIG && SUPABASE_CONFIG.url}`);
        console.error('   Fix: update js/supabase-config.js to use the hosted project URL only.');
        throw error;
    }
}

// Keep a session token for admin use; attach it only to Supabase requests
// Token is set by databaseAuth when session is created
let sessionToken = null;

const sessionAwareFetch = async (input, init = {}) => {
    const headers = new Headers(init.headers || {});

    // Attach Authorization only for requests to the Supabase project URL
    try {
        const requestUrl = (typeof input === 'string') ? input : (input && input.url) || '';
        if (sessionToken && requestUrl.startsWith(SUPABASE_CONFIG.url)) {
            headers.set('Authorization', `Bearer ${sessionToken}`);
            // Ensure API key header is present for REST requests
            headers.set('apikey', SUPABASE_CONFIG.anonKey);
        }
    } catch (e) {
        // Ignore URL parsing issues and proceed without session header
    }

    return fetch(input, { ...init, headers });
};

// Initialize Supabase client
// Add this script tag to your HTML files: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
let supabaseClient = null;

function initSupabase() {
    assertHostedSupabaseConfig();

    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }
    
    if (!supabaseClient) {
        const { createClient } = window.supabase;

        if (!SUPABASE_CONFIG.anonKey) {
            console.warn('⚠️ Supabase anon key is not set at runtime. Set `window.SUPABASE_ANON_KEY` or a meta tag `supabase-anon-key` to enable public Supabase features.');
        }

        supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
            global: {
                fetch: sessionAwareFetch
            }
        });
        console.log('✅ Supabase initialized successfully');
    }
    
    return supabaseClient;
}

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});

// Export for use in other modules
window.getSupabase = () => {
    if (!supabaseClient) {
        return initSupabase();
    }
    return supabaseClient;
};

window.setSupabaseSessionToken = (token) => {
    if (token) {
        sessionToken = token;
    } else {
        sessionToken = null;
    }
};

// 2FA removed site-wide: no feature flag needed
