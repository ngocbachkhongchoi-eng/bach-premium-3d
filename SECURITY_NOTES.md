# Security notes

- IP lockouts are designed for a single Render instance; login failures are serialized through `mutate` and persisted in the JSONBin record under `security.loginIps` (HMAC of client IP). No actual IP is written.
- At most three failed login attempts over a rolling 30-minute window trigger a 30-minute ban. A successful login resets the IP failure count. Website HTML remains accessible; API requests except health are blocked while banned.
- Trust X-Forwarded-For only behind Render (`TRUST_RENDER_PROXY=true`). Different proxies need their own trusted IP parsing design.
- Admin sessions expire after four hours; user sessions after 24 hours. Session revocation on logout is persisted.
- TOTP is optional; set `ADMIN_TOTP_SECRET` via private Render Environment. Invalid or already used codes are rejected.
- Audit and stress-test business-critical mutations before accepting real money. JSONBin single record is not a transactional payment database.


## Review and regression checks (2026-11-03)
- Run `node --test tests/api.test.js`. This starts an isolated in-memory JSONBin substitute and the real application; it never accesses the production Bin.
- Verified anonymous requests cannot update prices (401), signed-in customers cannot update prices (403), and admins can update a formatted VND price. Invalid amounts and cross-origin requests are rejected. Existing order amounts remain unchanged, changes survive restart, and logout revokes admin access.
- Price-only changes use the authenticated admin endpoint. Product content/delivery restrictions for existing orders remain in place. Listing price changes do not reprice, reopen or resell existing orders.
- Fixed form dispatch: an input named `id` shadows `HTMLFormElement.id`; use `getAttribute('id')` to identify edit forms.
- Browser checks with mocked API passed at desktop and 390px mobile widths: edit dialog, visible validation error, successful save, no JavaScript errors or horizontal page overflow. These are local checks, not production validation.
- Legacy external links are restricted to HTTP(S) on the client before opening; HTML escaping alone does not reject javascript URLs.
- Production Render access was blocked by the environment network policy. Live deployment, actual JSONBin permissions, TOTP configuration and production data have not been verified.
- Remaining architectural risk: multiple processes writing the same JSONBin can overwrite concurrent changes. Use one writer and plan a transactional database for monetary operations. This review does not establish that all defects have been eliminated.

## Request and purchase hardening (2026-11-04)
- Reject non-object JSON bodies with HTTP 400; reject browser cross-site POST requests in addition to existing Origin, JSON content type and custom-header checks.
- Limit POST requests to 120 per IP per minute, alongside endpoint-specific limits. This is a single-process application limit, not DDoS protection.
- Validate stored coupon percentages and quantities at purchase time, and reject unsafe or negative final prices before changing the wallet.
- Regression suite: `node --test tests/*.test.js` (4 tests passed). Added checks for private server/config paths, malformed request bodies, cross-site POSTs, invalid coupon balances, simultaneous purchases of one listing, and delivery credentials hidden from another customer. Concurrent purchase guarantees apply to one server process only.
- F12/DevTools cannot reliably be disabled by a website. No keyboard or context-menu blocking is used as a security control; authorization and delivery filtering run on the server.
- These local tests do not certify production security. Before accepting real payments, verify production credentials/access controls and backups, enable admin TOTP, and replace JSONBin with a transactional database for multiple writers. A reusable six-digit recovery code remains weaker than a higher-entropy or verified-channel recovery mechanism, even with rate limits.

## Session revocation hardening (2026-11-04)
- Fixed a demonstrated logout bypass: the token parser previously ignored extra dot-separated suffixes while revocation hashed the complete token. Strict token syntax now rejects those variants before signature verification; expiry must be an integer in the future.
- Cleanup now retains every unexpired revocation instead of dropping entries beyond 2,000, which could reactivate a logged-out session. This increases storage requirements under high session churn; move session storage to a database with expiry support before scaling. Storage failures must not be handled by dropping live revocations.
- Added regression checks for suffixed revoked tokens, persistence across restart, and cleanup with more than 2,000 unexpired entries. The suffix regression failed against the previous code (200 instead of 401); all four suite tests passed after the fix.
