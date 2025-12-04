# URGENT: Apply Product Deletion Protection

## ⚠️ Critical Issue Found
Products were being deleted without safeguards, potentially breaking order history.

## ✅ Quick Fix (5 minutes)

### Step 1: Apply Database Protections
**Run in Supabase SQL Editor**:

1. Open: https://supabase.com/dashboard/project/_/sql
2. Copy contents of: `sql/add_product_deletion_safeguards.sql`
3. Paste and click **Run**

Expected output:
```
✅ Added deleted_at column to products table
✅ Created check_product_has_orders function
✅ Created soft_delete_product function
✅ Created hard_delete_product function
✅ Created product_deletion_audit table
✅ Created audit triggers
```

### Step 2: Update RLS Policies
**Run in Supabase SQL Editor**:

1. Copy contents of: `sql/optimize_rls_policies.sql`
2. Paste and click **Run**

This adds the missing `inventory_delete_admin` policy.

### Step 3: Deploy Updated Code
The JavaScript fix is already in `js/admin.js`. 

If you're using:
- **GitHub Pages**: Auto-deployed ✅
- **Netlify/Vercel**: Will auto-deploy on push ✅
- **Manual hosting**: Upload `js/admin.js` to your server

## 🔍 Verify Protection is Working

### Test 1: Check Database Functions
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%product%';
```

Should show:
- `check_product_has_orders`
- `soft_delete_product`
- `hard_delete_product`

### Test 2: Check Audit Table Exists
```sql
SELECT * FROM product_deletion_audit LIMIT 1;
```

Should return empty result (no error).

### Test 3: Check Products Have deleted_at Column
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name = 'deleted_at';
```

Should show `deleted_at | timestamp with time zone`.

## 🛡️ What's Protected Now

✅ **Products with orders cannot be permanently deleted**  
✅ **Soft delete preserves order history**  
✅ **All deletions logged in audit table**  
✅ **Recovery possible for soft-deleted products**  
✅ **UI shows warnings before deletion**  
✅ **RLS policies prevent unauthorized deletion**

## 📊 Check for Existing Issues

### Find Products That Were Deleted
```sql
-- If you already have a deleted_at column with data:
SELECT id, name, sku, deleted_at
FROM products
WHERE deleted_at IS NOT NULL;
```

### Check Broken Orders (products missing)
```sql
SELECT DISTINCT oi.product_id
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id
WHERE p.id IS NULL;
```

If this returns rows, you have orders with deleted products! 😱

## 🚨 If You Find Broken Orders

Contact support immediately: **hello@ace1.in**

We can help:
1. Restore products from backups
2. Create placeholder products for order history
3. Audit what was deleted and when

## 📖 Full Documentation

See `PRODUCT_DELETION_PROTECTION.md` for complete details.

---

**Priority**: 🔴 CRITICAL  
**Time to Fix**: ⏱️ 5 minutes  
**Impact**: 🛡️ Prevents data loss
