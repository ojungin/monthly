-- 업무보고 Supabase 프로젝트(qoabsfqxufdzcjhgrceq)의 SQL Editor에서 실행합니다.
begin;
create table if not exists public.team_responsibilities(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 100),
 position text not null check(length(trim(position)) between 1 and 100),
 duties text not null check(length(trim(duties)) between 1 and 10000),
 created_by uuid not null default auth.uid() references public.members(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create or replace function public.touch_team_responsibility() returns trigger
 language plpgsql set search_path='' as $$
begin
 if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
  raise exception '작성자 및 최초 작성일 변경 불가';
 end if;
 new.updated_at=clock_timestamp();
 return new;
end $$;
drop trigger if exists touch_team_responsibility on public.team_responsibilities;
create trigger touch_team_responsibility before update on public.team_responsibilities
 for each row execute function public.touch_team_responsibility();
alter table public.team_responsibilities enable row level security;
revoke all on public.team_responsibilities from anon,authenticated;
grant select,insert,update,delete on public.team_responsibilities to authenticated;
drop policy if exists responsibilities_read on public.team_responsibilities;
create policy responsibilities_read on public.team_responsibilities for select to authenticated using(public.is_member());
drop policy if exists responsibilities_add on public.team_responsibilities;
create policy responsibilities_add on public.team_responsibilities for insert to authenticated with check(public.is_admin() and created_by=auth.uid());
drop policy if exists responsibilities_edit on public.team_responsibilities;
create policy responsibilities_edit on public.team_responsibilities for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists responsibilities_delete on public.team_responsibilities;
create policy responsibilities_delete on public.team_responsibilities for delete to authenticated using(public.is_admin());
notify pgrst,'reload schema';
commit;
