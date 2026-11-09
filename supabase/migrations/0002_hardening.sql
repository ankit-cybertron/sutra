-- VoxSpec migration 0002: Hardening functions and triggers
-- Enforces search_path security and compound parent check for spec_versions

-- 1. Hardened functions with pinned search_path
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.block_spec_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'spec_versions rows are immutable';
end;
$$;

create or replace function public.assert_same_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_owner uuid;
begin
  execute format('select owner_id from public.%I where id = $1', tg_argv[0])
    into parent_owner
    using (to_jsonb(new) ->> tg_argv[1])::uuid;
  if parent_owner is null or parent_owner is distinct from new.owner_id then
    raise exception 'owner mismatch with parent %', tg_argv[0];
  end if;
  return new;
end;
$$;

-- 2. Add session owner check on spec_versions
drop trigger if exists spec_versions_session_owner_check on public.spec_versions;
create trigger spec_versions_session_owner_check before insert on public.spec_versions
  for each row execute function public.assert_same_owner('sessions', 'session_id');
