# Database Storage Migration

## Overview
This migration moves all user data from localStorage to the Supabase database. Only the authentication session reference (`ace1_session_id`) remains in localStorage to persist login sessions across page reloads.

## Date: Current

## Changes Made

### 1. Database Tables Created

#### `wishlists` Table
```sql
- id (UUID, primary key)
- user_id (UUID, references auth.users)
- session_id (TEXT, for anonymous users)
- product_id (UUID, references products)
- added_at (TIMESTAMPTZ)
```

#### Cart RPC Functions
- `get_cart_by_session(session_id)` - Get anonymous user's cart
- `add_to_cart_by_session(session_id, product_id, quantity, size)` - Add item
- `update_cart_item_by_session(session_id, product_id, quantity)` - Update quantity
- `remove_from_cart_by_session(session_id, product_id)` - Remove item
- `clear_cart_by_session(session_id)` - Clear entire cart
- `merge_session_cart_to_user(session_id, user_id)` - Merge on login

#### Wishlist RPC Functions
- `get_wishlist_by_session(session_id)` - Get anonymous user's wishlist
- `add_to_wishlist_by_session(session_id, product_id)` - Add item
- `remove_from_wishlist_by_session(session_id, product_id)` - Remove item

### 2. JavaScript Files Modified

#### `js/main.js`
- Cart now loads from database on page load via `loadCartFromDatabase()`
- Anonymous users use `sessionStorage` for session ID (temporary, tab-scoped)
- All cart operations sync to database in real-time
- Removed all `localStorage.getItem('ace1_cart')` references

#### `js/supabase-service.js`
- `getCart()` - Now uses database for both authenticated and anonymous users
- `addToCart()` - Uses RPC functions for anonymous users
- `updateCartItem()` - Uses RPC functions for anonymous users
- `removeFromCart()` - Uses RPC functions for anonymous users
- `clearCart()` - Uses RPC functions for anonymous users
- `getWishlist()` - Now uses database for both authenticated and anonymous users
- `addToWishlist()` - Uses RPC functions for anonymous users
- `removeFromWishlist()` - Uses RPC functions for anonymous users

#### `js/user-profile.js`
- Wishlist loads from `wishlists` database table
- Removed localStorage fallback for cart/wishlist
- Auth checks use `window.databaseAuth` instead of localStorage token

#### `js/database-auth.js`
- Removed localStorage caching of user data
- User data now only kept in memory after loading from database session
- Added `getSessionToken()` method for API calls
- `isAuthenticated()` now checks in-memory user only

#### `js/auth.js`
- `AuthManager.isAuthenticated()` now delegates to `databaseAuth`
- `AuthManager.getCurrentUser()` now delegates to `databaseAuth`
- Removed localStorage token checks

#### `js/admin.js`
- Removed products cache in localStorage (products always fresh from DB)
- Admin token retrieved from `databaseAuth` or `sessionStorage`

#### `js/supabase-config.js`
- Removed localStorage token initialization
- Token now set by databaseAuth when session is created

#### `js/password-manager.js`
- Removed localStorage user data fallback
- Uses database auth or OAuth session only

### 3. Storage Strategy

| Data Type | Authenticated Users | Anonymous Users |
|-----------|--------------------|--------------------|
| Auth Session ID | localStorage (persistent) | N/A |
| Cart | `shopping_carts` table (user_id) | `shopping_carts` table (session_id) |
| Wishlist | `wishlists` table (user_id) | `wishlists` table (session_id) |
| User Profile | `users` table | N/A |
| Session Data | `sessions` table | N/A |
| Products Cache | None (always fresh) | None (always fresh) |

### 4. Anonymous User Flow

1. User visits site → `sessionStorage` generates temporary session ID
2. Cart/wishlist operations use RPC functions with session_id
3. Data persists in database for the browser tab session
4. On login → `merge_session_cart_to_user()` combines anonymous cart with user cart

### 5. What Still Uses localStorage

Only `ace1_session_id` for **authenticated user sessions**:
- Required for persistent login across page reloads
- Contains only a reference ID (actual session data in database)
- Cleared on logout
- Verified against database `sessions` table on each page load

### 6. Security Benefits

1. **No sensitive data in browser** - User data, cart, wishlist all in database
2. **Server-side validation** - All operations go through Supabase RLS policies
3. **Cross-device sync** - User data available on any device when logged in
4. **XSS protection** - Even if localStorage is compromised, attackers can't access user data
5. **Audit trail** - All operations logged in database

## Testing Checklist

- [ ] Anonymous user can add to cart
- [ ] Anonymous user can add to wishlist
- [ ] Cart persists across page navigation (same tab)
- [ ] Cart clears when tab closes (anonymous)
- [ ] Authenticated user cart persists across sessions
- [ ] Cart merges on login from anonymous
- [ ] Wishlist operations work for both user types
- [ ] Profile page loads user data from database
- [ ] Admin panel works without localStorage
