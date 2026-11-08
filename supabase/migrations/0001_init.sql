-- VoxSpec initial schema
-- Every table: owner_id for RLS, RLS enabled in this same migration,
-- indexes on all foreign keys and policy columns.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects (owner_id);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sessions (one dictation + clarification round-trip)
-- ---------------------------------------------------------------------------
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  status      text not null default 'draft'
              check (status in ('draft','analyzed','clarifying','compiled')),
  lang_hint   text not null default 'auto' check (lang_hint in ('auto','en','hi','hi-Latn')),
  round       smallint not null default 1 check (round between 1 and 2),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index sessions_owner_id_idx   on public.sessions (owner_id);
create index sessions_project_id_idx on public.sessions (project_id);
create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- transcripts
-- ---------------------------------------------------------------------------
create table public.transcripts (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id      uuid not null references public.sessions(id) on delete cascade,
  raw_text        text not null check (char_length(raw_text) between 1 and 12000),
  source          text not null default 'typed'
                  check (source in ('typed','wispr','browser_stt','upload')),
  detected_langs  text[] not null default '{}',
  created_at      timestamptz not null default now()
);
create index transcripts_owner_id_idx   on public.transcripts (owner_id);
create index transcripts_session_id_idx on public.transcripts (session_id);

-- ---------------------------------------------------------------------------
-- extractions (output of pipeline stages 2-3, with provenance)
-- ---------------------------------------------------------------------------
create table public.extractions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id      uuid not null references public.sessions(id) on delete cascade,
  transcript_id   uuid not null references public.transcripts(id) on delete cascade,
  claims          jsonb not null,
  decisions       jsonb not null,
  revision_trace  jsonb not null,
  provider        text not null,
  model           text not null,
  prompt_version  text not null,
  latency_ms      integer check (latency_ms >= 0),
  input_tokens    integer check (input_tokens >= 0),
  output_tokens   integer check (output_tokens >= 0),
  created_at      timestamptz not null default now()
);
create index extractions_owner_id_idx      on public.extractions (owner_id);
create index extractions_session_id_idx    on public.extractions (session_id);
create index extractions_transcript_id_idx on public.extractions (transcript_id);

-- ---------------------------------------------------------------------------
-- questions and answers
-- ---------------------------------------------------------------------------
create table public.questions (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id       uuid not null references public.sessions(id) on delete cascade,
  text             text not null,
  why_it_matters   text not null,
  impact           smallint not null check (impact between 1 and 5),
  options          jsonb not null default '[]'::jsonb,
  status           text not null default 'open' check (status in ('open','answered','skipped')),
  created_at       timestamptz not null default now()
);
create index questions_owner_id_idx   on public.questions (owner_id);
create index questions_session_id_idx on public.questions (session_id);

create table public.answers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question_id  uuid not null unique references public.questions(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now()
);
create index answers_owner_id_idx on public.answers (owner_id);

-- ---------------------------------------------------------------------------
-- assumptions
-- ---------------------------------------------------------------------------
create table public.assumptions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  statement   text not null,
  risk        text not null check (risk in ('low','medium','high')),
  status      text not null default 'open' check (status in ('open','confirmed','rejected')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index assumptions_owner_id_idx   on public.assumptions (owner_id);
create index assumptions_session_id_idx on public.assumptions (session_id);
create trigger assumptions_set_updated_at before update on public.assumptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- spec_versions (immutable once written)
-- ---------------------------------------------------------------------------
create table public.spec_versions (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id       uuid not null references public.projects(id) on delete cascade,
  session_id       uuid not null references public.sessions(id) on delete cascade,
  version          integer not null check (version >= 1),
  schema_version   text not null default '1.0',
  spec             jsonb not null,
  markdown         text not null,
  readiness        smallint not null check (readiness between 0 and 100),
  readiness_detail jsonb not null,
  idempotency_key  text,
  created_at       timestamptz not null default now(),
  unique (project_id, version)
);
create index spec_versions_owner_id_idx   on public.spec_versions (owner_id);
create index spec_versions_project_id_idx on public.spec_versions (project_id);
create index spec_versions_session_id_idx on public.spec_versions (session_id);
create unique index spec_versions_idem_idx
  on public.spec_versions (owner_id, idempotency_key) where idempotency_key is not null;

-- immutability: block updates to spec content
create or replace function public.block_spec_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'spec_versions rows are immutable';
end;
$$;
create trigger spec_versions_immutable before update on public.spec_versions
  for each row execute function public.block_spec_update();

-- ---------------------------------------------------------------------------
-- exports (audit of what was exported)
-- ---------------------------------------------------------------------------
create table public.exports (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  spec_version_id  uuid not null references public.spec_versions(id) on delete cascade,
  format           text not null check (format in ('md','zip','prompt')),
  agent            text check (agent in ('antigravity','claude-code','cursor')),
  created_at       timestamptz not null default now()
);
create index exports_owner_id_idx        on public.exports (owner_id);
create index exports_spec_version_id_idx on public.exports (spec_version_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only, all operations
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects','sessions','transcripts','extractions','questions',
    'answers','assumptions','spec_versions','exports'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end
$$;

-- Child-row integrity: a child's owner must match its parent's owner.
-- Prevents inserting rows pointing at another user's parent.
create or replace function public.assert_same_owner()
returns trigger
language plpgsql
as $$
declare
  parent_owner uuid;
begin
  execute format('select owner_id from public.%I where id = $1', tg_argv[0])
    into parent_owner
    using (to_jsonb(new) ->> tg_argv[1])::uuid;
  if parent_owner is distinct from new.owner_id then
    raise exception 'owner mismatch with parent %', tg_argv[0];
  end if;
  return new;
end;
$$;

create trigger sessions_owner_check     before insert or update on public.sessions
  for each row execute function public.assert_same_owner('projects', 'project_id');
create trigger transcripts_owner_check  before insert or update on public.transcripts
  for each row execute function public.assert_same_owner('sessions', 'session_id');
create trigger extractions_owner_check  before insert or update on public.extractions
  for each row execute function public.assert_same_owner('sessions', 'session_id');
create trigger questions_owner_check    before insert or update on public.questions
  for each row execute function public.assert_same_owner('sessions', 'session_id');
create trigger answers_owner_check      before insert or update on public.answers
  for each row execute function public.assert_same_owner('questions', 'question_id');
create trigger assumptions_owner_check  before insert or update on public.assumptions
  for each row execute function public.assert_same_owner('sessions', 'session_id');
create trigger spec_versions_owner_check before insert on public.spec_versions
  for each row execute function public.assert_same_owner('projects', 'project_id');
create trigger exports_owner_check      before insert or update on public.exports
  for each row execute function public.assert_same_owner('spec_versions', 'spec_version_id');

-- Privileges: no anon access to app tables
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
