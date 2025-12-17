(function () {
    const DEFAULT_ENDPOINT = (typeof window.HCAPTCHA_VERIFY_ENDPOINT === 'string' && window.HCAPTCHA_VERIFY_ENDPOINT.trim().length > 0)
        ? window.HCAPTCHA_VERIFY_ENDPOINT.trim()
        : (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url
            ? `${SUPABASE_CONFIG.url}/functions/v1/verify-hcaptcha`
            : '');

    async function verifyHCaptchaWithServer(token, context = {}) {
        // TEMPORARY: Skip verification if hCaptcha is disabled
        if (window.HCAPTCHA_DISABLED) {
            console.warn('⚠️ hCaptcha verification SKIPPED (disabled)');
            return { success: true, details: { disabled: true } };
        }
        
        if (!token) {
            return { success: false, error: 'Missing verification token.' };
        }

        const endpoint = context.endpoint || DEFAULT_ENDPOINT;
        if (!endpoint) {
            console.warn('hCaptcha verification endpoint is not configured');
            return { success: false, error: 'Verification service unavailable. Please try again later.' };
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    token,
                    action: context.action || 'general'
                })
            });

            const data = await response.json();
            if (!response.ok || !data?.success) {
                const message = data?.error || 'Verification failed. Please retry the challenge.';
                return { success: false, error: message, details: data };
            }

            return { success: true, details: data };
        } catch (error) {
            console.error('hCaptcha verification request failed', error);
            return { success: false, error: 'Verification service unreachable. Please try again.' };
        }
    }

    window.verifyHCaptchaWithServer = verifyHCaptchaWithServer;
})();
