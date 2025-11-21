// ===================================
// ADMIN SUPABASE CONFIGURATION
// Uses service_role key for admin operations
// ===================================

const ADMIN_SUPABASE_CONFIG = {
    url: 'https://ivxjmxrphuplqpxntseb.supabase.co',
    // IMPORTANT: Service role key should be kept secure
    // In production, admin operations should go through a secure backend API
    serviceRoleKey: 'YOUR_SERVICE_ROLE_KEY_HERE' // Get this from Supabase Dashboard > Settings > API
};

let adminSupabase = null;

function getAdminSupabase() {
    // Check if user is actually admin
    const isAdmin = localStorage.getItem('ace1_admin') === 'true';
    const user = JSON.parse(localStorage.getItem('ace1_user') || '{}');
    
    if (!isAdmin || user.email !== 'admin@ace1.in') {
        console.error('Unauthorized: Admin access required');
        return null;
    }
    
    if (!adminSupabase && typeof window.supabase !== 'undefined') {
        const { createClient } = window.supabase;
        adminSupabase = createClient(
            ADMIN_SUPABASE_CONFIG.url,
            ADMIN_SUPABASE_CONFIG.serviceRoleKey
        );
        console.log('✅ Admin Supabase client initialized with service_role');
    }
    
    return adminSupabase;
}

// Make available globally for admin panel
window.getAdminSupabase = getAdminSupabase;
