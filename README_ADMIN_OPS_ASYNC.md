# Admin Ops Async Queue 적용본

## 포함 사항
- 비동기 job queue 기반 Admin Ops
- worker cron route
- 경량 status API
- recent complex mapping SQL
- admin_ops_jobs 테이블 SQL
- vercel cron 설정 예시

## 적용 순서
1. `sql/admin_ops_jobs.sql` 실행
2. `sql/admin_ops_refresh_complexes_recent.sql`에서 함수 생성문 실행
3. 같은 파일의 `CREATE INDEX CONCURRENTLY` 2줄은 **각각 따로** 실행
4. Vercel 환경변수 설정
5. 배포

## 필수 환경변수
- `ADMIN_BACKFILL_SECRET`
- `CRON_SECRET`
- `MOLIT_API_KEY`
- `RTMS_LAWD_CODES_GROUP_1`
- `RTMS_LAWD_CODES_GROUP_2`
- `RTMS_LAWD_CODES_GROUP_3`
- `RTMS_LAWD_CODES_GROUP_4`
- Supabase 관련 env

## worker 호출
- Vercel Cron이 `/api/cron/admin-ops-worker`를 주기적으로 호출
- 요청 헤더는 `Authorization: Bearer <CRON_SECRET>` 또는 `x-admin-secret`을 허용

## 운영 권장
- 기본 경로는 `전체 파이프라인 시작`
- 큰 수집이 300초를 넘으면 collect 단계를 더 잘게 분해해야 함
- `all`은 가능하지만 데이터가 커지면 오래 걸릴 수 있음
