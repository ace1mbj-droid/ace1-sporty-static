# Website Cleanup & Audit Report
**Date:** December 4, 2025
**Project:** ACE#1 Sporty Static Website

## 📊 Project Overview
- **Total Size:** 5.1 MB
- **HTML Files:** 30 (mix of production and test files)
- **JS Files:** 36
- **CSS Files:** Multiple

---

## 🗑️ UNNECESSARY/TEST FILES TO REMOVE

### Test & Debug HTML Files (in `/docs/tests/manual/`)
These are testing pages that shouldn't be in production:
- ❌ `docs/tests/manual/test-sql-injection.html`
- ❌ `docs/tests/manual/test-security-performance.html`
- ❌ `docs/tests/manual/debug-cart.html`
- ❌ `docs/tests/manual/hash-generator.html`
- ❌ `docs/tests/manual/test-database.html`
- ❌ `docs/tests/manual/test-social-login.html`
- ❌ `docs/tests/manual/test-stock.html`
- ❌ `docs/tests/manual/test-supabase.html`

### Unused HTML Pages (Not linked in navbar or navigation)
- ❌ `admin-password-migration.html` - Outdated password migration tool
- ❌ `security-validation.html` - Test/validation page
- ❌ `fix-column.html` - Database migration test file
- ❌ `update-password.html` - Duplicate/unused password page

### Unused JS Files
- ❌ `js/api.js` - Not imported in any main pages
- ❌ `js/stats.js` - Not imported anywhere
- ❌ `js/admin-supabase-config.js` - Duplicate config file
- ❌ `js/oauth-redirect.js` - Not being used

### Unused Configuration Files
- ❌ `security-headers-config.txt` - Text file with no function
- ❌ `security-validation.html` - Test file
- ❌ `vercel.json` - If not using Vercel, can remove
- ❌ `.vercel/` - Directory can be removed if not using Vercel

### Unused Documentation Files
- ❌ `DEPLOYMENT-CHECKLIST.txt` - Can be moved to /docs
- ❌ `FTP-UPLOAD-CHECKLIST.txt` - Can be moved to /docs
- ❌ `SERVER_TEST_REPORT.md` - Test file
- ❌ `SUPABASE_QUICK_REFERENCE.txt` - Can be organized in /docs
- ❌ `START_HERE.txt` - Move to /docs
- ❌ `add-image-optimizer.sh` - Old setup script
- ❌ `add-security-to-html.sh` - Old setup script
- ❌ `setup-supabase.sh` - Old setup script
- ❌ `test_server.sh` - Old test script
- ❌ `test_server_v2.sh` - Old test script
- ❌ `load-test.py` - Old load testing script
- ❌ `scripts/` - May contain old setup/test scripts

---

## ✅ PRODUCTION-READY FILES TO KEEP

### Core HTML Pages
- ✅ `index.html` - Homepage
- ✅ `products.html` - Products listing
- ✅ `admin.html` - Admin dashboard
- ✅ `login.html` - User login
- ✅ `register.html` - User registration
- ✅ `checkout.html` - Checkout flow
- ✅ `user-profile.html` - User profile
- ✅ `order-confirmation.html` - Order confirmation
- ✅ `contact.html` - Contact form
- ✅ `about.html` - About page
- ✅ `faq.html` - FAQ page
- ✅ `privacy-policy.html` - Privacy policy
- ✅ `size-guide.html` - Size guide
- ✅ `technology.html` - Technology info
- ✅ `forgot-password.html` - Password reset
- ✅ `auth-callback.html` - OAuth callback
- ✅ `data-deletion.html` - GDPR data deletion
- ✅ `admin-login.html` - Admin login

### Core JS Files (In Use)
- ✅ `js/cache-buster.js` - Cache management
- ✅ `js/supabase-config.js` - DB configuration
- ✅ `js/database-auth.js` - Authentication
- ✅ `js/supabase-service.js` - DB service layer
- ✅ `js/security.js` - Security utilities
- ✅ `js/password-hasher.js` - Password hashing
- ✅ `js/password-manager.js` - Password management
- ✅ `js/hcaptcha-config.js` - CAPTCHA config
- ✅ `js/hcaptcha-manager.js` - CAPTCHA management
- ✅ `js/bot-defense.js` - Bot protection
- ✅ `js/main.js` - Main app logic
- ✅ `js/products.js` - Products page logic
- ✅ `js/admin.js` - Admin dashboard logic
- ✅ `js/ecommerce-backend.js` - Backend API layer
- ✅ `js/image-manager.js` - Image handling
- ✅ `js/image-optimizer.js` - Image optimization
- ✅ `js/reviews.js` - Reviews functionality
- ✅ `js/reviews-manager.js` - Reviews management
- ✅ `js/checkout.js` - Checkout logic
- ✅ `js/contact.js` - Contact form
- ✅ `js/auth.js` - Authentication helpers
- ✅ `js/razorpay-config.js` - Payment config
- ✅ `js/user-profile.js` - User profile logic

