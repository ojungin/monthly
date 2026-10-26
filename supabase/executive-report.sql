-- 업무보고 Supabase 프로젝트에서 1회 실행. 기존 데이터와 권한 유지.
begin;
create or replace function public.claim_executive_report_ai(document_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception '관리자/책임자만 경영진 보고서를 생성할 수 있습니다';end if;
 perform 1 from public.members where id=auth.uid() for update;
 if not exists(select 1 from public.report_documents d where d.id=document_id and d.kind='weekly' and d.snapshot ? 'ai_summary') then
  raise exception '요약이 완료된 주간 통합 보고서가 필요합니다';
 end if;
 if (select count(*) from public.report_ai_attempts a where a.user_id=auth.uid() and a.created_at>now()-interval '1 hour')>=20 then
  raise exception '시간당 요약 생성 한도 20회를 초과했습니다';
 end if;
 insert into public.report_ai_attempts(user_id,document_id) values(auth.uid(),document_id);
end $$;
revoke all on function public.claim_executive_report_ai(uuid) from public,anon;
grant execute on function public.claim_executive_report_ai(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
