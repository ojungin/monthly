# 팀워크 — 주간 업무 보고 및 월 성과 취합

한국어 반응형 웹 앱입니다. GitHub Pages에서 화면을 배포하고 Supabase에서 로그인 및 공용 데이터를 관리합니다. 서버 비밀 키는 사용하지 않습니다.

## 구현 기능
- 프로젝트, 업무, 상태, 진행률, 성과, 이슈, 다음 주 계획 입력
- 본인 임시저장 및 주간별 기존 보고 수정 (작성자당 주간 1개)
- 등록 팀원 전체가 제출 보고 열람, 본인만 수정
- 월별 및 프로젝트별 취합, 팀원별 제출 건수, 완료 업무 집계
- Excel 호환 UTF-8 CSV 다운로드, 인쇄 및 PDF 저장
- 모바일 화면, 가상 데이터 데모 (브라우저 로컬 저장)

월 귀속은 **보고 주간 월요일** 기준입니다. 예: 2026-09-28 주간은 9월에 포함합니다. 월 경계에서 업무별 날짜 분할은 하지 않습니다. 성과 문구를 원문 그대로 취합하며 AI 요약이나 서로 다른 수치의 자동 합산은 하지 않습니다.

## 현재 상태
코드와 Supabase 공개 연결 설정 반영 완료. monthly 저장소 파일 업로드는 승인 정책에 의해 거부되어 실제 배포는 미완료입니다. Supabase 테이블과 권한 적용 여부도 확인되지 않았습니다. config.js가 비어 있으면 명확하게 표시된 데모 모드만 가능합니다. 데모는 공용 저장소가 아닙니다.

## 1. GitHub 새 저장소
GitHub의 ojungin 계정으로 monthly 저장소를 사용합니다. 저장소 공개 여부는 사용 중인 GitHub 플랜의 Pages 지원 범위에 따라 선택합니다. 공개 저장소에 실제 업무 데이터나 비밀 키를 올리지 마세요.

이 폴더를 저장소 루트로 올립니다. 웹 업로드에서는 숨김 폴더 .github가 빠지지 않도록 확인하세요. Git을 사용할 경우 이 폴더에서:

```powershell
git init -b main
git add .
git commit -m "Build weekly report workspace"
git remote add origin https://github.com/ojungin/monthly.git
git push -u origin main
```

GitHub Settings > Pages > Build and deployment > Source를 **GitHub Actions**로 선택합니다. Actions에서 Deploy weekly report 워크플로를 실행하세요. Supabase 설정 전에는 데모가 배포됩니다. 배포 성공 후 예상 주소는 https://ojungin.github.io/monthly/ 이며, 실제 성공 전에는 유효한 배포 주소로 간주하지 마세요.

## 2. Supabase 공용 저장소
1. Supabase 프로젝트를 만든 후 SQL Editor에서 supabase/schema.sql 전체를 실행합니다.
2. Authentication 설정에서 공개 회원가입을 끄고, 관리자만 사용자를 생성하도록 운영합니다. 이메일/비밀번호 로그인을 사용합니다.
3. Authentication > URL Configuration에서 Site URL과 Redirect URLs에 실제 GitHub Pages 주소를 등록합니다. 비밀번호 재설정/초대 이메일을 사용하려면 이메일 전송 설정도 확인합니다.
4. Authentication > Users에서 팀원 계정을 생성합니다. 최초 비밀번호를 관리자가 배포하지 않으려면 초대 이메일 또는 재설정 메일을 이용합니다.
5. 각 사용자의 UUID로 members 테이블에 팀원 등록을 합니다. 등록 전에는 보고를 볼 수 없습니다.

```sql
insert into public.members (id, name, team)
values ('실제-사용자-UUID', '오정인', '사업전략팀');
```

6. GitHub Settings > Secrets and variables > Actions > Variables에 아래 두 값을 추가합니다.
   - SUPABASE_URL: Supabase 프로젝트 HTTPS URL
   - SUPABASE_PUBLISHABLE_KEY: publishable 키 또는 legacy anon 키
7. Actions에서 다시 배포합니다. **secret / service_role 키는 절대 넣지 마세요.**

팀원 목록 등록·비활성화는 Supabase 관리자 화면에서 수행합니다. 앱 내 관리자 메뉴는 없습니다. members에서 사용자를 삭제하면 외래 키 설정에 의해 해당 보고도 삭제되므로 퇴사자 처리 시 보고 보존 여부를 먼저 결정하세요.

## 실행 및 검증
Node.js 24 이상. 외부 npm 의존성 설치 없이 실행합니다.

```powershell
npm test
npm run build
npm start
```

http://127.0.0.1:4173 에서 데모를 확인합니다. Supabase SDK는 연결 모드에서만 esm.sh를 통해 불러옵니다. 인터넷이 필요합니다. 인쇄 화면에서 PDF로 저장할 수 있습니다. CSV는 실제 .xlsx 파일이 아닌 Excel 호환 파일입니다.

## 운영 전 확인
두 테스트 계정으로: A의 임시저장이 B에게 보이지 않는지, A의 제출 보고는 B에게 보이는지, B가 A의 보고를 수정할 수 없는지 확인하세요. 비등록/로그아웃 상태에서는 보고 조회가 차단되어야 합니다. 월 경계 보고의 귀속과 CSV 한글 표시도 확인하세요. DB 정책은 SQL에 포함되어 있으나 실제 프로젝트 적용 및 권한 테스트는 아직 실행되지 않았습니다.

공식 문서: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site 및 https://supabase.com/docs/guides/database/postgres/row-level-security