### Core CSS Files
- ✅ `css/style.css` - Main styles
- ✅ `css/image-manager.css` - Image UI styles
- ✅ `css/password-manager.css` - Password UI styles
- ✅ `css/reviews.css` - Reviews styles

### Images & Assets
- ✅ `images/` - Product images
- ✅ `supabase/` - Supabase migrations/config

---

## 🔧 CLEANUP ACTIONS NEEDED

### 1. Remove Test/Debug Files
```bash
# Remove test HTML files
rm -rf docs/tests/manual/*.html
rm admin-password-migration.html
rm security-validation.html
rm fix-column.html
rm update-password.html

# Remove unused JS files
rm js/api.js
rm js/stats.js
rm js/admin-supabase-config.js
rm js/oauth-redirect.js
```

### 2. Remove Old Scripts & Setup Files
```bash
rm add-image-optimizer.sh
rm add-security-to-html.sh
rm setup-supabase.sh
rm test_server.sh
rm test_server_v2.sh
rm load-test.py
rm -rf scripts/
```

### 3. Remove Unnecessary Config Files
```bash
rm security-headers-config.txt
rm -rf .vercel/  (if not using Vercel)
```

### 4. Reorganize Documentation
Move to `/docs/` folder:
- DEPLOYMENT-CHECKLIST.txt
- FTP-UPLOAD-CHECKLIST.txt
- SUPABASE_QUICK_REFERENCE.txt
- START_HERE.txt
- SERVER_TEST_REPORT.md

---

## 📋 Code Quality Checks

### Issues Found
1. **Duplicate database auth** - `database-auth.js` and `admin-supabase-config.js` - REMOVE `admin-supabase-config.js`
2. **Unused API file** - `js/api.js` - REMOVE
3. **Stats file unused** - `js/stats.js` - REMOVE
4. **OAuth redirect unused** - `js/oauth-redirect.js` - REMOVE (or check if used)

### Files to Review
- ✅ No major code quality issues found
- ✅ All main JS files are properly imported
- ✅ CSS files are organized and used

---

## 🚀 Recommended Project Structure After Cleanup

```
ace1-sporty-static/
├── index.html
├── products.html
├── admin.html
├── login.html
├── register.html
├── checkout.html
├── user-profile.html
├── order-confirmation.html
├── contact.html
├── about.html
├── faq.html
├── privacy-policy.html
├── size-guide.html
├── technology.html
├── forgot-password.html
├── auth-callback.html
├── data-deletion.html
├── admin-login.html
├── css/
│   ├── style.css
│   ├── image-manager.css
│   ├── password-manager.css
│   └── reviews.css
├── js/
│   ├── cache-buster.js
│   ├── supabase-config.js
│   ├── database-auth.js
│   ├── supabase-service.js
│   ├── security.js
│   ├── password-hasher.js
│   ├── password-manager.js
│   ├── hcaptcha-config.js
│   ├── hcaptcha-manager.js
│   ├── bot-defense.js
│   ├── main.js
│   ├── products.js
│   ├── admin.js
│   ├── ecommerce-backend.js
│   ├── image-manager.js
│   ├── image-optimizer.js
│   ├── reviews.js
│   ├── reviews-manager.js
│   ├── checkout.js
│   ├── contact.js
│   ├── auth.js
│   ├── razorpay-config.js
│   └── user-profile.js
├── images/
│   └── placeholder.jpg
├── supabase/
│   └── [migrations]
├── docs/
│   ├── DEPLOYMENT-CHECKLIST.txt
│   ├── FTP-UPLOAD-CHECKLIST.txt
│   ├── SUPABASE_QUICK_REFERENCE.txt
│   ├── START_HERE.txt
│   └── SERVER_TEST_REPORT.md
├── .git/
├── .gitignore
├── README.md
└── package.json (if using Node.js)
```

---

## 📊 Cleanup Results
**Before:** 30 HTML files, 36 JS files, 5.1 MB total
**After:** ~18 HTML files, ~23 JS files, ~3.5 MB estimated

**Files to Remove:** 12+ HTML files, 4+ JS files, 10+ script/config files

---

## ⚠️ Important Notes
1. **Backup first** - Commit current state before cleanup
2. **Test thoroughly** - After removing files, test all main pages
3. **Check imports** - Verify no remaining files import removed files
4. **Update .gitignore** - If applicable
5. **Document changes** - Update README with current file structure

