// hCaptcha configuration
// Replace the placeholder site key with your production key from https://dashboard.hcaptcha.com/sites

window.HCAPTCHA_SITE_KEY = window.HCAPTCHA_SITE_KEY || '38929996-78b6-499c-95a6-3aacdaae0ec4';
window.HCAPTCHA_THEME = window.HCAPTCHA_THEME || 'light';
window.HCAPTCHA_VERIFY_ENDPOINT = window.HCAPTCHA_VERIFY_ENDPOINT
	|| (typeof SUPABASE_CONFIG !== 'undefined' ? `${SUPABASE_CONFIG.url}/functions/v1/verify-hcaptcha` : '');
