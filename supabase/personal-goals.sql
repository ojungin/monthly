-- 보고 사이트 qoabsfqxufdzcjhgrceq에서 실행. 기존 팀 목표 보존.
begin;
create or replace function public.kpi_can_manage() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members where id=auth.uid() and role='admin');
$$;
revoke all on function public.kpi_can_manage() from public,anon;
grant execute on function public.kpi_can_manage() to authenticated;
drop policy if exists goals_add on public.team_goals;
create policy goals_add on public.team_goals for insert to authenticated with check(public.kpi_can_manage() and created_by=auth.uid());
drop policy if exists goals_edit on public.team_goals;
create policy goals_edit on public.team_goals for update to authenticated using(public.kpi_can_manage()) with check(public.kpi_can_manage());
drop policy if exists strategies_add on public.team_goal_strategies;
create policy strategies_add on public.team_goal_strategies for insert to authenticated with check(public.kpi_can_manage() and created_by=auth.uid());
drop policy if exists strategies_edit on public.team_goal_strategies;
create policy strategies_edit on public.team_goal_strategies for update to authenticated using(public.kpi_can_manage()) with check(public.kpi_can_manage());
create table if not exists public.personal_goal_sets(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.members(id),
 year integer not null check(year between 2000 and 2100),
 rows jsonb not null check(jsonb_typeof(rows)='array' and jsonb_array_length(rows)=5),
 created_by uuid not null references public.members(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists personal_goals_owner_year_idx on public.personal_goal_sets(user_id,year);
create or replace function public.validate_personal_goals() returns trigger language plpgsql set search_path='' as $$
declare item jsonb;active boolean;filled integer:=0;goal_year integer;score jsonb;field text;
begin
 if not public.kpi_can_manage() then raise exception '관리자/책임자만 KPI 입력·수정 가능';end if;
 if tg_op='UPDATE' and new.created_by is distinct from old.created_by then raise exception '작성자 변경 불가';end if;
 for item in select value from jsonb_array_elements(new.rows) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'scores') is distinct from 'object' then raise exception '잘못된 개인 목표 행';end if;
  active:=false;
  foreach field in array array['strategy_id','personal_goal','method','indicator','target_date','remarks'] loop
   if coalesce(length(trim(item->>field)),0)>0 then active:=true;end if;
  end loop;
  for score in select value from jsonb_each(item->'scores') loop
   if jsonb_typeof(score)<>'string' or length(score#>>'{}')>1000 then raise exception '평가 기준 형식 오류';end if;
   if length(trim(score#>>'{}'))>0 then active:=true;end if;
  end loop;
  if not active then continue;end if;
  select g.year into goal_year from public.team_goal_strategies s join public.team_goals g on g.id=s.goal_id where s.id=(item->>'strategy_id')::uuid;
  if goal_year is null or goal_year<>new.year then raise exception '해당 연도의 실행 계획 선택 필요';end if;
  foreach field in array array['personal_goal','method','indicator'] loop
   if coalesce(length(trim(item->>field)),0) not between 1 and 4000 then raise exception '개인목표·방법·평가지표 입력 필요';end if;
  end loop;
  if coalesce(item->>'target_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '목표일정 입력 필요';end if;
  perform (item->>'target_date')::date;
  if coalesce(length(item->>'remarks'),0)>2000 then raise exception '비고 2000자 초과';end if;
  filled:=filled+1;
 end loop;
 if filled=0 then raise exception '개인 목표 한 개 이상 입력 필요';end if;
 new.updated_at=clock_timestamp();return new;
end $$;
drop trigger if exists personal_goals_validate on public.personal_goal_sets;
create trigger personal_goals_validate before insert or update on public.personal_goal_sets for each row execute function public.validate_personal_goals();
alter table public.personal_goal_sets enable row level security;
revoke all on public.personal_goal_sets from anon,authenticated;
grant select,insert,update on public.personal_goal_sets to authenticated;
drop policy if exists personal_goals_read on public.personal_goal_sets;
create policy personal_goals_read on public.personal_goal_sets for select to authenticated using(public.is_member() and (public.kpi_can_manage() or user_id=auth.uid()));
drop policy if exists personal_goals_add on public.personal_goal_sets;
create policy personal_goals_add on public.personal_goal_sets for insert to authenticated with check(public.kpi_can_manage() and created_by=auth.uid());
drop policy if exists personal_goals_edit on public.personal_goal_sets;
create policy personal_goals_edit on public.personal_goal_sets for update to authenticated using(public.kpi_can_manage()) with check(public.kpi_can_manage());
notify pgrst, 'reload schema';
commit;
