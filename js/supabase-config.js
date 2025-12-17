// ===================================
// SUPABASE CONFIGURATION
// ===================================
// Configured on: December 3, 2025
const SUPABASE_CONFIG = {
    url: 'https://vorqavsuqcjnkjzwkyzr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcnFhdnN1cWNqbmtqendreXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NTYwMTMsImV4cCI6MjA3OTIzMjAxM30.HhExWu9XMFm2CBhoZUnHyYI0D0-smScXb_pSzCGkMvI'
};

// Session-aware headers passed to every Supabase request (used for custom admin auth)
const sessionHeaders = {};

const storedToken = (() => {
    try {
        return localStorage.getItem('ace1_token');
    } catch (error) {
        return null;
    }
})();

if (storedToken) {
    sessionHeaders['ace1-session'] = storedToken;
}

const sessionAwareFetch = async (input, init = {}) => {
    const headers = new Headers(init.headers || {});
    Object.entries(sessionHeaders).forEach(([key, value]) => {
        if (value) {
            headers.set(key, value);
        } else {
            headers.delete(key);
        }
    });
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
        sessionHeaders['ace1-session'] = token;
    } else {
        delete sessionHeaders['ace1-session'];
    }
};
