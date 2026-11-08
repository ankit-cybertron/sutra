# SECURITY.md

Threat model and required controls. The `security-review` skill must be run against this file's checklist before each phase is declared done.

## 1. Assets

- User transcripts and specs (private product ideas).
- Auth sessions and JWTs.
- LLM provider API keys and the Supabase service-role key.
- Availability and cost budget (LLM calls cost money).

## 2. Trust boundaries

Browser <-> API (untrusted client). API <-> Postgres (RLS enforced). API <-> LLM provider (untrusted output). Transcript content is **untrusted data** throughout.

## 3. Threats and controls

| Threat | Control |
|---|---|
| Broken access control (reading other users' specs) | RLS on every table with `owner_id = (select auth.uid())`; API queries run in the user's JWT context, not the service role; automated cross-user tests must fail closed |
| Forged or expired JWT | Verify signature, `exp`, `aud`, `iss` against Supabase JWKS; reject otherwise with 401 |
| Prompt injection via transcript ("ignore previous instructions...") | Transcript wrapped in clearly delimited data block; system prompt states it is data; pipeline LLM calls have no tools and no network; output validated by schema; resolver ignores instruction-like claims; injection test cases in golden set |
| LLM output abuse (XSS in markdown) | Render Markdown with a sanitizer, no raw HTML, links get `rel="noopener noreferrer"`; strict CSP |
| Secrets leakage | Keys only server-side; `.env` gitignored; secret scanning in CI; service-role key never sent to browser; logs scrub tokens |
| Cost abuse / DoS | Per-user rate limits on analyze and compile; input length cap 12,000; per-user daily LLM budget; request timeouts; max body size |
| CSRF | Bearer-token API (no cookie auth to API); Supabase cookies are `SameSite=Lax`, `HttpOnly`, `Secure` |
| CORS misconfiguration | Explicit allow-list from env, no wildcard with credentials |
| SQL injection | Parameterized queries only; no string-built SQL; migrations reviewed |
| Insecure dependencies | Pinned versions, `pip-audit` and `npm audit` in CI, Dependabot, review on every new dependency |
| Data retention / privacy | Text only (no audio stored); user can delete project (cascades) and all data; deletion tested; no transcript content in logs above DEBUG |
| Third-party data sharing | Document which provider receives transcript text; provider selection visible in settings; no training opt-in assumed, note provider terms in README |
| Clickjacking, content sniffing | `X-Frame-Options: DENY` / `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |

## 4. Required headers (web)

CSP with nonce-based scripts, `default-src 'self'`, `connect-src` limited to API and Supabase origins, `img-src 'self' data:`, `frame-ancestors 'none'`. HSTS in production.

## 5. Secure defaults

- New tables: RLS enabled in the same migration that creates them.
- Public share links (post-MVP) use unguessable 128-bit tokens, are revocable, and expose a read-only projection.
- Error responses never include stack traces or provider raw errors; include `request_id`.

## 6. Review checklist (run before each phase completes)

- [ ] Every table has RLS enabled and policies for all operations used
- [ ] Cross-user access test exists and passes (user B cannot read/write user A rows)
- [ ] No secret in repo history, bundle, or logs (scan run)
- [ ] JWT verification covers signature, expiry, audience, issuer
- [ ] Rate limits active on analyze and compile, tested
- [ ] Prompt-injection fixtures in tests and eval golden set pass
- [ ] Markdown rendering sanitized, CSP active
- [ ] Dependency audit clean or findings documented
- [ ] Delete-my-data works and is tested end to end
