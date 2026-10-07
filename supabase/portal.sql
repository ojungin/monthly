-- 기존 팀원/보고 보존. 보고 수정은 본인만, 생성 문서는 기존 팀원과 공유.
begin;
drop policy if exists report_update on public.reports;
create policy report_update on public.reports for update to authenticated
using (public.is_member() and user_id=(select auth.uid()))
with check (public.is_member() and user_id=(select auth.uid()));
create or replace function public.report_update_audit() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.user_id is distinct from old.user_id or new.week_start is distinct from old.week_start) then
  raise exception '보고 작성자와 보고 주간은 변경할 수 없습니다';
 end if;
 new.updated_by=auth.uid();return new;
end $$;
create table if not exists public.report_documents (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('weekly','monthly')),
 period text not null,
 snapshot jsonb not null,
 created_by uuid references public.members(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists report_documents_period_idx on public.report_documents(kind,period,created_at desc);
alter table public.report_documents enable row level security;
revoke all on public.report_documents from anon,authenticated;
grant select on public.report_documents to authenticated;
drop policy if exists document_read on public.report_documents;
create policy document_read on public.report_documents for select to authenticated using (public.is_member());
create or replace function public.generate_report_document(document_kind text,document_period text)
returns public.report_documents language plpgsql security definer set search_path='' as $$
declare rs jsonb;ms jsonb;author_name text;result public.report_documents;doc_id uuid:=gen_random_uuid();stamp timestamptz:=clock_timestamp();
begin
 if not public.is_member() then raise exception '팀원만 문서를 생성할 수 있습니다';end if;
 if document_kind not in ('weekly','monthly') then raise exception '잘못된 문서 유형';end if;
 if document_kind='weekly' then
  if document_period !~ '^\d{4}-\d{2}-\d{2}$' or extract(isodow from document_period::date)<>1 then raise exception '월요일을 선택해주세요';end if;
 elsif document_period !~ '^\d{4}-\d{2}$' then raise exception '월을 선택해주세요';
 end if;
 select jsonb_agg(to_jsonb(r) order by r.week_start,r.user_id) into rs from public.reports r
 where r.status='submitted' and (case when document_kind='weekly' then r.week_start=document_period::date else to_char(r.week_start,'YYYY-MM')=document_period end);
 if rs is null then raise exception '제출된 보고가 없습니다';end if;
 select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'team',m.team) order by m.name) into ms from public.members m;
 select name into author_name from public.members where id=auth.uid();
 insert into public.report_documents(id,kind,period,snapshot,created_by,created_at)
 values(doc_id,document_kind,document_period,jsonb_build_object('version',1,'id',doc_id,
 case when document_kind='weekly' then 'week' else 'month' end,document_period,
 'created_at',stamp,'author',author_name,'members',ms,'reports',rs),auth.uid(),stamp) returning * into result;
 return result;
end $$;
revoke all on function public.generate_report_document(text,text) from public,anon;
grant execute on function public.generate_report_document(text,text) to authenticated;
-- 로그인 계정의 비밀번호나 인증 토큰을 노출하지 않고 관리자가 기존 계정을 일반 팀원으로 등록.
create or replace function public.register_team_member(account_email text,display_name text,team_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare account_id uuid;
begin
 if not public.is_admin() then raise exception '관리자만 팀원을 등록할 수 있습니다';end if;
 if length(trim(display_name)) not between 1 and 100 or length(trim(team_name)) not between 1 and 100 then raise exception '이름과 소속을 입력해주세요';end if;
 select id into account_id from auth.users where lower(email)=lower(trim(account_email));
 if account_id is null then raise exception 'Authentication에서 로그인 계정을 먼저 생성해주세요';end if;
 insert into public.members(id,name,team,role) values(account_id,trim(display_name),trim(team_name),'member');
 return account_id;
end $$;
revoke all on function public.register_team_member(text,text,text) from public,anon;
grant execute on function public.register_team_member(text,text,text) to authenticated;
commit;
