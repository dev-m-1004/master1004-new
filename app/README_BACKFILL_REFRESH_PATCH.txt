백필 자동 MV refresh 패치

수정 파일
- api/admin/backfill/route.ts

적용 내용
- 실제 백필 완료 후 refresh_home_summary_mvs() 자동 실행
- 홈 경로 revalidatePath("/") 처리
- dryRun=true 인 경우 refresh 생략
- 응답 summary에 refreshedHomeSummary 필드 추가

필수 환경변수
- SUPABASE_SERVICE_ROLE_KEY

주의
- Supabase SQL에서 refresh_home_summary_mvs() 함수가 이미 생성되어 있어야 합니다.
