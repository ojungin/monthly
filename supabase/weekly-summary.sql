-- 기존 문서 생성 RPC가 팀원 권한·보고 주간·제출 내용을 검증합니다.
-- 이 확장 RPC는 새로 생성한 문서 하나에 집계 지표만 추가합니다.
begin;
create or replace function public.generate_summary_report_document(
 document_kind text, document_period text, metric_summary jsonb
) returns public.report_documents
language plpgsql security definer set search_path='' as $$
declare result public.report_documents;
begin
 if not public.is_member() then raise exception '팀원만 문서를 생성할 수 있습니다'; end if;
 if document_kind <> 'weekly' then raise exception '주간 보고에만 지표를 추가할 수 있습니다'; end if;
 if metric_summary is null or jsonb_typeof(metric_summary) <> 'object'
    or metric_summary->>'week' is distinct from document_period
    or jsonb_typeof(metric_summary->'sections') is distinct from 'array'
    or jsonb_array_length(metric_summary->'sections') <> 3
    or octet_length(metric_summary::text) > 100000 then
  raise exception '잘못된 지표 형식입니다';
 end if;
 if exists(select 1 from jsonb_array_elements(metric_summary->'sections') s
   where jsonb_typeof(s->'rows') is distinct from 'array') then
  raise exception '잘못된 지표 항목입니다';
 end if;
 result := public.generate_report_document(document_kind,document_period);
 update public.report_documents set snapshot = snapshot || jsonb_build_object('metrics',metric_summary,'version',2)
 where id=result.id and created_by=auth.uid() returning * into result;
 return result;
end $$;
revoke all on function public.generate_summary_report_document(text,text,jsonb) from public,anon;
grant execute on function public.generate_summary_report_document(text,text,jsonb) to authenticated;
commit;
