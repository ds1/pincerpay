# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in PincerPay, please report it using [GitHub's private vulnerability reporting](https://github.com/ds1/pincerpay/security/advisories/new).

**What to include:**
- Description of the vulnerability
- Steps to reproduce
- Affected component (facilitator, SDK, Anchor program, dashboard)
- Potential impact assessment

**Response timeline:**
- Acknowledgment within 48 hours
- Assessment and severity classification within 1 week
- Fix timeline communicated after assessment

## Scope

**In scope:**
- Facilitator server (`apps/facilitator/`) — auth, settlement, env-scoping enforcement, OFAC, webhook signing
- SDK packages (`@pincerpay/core`, `@pincerpay/solana`, `@pincerpay/merchant`, `@pincerpay/agent`, `@pincerpay/mcp`, `@pincerpay/cli`, `@pincerpay/onboarding`)
- Database schemas + migrations (`@pincerpay/db`) — RLS, environment integrity trigger
- Anchor program (`packages/program/`)
- Dashboard authentication, authorization, and admin surface (`apps/dashboard/`)
- Self-serve onboarding endpoints (`/v1/onboarding/*`) — Supabase Auth integration, CLI bearer-token issuance, audit log
- Payment verification and settlement logic
- Webhook signature verification (HMAC-SHA256) and delivery integrity

**Out of scope:**
- Social engineering attacks
- Denial of service attacks
- Third-party dependencies (report upstream; notify us if it affects PincerPay)
- Issues in test/example code that don't affect production

## Disclosure Policy

- We will coordinate disclosure timelines with you
- We will credit reporters in release notes (unless you prefer anonymity)
- Please do not open public GitHub issues for security vulnerabilities
