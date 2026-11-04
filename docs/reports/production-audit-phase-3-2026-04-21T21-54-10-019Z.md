# Phase 3 - Security and Claims Gate

- Overall: **FAIL**
- Passed: 0
- Failed: 1

## Step Results

| Step | Status | Exit Code |
|---|---|---|
| npm run type-check | FAIL | 2 |

## npm run type-check

```text

> type-check
> tsc --noEmit

src/app/api/billing/downgrade/route.ts(38,46): error TS2339: Property 'retryAfter' does not exist on type 'RateLimitResult'.
src/app/api/billing/upgrade-intent/route.ts(40,46): error TS2339: Property 'retryAfter' does not exist on type 'RateLimitResult'.
src/app/api/billing/upgrade-intent/route.ts(154,46): error TS2339: Property 'retryAfter' does not exist on type 'RateLimitResult'.

```