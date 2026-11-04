# Phased Production Readiness Plan

This plan organizes production readiness into repeatable phases.

## Phase 1: Foundation Gate (Automated)

Objective: Ensure baseline code health and build correctness.

Checks:
- Environment validation
- Type checking
- Web production build
- Extension bundle build
- Extension manifest validation

Note:
- The legacy `next lint` flow is not used in the automated gates because Next.js 16 changed lint command behavior in this repo. Add an explicit ESLint pipeline as a follow-up hardening task.

Exit criteria:
- All commands pass with exit code 0
- No critical type/build errors

## Phase 2: Platform Gate (Automated + Manual)

Objective: Ensure each app surface is buildable and operationally sane.

Checks:
- Desktop dependency install and package build
- Mobile dependency install and config validation
- Extension packaging artifact generation
- Web regression smoke checks

Exit criteria:
- Desktop build succeeds
- Mobile config validates
- Extension package is generated
- No platform-specific blockers

## Phase 3: Security & Product Claims Gate (Manual + Agent)

Objective: Verify production trust posture and market-facing accuracy.

Checks:
- Security hardening checklist
- Admin/RBAC validation
- Legal and public route verification
- Landing/pricing/marketing claim accuracy
- Store submission readiness deltas

Exit criteria:
- No open P0/P1 vulnerabilities
- No false product claims
- Legal/support links verified

## Phase 4: Release Candidate Gate

Objective: Final pre-release confidence.

Checks:
- Run all domain agents
- Triage and resolve findings
- Rerun phase 1 and phase 2 automation
- Publish QA summary delta for this release

Exit criteria:
- Blocker list is empty
- Reports attached for all phases
- Build artifacts generated and versioned

## Required Artifacts Per Phase

- Command output summary
- Findings report with severity
- Fixes applied and file list
- Remaining known risks

## Recommended Ownership

- Engineering: phase 1 and phase 2
- Security: phase 3 security section
- Product/Marketing: phase 3 claims section
- Release manager: phase 4 signoff
