# 사이트에서 팀원 계정 등록 설정 (관리자 전용)

팀원 관리 화면의 **계정 생성 및 팀원 등록**은 Supabase Edge Function `member-admin`이 처리합니다. 로그인 계정 생성에는 서비스 키가 필요하므로 브라우저가 아니라 이 함수 안에서만 사용합니다.

1. [SQL Editor](https://supabase.com/dashboard/project/qoabsfqxufdzcjhgrceq/sql/new)에서 [member-accounts.sql](../supabase/member-accounts.sql) 전체를 실행합니다. 기존 계정·팀원 정보는 바뀌지 않습니다.
2. **Edge Functions → Deploy a new function → Via Editor**에서 이름을 `member-admin`으로 지정하고 [index.ts](../supabase/functions/member-admin/index.ts) 전체를 붙여넣어 배포합니다.
3. 배포한 함수의 설정(Details)에서 **Verify JWT(Enforce JWT verification)를 끕니다.** 함수가 직접 로그인 토큰과 관리자 권한을 확인합니다(report-ai와 같은 방식).
4. 서비스 키: 함수에 기본 제공되는 `SUPABASE_SERVICE_ROLE_KEY`를 사용합니다. 프로젝트에서 레거시 키를 비활성화해 이 값이 동작하지 않으면 **Edge Functions → Secrets**에 `MEMBER_ADMIN_SECRET_KEY`로 `sb_secret_...` 키를 등록합니다. 이 키는 저장소나 사이트 설정(config.js)에 절대 넣지 않습니다.

CLI 사용 시: `supabase functions deploy member-admin --no-verify-jwt --project-ref qoabsfqxufdzcjhgrceq`

## 동작
- 관리자/책임자(members.role='admin')만 호출할 수 있습니다. 일반 팀원이 호출하면 403으로 거절됩니다.
- 이메일로 기존 로그인 계정을 찾고, 없으면 비밀번호 없는 계정(이메일 인증 완료)을 만든 뒤 일반 팀원으로 등록합니다. 등록에 실패하면 방금 만든 계정은 삭제해 되돌립니다.
- 새 팀원은 로그인 화면에서 업무 이메일 → 인증코드로 로그인합니다. 등록 시 메일은 발송되지 않으므로 관리자가 사이트 주소를 안내합니다.
- 관리자/책임자 권한은 팀원 목록의 **권한 변경**으로 바꿉니다([member-roles.sql](../supabase/member-roles.sql) 실행 필요). 본인 권한은 바꿀 수 없고, 마지막 관리자/책임자는 일반 팀원으로 바꿀 수 없으며, 변경 이력은 member_role_changes 테이블에 남습니다.
- **로그인 계정 현황**에서 전체 로그인 계정, 팀원 미등록 계정, 같은 이메일 중복을 확인할 수 있습니다.
