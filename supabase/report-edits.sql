-- 월 성과 보고서 편집 저장. 업무보고 Supabase 프로젝트(qoabsfqxufdzcjhgrceq) SQL Editor에서 1회 실행합니다.
-- 사전 조건: portal.sql, admin-role.sql, report-ai.sql 적용. 기존 보고·문서·권한은 변경하지 않습니다.
-- 편집본은 snapshot.edited(model, edited_at, edited_by)에 저장되며 생성 원본(reports, metrics, ai_summary)은 그대로 보존됩니다.
-- edits가 null이면 편집본을 지워 생성 원본으로 되돌립니다. 자문 필요 사항(advisory_request)은 같은 요청에서 함께 저장합니다.
begin;
create or replace function public.save_report_edits(document_id uuid,edits jsonb,advisory_text text)
returns public.report_documents language plpgsql security definer set search_path='' as $$
declare result public.report_documents;editor text;
begin
 if not public.is_member() then raise exception '팀원 권한이 필요합니다';end if;
 if advisory_text is null or length(advisory_text)>5000 then raise exception '자문 필요 사항은 5000자 이내로 입력해주세요';end if;
 if edits is not null and (jsonb_typeof(edits)<>'object'
   or jsonb_typeof(edits->'summary') is distinct from 'array'
   or jsonb_typeof(edits->'sections') is distinct from 'array'
   or jsonb_array_length(edits->'sections')>3
   or octet_length(edits::text)>300000) then
  raise exception '편집 내용 형식 오류';
 end if;
 select name into editor from public.members where id=auth.uid();
 update public.report_documents d
  set snapshot=(case when edits is null then d.snapshot-'edited'
   else d.snapshot||jsonb_build_object('edited',jsonb_build_object('model',edits,'edited_at',clock_timestamp(),'edited_by',editor)) end)
   ||jsonb_build_object('advisory_request',advisory_text)
  where d.id=document_id and d.kind='monthly' and (d.created_by=auth.uid() or public.is_admin())
  returning * into result;
 if result.id is null then raise exception '문서 작성자 또는 관리자만 수정할 수 있습니다';end if;
 return result;
end $$;
revoke all on function public.save_report_edits(uuid,jsonb,text) from public,anon;
grant execute on function public.save_report_edits(uuid,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
