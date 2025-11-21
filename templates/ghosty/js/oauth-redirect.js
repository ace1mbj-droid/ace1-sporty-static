// OAuth Redirect Handler
// Add this script to login.html to ensure OAuth redirects work

(async function() {
    // Wait for Supabase to load
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max
    
    const checkAndRedirect = async () => {
        attempts++;
        
        // Check if Supabase is loaded
        if (!window.getSupabase) {
            if (attempts < maxAttempts) {
                setTimeout(checkAndRedirect, 100);
            }
            return;
        }
        
        try {
            const supabase = window.getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            
            // If user has active Supabase session on login page, redirect
            if (session && session.user) {
                console.log('✅ Active OAuth session detected, redirecting...');
                
                // Get redirect parameter from URL
                const urlParams = new URLSearchParams(window.location.search);
                const redirect = urlParams.get('redirect') || 'user-profile.html';
                
                // Show message
                const message = document.createElement('div');
                message.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #28a745; color: white; padding: 15px 30px; border-radius: 8px; z-index: 10000; font-family: Arial; box-shadow: 0 4px 12px rgba(0,0,0,0.2);';
                message.textContent = '✅ Login successful! Redirecting...';
                document.body.appendChild(message);
                
                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = redirect;
                }, 800);
            }
        } catch (error) {
            console.error('OAuth check error:', error);
        }
    };
    
    // Start checking
    checkAndRedirect();
})();
