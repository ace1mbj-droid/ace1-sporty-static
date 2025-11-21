#!/usr/bin/env node
/*
 Simple verification script for E2E CI that queries Supabase using the
 SUPABASE_SERVICE_ROLE_KEY (no TCP psql required).

 Expects:
  - SUPABASE_PROJECT_REF
  - SUPABASE_SERVICE_ROLE_KEY
  - /tmp/e2e-output.json to exist

 Exits 0 when verification passes, non-zero otherwise.
*/

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function main(){
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if(!projectRef || !serviceRole){
    console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }

  if(!fs.existsSync('/tmp/e2e-output.json')){
    console.error('/tmp/e2e-output.json not found — create-order may have failed');
    process.exit(3);
  }

  const out = JSON.parse(fs.readFileSync('/tmp/e2e-output.json','utf8'));
  const orderId = out.orderId || null;
  const razorId = out.razorId || null;

  if(!orderId){
    console.error('No orderId found in /tmp/e2e-output.json');
    process.exit(4);
  }

  const SUPABASE_URL = `https://${projectRef}.supabase.co`;
  const admin = createClient(SUPABASE_URL, serviceRole, { auth: { persistSession: false } });

  try {
    console.log('Checking orders table for id=', orderId);
    const { data: orders, error: oErr } = await admin.from('orders').select('id, status').eq('id', orderId).limit(1);
    if(oErr){
      console.error('Failed querying orders:', oErr.message || oErr);
      process.exit(10);
    }
    if(!orders || orders.length === 0){
      console.error('Order not found:', orderId);
      process.exit(11);
    }

    console.log('Order found:', orders[0]);

    if(razorId){
      console.log('Checking payments table for provider_order_id=', razorId);
      const { data: payments, error: pErr } = await admin.from('payments').select('id, provider_order_id, status').eq('provider_order_id', razorId).limit(1);
      if(pErr){
        console.error('Failed querying payments:', pErr.message || pErr);
        process.exit(12);
      }
      if(!payments || payments.length === 0){
        console.error('Payment not found for razor id:', razorId);
        process.exit(13);
      }
      console.log('Payment found:', payments[0]);
    } else {
      console.warn('No razorId present in e2e output — skipping payments check');
    }

    console.log('E2E verification succeeded');
    process.exit(0);
  } catch (err){
    console.error('Unhandled verification error', err?.message || err);
    process.exit(20);
  }
}

main();
