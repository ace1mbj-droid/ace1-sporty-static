# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in the ACE#1 project, please report it responsibly to **hello@ace1.in** instead of using the public issue tracker.

### What to Include in Your Report

Please provide:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (if available)

### Response Timeline

We will acknowledge your report within **48 hours** and work to:
1. Verify the vulnerability
2. Develop and test a fix
3. Release a patched version
4. Credit the reporter (if desired)

## Security Best Practices

When using ACE#1, please follow these security practices:

### For Administrators
- Use strong, unique passwords for admin accounts
- Enable two-factor authentication where available
- Regularly review admin dashboard activity and security logs
- Keep sensitive information (API keys, credentials) in environment variables only
- Never commit secrets to version control

### For Users
- Use HTTPS when accessing the site (always enforced)
- Create strong, unique passwords
- Don't share your account credentials
- Report suspicious activity to the admin team

## Data Security

- **Database**: All data is securely stored in Supabase with proper authentication and authorization
- **File Storage**: Product images and uploads are stored in Supabase Storage with public read access (configurable)
- **Authentication**: Supabase Auth with email-based authentication
- **Encryption**: All connections use HTTPS (TLS/SSL)

### Remote-first policy (important)

- We do NOT store backend runtime data (database dumps, credentials, or live session tokens) in the local repository or on developer machines. Use the remote Supabase project for all production/testing data.
- Temporary CLI artifacts or cached files (for example in any `supabase/.temp` directories) should not be kept in source control — they are ignored and should be removed from local workspace when no longer required.
- Secrets (service_role keys, API keys, payment secrets) must only be stored in secure environment variables (CI secrets or server envs) and never committed.

Following this policy keeps the codebase portable, avoids accidental exposure of production data, and ensures the canonical deployment is through GitHub + Supabase (DB) + FTP (static front end).

## Code Security

This project implements:
- Input validation and sanitization (DOMPurify)
- XSS protection via Content Security Policy
- Password hashing for admin operations
- SQL injection prevention through parameterized queries
- CSRF protection through Supabase auth tokens

## Dependencies

We regularly monitor our dependencies for security vulnerabilities:
- Supabase SDK updates are monitored
- Third-party libraries are kept up-to-date
- Security patches are applied promptly

## Compliance

This project follows security best practices for:
- User data protection
- Payment processing (PCI compliance for checkout)
- Privacy regulations (GDPR-compliant data handling)

## Security Notices

Current security status: ✅ **No known vulnerabilities**

## Contact

For security-related questions or concerns, please contact: **hello@ace1.in**

---

Last Updated: December 4, 2025
