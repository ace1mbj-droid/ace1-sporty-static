# Complete localStorage/sessionStorage Audit

## Summary by Data Type

### 🔵 AUTHENTICATION & SESSION (Must keep some, but should optimize)

| Key | Used In | Purpose | Status | Notes |
|-----|---------|---------|--------|-------|
| `ace1_token` | `js/database-auth.js`, `js/admin.js`, `admin-login.html` | JWT session token | ✅ REQUIRED | Needed for API auth, but consider using httpOnly cookies |
| `ace1_user` | `js/database-auth.js`, `js/password-manager.js`, `admin-login.html` | Cached user profile | ✅ ACCEPTABLE | For fast UX, validates token |
| `ace1_admin` | `js/database-auth.js`, `js/main.js`, `admin-login.html` | Admin flag | ✅ ACCEPTABLE | Quick access for admin checks |
| `userEmail` | `js/password-manager.js` | Email during reset flow | ✅ ACCEPTABLE | Temporary, session-specific |
| `csrf_token` | `js/security.js` | CSRF protection | ✅ ACCEPTABLE | Session-scoped, security feature |

### 🟠 CART & ORDERS (Should move to database)

| Key | Used In | Purpose | Status | Database Target |
|-----|---------|---------|--------|-----------------|
| `ace1_cart` | `js/main.js`, `js/checkout.js` | Shopping cart items | ⚠️ NEEDS MIGRATION | `shopping_carts` table |
| `ace1_orders` | `js/checkout.js` | Order history backup | ⚠️ NEEDS MIGRATION | `orders` table (already exists) |

### 🔴 REVIEWS (Should move to database)

| Key | Used In | Purpose | Status | Database Target |
|-----|---------|---------|--------|-----------------|
| `ace1_reviews` | `js/reviews.js` | Product reviews | ⚠️ NEEDS MIGRATION | `reviews` table |

### 🟢 CACHE & VERSIONING (Acceptable, internal use)

| Key | Used In | Purpose | Status | Notes |
|-----|---------|---------|--------|-------|
| `ace1_version` | `js/cache-buster.js` | App version for cache busting | ✅ OK | Internal optimization |
| `ace1_last_reload` | `js/cache-buster.js` | Last reload timestamp | ✅ OK | Internal optimization |
| Various cache keys | `js/cache-buster.js` | Resource cache metadata | ✅ OK | Performance optimization |

---

## Detailed Breakdown by File

### 1. `js/database-auth.js` (11 localStorage + 1 sessionStorage)
**Purpose**: Authentication and user session management

```javascript
// Line 16: Store token after login
localStorage.setItem('ace1_token', token);

// Line 18: Remove token on logout
localStorage.removeItem('ace1_token');

// Line 45: Retrieve stored token
const token = localStorage.getItem('ace1_token');

// Line 91: Store user profile for quick access
localStorage.setItem('ace1_user', JSON.stringify(this.currentUser));

// Line 238, 366, 485, 521: Store user data multiple places
localStorage.setItem('ace1_user', JSON.stringify(user));

// Line 371: Store admin flag
localStorage.setItem('ace1_admin', 'true');

// Line 604: Get token for requests
const token = localStorage.getItem('ace1_token');

// Line 636: Clear ALL on logout (includes user data, admin flag)
localStorage.clear();

// Line 639: Clear session storage
sessionStorage.clear();

// Line 653: Check if logged in
return !!this.currentUser || !!localStorage.getItem('ace1_token');

// Line 662: Get cached user
const stored = localStorage.getItem('ace1_user');
```

**Status**: ✅ KEEP (Authentication backbone - necessary for session management)

---

### 2. `js/security.js` (1 sessionStorage)
**Purpose**: CSRF token management

```javascript
// Line 18: Store CSRF token in session
sessionStorage.setItem('csrf_token', this.csrfToken);

// Line 37: Retrieve CSRF token
return this.csrfToken || sessionStorage.getItem('csrf_token');
```

**Status**: ✅ KEEP (Security feature, session-scoped)

---

### 3. `js/cache-buster.js` (8 localStorage operations)
**Purpose**: Cache versioning and app update detection

```javascript
// Line 77-78: Check previous version
const lastVersion = localStorage.getItem('ace1_version');
const lastReload = localStorage.getItem('ace1_last_reload');

// Line 85-86, 96, 100: Store version and reload time
localStorage.setItem('ace1_version', CACHE_VERSION);
localStorage.setItem('ace1_last_reload', now.toString());

// Line 43, 53, 59, 63, 168-169: Clear cache keys
localStorage.removeItem(key);
sessionStorage.removeItem(key);
```

**Status**: ✅ KEEP (Performance optimization, internal use)

---

### 4. `js/supabase-config.js` (1 localStorage)
**Purpose**: Token retrieval for API auth

```javascript
// Line 15: Get token for Supabase auth
return localStorage.getItem('ace1_token');
```

**Status**: ✅ KEEP (Depends on auth token storage)

---

### 5. `js/checkout.js` (6 localStorage operations)
**Purpose**: Shopping cart and order management

