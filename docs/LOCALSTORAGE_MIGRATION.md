# localStorage to Database Migration Guide

## Overview
The application currently uses localStorage for data that should be persisted in the database. This guide documents what needs to be migrated and the implementation status.

## Migration Status

### ✅ COMPLETED (Already in Database)
- **Admin Token** (`ace1_token`) → `sessions` table with Supabase Auth
- **User Profile** (`ace1_user`) → `users` table
- **Admin Flag** (`ace1_admin`) → `user_roles` table (just secured with RLS)

### 🔄 IN PROGRESS (Tables Created, Code Pending)

#### 1. Shopping Cart (`ace1_cart`) → `shopping_carts` TABLE
**Status**: Database table created ✅ | Code migration needed ⏳

**Current localStorage structure**:
```javascript
// Format: array of cart items
[
  { id: "uuid", name: "Product", price: 14999, image: "...", quantity: 1 },
  ...
]
```

**New database schema**:
```sql
shopping_carts (
  id UUID,
  user_id UUID (nullable for anonymous),
  session_id TEXT (for anonymous users),
  product_id UUID,
  quantity INTEGER,
  size TEXT (optional),
  added_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Migration Path**:
- [ ] Update `js/main.js` - `updateCart()` to sync with database
- [ ] Update `js/checkout.js` - `loadCartItems()` to load from database
- [ ] Update `js/checkout.js` - `placeOrder()` to clear database cart
- [ ] Add session ID generation for anonymous users
- [ ] Implement cart fallback logic (database → localStorage fallback)

**Code Files Affected**:
- `js/main.js` (lines 5, 282, 818)
- `js/checkout.js` (lines 54, 350)

#### 2. Orders (`ace1_orders`) → `orders` TABLE
**Status**: Database table exists ✅ | Code already using it ✅

**Current issue**: Fallback to localStorage when Supabase fails
**Action**: Remove localStorage fallback once Supabase is reliable

**Code Files**:
- `js/checkout.js` (lines 364, 391-401) - remove `saveOrderToLocalStorage()` fallback

#### 3. Reviews (`ace1_reviews`) → `reviews` TABLE
**Status**: Database table created ✅ | Code migration needed ⏳

**Current localStorage structure**:
```javascript
// Format: object with product IDs as keys
{
  "product-uuid": [
    { id: "review-id", user: "name", rating: 5, comment: "..." },
    ...
  ]
}
```

**New database schema**:
```sql
reviews (
  id UUID,
  product_id UUID,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  rating INTEGER (1-5),
  title TEXT,
  comment TEXT,
  verified_purchase BOOLEAN,
  helpful_count INTEGER,
  unhelpful_count INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Migration Path**:
- [ ] Update `js/reviews.js` - Load reviews from database
- [ ] Update `js/reviews.js` - Save reviews to database
- [ ] Update `js/reviews-manager.js` if it exists
- [ ] Implement review fallback logic (database → localStorage fallback)

**Code Files Affected**:
- `js/reviews.js` (lines 60-61, 150, 168-171, 370-373)

---

## Implementation Recommendations

### Phase 1: Shopping Cart Migration (High Priority)
**Why**: Affects every user session and is critical for e-commerce

```javascript
// Pseudo-code for new cart sync
async function updateCart() {
    // If authenticated, sync with database
    if (auth.user) {
        await supabase.from('shopping_carts')
            .upsert(cart.map(item => ({
                user_id: auth.user.id,
                product_id: item.id,
                quantity: item.quantity,
                size: item.size
            })));
    } else {
        // For anonymous users: use localStorage as backup
        localStorage.setItem('ace1_cart', JSON.stringify(cart));
    }
}
```

### Phase 2: Reviews Migration (Medium Priority)
**Why**: Improves data persistence and admin moderation capabilities

```javascript
// Pseudo-code for new reviews
async function saveReview(productId, reviewData) {
    if (auth.user) {
        await supabase.from('reviews').insert({
            product_id: productId,
            user_id: auth.user.id,
            user_email: auth.user.email,
            ...reviewData
        });
    } else {
        // Fallback to localStorage for anonymous reviews
        saveReviewToLocalStorage(productId, reviewData);
    }
}
```

### Phase 3: Clean Up Fallbacks (Future)
Once database is fully stable:
- Remove all localStorage fallback code
- Remove `saveOrderToLocalStorage()` function
- Update documentation

---

## Backward Compatibility

During migration, maintain dual-write pattern:
```javascript
// Save to BOTH database and localStorage
await saveToDatabase(data);
localStorage.setItem(key, JSON.stringify(data));

// Load from DATABASE first, fallback to localStorage
const data = await loadFromDatabase() || JSON.parse(localStorage.getItem(key));
```

This ensures:
- Existing offline users continue working
- New data goes to database
- Gradual transition period
- Easy rollback if needed

---

## Security Notes

✅ All new tables have RLS policies:
- **Reviews**: Public read, authenticated write, self-delete + admin override
- **Shopping Carts**: Self-read, self-write, authenticated-only
- **Sessions**: Already secured via Supabase Auth

---

## Database Tables Status

| Table | Purpose | RLS | Status |
|-------|---------|-----|--------|
| `reviews` | Product reviews | ✅ | Ready to use |
| `shopping_carts` | Pending cart items | ✅ | Ready to use |
| `orders` | Completed orders | ✅ | In use |
| `order_items` | Order line items | ✅ | In use |
| `sessions` | User sessions | ✅ | In use |
| `users` | User profiles | ✅ | In use |
| `user_roles` | Admin flags | ✅ | Just secured |

---

## Next Steps

1. **Update shopping cart sync** in `js/main.js` and `js/checkout.js`
2. **Update reviews loading/saving** in `js/reviews.js`
3. **Remove localStorage fallbacks** from `js/checkout.js` (lines 364+)
4. **Test offline behavior** for anonymous users
5. **Monitor database performance** during rollout
