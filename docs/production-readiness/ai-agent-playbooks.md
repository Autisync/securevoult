# Production Readiness AI Agent Playbooks

Use this file to run focused agents by domain and keep quality moving in phases.

## How To Use

1. Pick a phase from the phased roadmap.
2. Run each agent prompt in order.
3. Each agent must output:
- Findings ordered by severity
- Blocking vs non-blocking issues
- Exact file paths affected
- Suggested fixes and tests
4. Merge fixes, rerun phase checks, and attach the report artifact.

## Global Agent Output Contract

Every agent response must include:
- Scope covered
- Critical findings (P0/P1)
- Regression risks
- Missing tests
- Recommended patch list
- Verification commands

## Agent 1: UI/UX Quality Agent

Goal: Make web UI production-ready for visual quality, accessibility, consistency, and responsive behavior.

Checklist:
- Responsive layouts: 320px, 768px, 1024px, 1440px
- Keyboard navigation and focus visibility
- Color contrast and semantic labels
- Error states, loading states, empty states
- Dark/light theme consistency

Primary targets:
- src/components/
- src/app/
- src/app/globals.css

Deliverables:
- UI defects by page/component
- Accessibility issues with severity
- Quick wins and design debt backlog

## Agent 2: API Contract Agent

Goal: Validate API behavior, consistency, status codes, auth requirements, and error shape.

Checklist:
- 2xx/4xx/5xx consistency
- Validation and parsing safety
- Rate limit enforcement
- Admin route protections
- Stable response schema for frontend callers

Primary targets:
- src/app/api/
- src/lib/api-error.ts
- src/lib/rate-limit.ts

Deliverables:
- Endpoint matrix with expected vs actual behavior
- Contract break risks
- Missing tests and edge cases

## Agent 3: Backend Security Agent

Goal: Review server security and operational safety.

Checklist:
- Token verification paths
- Session revocation enforcement
- Secret handling and logs
- SSRF/XSS/open redirect surface
- Data race/conflict handling (vault versioning)

Primary targets:
- src/lib/auth*.ts
- src/lib/vault.ts
- src/lib/rate-limit.ts
- src/models/

Deliverables:
- Vulnerability list with exploitability ranking
- Minimal hardening patch plan

## Agent 4: Mobile Readiness Agent

Goal: Validate Expo app and release posture.

Checklist:
- App starts and navigation flow works
- Biometric unlock behavior and fallback paths
- Error handling and offline behavior
- EAS config sanity
- Store readiness gaps

Primary targets:
- mobile/
- docs/testing-mobile.md

Deliverables:
- Mobile release blockers
- Device test matrix

## Agent 5: Extension Readiness Agent

Goal: Validate browser extension stability, permissions, popup flow, and packaging.

Checklist:
- Manifest permissions minimality
- Popup auth + vault unlock/create flows
- Save-login and autofill behavior
- Cross-browser install notes
- Packaging and versioning correctness

Primary targets:
- extension-package/
- public/background.js
- public/content.js
- src/components/ExtensionPopup.tsx

Deliverables:
- Permission risk list
- UX breakpoints in popup flow
- Store submission checklist deltas

## Agent 6: Desktop Readiness Agent

Goal: Validate Electron hardening and packaging posture.

Checklist:
- BrowserWindow security flags
- Preload boundary and exposed APIs
- Dev/prod URL handling
- Packaging outputs and signing readiness

Primary targets:
- desktop/main.js
- desktop/preload.js
- desktop/package.json

Deliverables:
- Security hardening findings
- Packaging blockers

## Agent 7: Admin & RBAC Agent

Goal: Validate admin-only surfaces and audit integrity.

Checklist:
- Role gating on UI and API
- Activity log null safety and accuracy
- Admin mutation safeguards
- Session-level accountability

Primary targets:
- src/components/AdminPanel.tsx
- src/app/api/admin/
- src/lib/auth*.ts

Deliverables:
- Privilege escalation risks
- Audit reliability issues

## Agent 8: Landing & Marketing Agent

Goal: Ensure public claims are accurate and conversion UX is strong.

Checklist:
- Feature claims match real implementation
- Pricing and plan language consistency
- CTA destination integrity
- SEO metadata consistency
- Legal links and trust messaging

Primary targets:
- src/components/LandingPage.tsx
- src/app/layout.tsx
- docs/store-listings/
- docs/qa-summary.md

Deliverables:
- Claim mismatch list
- Conversion UX improvements

## Agent 9: Performance & Observability Agent

Goal: Improve runtime performance and support production debugging.

Checklist:
- Bundle hotspots and unnecessary re-renders
- API latency and retry strategy
- Logging quality and signal/noise
- Health checks and service diagnostics

Primary targets:
- src/components/
- src/app/api/health/
- src/lib/

Deliverables:
- Top performance bottlenecks
- Monitoring gap list

## Agent 10: Test Coverage Agent

Goal: Improve confidence with minimal, high-value test additions.

Checklist:
- Critical path smoke tests
- Auth and vault flow tests
- Extension popup functional checks
- Admin route access tests

Primary targets:
- docs/testing-*.md
- src/app/api/
- src/contexts/

Deliverables:
- Priority test backlog
- Suggested CI test stages

## Suggested Cadence

- Daily: UI/UX, API contract, extension popup checks
- Weekly: backend security, admin/RBAC, performance
- Release week: run all 10 agents and complete all phase gates
