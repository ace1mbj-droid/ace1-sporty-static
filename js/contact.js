// Contact form handling
const contactForm = document.getElementById('contact-form');

contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const captchaToken = typeof window.requireHCaptchaToken === 'function'
        ? window.requireHCaptchaToken(contactForm)
        : '';

    if (captchaToken === null) {
        return;
    }

    if (typeof window.verifyHCaptchaWithServer === 'function' && captchaToken) {
        const verification = await window.verifyHCaptchaWithServer(captchaToken, { action: 'contact' });
        if (!verification?.success) {
            const message = verification?.error || 'Verification failed. Please try again.';
            showNotification(message, 'error');
            if (typeof window.resetHCaptchaToken === 'function') {
                window.resetHCaptchaToken(contactForm);
            }
            return;
        }
    }
    
    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData);
    
    // Create email body
    const emailBody = `
Name: ${data.firstName} ${data.lastName}
Email: ${data.email}
Phone: ${data.phone || 'N/A'}
Subject: ${data.subject}

Message:
${data.message}
    `.trim();
    
    // Create mailto link
    const mailtoLink = `mailto:hello@ace1.in?subject=${encodeURIComponent(data.subject || 'Contact Form Submission')}&body=${encodeURIComponent(emailBody)}`;
    
    // Open email client
    window.location.href = mailtoLink;
    
    // Show success message
    showNotification('Opening your email client to send the message to hello@ace1.in');
    
    // Reset form after a short delay
    setTimeout(() => {
        contactForm.reset();
        if (typeof window.resetHCaptchaToken === 'function') {
            window.resetHCaptchaToken(contactForm);
        }
    }, 1000);
});
