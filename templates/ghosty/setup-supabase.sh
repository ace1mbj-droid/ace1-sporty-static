#!/bin/bash

# Supabase Setup Helper Script
# This script helps you set up Supabase for your Ace1 E-Commerce website

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║        🚀 SUPABASE SETUP HELPER FOR ACE1 E-COMMERCE 🚀        ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -f "js/supabase-config.js" ]; then
    echo "❌ Error: Please run this script from your Ace1 E-Commerce Website directory"
    exit 1
fi

echo "This script will help you configure Supabase for your website."
echo ""
echo "📋 What you'll need:"
echo "   1. Supabase Project URL"
echo "   2. Supabase Anon/Public Key"
echo "   3. (Optional) Razorpay Key ID"
echo ""
echo "If you don't have these yet, follow these steps:"
echo ""
echo "STEP 1: Create Supabase Account"
echo "   → Go to: https://supabase.com"
echo "   → Click 'Start your project'"
echo "   → Sign up with GitHub or Google"
echo ""
echo "STEP 2: Create New Project"
echo "   → Click 'New Project'"
echo "   → Choose a name (e.g., 'ace1-ecommerce')"
echo "   → Choose a region close to you"
echo "   → Wait 2-3 minutes for initialization"
echo ""
echo "STEP 3: Get Your Credentials"
echo "   → Go to Settings → API"
echo "   → Copy 'Project URL' (https://xxxxx.supabase.co)"
echo "   → Copy 'anon public' key (starts with 'eyJ...')"
echo ""
read -p "Press ENTER when you have your credentials ready, or Ctrl+C to exit..."
echo ""

# Get Supabase URL
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Enter your Supabase Project URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Example: https://xyzcompany.supabase.co"
echo ""
read -p "Supabase URL: " SUPABASE_URL

if [ -z "$SUPABASE_URL" ]; then
    echo "❌ Error: Supabase URL is required"
    exit 1
fi

# Validate URL format
if [[ ! "$SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
    echo "⚠️  Warning: URL format looks incorrect. It should be https://xxxxx.supabase.co"
    read -p "Continue anyway? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        exit 1
    fi
fi

echo ""

# Get Supabase Anon Key
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Enter your Supabase Anon/Public Key"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
echo ""
read -p "Supabase Anon Key: " SUPABASE_ANON_KEY

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: Supabase Anon Key is required"
    exit 1
fi

# Validate key format
if [[ ! "$SUPABASE_ANON_KEY" =~ ^eyJ ]]; then
    echo "⚠️  Warning: Key format looks incorrect. It should start with 'eyJ'"
    read -p "Continue anyway? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        exit 1
    fi
fi

echo ""

# Get Razorpay Key (optional)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Enter your Razorpay Key ID (Optional - press ENTER to skip)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Get from: https://dashboard.razorpay.com/app/keys"
echo ""
read -p "Razorpay Key ID (optional): " RAZORPAY_KEY_ID

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 CONFIGURATION SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Supabase URL: $SUPABASE_URL"
echo "Supabase Key: ${SUPABASE_ANON_KEY:0:20}..."
if [ -n "$RAZORPAY_KEY_ID" ]; then
    echo "Razorpay Key: $RAZORPAY_KEY_ID"
else
    echo "Razorpay Key: (not configured)"
fi
echo ""
read -p "Is this correct? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "❌ Setup cancelled. Run the script again."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 UPDATING CONFIGURATION FILES..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Backup original config
if [ -f "js/supabase-config.js.backup" ]; then
    echo "⚠️  Backup already exists, skipping backup creation"
else
    cp js/supabase-config.js js/supabase-config.js.backup
    echo "✅ Created backup: js/supabase-config.js.backup"
fi

# Update supabase-config.js
cat > js/supabase-config.js << EOF
// ===================================
// SUPABASE CONFIGURATION
// ===================================
// Configured on: $(date)
const SUPABASE_CONFIG = {
    url: '$SUPABASE_URL',
    anonKey: '$SUPABASE_ANON_KEY'
};

// Initialize Supabase client
// Add this script tag to your HTML files: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
let supabase = null;

function initSupabase() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded. Add the CDN script to your HTML.');
        return null;
    }
    
    if (!supabase) {
        const { createClient } = window.supabase;
        supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('✅ Supabase initialized successfully');
    }
    
    return supabase;
}

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});

// Export for use in other modules
window.getSupabase = () => {
    if (!supabase) {
        return initSupabase();
    }
    return supabase;
};
EOF

echo "✅ Updated: js/supabase-config.js"

# Update Razorpay key if provided
if [ -n "$RAZORPAY_KEY_ID" ]; then
    if grep -q "key: 'YOUR_RAZORPAY_KEY_ID'" js/checkout.js; then
        # Create backup
        if [ ! -f "js/checkout.js.backup" ]; then
            cp js/checkout.js js/checkout.js.backup
            echo "✅ Created backup: js/checkout.js.backup"
        fi
        
        # Update the key
        sed -i.tmp "s/key: 'YOUR_RAZORPAY_KEY_ID'/key: '$RAZORPAY_KEY_ID'/" js/checkout.js
        rm js/checkout.js.tmp 2>/dev/null
        echo "✅ Updated: js/checkout.js (Razorpay key)"
    fi
fi

# Create .env file
cat > .env << EOF
# Supabase Configuration
# Generated on: $(date)
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Razorpay Configuration
RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID:-your_razorpay_key_id}

# Site Configuration
SITE_URL=http://localhost:3000
SITE_NAME=Ace1 E-Commerce
SUPPORT_EMAIL=support@ace1.com
EOF

echo "✅ Created: .env"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ CONFIGURATION COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "STEP 4: Create Database Schema"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Go to your Supabase dashboard"
echo "2. Click 'SQL Editor' in the left sidebar"
echo "3. Click 'New Query'"
echo "4. Open the file: SUPABASE_SETUP.md"
echo "5. Copy ALL the SQL code (starting from 'CREATE TABLE users')"
echo "6. Paste into Supabase SQL Editor"
echo "7. Click 'Run' (or press Ctrl+Enter)"
echo "8. Wait for 'Success' message"
echo ""
echo "STEP 5: Test Your Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Open index.html in your browser"
echo "2. Open browser console (F12)"
echo "3. Look for: '✅ Supabase initialized successfully'"
echo "4. Go to register.html and create a test account"
echo "5. Check Supabase dashboard → Authentication → Users"
echo "6. You should see your new user!"
echo ""
echo "📖 For detailed instructions, read:"
echo "   → SUPABASE_QUICK_START.md"
echo "   → SUPABASE_SETUP.md"
echo ""
echo "🎉 Your configuration is ready!"
echo ""
echo "⚠️  SECURITY REMINDER:"
echo "   → DO NOT commit .env file to GitHub"
echo "   → Add .env to your .gitignore file"
echo ""

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    cat > .gitignore << EOF
# Environment variables
.env
.env.local
.env.production

# Backups
*.backup

# Node modules (if using npm)
node_modules/

# OS files
.DS_Store
Thumbs.db
EOF
    echo "✅ Created: .gitignore"
else
    if ! grep -q "^\.env$" .gitignore; then
        echo "" >> .gitignore
        echo "# Environment variables" >> .gitignore
        echo ".env" >> .gitignore
        echo "✅ Updated: .gitignore"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Ready to continue with database setup!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
