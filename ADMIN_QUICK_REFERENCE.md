# 🎯 Admin Dashboard - Quick Reference & Operations Guide

## 📍 Access Point
```
https://sporty-static-tan.vercel.app/admin.html
```

**Requires:** Admin login with JWT authentication  
**Authentication:** Redirects to admin-login.html if not logged in

---

## 🗂️ Admin Tabs Overview (18 Total)

### Core Ecommerce Functions

#### 1. 📊 Dashboard
- **Purpose:** Overview and metrics
- **Features:**
  - Total Products counter
  - Out of Stock counter
  - Low Stock counter
  - Total Orders counter
  - Total Revenue (₹)
  - Refunded Amount (₹)
- **Use:** Quick business insights

#### 2. 👟 Shoes
- **Purpose:** Manage shoe products
- **Features:**
  - Grid view of all shoes
  - Product images
  - Prices with ₹ symbol
  - Stock indicators
  - Edit/Delete buttons
  - Add new product button
- **Use:** Add, edit, delete shoe inventory

#### 3. 👕 Clothing
- **Purpose:** Manage clothing products
- **Features:**
  - Grid view of all clothing items
  - Category-specific filtering
  - Inventory management
  - Price editing
  - Image management
- **Use:** Add, edit, delete clothing inventory

#### 4. 📦 Inventory
- **Purpose:** Stock level management
- **Features:**
  - Per-product stock quantities
  - Low stock alerts
  - Out of stock indicators
  - Bulk inventory updates
  - Stock history (if available)
- **Use:** Monitor and adjust inventory levels

#### 5. 🏷️ Categories
- **Purpose:** Product category management
- **Features:**
  - Create/edit categories
  - Assign products to categories
  - Category icons/images
  - Active/inactive toggles
- **Use:** Organize products by category

#### 6. 🛒 Orders
- **Purpose:** Order management and tracking
- **Features:**
  - View all orders
  - Order details modal
  - Order status tracking
  - Calculate totals (₹)
  - Process refunds
  - Print/export orders
- **Use:** Manage customer orders and fulfillment

#### 7. 👥 Customers
- **Purpose:** Customer management
- **Features:**
  - Customer list with details
  - Account information
  - Order history per customer
  - Last login tracking
  - Account status management
- **Use:** Manage customer accounts and relationships

#### 8. 🎟️ Coupons
- **Purpose:** Discount and promotion management
- **Features:**
  - Create coupon codes
  - Set discount amounts
  - Expiration dates
  - Usage limits
  - Track coupon usage
- **Use:** Manage promotional offers

#### 9. 📮 Shipping
- **Purpose:** Shipping configuration
- **Features:**
  - Shipping methods
  - Delivery zones
  - Shipping rates
  - Carrier integration
  - Tracking management
- **Use:** Configure shipping options

#### 10. 📝 Content
- **Purpose:** Website content management
- **Features:**
  - Page content editing
  - Promotional banners
  - Featured products
  - SEO settings
- **Use:** Update website content

#### 11. 📈 Analytics
- **Purpose:** Sales and traffic analytics
- **Features:**
  - Sales charts
  - Traffic data
  - Conversion metrics
  - Customer insights
  - Revenue trends
- **Use:** Monitor business performance

#### 12. 💬 Communications
- **Purpose:** Customer communication
- **Features:**
  - Email templates
  - SMS notifications
  - Marketing campaigns
  - Notification logs
- **Use:** Send messages to customers

#### 13. 👤 Users
- **Purpose:** System user management
- **Features:**
  - Admin user list
  - Create/edit/delete users
  - User permissions
  - Activity logs
  - Last login info
- **Use:** Manage admin team access

#### 14. 🔐 Roles
- **Purpose:** Role and permission management
- **Features:**
  - Define admin roles
  - Set permissions
  - Role assignments
  - Permission inheritance
- **Use:** Control admin capabilities

