# GPT 요약 활성화

업무보고 Supabase 프로젝트 `qoabsfqxufdzcjhgrceq`에 적용합니다. Dashboard_DV가 아닙니다.

1. [SQL Editor](https://supabase.com/dashboard/project/qoabsfqxufdzcjhgrceq/sql/new)에 [report-ai.sql](../supabase/report-ai.sql) 전체를 붙여넣고 Run 합니다. 기존 보고서·계정은 보존됩니다.
2. Supabase **Edge Functions → Secrets**에서 `OPENAI_API_KEY`를 등록합니다. 키는 채팅·GitHub·웹사이트에 입력하지 마세요. API 사용료는 연결한 API 프로젝트에 청구됩니다. `OPENAI_REPORT_MODEL`은 선택사항이며 기본 `gpt-4.1-mini`입니다. 사용 가능한 Structured Outputs 지원 모델을 지정할 수 있습니다.
3. **Edge Functions → Deploy a new function → Via Editor**에서 이름을 `report-ai`로 지정합니다. [index.ts](../supabase/functions/report-ai/index.ts) 전체를 붙여넣고 배포합니다. 단일 파일이므로 별도 import 파일은 필요 없습니다.
4. 함수 설정에서 **Verify JWT with legacy secret**을 끕니다. 함수 내부에서 매 요청 `auth/v1/user`로 JWT와 문서 작성자 권한을 직접 검증합니다. 신규 JWT 서명 키와 호환하기 위한 설정입니다. 비로그인 요청은 차단됩니다.
5. 사이트를 새로고침한 후 새 통합문서를 생성하거나, 본인이 생성한 문서의 **GPT 요약 생성** 버튼을 누릅니다.

CLI를 사용한다면 저장소 루트에서 `supabase login`, `supabase link --project-ref qoabsfqxufdzcjhgrceq`, `supabase functions deploy report-ai --no-verify-jwt` 순서로 실행합니다. 키는 Secrets 화면에서 등록합니다. 내장 SUPABASE_URL/SUPABASE_ANON_KEY를 사용하며 서비스 역할 키는 필요 없습니다.

## 확인 사항

- 주간 5·6번: GPT 요약 표 + 펼쳐보기에서 보고자별 원문.
- 월간: 선택 월의 제출본으로 지표/한 일/할 일을 정리합니다. 지표는 해당 월의 저장된 최신 주간 통합문서 또는 원본 보고에 있는 실제 수치만 사용합니다. 저장 지표가 없으면 새 값을 생성하지 않습니다.
- 자문 요청사항은 빈칸으로 시작합니다. 직접 입력하고 별도 저장한 뒤 다운로드하면 Word/PDF/HTML에 반영됩니다. 문서 작성자 또는 관리자만 수정합니다.
- 저장 문서는 생성 시점의 자료를 보존합니다. 원본 보고를 수정했다면 새 통합문서를 생성해주세요.
- 동일 문서의 요약은 재사용합니다. 계정별 시간당 20회로 제한하며, 중단된 요청은 3분 후 재시도할 수 있습니다.
- 실패하면 원본 문서는 유지되고 GPT 요약 미생성 안내가 표시됩니다. 데모에서는 API를 호출하지 않습니다.
- [summary.mjs](../supabase/functions/_shared/summary.mjs)에 요약 규칙/JSON Schema가 있습니다. 단일 배포 파일 index.ts에도 동일 규칙이 들어 있습니다. 규칙 수정 시 두 파일을 같이 수정합니다.
- 완료 여부는 동일 담당자+업무ID의 최신 상태를 우선합니다. 진행 중 업무의 실제 성과와 남은 계획은 구분합니다. 회원·MAU·포인트는 플랫폼·기간을 분리하고 임의 합산하지 않습니다. 출처 ID를 검증합니다.
- Responses API Structured Outputs를 사용하고 `store:false`로 호출합니다. 자문 요청사항은 모델이 작성하지 않습니다.

[공식 OpenAI Structured Outputs 문서](https://developers.openai.com/api/docs/guides/structured-outputs)
