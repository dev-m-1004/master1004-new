# Admin Ops Async Pipeline 적용본

포함 핵심:
- 전체 파이프라인 시작 시 collect group1~4 -> map -> listing -> summary 순서로 개별 job 큐 생성
- worker cron은 queued job 1개씩만 처리
- collect 전체 1job timeout 문제 완화
- SQL 파일 포함
- vercel.json cron 포함

적용 순서:
1. `sql/admin_ops_jobs.sql` 실행
2. `sql/admin_ops_refresh_complexes_recent.sql`에서 함수 생성문 먼저 실행
3. 같은 파일의 `create index concurrently` 2줄은 각각 따로 실행
4. 코드 배포
5. Vercel 환경변수 확인: `CRON_SECRET`, `ADMIN_BACKFILL_SECRET`, `MOLIT_API_KEY`, `RTMS_LAWD_CODES_GROUP_1~4`, Supabase env
6. Vercel Cron 확인: `/api/cron/admin-ops-worker`

운영 기본:
- 전체 파이프라인 시작 = collect group1,2,3,4 + map + listing + summary job 7개 생성
- worker가 한 번에 하나씩 처리