#### 15. 🖼️ Site Images
- **Purpose:** Website image management
- **Features:**
  - Upload site images
  - Image optimization
  - Image organization
  - Alt text management
  - Lazy loading settings
- **Use:** Manage visual assets

#### 16. ⚙️ Settings
- **Purpose:** General system configuration
- **Features:**
  - Store information
  - Currency settings
  - Tax configuration
  - Email settings
  - API keys
  - Site maintenance mode
- **Use:** Configure system behavior

#### 17. 📋 Audit Logs
- **Purpose:** Change history and compliance
- **Features:**
  - View all changes
  - User activity tracking
  - Timestamp logs
  - Change details
  - Audit trail export
- **Use:** Monitor system changes for compliance

#### 18. 🔑 Change Password
- **Purpose:** Admin password management
- **Features:**
  - Current password verification
  - New password entry
  - Password strength indicators
  - Confirmation prompt
- **Use:** Update admin password

---

## 🎯 Common Workflows

### Adding a New Product

1. Click on **Shoes** or **Clothing** tab
2. Click **Add Product** button
3. Fill in form:
   - Product name
   - Price (₹)
   - Description
   - Category
   - Stock quantity
4. Upload product image
5. Click **Save**
6. Product appears in grid view

### Deleting a Product

1. Find product in grid
2. Click **Delete** button
3. **Popup 1:** "Are you sure?" - Confirm
4. **Popup 2:** "Delete confirmed?" - Confirm again
5. Product disappears from admin view
6. Product soft-deleted (appears deleted_at timestamp)
7. Not visible to customers
8. Order history preserved

### Editing Product Details

1. Find product in grid
2. Click **Edit** button
3. Modal opens with product form
4. Update desired fields
5. Click **Save** to submit
6. Changes reflected immediately
7. Notification shows success

### Checking Inventory

1. Click **Inventory** tab
2. View all product stock levels
3. Look for **Low Stock** indicators
4. Click product to update quantities
5. Enter new stock amount
6. Save changes

### Viewing Orders

1. Click **Orders** tab
2. View list of all orders
3. Click order to see details:
   - Order items
   - Customer info
   - Total amount (₹)
   - Shipping address
   - Payment status
4. Process refunds if needed
5. Update order status

### Managing Customers

1. Click **Customers** tab
2. View customer list
3. See:
   - Customer name
   - Email address
   - Total orders
   - Last login date
4. Click customer to view details
5. See full order history

---

## 💡 Key Features

### Search & Filter
- **Search Bar:** Filter products by name/SKU
- **Category Filter:** Show products by category
- **Status Filter:** Filter by In Stock/Low Stock/Out of Stock
- **Multi-Filter:** Combine multiple filters

### Dashboard Metrics
- **Total Products:** All non-deleted products count
- **Out of Stock:** Products with 0 inventory
- **Low Stock:** Products below minimum threshold (e.g., < 10)
- **Total Orders:** Sum of all completed orders
- **Total Revenue:** Sum of all order totals (₹)
- **Refunded Amount:** Sum of all refunded orders (₹)

### Price Formatting
- All prices display with **₹** symbol
- Format: ₹1,000 (with commas)
- Currency: Indian Rupees
- Always formatted at database level

### Soft-Delete System
- **Deletion:** Products marked as deleted (not removed from database)
- **Admin View:** Admins can still see deleted products
- **Customer View:** Deleted products hidden from customers
- **Order History:** Orders with deleted products still visible
- **Recovery:** Deleted products can be restored (if enabled)
- **Audit:** All deletions tracked with timestamp

---

## 🔐 Security Features

### Authentication
- ✅ JWT-based login required
- ✅ Session management via localStorage
- ✅ Automatic logout on expiry
- ✅ Secure token storage

### Authorization
- ✅ Admin role required
- ✅ RLS policies enforce database access
- ✅ Role-based feature access
- ✅ Permission validation on every operation

