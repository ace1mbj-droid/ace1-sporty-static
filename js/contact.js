// Contact form handling
const contactForm = document.getElementById('contact-form');

contactForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    
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
    }, 1000);
});
