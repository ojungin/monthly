begin;
create table if not exists public.report_ai_attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null,document_id uuid not null references public.report_documents(id) on delete cascade,created_at timestamptz not null default now());
create index if not exists report_ai_attempts_user_time on public.report_ai_attempts(user_id,created_at);
alter table public.report_ai_attempts enable row level security;
revoke all on public.report_ai_attempts from public,anon,authenticated;
create or replace function public.claim_report_ai(document_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare doc public.report_documents;
begin
 if not public.is_member() then raise exception '팀원 권한이 필요합니다';end if;
 -- Serialize per account so concurrent requests cannot bypass the hourly cap.
 perform 1 from public.members where id=auth.uid() for update;
 select * into doc from public.report_documents d where d.id=document_id and d.created_by=auth.uid() for update;
 if not found then raise exception '본인이 생성한 문서만 요약할 수 있습니다';end if;
 if doc.snapshot ? 'ai_summary' then raise exception '이미 요약된 문서입니다';end if;
 if doc.snapshot->>'ai_started_at' is not null and (doc.snapshot->>'ai_started_at')::timestamptz>now()-interval '3 minutes' then raise exception '요약이 진행 중입니다';end if;
 if (select count(*) from public.report_ai_attempts where user_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception '시간당 GPT 생성 한도 20회를 초과했습니다';end if;
 insert into public.report_ai_attempts(user_id,document_id) values(auth.uid(),document_id);
 update public.report_documents d set snapshot=d.snapshot||jsonb_build_object('ai_started_at',clock_timestamp()) where d.id=document_id;
end $$;
create or replace function public.release_report_ai(document_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_member() then raise exception '팀원 권한이 필요합니다';end if;
 update public.report_documents d set snapshot=d.snapshot-'ai_started_at' where d.id=document_id and d.created_by=auth.uid();
end $$;
create or replace function public.save_report_ai(document_id uuid,summary_data jsonb) returns public.report_documents language plpgsql security definer set search_path='' as $$
declare result public.report_documents;k text;
begin
 if not public.is_member() then raise exception '팀원 권한이 필요합니다';end if;
 if summary_data is null or jsonb_typeof(summary_data)<>'object' or octet_length(summary_data::text)>150000 then raise exception '요약 형식 오류';end if;
 foreach k in array array['issues','plans','done','todo','metrics'] loop
  if jsonb_typeof(summary_data->k) is distinct from 'array' then raise exception '요약 항목 오류';end if;
 end loop;
 update public.report_documents d set snapshot=(d.snapshot-'ai_started_at')||jsonb_build_object('ai_summary',summary_data) where d.id=document_id and d.created_by=auth.uid() and d.snapshot ? 'ai_started_at' returning * into result;
 if result.id is null then raise exception '요약 저장 권한 또는 생성 상태를 확인해주세요';end if;return result;
end $$;
create or replace function public.save_report_advisory(document_id uuid,advisory_text text) returns public.report_documents language plpgsql security definer set search_path='' as $$
declare result public.report_documents;
begin
 if not public.is_member() then raise exception '팀원 권한이 필요합니다';end if;
 if advisory_text is null or length(advisory_text)>5000 then raise exception '자문 요청사항은 5000자 이내로 입력해주세요';end if;
 update public.report_documents d set snapshot=d.snapshot||jsonb_build_object('advisory_request',advisory_text) where d.id=document_id and d.kind='monthly' and (d.created_by=auth.uid() or public.is_admin()) returning * into result;
 if result.id is null then raise exception '문서 작성자 또는 관리자만 수정할 수 있습니다';end if;return result;
end $$;
revoke all on function public.claim_report_ai(uuid),public.release_report_ai(uuid),public.save_report_ai(uuid,jsonb),public.save_report_advisory(uuid,text) from public,anon;
grant execute on function public.claim_report_ai(uuid),public.release_report_ai(uuid),public.save_report_ai(uuid,jsonb),public.save_report_advisory(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
