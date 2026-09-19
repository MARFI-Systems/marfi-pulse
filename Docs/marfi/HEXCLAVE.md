# MARFI Pulse Hexclave login

Branch: `marfi/hexclave-pilot`
Fork: https://github.com/MARFI-Systems/marfi-pulse
Hexclave Cloud project: **MARFI Pulse** (MARFI team)
Live Pulse: still stock OneUptime 13.0.5 on Elestio. Do not cut over until a test login works.

## Rules
- Hexclave is embedded auth, not OneUptime SAML/OIDC IdP.
- Default off: `HEXCLAVE_ENABLED=false`.
- Native master-admin password stays as break-glass. Do not require SSO.
- No password UI for team users once Hexclave is on.
- Sign-up is off in Hexclave. Create users in the Hexclave dashboard, bind by email to existing OneUptime users.
- Secrets stay in Aside Vault / host env. Never commit keys.

## Auth methods (Hexclave Cloud)
- Magic link / OTP: on
- Passkey: on
- GitHub: on
- Email/password: off
- Google / Microsoft: off
- Allow new user sign-ups: off

## Next
1. Generate Hexclave project keys, vault them, do not print.
2. Trust `https://pulse.marfi.app` only after a staging test.
3. Implement `POST /api/identity/hexclave/exchange` (JWKS verify, bind email, issue OneUptime session).
4. Wrap Accounts `Login.tsx` behind `HEXCLAVE_ENABLED`.
5. Point Elestio at this fork only after Danny signs in via Hexclave in a non-prod check.

Native OneUptime reset-link login remains the live path until that cutover.

## CI
- Upstream OneUptime workflows parked in `.github/upstream-workflows/` (do not run on this fork).
- Trivy on Monk `monkci-ubuntu-24.04-2` via `.github/workflows/trivy-security.yml`.
