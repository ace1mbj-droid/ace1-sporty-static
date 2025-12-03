#!/bin/bash

# Server Smoke Test for create-order validation
# Tests locked product and stock quantity validation

PROJECT_URL="https://vorqavsuqcjnkjzwkyzr.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcnFhdnN1cWNqbmtqendreXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTI3ODc3NzUsImV4cCI6MjAwODM4Nzc3NX0.yc1sI7V7b1FWZrJLfqj0bOjqlhZXKUYCGfGXZWOxpFk"

FUNCTION_URL="$PROJECT_URL/functions/v1/create-order"

echo "========================================"
echo "Server Smoke Test - create-order validation"
echo "========================================"
echo ""
echo "Testing Supabase project: $PROJECT_URL"
echo ""

# Test 1: Attempt to create order with locked product
echo "Test 1: Add LOCKED product to cart (should fail with 400)"
echo "---"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "id": "locked-test-product",
        "qty": 1,
        "price_cents": 5000
      }
    ],
    "customer_email": "test@example.com",
    "customer_name": "Test User"
  }')

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if response contains error about locked product
if echo "$RESPONSE" | grep -q "locked\|locked/unavailable"; then
  echo "✅ PASS: Server correctly rejects locked product"
elif echo "$RESPONSE" | grep -q "not found\|does not exist"; then
  echo "⚠️  INFO: Product not found in database (test setup needed)"
else
  echo "❌ FAIL: No lock validation error in response"
fi
echo ""

# Test 2: Attempt to create order with insufficient stock
echo "Test 2: Add product with insufficient stock (should fail with 400)"
echo "---"
RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "id": "low-stock-product",
        "qty": 999,
        "price_cents": 5000
      }
    ],
    "customer_email": "test@example.com",
    "customer_name": "Test User"
  }')

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if response contains error about stock
if echo "$RESPONSE" | grep -q "stock\|insufficient"; then
  echo "✅ PASS: Server correctly rejects insufficient stock"
elif echo "$RESPONSE" | grep -q "not found\|does not exist"; then
  echo "⚠️  INFO: Product not found in database (test setup needed)"
else
  echo "❌ FAIL: No stock validation error in response"
fi
echo ""

echo "========================================"
echo "To properly test, you need to:"
echo "1. Create test products with is_locked=true or low stock_quantity"
echo "2. Rerun this test script"
echo ""
echo "Or run a quick manual test by:"
echo "1. Visit https://ace1.in (or your dev site)"
echo "2. Find a locked product (should show 'Locked' badge)"
echo "3. Try to add it to cart (button should be disabled)"
echo "========================================"
