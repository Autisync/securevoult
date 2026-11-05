#!/usr/bin/env node
/**
 * scripts/stripe-setup.js
 *
 * Creates Stripe products and prices for SecureVoult plans,
 * then writes the price IDs into .env.local automatically.
 *
 * Usage:
 *   1. Set STRIPE_SECRET_KEY in .env.local (use TEST key first: sk_test_...)
 *   2. Run:  node scripts/stripe-setup.js
 *   3. The script will append STRIPE_PRICE_* variables to .env.local.
 *   4. Restart your dev server so Next.js picks up the new vars.
 *
 * Safe to re-run — it checks for existing products/prices by lookup_key
 * before creating new ones, so you won't get duplicates.
 */

'use strict';

const path  = require('path');
const fs    = require('fs');
const https = require('https');

// ── Load .env.local manually (no dotenv dependency) ────────────────────────

const envPath = path.join(__dirname, '..', '.env.local');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

const env = loadEnv(envPath);
const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('\n[error]  STRIPE_SECRET_KEY not found in .env.local or environment.');
  console.error('    Get your test key from: https://dashboard.stripe.com/test/apikeys');
  console.error('    Add this line to .env.local:');
  console.error('        STRIPE_SECRET_KEY=sk_test_...\n');
  process.exit(1);
}

if (STRIPE_SECRET_KEY.startsWith('sk_live_')) {
    console.warn('\n[!] You are using a LIVE Stripe key.');
  console.warn('    This will create REAL products that appear in your Stripe dashboard.');
  console.warn('    Press Ctrl+C within 5 seconds to cancel...\n');
  // Give user a chance to bail (synchronous wait via busyloop — only at startup)
  const end = Date.now() + 5000;
  while (Date.now() < end) { /* wait */ }
}

// ── Stripe API helper (no external dependencies) ────────────────────────────

function stripeRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? new URLSearchParams(flattenParams(body)).toString() : '';
    const options = {
      hostname: 'api.stripe.com',
      path: `/v1/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(`Stripe ${parsed.error.type}: ${parsed.error.message}`));
          else resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse Stripe response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/** Flatten nested object to Stripe-style form params: { a: { b: 'c' } } → 'a[b]=c' */
function flattenParams(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(result, flattenParams(v, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') Object.assign(result, flattenParams(item, `${key}[${i}]`));
        else result[`${key}[${i}]`] = item;
      });
    } else if (v !== undefined && v !== null) {
      result[key] = String(v);
    }
  }
  return result;
}

async function findPriceByLookupKey(lookupKey) {
  const res = await stripeRequest('GET', `prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&expand[]=data.product`);
  return res.data && res.data.length > 0 ? res.data[0] : null;
}

async function findOrCreateProduct(name, description, metadata) {
  // Search existing active products by name
  const res = await stripeRequest('GET', `products?active=true&limit=100`);
  const existing = res.data.find(p => p.name === name);
  if (existing) {
    console.log(`  [skip]  Product already exists: ${name} (${existing.id})`);
    return existing.id;
  }
  const product = await stripeRequest('POST', 'products', {
    name,
    description,
    metadata,
    tax_code: 'txcd_10103001', // SaaS subscription
  });
  console.log(`  [ok]  Created product: ${name} (${product.id})`);
  return product.id;
}

async function findOrCreatePrice(lookupKey, productId, unitAmount, currency, interval) {
  const existing = await findPriceByLookupKey(lookupKey);
  if (existing) {
    console.log(`  [skip]  Price already exists: ${lookupKey} -> ${existing.id}`);
    return existing.id;
  }
  const price = await stripeRequest('POST', 'prices', {
    product: productId,
    unit_amount: unitAmount,
    currency,
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: false,
    metadata: { lookup_key: lookupKey },
  });
  console.log(`  [ok]  Created price: ${lookupKey} -> ${price.id}  (${currency.toUpperCase()} ${(unitAmount / 100).toFixed(2)}/${interval})`);
  return price.id;
}

// ── Plan definitions ─────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'pro',
    name: 'SecureVoult Pro',
    description: 'Zero-knowledge password manager — unlimited entries, passkeys, breach monitoring, extension sync.',
    prices: [
      // monthly: £6.00
      { lookupKey: 'securevoult_pro_monthly', amount: 600, currency: 'gbp', interval: 'month', envKey: 'STRIPE_PRICE_PRO_MONTHLY' },
      // yearly: £57.60 (£4.80/mo × 12 = 20% off)
      { lookupKey: 'securevoult_pro_yearly',  amount: 5760, currency: 'gbp', interval: 'year',  envKey: 'STRIPE_PRICE_PRO_YEARLY'  },
    ],
  },
  {
    id: 'company',
    name: 'SecureVoult Company',
    description: 'Team password manager — admin panel, audit logs, breach monitoring, security policy enforcement. Per user/month.',
    prices: [
      // monthly: £8.00/user
      { lookupKey: 'securevoult_company_monthly', amount: 800,  currency: 'gbp', interval: 'month', envKey: 'STRIPE_PRICE_COMPANY_MONTHLY' },
      // yearly: £76.80/user (£6.40/mo × 12 = 20% off)
      { lookupKey: 'securevoult_company_yearly',  amount: 7680, currency: 'gbp', interval: 'year',  envKey: 'STRIPE_PRICE_COMPANY_YEARLY'  },
    ],
  },
];

// ── Webhook endpoint helper ──────────────────────────────────────────────────

async function getOrCreateWebhookEndpoint(appUrl) {
  const webhookUrl = `${appUrl}/api/billing/webhook`;
  const res = await stripeRequest('GET', 'webhook_endpoints?limit=100');
  const existing = res.data.find(w => w.url === webhookUrl);
  if (existing) {
    console.log(`  [skip]  Webhook already exists: ${webhookUrl}`);
    // Cannot retrieve signing_secret after creation — only shown once
    return null;
  }
  const wh = await stripeRequest('POST', 'webhook_endpoints', {
    url: webhookUrl,
    enabled_events: [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_failed',
    ],
  });
  console.log(`  [ok]  Created webhook: ${webhookUrl}`);
  return wh.secret; // Only shown on creation
}

// ── Write env vars back to .env.local ───────────────────────────────────────

function upsertEnvLocal(vars) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
      console.log(`  [updated]  ${key}  in .env.local`);
    } else {
      content += `\n${key}=${value}`;
      console.log(`  [added]    ${key}  to .env.local`);
    }
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n[stripe-setup]  SecureVoult Stripe Setup\n');
  console.log(`   Key type: ${STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`);
  console.log('');

  const newVars = {};

  for (const plan of PLANS) {
    console.log(`\n── ${plan.name} ──`);
    const productId = await findOrCreateProduct(plan.name, plan.description, { plan_id: plan.id, app: 'securevoult' });

    for (const price of plan.prices) {
      const priceId = await findOrCreatePrice(price.lookupKey, productId, price.amount, price.currency, price.interval);
      newVars[price.envKey] = priceId;
    }
  }

  // Optional: create webhook for local testing
  const appUrl = env.NEXT_PUBLIC_APP_URL || '';
  let webhookSecret = null;
  if (appUrl && appUrl.startsWith('https://')) {
    console.log('\n── Webhook ──');
    webhookSecret = await getOrCreateWebhookEndpoint(appUrl);
  } else {
    console.log('\n── Webhook ──');
    console.log('  ℹ️   Skipping webhook creation (NEXT_PUBLIC_APP_URL is not an https:// URL).');
    console.log('       For local testing run:  stripe listen --forward-to localhost:3000/api/billing/webhook');
    console.log('       For production set NEXT_PUBLIC_APP_URL=https://vault.autisync.com and re-run.');
  }

  if (webhookSecret) {
    newVars['STRIPE_WEBHOOK_SECRET'] = webhookSecret;
  }

  // Write everything
  console.log('\n── Writing to .env.local ──');
  upsertEnvLocal(newVars);

  console.log('\nDone!\n');
  console.log('   Next steps:');
  console.log('   1. Restart your dev server:  npm run dev');
  console.log('   2. Test checkout at:          http://localhost:3000  → Settings → Billing → Upgrade');

  if (!webhookSecret && !env.STRIPE_WEBHOOK_SECRET) {
    console.log('   3. For local webhook testing:');
    console.log('      a) Install Stripe CLI: https://stripe.com/docs/stripe-cli#install');
    console.log('      b) Run: stripe login');
    console.log('      c) Run: stripe listen --forward-to localhost:3000/api/billing/webhook');
    console.log('      d) Copy the "whsec_..." secret and add to .env.local as STRIPE_WEBHOOK_SECRET');
  }

  console.log('');
}

main().catch((err) => {
  console.error('\n[error]  Stripe setup failed:', err.message);
  process.exit(1);
});
