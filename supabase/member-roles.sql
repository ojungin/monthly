-- 팀원 권한 변경(관리자/책임자 전용). 업무보고 Supabase 프로젝트(qoabsfqxufdzcjhgrceq) SQL Editor에서 실행합니다.
-- 기존 팀원·권한은 바뀌지 않습니다. 다시 실행해도 됩니다.
begin;
-- 권한 변경 이력(누가, 언제, 누구를, 무엇에서 무엇으로)
create table if not exists public.member_role_changes(
 id bigint generated always as identity primary key,
 member_id uuid not null references public.members(id) on delete cascade,
 old_role text not null,
 new_role text not null,
 changed_by uuid not null references public.members(id),
 changed_at timestamptz not null default now()
);
alter table public.member_role_changes enable row level security;
revoke all on public.member_role_changes from anon,authenticated;
grant select on public.member_role_changes to authenticated;
drop policy if exists role_changes_read on public.member_role_changes;
create policy role_changes_read on public.member_role_changes for select to authenticated
 using(exists(select 1 from public.members m where m.id=(select auth.uid()) and m.role='admin'));

create or replace function public.set_member_role(member_id uuid,new_role text)
returns public.members language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();target public.members;result public.members;
begin
 -- public.is_admin() 대신 members.role을 직접 확인합니다.
 if me is null or not exists(select 1 from public.members m where m.id=me and m.role='admin') then raise exception '관리자/책임자만 권한을 변경할 수 있습니다'; end if;
 if new_role not in('member','admin') then raise exception '권한은 일반 팀원 또는 관리자/책임자만 지정할 수 있습니다'; end if;
 if member_id=me then raise exception '본인 권한은 직접 변경할 수 없습니다. 다른 관리자/책임자에게 요청해주세요'; end if;
 -- 동시에 여러 관리자가 변경해도 관리자가 0명이 되지 않도록 관리자 행을 잠급니다.
 perform 1 from public.members m where m.role='admin' for update;
 select * into target from public.members m where m.id=member_id for update;
 if not found then raise exception '등록된 팀원이 아닙니다'; end if;
 if target.role=new_role then return target; end if;
 if target.role='admin' and (select count(*) from public.members m where m.role='admin')<=1 then raise exception '마지막 관리자/책임자의 권한은 변경할 수 없습니다'; end if;
 update public.members m set role=new_role where m.id=member_id returning * into result;
 insert into public.member_role_changes(member_id,old_role,new_role,changed_by) values(member_id,target.role,new_role,me);
 return result;
end $$;
revoke all on function public.set_member_role(uuid,text) from public,anon;
grant execute on function public.set_member_role(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
