-- 새 Supabase 프로젝트의 SQL Editor에서 한 번 실행합니다.
create table public.members (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (length(name) between 1 and 100),
 team text not null default '우리 팀'
);
create table public.reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.members(id) on delete cascade,
 week_start date not null check (extract(isodow from week_start)=1),
 status text not null check (status in ('draft','submitted')),
 items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items)>0),
 issues text not null default '', next_plan text not null default '',
 updated_at timestamptz not null default now(),
 unique(user_id,week_start)
);
create index reports_month_idx on public.reports(week_start);
create function public.validate_report() returns trigger language plpgsql set search_path='' as $$
declare item jsonb;
begin
 for item in select value from jsonb_array_elements(new.items) loop
  if coalesce(length(trim(item->>'project')),0)=0 or coalesce(length(trim(item->>'title')),0)=0
    or coalesce(item->>'state','') not in ('완료','진행','보류')
    or jsonb_typeof(item->'progress') is distinct from 'number'
    or (item->>'progress')::numeric not between 0 and 100 then
    raise exception '업무 내용 또는 진행률을 확인해주세요';
  end if;
 end loop;
 new.updated_at=now(); return new;
end $$;
create trigger validate_report before insert or update on public.reports for each row execute function public.validate_report();
alter table public.members enable row level security;
alter table public.reports enable row level security;
revoke all on public.members, public.reports from anon, authenticated;
grant select on public.members to authenticated;
grant select,insert,update on public.reports to authenticated;
create function public.is_member() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members where id=(select auth.uid()));
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;
create policy member_read on public.members for select to authenticated using (public.is_member());
create policy report_read on public.reports for select to authenticated using
 (public.is_member() and (status='submitted' or user_id=(select auth.uid())));
create policy report_insert on public.reports for insert to authenticated with check
 (public.is_member() and user_id=(select auth.uid()));
create policy report_update on public.reports for update to authenticated using
 (public.is_member() and user_id=(select auth.uid())) with check
 (public.is_member() and user_id=(select auth.uid()));
-- 팀원 추가: Authentication > Users에서 사용자 생성 후 UUID를 넣습니다.
-- insert into public.members(id,name,team) values ('사용자-UUID','오정인','사업전략팀');
