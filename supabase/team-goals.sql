-- 보고 사이트 Supabase 프로젝트에서 실행. 기존 보고·계정은 변경하지 않음.
begin;
create table if not exists public.team_goals(
 id uuid primary key default gen_random_uuid(),
 year integer not null check(year between 2000 and 2100),
 category text not null check(category in ('닥터빌','팜빌','공통')),
 business_goal text not null check(length(trim(business_goal)) between 1 and 3000),
 team_goal text not null check(length(trim(team_goal)) between 1 and 3000),
 created_by uuid references public.members(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.team_goal_strategies(
 id uuid primary key default gen_random_uuid(),
 goal_id uuid not null references public.team_goals(id),
 period_type text not null check(period_type in ('half','quarter')),
 period text not null,
 strategy text not null check(length(trim(strategy)) between 1 and 5000),
 created_by uuid references public.members(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((period_type='half' and period in ('상반기','하반기')) or (period_type='quarter' and period in ('1분기','2분기','3분기','4분기')))
);
create or replace function public.touch_team_goal() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.created_by is distinct from old.created_by then raise exception '작성자 변경 불가';end if;
 new.updated_at=clock_timestamp();return new;
end $$;
drop trigger if exists touch_team_goal on public.team_goals;
create trigger touch_team_goal before update on public.team_goals for each row execute function public.touch_team_goal();
drop trigger if exists touch_team_goal_strategy on public.team_goal_strategies;
create trigger touch_team_goal_strategy before update on public.team_goal_strategies for each row execute function public.touch_team_goal();
alter table public.team_goals enable row level security;
alter table public.team_goal_strategies enable row level security;
revoke all on public.team_goals,public.team_goal_strategies from anon,authenticated;
grant select,insert,update on public.team_goals,public.team_goal_strategies to authenticated;
drop policy if exists goals_read on public.team_goals;
create policy goals_read on public.team_goals for select to authenticated using(public.is_member());
drop policy if exists goals_add on public.team_goals;
create policy goals_add on public.team_goals for insert to authenticated with check(public.is_admin() and created_by=auth.uid());
drop policy if exists goals_edit on public.team_goals;
create policy goals_edit on public.team_goals for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists strategies_read on public.team_goal_strategies;
create policy strategies_read on public.team_goal_strategies for select to authenticated using(public.is_member());
drop policy if exists strategies_add on public.team_goal_strategies;
create policy strategies_add on public.team_goal_strategies for insert to authenticated with check(public.is_member() and created_by=auth.uid());
drop policy if exists strategies_edit on public.team_goal_strategies;
create policy strategies_edit on public.team_goal_strategies for update to authenticated using(public.is_admin()) with check(public.is_admin());
commit;
