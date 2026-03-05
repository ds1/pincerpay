# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in PincerPay, please report it responsibly.

**Email:** danmakesthings@gmail.com

**Subject line:** `[SECURITY] PincerPay: <brief description>`

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
- Facilitator server (`apps/facilitator/`)
- SDK packages (`@pincerpay/core`, `@pincerpay/solana`, `@pincerpay/merchant`, `@pincerpay/agent`, `@pincerpay/mcp`)
- Anchor program (`packages/solana-program/`)
- Dashboard authentication and authorization (`apps/dashboard/`)
- Payment verification and settlement logic

**Out of scope:**
- Social engineering attacks
- Denial of service attacks
- Third-party dependencies (report upstream; notify us if it affects PincerPay)
- Issues in test/example code that don't affect production

## Disclosure Policy

- We will coordinate disclosure timelines with you
- We will credit reporters in release notes (unless you prefer anonymity)
- Please do not open public GitHub issues for security vulnerabilities
