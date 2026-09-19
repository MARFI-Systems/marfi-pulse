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
- Passkey: off
- GitHub: off
- Email/password: off
- Google / Microsoft: off
- Allow new user sign-ups: off
- Login mail: Resend from `secure-login@marfi.app`

## Cloud project
- Project ID: `ad703cc5-cd3e-4728-aaff-000ee09498e9`
- Trusted domain: `https://pulse.marfi.app` (localhost still allowed for non-prod)
- Project keys: 30-day pair, Aside Vault `Hexclave MARFI Pulse project keys`. Do not print.
- Resend: Aside Vault `Resend Pulse Hexclave login mail`. Sender `secure-login@marfi.app` / MARFI Pulse.

## Fork implementation (this branch)
- `POST /identity/hexclave/exchange` binds an existing `@marfi.io` OneUptime user after Hexclave `/users/me` verify. Does not create users.
- Accounts `Login.tsx` wraps `HexclaveLogin` when `HEXCLAVE_ENABLED=true`.
- Frontend env allowlist: `HEXCLAVE_ENABLED`, `HEXCLAVE_PROJECT_ID`, `HEXCLAVE_PUBLISHABLE_CLIENT_KEY`.
- `HEXCLAVE_SECRET_SERVER_KEY` is deny-listed from `env.js`.

## Not done
- No Elestio cutover. Live Pulse stays stock OneUptime 13.0.5 until a Hexclave test login works on this fork.
- Native OneUptime reset-link login remains the live path until that cutover.
- Do not set `HEXCLAVE_ENABLED=true` on production.

## CI
- Upstream OneUptime workflows parked in `.github/upstream-workflows/` (do not run on this fork).
- Trivy on Monk `monkci-ubuntu-24.04-2` via `.github/workflows/trivy-security.yml`.
