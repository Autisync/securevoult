# Phase 3 - Security and Claims Gate

- Overall: **FAIL**
- Passed: 0
- Failed: 1

## Step Results

| Step | Status | Exit Code |
|---|---|---|
| npm run verify | FAIL | 2 |

## npm run verify

```text

> verify
> npm run type-check && npm run lint


> type-check
> tsc --noEmit

src/contexts/VaultContext.tsx(134,51): error TS2322: Type 'VaultData | null' is not assignable to type 'VaultData'.
  Type 'null' is not assignable to type 'VaultData'.

```