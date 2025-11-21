#!/bin/bash

# Script to add security scripts and meta tags to all HTML files
# ACE#1 E-Commerce Website

echo "🔒 Adding security scripts to all HTML files..."

# Find all HTML files (excluding test files)
html_files=$(find . -name "*.html" -not -name "test-*.html" -not -path "./node_modules/*")

for file in $html_files; do
    echo "Processing: $file"
    
    # Add security meta tags if not already present
    if ! grep -q "X-Frame-Options" "$file"; then
        # Add after <meta name="viewport"...>
        sed -i '' '/<meta name="viewport"/a\
    \
    <!-- Security Meta Tags -->\
    <meta http-equiv="X-Frame-Options" content="SAMEORIGIN">\
    <meta http-equiv="X-Content-Type-Options" content="nosniff">\
    <meta http-equiv="X-XSS-Protection" content="1; mode=block">\
    <meta name="referrer" content="strict-origin-when-cross-origin">
' "$file"
        echo "  ✓ Added security meta tags"
    fi
    
    # Add DOMPurify if supabase scripts exist but DOMPurify doesn't
    if grep -q "supabase-js" "$file" && ! grep -q "dompurify" "$file"; then
        # Add security scripts before database-auth.js
        sed -i '' 's|<script src="js/database-auth.js"></script>|<!-- Security Scripts -->\
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>\
    <script src="js/password-hasher.js"></script>\
    <script src="js/security.js"></script>\
    <script src="js/database-auth.js"></script>|g' "$file"
        echo "  ✓ Added security scripts (DOMPurify, password-hasher, security)"
    fi
done

echo ""
echo "✅ Security updates complete!"
echo ""
echo "Added to all HTML files:"
echo "  - X-Frame-Options meta tag"
echo "  - X-Content-Type-Options meta tag"
echo "  - X-XSS-Protection meta tag"
echo "  - Referrer Policy meta tag"
echo "  - DOMPurify library"
echo "  - Password Hasher (PBKDF2)"
echo "  - Security Manager (CSRF, Rate Limiting)"
