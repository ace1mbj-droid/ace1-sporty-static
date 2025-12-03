// ===================================
// SUPABASE CONFIGURATION
// ===================================
// Configured on: December 3, 2025
const SUPABASE_CONFIG = {
    url: 'https://vorqavsuqcjnkjzwkyzr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcnFhdnN1cWNqbmtqendreXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE0MDk0NzMsImV4cCI6MjA0Njk4NTQ3M30.9E_wEHfFHLxpqqD0t4Y3mHNbOGDzQ3GNfYhNfwyqHdE'
};

// Initialize Supabase client
// Add this script tag to your HTML files: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
let supabase = null;

function initSupabase() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }
    
    if (!supabase) {
        const { createClient } = window.supabase;
        supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('✅ Supabase initialized successfully');
    }
    
    return supabase;
}

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});

// Export for use in other modules
window.getSupabase = () => {
    if (!supabase) {
        return initSupabase();
    }
    return supabase;
};
