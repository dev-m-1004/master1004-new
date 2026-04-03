# 적용 완료 사항

## 1. 목록 API 구조 변경
- `transactions` 원본 스캔 방식에서 `complex_listing_mv` 머티리얼라이즈드 뷰 조회 방식으로 변경
- `lawdCode` 필터 실제 반영
- 검색/정렬/페이지네이션 응답 구조 유지

## 2. 프론트 필터 보정
- 법정동 선택 시 `selectedLawdCode`를 실제 코드로 저장
- 클라이언트 목록 조회를 `cache: 'no-store'` + `AbortController`로 정리
- 중복 요청/늦게 도착한 응답으로 인한 UI 꼬임 완화

## 3. 상세페이지 보정
- 거래 정렬에 `id desc` 추가
- complex 조회 실패/거래 없음 처리 보강
- 차트 wrapper에 `min-w-0`, `min-h-[320px]` 적용

## 4. 차트 경고 대응
- `ResponsiveContainer`에 `minWidth`, `minHeight` 적용
- mount 이후에만 렌더하도록 조정

## 5. 백필 후 캐시 새로고침 연결
- `/api/admin/backfill/refresh-complexes`에서
  - `refresh_complexes_from_transactions()`
  - `refresh_complex_listing_mv()`
  순서대로 실행하도록 변경

# 반드시 해야 하는 작업
1. Supabase SQL Editor에서 `_sql/001_complex_listing_mv.sql` 실행
2. Next.js 서버 재시작
3. 아래 호출 1회 실행

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-admin-secret" = "my-super-secret-backfill-key-2026"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/admin/backfill/refresh-complexes" `
  -Method POST `
  -Headers $headers
```

# 백필 후 권장 순서
1. `/api/admin/backfill` 실행
2. `/api/admin/backfill/refresh-complexes` 실행
3. 목록 페이지 확인
