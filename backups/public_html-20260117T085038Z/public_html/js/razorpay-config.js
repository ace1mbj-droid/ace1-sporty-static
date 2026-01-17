// Razorpay Configuration
const RAZORPAY_CONFIG = {
    // Get your keys from https://dashboard.razorpay.com/app/keys
    // NOTE: KEY_ID is public and safe to expose in frontend
    KEY_ID: 'rzp_test_ReqQQAo6ZLgzcU', // Production key should be set via environment variable


    // Company details
    COMPANY_NAME: 'Ace#1',
    COMPANY_LOGO: window.location.origin + '/images/logo.png',
    
    // Theme
    THEME_COLOR: '#FF6B00'
};

// Make config globally available
window.RAZORPAY_CONFIG = RAZORPAY_CONFIG;
