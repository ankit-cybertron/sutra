# ADR 0005: Database Schema Hardening and Security Definer Triggers

- Status: Accepted
- Date: 2026-11-09

## Context
During Phase 1 critical review of `supabase/migrations/0001_init.sql` against `supabase-postgres-best-practices` and `security-review` skills, several security and integrity considerations were identified before initial application:

1. **Function Search Path:** Triggers and functions (`set_updated_at`, `block_spec_update`, `assert_same_owner`) did not explicitly define `SET search_path = public`, which leaves potential exposure to search_path hijacking in multi-schema environments.
2. **Security Definer for Integrity Validation:** `assert_same_owner` inspects the parent record's `owner_id`. When invoked in the context of an unprivileged or malicious user trying to reference another tenant's parent, `assert_same_owner` must execute with `SECURITY DEFINER` and a pinned `search_path` to reliably look up the parent record's owner and assert that it matches `new.owner_id`.
3. **Compound Foreign Key Integrity on Spec Versions:** `spec_versions` references both `projects(id)` and `sessions(id)`. The original migration checked owner alignment with `projects` but omitted the check for `sessions`.

## Decision
Create migration `supabase/migrations/0002_hardening.sql` (or apply hardening before first deploy) ensuring:
- Functions explicitly pin `SET search_path = public`.
- `assert_same_owner()` is marked `SECURITY DEFINER` with search path pinned.
- `spec_versions` validates parent ownership on both `project_id` and `session_id`.

## Consequences
- Parent-child ownership validation is deterministic and cannot be bypassed.
- Functions are protected against search_path manipulation.
- RLS cross-user isolation is guaranteed across all relations.
