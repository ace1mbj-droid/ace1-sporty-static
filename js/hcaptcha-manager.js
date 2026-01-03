// TEMPORARY: Disable hCaptcha for development/testing
// Set to false to re-enable hCaptcha validation
window.HCAPTCHA_DISABLED = true;

class HCaptchaManager {
    constructor() {
        // Skip initialization if disabled
        if (window.HCAPTCHA_DISABLED) {
            // Intentionally disabled in this environment; avoid emitting warnings on public pages.
            console.log('hCaptcha is temporarily disabled');
            return;
        }
        
        this.siteKey = window.HCAPTCHA_SITE_KEY;
        this.theme = window.HCAPTCHA_THEME || 'light';
        this.widgetMap = new Map();
        this.scriptPromise = null;

        if (!this.siteKey) {
            // Configuration issue; don't warn on public pages.
            console.log('hCaptcha site key missing. Set window.HCAPTCHA_SITE_KEY before loading hcaptcha-manager.js');
            return;
        }

        document.addEventListener('DOMContentLoaded', () => {
            this.attachToMarkedForms();
        });
    }

    async attachToMarkedForms() {
        const forms = document.querySelectorAll('form[data-requires-hcaptcha="true"]');
        if (!forms.length || !this.siteKey) {
            return;
        }

        const hcaptcha = await this.loadScript();
        if (!hcaptcha) {
            console.error('Unable to load hCaptcha script');
            return;
        }

        forms.forEach(form => this.attachToForm(form));
    }

    async loadScript() {
        if (window.hcaptcha) {
            return window.hcaptcha;
        }

        if (!this.scriptPromise) {
            this.scriptPromise = new Promise((resolve, reject) => {
                const existing = document.querySelector('script[data-hcaptcha-loader="true"]');
                if (existing) {
                    existing.addEventListener('load', () => resolve(window.hcaptcha));
                    existing.addEventListener('error', reject);
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
                script.async = true;
                script.defer = true;
                script.setAttribute('data-hcaptcha-loader', 'true');
                script.onload = () => resolve(window.hcaptcha);
                script.onerror = reject;
                document.head.appendChild(script);
            }).catch(err => {
                console.error('hCaptcha script failed to load:', err);
                return null;
            });
        }

        return this.scriptPromise;
    }

    attachToForm(form) {
        if (this.widgetMap.has(form)) {
            return;
        }

        let placeholder = form.querySelector('[data-hcaptcha-placeholder]');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.dataset.hcaptchaPlaceholder = 'true';
            placeholder.className = 'captcha-container';
            const submitButton = form.querySelector('[data-hcaptcha-insert-before]') || form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.parentNode.insertBefore(placeholder, submitButton);
            } else {
                form.appendChild(placeholder);
            }
        }

        const errorMessage = form.dataset.hcaptchaError || 'Please verify that you are human before continuing.';

        const widgetId = window.hcaptcha.render(placeholder, {
            sitekey: this.siteKey,
            theme: form.dataset.hcaptchaTheme || this.theme,
            size: form.dataset.hcaptchaSize || 'normal',
            callback: token => this.syncToken(form, token),
            'expired-callback': () => this.syncToken(form, ''),
            'error-callback': () => this.syncToken(form, '')
        });

        this.widgetMap.set(form, widgetId);

        form.addEventListener('submit', (event) => {
            const token = window.hcaptcha.getResponse(widgetId);
            if (!token) {
                event.preventDefault();
                event.stopPropagation();
                this.notify(errorMessage);
            } else {
                this.syncToken(form, token);
            }
        }, true);
    }

    syncToken(form, token) {
        let input = form.querySelector('input[name="hcaptcha_token"]');
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'hcaptcha_token';
            form.appendChild(input);
        }
        input.value = token || '';
    }

    reset(form) {
        const widgetId = this.widgetMap.get(form);
        if (typeof widgetId !== 'undefined') {
            window.hcaptcha.reset(widgetId);
            this.syncToken(form, '');
        }
    }

    getToken(form) {
        return form?.querySelector('input[name="hcaptcha_token"]')?.value?.trim() || '';
    }

    requireToken(form) {
        if (!form?.dataset?.requiresHcaptcha) {
            return '';
        }

        const token = this.getToken(form);
        if (!token) {
            const message = form?.dataset?.hcaptchaError || 'Please complete the verification challenge.';
            this.notify(message);
            return null;
        }

        return token;
    }

    notify(message) {
        if (window.showNotification) {
            window.showNotification(message, 'warning');
        } else {
            alert(message);
        }
    }
}

window.HCaptchaManager = HCaptchaManager;
window.hcaptchaManager = new HCaptchaManager();

function fallbackRequireToken(form) {
    if (!form?.dataset?.requiresHcaptcha) {
        return '';
    }

    const token = form?.querySelector('input[name="hcaptcha_token"]')?.value?.trim() || '';
    if (!token) {
        const message = form?.dataset?.hcaptchaError || 'Please complete the verification challenge.';
        if (window.showNotification) {
            window.showNotification(message, 'warning');
        } else {
            alert(message);
        }
        return null;
    }

    return token;
}

function fallbackReset(form) {
    if (!form) {
        return;
    }
    const input = form.querySelector('input[name="hcaptcha_token"]');
    if (input) {
        input.value = '';
    }
}

window.requireHCaptchaToken = function requireHCaptchaToken(form) {
    // TEMPORARY: Skip validation if disabled
    if (window.HCAPTCHA_DISABLED) {
        return ''; // Return empty string (valid token) when disabled
    }
    
    if (window.hcaptchaManager?.requireToken) {
        return window.hcaptchaManager.requireToken(form);
    }
    return fallbackRequireToken(form);
};

window.resetHCaptchaToken = function resetHCaptchaToken(form) {
    // TEMPORARY: Skip reset if disabled
    if (window.HCAPTCHA_DISABLED) {
        return;
    }
    
    if (window.hcaptchaManager?.reset) {
        window.hcaptchaManager.reset(form);
        return;
    }
    fallbackReset(form);
};
