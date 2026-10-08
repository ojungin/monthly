begin;
alter table public.reports add column if not exists report_date date;
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
 if document_kind='weekly' then
 select jsonb_agg(to_jsonb(r) order by r.user_id) into rs from (
 select distinct on (user_id) * from public.reports where status='submitted' and week_start<=document_period::date
 order by user_id,week_start desc,updated_at desc,id desc
 ) r;
 else
 select jsonb_agg(to_jsonb(r) order by r.week_start,r.user_id) into rs from public.reports r
 where r.status='submitted' and to_char(r.week_start,'YYYY-MM')=document_period;
 end if;
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

commit;