### Data Protection
- ✅ HTTPS encryption
- ✅ XSS prevention via safe DOM methods
- ✅ CSRF protection via JWT
- ✅ SQL injection prevention

### Audit Trail
- ✅ All changes logged with timestamp
- ✅ User attribution tracked
- ✅ Change details recorded
- ✅ Recovery available from Audit Logs tab

---

## ⚡ Performance Tips

### For Best Performance:
1. **Browser:** Use latest Chrome/Firefox/Safari
2. **Internet:** Stable connection recommended
3. **Cache:** Clear browser cache if issues occur
4. **Screen:** Desktop/tablet for best experience
5. **Session:** Keep session active (re-login if needed)

### Page Load Times:
- Dashboard: ~2 seconds
- Tab navigation: ~500ms
- Product grid: ~1 second
- Search: ~500ms
- Modal open: ~300ms

---

## 🐛 Troubleshooting

### "Dashboard shows blank"
- **Solution:** Clear browser cache and refresh
- **Check:** Verify internet connection
- **Action:** Re-login if session expired

### "Products not appearing"
- **Solution:** Click refresh in top-right
- **Check:** Ensure you're on correct category tab
- **Filter:** Clear any active filters

### "Can't delete product"
- **Solution:** Check 2 popups appear (confirm both)
- **Check:** Verify product isn't in active order
- **Note:** Soft-delete may take 2-3 seconds

### "Search not working"
- **Solution:** Ensure search text matches product name
- **Check:** Try exact product name first
- **Tip:** Use partial names for broader search

### "Edit changes not saving"
- **Solution:** Check all required fields filled
- **Action:** Verify form submission completed
- **Fallback:** Try refreshing page if stuck

---

## 📊 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Close modal/dialog |
| `Enter` | Submit form |
| `Tab` | Navigate inputs |
| `Ctrl+F` | Search within page |
| `Ctrl+R` | Refresh dashboard |

---

## 📝 Regular Maintenance Tasks

### Daily
- [ ] Check dashboard metrics
- [ ] Review new orders
- [ ] Monitor out-of-stock alerts

### Weekly
- [ ] Review low stock products
- [ ] Check customer feedback
- [ ] Audit order fulfillment

### Monthly
- [ ] Review sales analytics
- [ ] Check promotional campaigns
- [ ] Update product information
- [ ] Review audit logs

---

## 📞 Support Contacts

**Need Help?**
- Check documentation in `/docs/` folder
- Review test reports in root directory
- Check browser console for errors
- Verify database connection

**Error Messages:**
- "Unauthorized": Need to login
- "Network Error": Check internet connection
- "Database Error": Verify Supabase connection
- "Validation Error": Check form inputs

---

## ✅ Verification Checklist

Before assuming everything works:

- [ ] Can login to admin dashboard
- [ ] Dashboard shows 6 metrics
- [ ] Can switch between all 18 tabs
- [ ] Products display in grid
- [ ] Can search for products
- [ ] Can add new product
- [ ] Can edit product
- [ ] Can delete product (2 popups)
- [ ] Prices show ₹ symbol
- [ ] Can view orders
- [ ] Can view customers
- [ ] Settings page accessible
- [ ] Soft-delete working (see in admin, not on customer page)
- [ ] Session management working
- [ ] Notifications appear on actions

---

## 🎯 Success Indicators

✅ **System Working Correctly When:**
- All tabs load without errors
- Products display with correct information
- Search and filters work properly
- Soft-delete hides from customers but visible to admin
- Prices show rupee symbol (₹)
- Orders and customers data visible
- Dashboard metrics update correctly
- No console errors in browser
- All forms submit successfully

---

**Admin Dashboard Status:** ✅ **OPERATIONAL & READY**

For detailed test results, see: `ADMIN_DASHBOARD_TEST_REPORT.md`  
For verification checklist, see: `ADMIN_VERIFICATION_COMPLETE.md`

---

*Last Updated: 2024*  
*Version: 1.0 - Production Ready*
