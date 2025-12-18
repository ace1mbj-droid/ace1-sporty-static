// ===================================
// SUPABASE CONFIGURATION
// ===================================
// Configured on: December 3, 2025
const SUPABASE_CONFIG = {
    url: 'https://vorqavsuqcjnkjzwkyzr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcnFhdnN1cWNqbmtqendreXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NTYwMTMsImV4cCI6MjA3OTIzMjAxM30.HhExWu9XMFm2CBhoZUnHyYI0D0-smScXb_pSzCGkMvI'
};

// Keep a session token for admin use; attach it only to Supabase requests
let sessionToken = null;
const storedToken = (() => {
    try {
        return localStorage.getItem('ace1_token');
    } catch (error) {
        return null;
    }
})();

if (storedToken) {
    sessionToken = storedToken;
}

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
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }
    
    if (!supabaseClient) {
        const { createClient } = window.supabase;
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
