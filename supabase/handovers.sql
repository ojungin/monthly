-- 인수인계서. 업무보고 Supabase 프로젝트(qoabsfqxufdzcjhgrceq)의 SQL Editor에서 실행합니다.
-- 인계자 본인: 확인 완료 전까지 열람 · 작성 중일 때만 수정/삭제 · 확인 전 회수 가능
-- 인수자: 공유된 뒤부터 열람 · 확인 완료 처리
-- 관리자/책임자(members.role='admin'): 전체 열람
begin;
create table if not exists public.handovers(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references public.members(id),
 receiver_id uuid references public.members(id),
 status text not null default 'draft' check(status in('draft','shared','confirmed')),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 30),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 shared_at timestamptz,
 confirmed_at timestamptz,
 check(status='draft' or receiver_id is not null),
 check(receiver_id is distinct from owner_id)
);
create index if not exists handovers_owner_idx on public.handovers(owner_id,status);
create index if not exists handovers_receiver_idx on public.handovers(receiver_id,status);

create or replace function public.audit_handover() returns trigger language plpgsql set search_path='' as $$
declare item jsonb;url jsonb;me uuid:=auth.uid();
begin
 if me is null then raise exception '로그인한 후 이용해주세요'; end if;
 for item in select value from jsonb_array_elements(new.items) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'task')<>'string' or jsonb_typeof(item->'details')<>'string' or jsonb_typeof(item->'urls')<>'array' then raise exception '잘못된 업무 형식'; end if;
  if length(trim(item->>'task')) not between 1 and 200 then raise exception '주요 업무는 1~200자'; end if;
  if length(item->>'details')>200000 then raise exception '업무 세부 내용이 너무 깁니다'; end if;
  if jsonb_array_length(item->'urls')>20 then raise exception '참고 URL은 20개까지'; end if;
  for url in select value from jsonb_array_elements(item->'urls') loop
   if jsonb_typeof(url)<>'string' or length(url#>>'{}')>2000 or (url#>>'{}') !~* '^https?://' then raise exception '참고 URL 형식 오류'; end if;
  end loop;
 end loop;
 if tg_op='INSERT' then
  new.owner_id=me;new.created_at=now();new.confirmed_at=null;
  if new.status not in('draft','shared') then raise exception '잘못된 상태'; end if;
  new.shared_at=case when new.status='shared' then clock_timestamp() end;
 else
  if new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then raise exception '인계자 및 최초 작성일 변경 불가'; end if;
  if old.status='draft' and me=old.owner_id and new.status in('draft','shared') then
   new.shared_at=case when new.status='shared' then clock_timestamp() end;new.confirmed_at=null;
  elsif old.status='shared' and me=old.owner_id and new.status='draft' then
   -- 확인 전 회수: 내용은 그대로 두고 작성 중으로 되돌립니다.
   if new.items is distinct from old.items then raise exception '회수와 수정은 따로 진행해주세요'; end if;
   new.shared_at=null;new.confirmed_at=null;
  elsif old.status='shared' and me=old.receiver_id and new.status='confirmed' then
   if new.items is distinct from old.items or new.receiver_id is distinct from old.receiver_id then raise exception '인수자는 내용을 변경할 수 없습니다'; end if;
   new.shared_at=old.shared_at;new.confirmed_at=clock_timestamp();
  else
   raise exception '허용되지 않은 인수인계서 변경입니다';
  end if;
 end if;
 new.updated_at=clock_timestamp();
 return new;
end $$;
drop trigger if exists audit_handover on public.handovers;
create trigger audit_handover before insert or update on public.handovers for each row execute function public.audit_handover();

alter table public.handovers enable row level security;
revoke all on public.handovers from anon,authenticated;
grant select,insert,update,delete on public.handovers to authenticated;
drop policy if exists handovers_read on public.handovers;
create policy handovers_read on public.handovers for select to authenticated using(
 public.is_member() and (
  public.is_admin()
  or (owner_id=(select auth.uid()) and status<>'confirmed')
  or (receiver_id=(select auth.uid()) and status<>'draft')));
drop policy if exists handovers_add on public.handovers;
create policy handovers_add on public.handovers for insert to authenticated
 with check(public.is_member() and owner_id=(select auth.uid()));
drop policy if exists handovers_edit on public.handovers;
create policy handovers_edit on public.handovers for update to authenticated
 using(public.is_member() and ((owner_id=(select auth.uid()) and status in('draft','shared')) or (receiver_id=(select auth.uid()) and status='shared')))
 with check(owner_id=(select auth.uid()) or receiver_id=(select auth.uid()));
drop policy if exists handovers_delete on public.handovers;
create policy handovers_delete on public.handovers for delete to authenticated
 using(owner_id=(select auth.uid()) and status='draft');
notify pgrst,'reload schema';
commit;
