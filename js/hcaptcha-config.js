// hCaptcha configuration
// Replace the placeholder site key with your production key from https://dashboard.hcaptcha.com/sites

window.HCAPTCHA_SITE_KEY = window.HCAPTCHA_SITE_KEY || 'edf8e53e-9be8-4c5a-8434-1eae72e636f2';
window.HCAPTCHA_THEME = window.HCAPTCHA_THEME || 'light';
window.HCAPTCHA_VERIFY_ENDPOINT = window.HCAPTCHA_VERIFY_ENDPOINT
	|| (typeof SUPABASE_CONFIG !== 'undefined' ? `${SUPABASE_CONFIG.url}/functions/v1/verify-hcaptcha` : '');
