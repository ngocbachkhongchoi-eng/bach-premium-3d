# Security notes

- IP lockouts are designed for a single Render instance; login failures are serialized through `mutate` and persisted in the JSONBin record under `security.loginIps` (HMAC of client IP). No actual IP is written.
- At most three failed login attempts over a rolling 30-minute window trigger a 30-minute ban. A successful login resets the IP failure count. Website HTML remains accessible; API requests except health are blocked while banned.
- Trust X-Forwarded-For only behind Render (`TRUST_RENDER_PROXY=true`). Different proxies need their own trusted IP parsing design.
- Admin sessions expire after four hours; user sessions after 24 hours. Session revocation on logout is persisted.
- TOTP is optional; set `ADMIN_TOTP_SECRET` via private Render Environment. Invalid or already used codes are rejected.
- Audit and stress-test business-critical mutations before accepting real money. JSONBin single record is not a transactional payment database.
