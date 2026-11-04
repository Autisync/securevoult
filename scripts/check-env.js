#!/usr/bin/env node
/**
 * scripts/check-env.js
 *
 * Validates all required environment variables for SecureVoult.
 * Prints a per-service checklist with specific "how to get this" instructions
 * for anything that is missing or looks like a placeholder.
 *
 * Usage:  node scripts/check-env.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Load .env.local ──────────────────────────────────────────────────────────

const envPath = path.join(__dirname, '..', '.env.local');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const env   = {};
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

const fileEnv  = loadEnv(envPath);
const combined = { ...fileEnv, ...process.env }; // process.env wins

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /^your[-_]/i,
  /placeholder/i,
  /^<.*>$/,
  /^changeme$/i,
  /^todo$/i,
  /^xxxx/i,
];

function isPlaceholder(val) {
  if (!val) return false;
  return PLACEHOLDER_PATTERNS.some(re => re.test(val));
}

function get(key) {
  const val = combined[key];
  if (!val || val.trim() === '') return { status: 'missing', value: null };
  if (isPlaceholder(val))           return { status: 'placeholder', value: val };
  return { status: 'ok', value: val };
}

let hasErrors   = false;
let hasWarnings = false;

function report(key, { status }, howToGet) {
  if (status === 'ok') {
    console.log(`  [ok]  ${key}`);
    return;
  }
  if (status === 'missing') {
    console.log(`  [missing]  ${key}  -- MISSING`);
    if (howToGet) console.log(`       ${howToGet}`);
    hasErrors = true;
    return;
  }
  if (status === 'placeholder') {
    console.log(`  [!] ${key}  -- looks like a placeholder, replace with a real value`);
    if (howToGet) console.log(`       ${howToGet}`);
    hasWarnings = true;
  }
}

function reportOptional(key, { status }, howToGet) {
  if (status === 'ok') {
    console.log(`  [ok]  ${key}`);
    return;
  }
  if (status === 'missing') {
    console.log(`  [optional]  ${key}  -- not set`);
    if (howToGet) console.log(`       ${howToGet}`);
    return;
  }
  if (status === 'placeholder') {
    console.log(`  [!] ${key}  -- looks like a placeholder, replace with a real value if you want this optional feature enabled`);
    if (howToGet) console.log(`       ${howToGet}`);
    hasWarnings = true;
  }
}

// ── Checks ───────────────────────────────────────────────────────────────────

console.log('\n[check-env]  SecureVoult -- Environment Variable Check\n');

// Firebase client
console.log('\n-- Firebase (client) --');
report('NEXT_PUBLIC_FIREBASE_API_KEY',            get('NEXT_PUBLIC_FIREBASE_API_KEY'),
       'Firebase Console → Project Settings → General → Your apps → Web app → apiKey');
report('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',         get('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
       'Firebase Console → Project Settings → General → authDomain  (e.g. your-project.firebaseapp.com)');
report('NEXT_PUBLIC_FIREBASE_PROJECT_ID',          get('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
       'Firebase Console → Project Settings → General → projectId');
report('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',      get('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
       'Firebase Console → Project Settings → General → storageBucket');
report('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', get('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
       'Firebase Console → Project Settings → General → messagingSenderId');
report('NEXT_PUBLIC_FIREBASE_APP_ID',              get('NEXT_PUBLIC_FIREBASE_APP_ID'),
       'Firebase Console → Project Settings → General → appId');

// Firebase Admin
console.log('\n-- Firebase Admin (server-side only) --');
report('FIREBASE_ADMIN_PROJECT_ID',    get('FIREBASE_ADMIN_PROJECT_ID'),
       'Must match NEXT_PUBLIC_FIREBASE_PROJECT_ID');
report('FIREBASE_ADMIN_CLIENT_EMAIL',  get('FIREBASE_ADMIN_CLIENT_EMAIL'),
       'Firebase Console → Project Settings → Service Accounts → Generate new private key → client_email');
const pkStatus = get('FIREBASE_ADMIN_PRIVATE_KEY');
report('FIREBASE_ADMIN_PRIVATE_KEY',   pkStatus,
       [
         'Firebase Console → Project Settings → Service Accounts → Generate new private key',
         '       → Download JSON → copy the "private_key" value',
         '       → In .env.local paste as one line with literal \\n for newlines:',
         '       FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n"',
       ].join('\n'));

if (pkStatus.status === 'ok') {
  // Validate it looks like a PEM key
  const pk = pkStatus.value.replace(/\\n/g, '\n');
  if (!pk.includes('-----BEGIN')) {
    console.log('  [!] FIREBASE_ADMIN_PRIVATE_KEY does not contain a PEM header.');
    console.log('       Expected format: "-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n"');
    hasWarnings = true;
  }
}

// MongoDB
console.log('\n-- MongoDB --');
report('MONGODB_URI', get('MONGODB_URI'),
       'MongoDB Atlas → Database → Connect → Drivers → copy the connection string');

// Stripe
console.log('\n-- Stripe --');
const stripeKey = get('STRIPE_SECRET_KEY');
report('STRIPE_SECRET_KEY', stripeKey,
       'https://dashboard.stripe.com/test/apikeys → Secret key  (use sk_test_... in development)');
report('STRIPE_WEBHOOK_SECRET', get('STRIPE_WEBHOOK_SECRET'),
       'Run: stripe listen --forward-to localhost:3000/api/billing/webhook  (copy the whsec_... secret)');
report('STRIPE_PRICE_PRO_MONTHLY',     get('STRIPE_PRICE_PRO_MONTHLY'),
       'Run:  node scripts/stripe-setup.js  (creates prices automatically once STRIPE_SECRET_KEY is set)');
report('STRIPE_PRICE_PRO_YEARLY',      get('STRIPE_PRICE_PRO_YEARLY'),     'Same — run stripe-setup.js');
report('STRIPE_PRICE_COMPANY_MONTHLY', get('STRIPE_PRICE_COMPANY_MONTHLY'),'Same — run stripe-setup.js');
report('STRIPE_PRICE_COMPANY_YEARLY',  get('STRIPE_PRICE_COMPANY_YEARLY'), 'Same — run stripe-setup.js');

// HaveIBeenPwned
console.log('\n-- HaveIBeenPwned --');
reportOptional('HIBP_API_KEY', get('HIBP_API_KEY'),
       'https://haveibeenpwned.com/API/Key  (optional -- breach email checks return notConfigured without it)');

// App URL
console.log('\n-- App URL --');
report('NEXT_PUBLIC_APP_URL', get('NEXT_PUBLIC_APP_URL'),
       'Set to http://localhost:3000 for dev, https://app.securevoult.co.uk for production');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');

if (!hasErrors && !hasWarnings) {
  console.log('\n[ok]  All environment variables are set.\n');
  process.exit(0);
}

if (hasErrors) {
  console.log(`[error]  One or more required variables are missing.`);
  console.log('    Copy .env.example -> .env.local and fill in the values.\n');
}

if (hasWarnings && !hasErrors) {
  console.log('[!]  All required variables are present but some look like placeholders.\n');
}

process.exit(hasErrors ? 1 : 0);