```javascript
// Line 54: Load cart items
const cart = localStorage.getItem('ace1_cart');

// Line 350: Clear cart after order
localStorage.removeItem('ace1_cart');

// Line 391-392, 396-397, 400-401: Fallback to localStorage for orders
this.saveOrderToLocalStorage(orderData);

// Line 406, 408: Save/load orders from localStorage
const orders = JSON.parse(localStorage.getItem('ace1_orders') || '[]');
localStorage.setItem('ace1_orders', JSON.stringify(orders));

// Line 411: Clear cart
localStorage.removeItem('ace1_cart');
```

**Status**: ⚠️ MIGRATE (Should use `shopping_carts` + `orders` tables)

---

### 6. `js/main.js` (3 localStorage operations)
**Purpose**: Shopping cart management

```javascript
// Line 5: Initialize cart from localStorage
let cart = JSON.parse(localStorage.getItem('ace1_cart') || '[]');

// Line 282: Save cart to localStorage
localStorage.setItem('ace1_cart', JSON.stringify(cart));

// Line 818: Get cart for display
const cart = JSON.parse(localStorage.getItem('ace1_cart') || '[]');
```

**Status**: ⚠️ MIGRATE (Should sync with `shopping_carts` table)

---

### 7. `js/reviews.js` (6 localStorage operations)
**Purpose**: Product reviews storage

```javascript
// Line 61: Load reviews from localStorage
const allReviews = JSON.parse(localStorage.getItem('ace1_reviews') || '{}');

// Line 169, 171: Save reviews to localStorage
const allReviews = JSON.parse(localStorage.getItem('ace1_reviews') || '{}');
localStorage.setItem('ace1_reviews', JSON.stringify(allReviews));

// Line 371, 373: Save reviews again
const allReviews = JSON.parse(localStorage.getItem('ace1_reviews') || '{}');
localStorage.setItem('ace1_reviews', JSON.stringify(allReviews));
```

**Status**: ⚠️ MIGRATE (Should use `reviews` table)

---

### 8. `js/password-manager.js` (2 localStorage + 1 sessionStorage)
**Purpose**: Password reset and user session

```javascript
// Line 36: Get user from localStorage
const userStr = localStorage.getItem('ace1_user');

// Line 53: Temporary email during reset flow
const userEmail = sessionStorage.getItem('userEmail');

// Line 405: Clear all data
localStorage.clear();
```

**Status**: ✅ KEEP (Line 36 depends on auth; line 53 is temp; line 405 is logout)

---

### 9. `admin-login.html` (4 localStorage + HTML comments)
**Purpose**: Admin authentication

```javascript
// Line 283: Store access token
localStorage.setItem('ace1_token', data.session.access_token);

// Line 306-307: Store admin flag and user data
localStorage.setItem('ace1_admin', 'true');
localStorage.setItem('ace1_user', JSON.stringify({...}));

// Line 320: Remove token on logout
localStorage.removeItem('ace1_token');
```

**Status**: ✅ KEEP (Part of auth system)

---

### 10. Test Files
- `tests/e2e/admin.spec.js`: Sets up test data in localStorage
- `auth-test.html`: Documentation mentions localStorage

**Status**: ✅ OK (Test setup only)

---

## Migration Priority Summary

### Priority 1: MUST KEEP ✅
```
ace1_token        - Session JWT
ace1_user         - Cached user profile  
ace1_admin        - Admin flag
csrf_token        - CSRF protection
ace1_version      - Cache versioning
ace1_last_reload  - Last reload time
```

### Priority 2: SHOULD MIGRATE ⚠️
```
ace1_cart         → shopping_carts table (3 files)
ace1_orders       → orders table (1 file)
ace1_reviews      → reviews table (1 file)
userEmail         → Keep (temp, password reset flow)
```

---

## Total Storage Impact

| Category | Count | Keep | Migrate | Notes |
|----------|-------|------|---------|-------|
| localStorage keys | 10+ | 6 | 3 | Includes cache versioning |
| sessionStorage keys | 3 | 2 | 0 | CSRF token + temp email |
| Total to migrate | 3 | - | - | Cart, Orders, Reviews |

---

## Implementation Roadmap

### Phase 1: Cart Migration (High Priority)
- Migrate `ace1_cart` → `shopping_carts` table
- Keep dual-write pattern (database + localStorage)
- Sync cart on every add/remove

### Phase 2: Reviews Migration (Medium Priority)
- Migrate `ace1_reviews` → `reviews` table
- Allow anonymous reviews to stay in localStorage
- Authenticated reviews go to database

### Phase 3: Orders (Already done, cleanup)
- Orders already use database
- Remove localStorage fallback code
- Keep order history database-only

### Phase 4: Optimization (Future)
- Consider httpOnly cookies for `ace1_token` (security improvement)
- Clean up test files

---

## What NOT to Migrate

✅ Keep in localStorage (legitimate use cases):
- **Authentication tokens** - Needed for API auth, consider moving to httpOnly cookies later
- **Admin flag** - Quick admin UX, validates against user_roles table
- **Cached user data** - Fast profile access, synced with users table
- **CSRF token** - Security mechanism, session-scoped
- **Cache metadata** - Performance optimization, internal only

