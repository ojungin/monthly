-- 업무보고 프로젝트(qoabsfqxufdzcjhgrceq)의 SQL Editor에서 전체 실행.
-- 기존 계정 권한과 저장된 R&R 데이터는 변경하지 않습니다.
begin;
create or replace function public.team_rr_access(require_manager boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.members m
  where m.id=(select auth.uid())
    and (not require_manager or m.role='admin')
 );
$$;
revoke all on function public.team_rr_access(boolean) from public,anon;
grant execute on function public.team_rr_access(boolean) to authenticated;

create or replace function public.audit_team_responsibility() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  -- 브라우저가 전달한 값 대신 실제 인증 사용자를 기록합니다.
  if auth.uid() is null then raise exception '업무보고 사이트에 로그인한 후 저장해주세요'; end if;
  new.created_by=auth.uid();
 else
  if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
   raise exception '작성자 및 최초 작성일 변경 불가';
  end if;
 end if;
 new.updated_at=clock_timestamp();
 return new;
end $$;
drop trigger if exists touch_team_responsibility on public.team_responsibilities;
drop trigger if exists audit_team_responsibility on public.team_responsibilities;
create trigger audit_team_responsibility before insert or update on public.team_responsibilities
 for each row execute function public.audit_team_responsibility();

alter table public.team_responsibilities enable row level security;
revoke all on public.team_responsibilities from anon,authenticated;
grant select,insert,update,delete on public.team_responsibilities to authenticated;

drop policy if exists responsibilities_read on public.team_responsibilities;
create policy responsibilities_read on public.team_responsibilities
 for select to authenticated using(public.team_rr_access(false));
drop policy if exists responsibilities_add on public.team_responsibilities;
create policy responsibilities_add on public.team_responsibilities
 for insert to authenticated with check(public.team_rr_access(true) and created_by=(select auth.uid()));
drop policy if exists responsibilities_edit on public.team_responsibilities;
create policy responsibilities_edit on public.team_responsibilities
 for update to authenticated using(public.team_rr_access(true)) with check(public.team_rr_access(true));
drop policy if exists responsibilities_delete on public.team_responsibilities;
create policy responsibilities_delete on public.team_responsibilities
 for delete to authenticated using(public.team_rr_access(true));
notify pgrst,'reload schema';
commit;
