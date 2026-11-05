-- 사이트에서 팀원 로그인 계정 등록(관리자 전용). 업무보고 Supabase 프로젝트(qoabsfqxufdzcjhgrceq) SQL Editor에서 실행합니다.
-- 기존 계정·팀원 정보는 변경하지 않습니다. 다시 실행해도 됩니다.
begin;
-- Edge Function(member-admin)만 사용하는 이메일→계정 ID 조회. 브라우저(anon/authenticated)에서는 호출할 수 없습니다.
create or replace function public.auth_user_id_by_email(account_email text) returns uuid
language sql stable security definer set search_path='' as $$
 select id from auth.users where lower(email)=lower(trim(account_email)) order by created_at limit 1;
$$;
revoke all on function public.auth_user_id_by_email(text) from public,anon,authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- 팀원 관리 화면의 '로그인 계정 현황'(관리자만): 중복 계정·미등록 계정을 찾는 데 사용합니다.
create or replace function public.admin_member_accounts()
returns table(id uuid,email text,created_at timestamptz,last_sign_in_at timestamptz,is_member boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 -- public.is_admin() 대신 로그인 계정의 members.role을 직접 확인합니다(executive-report.sql과 같은 방식).
 if auth.uid() is null or not exists(select 1 from public.members m where m.id=auth.uid() and m.role='admin') then raise exception '관리자/책임자만 조회할 수 있습니다'; end if;
 return query select u.id,u.email::text,u.created_at,u.last_sign_in_at,exists(select 1 from public.members m where m.id=u.id)
  from auth.users u order by lower(u.email),u.created_at;
end $$;
revoke all on function public.admin_member_accounts() from public,anon;
grant execute on function public.admin_member_accounts() to authenticated;
notify pgrst,'reload schema';
commit;
