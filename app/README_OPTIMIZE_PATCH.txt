적용 내용
- 메인 홈 요약 API 분리: /api/home/trend, /api/home/regions, /api/home/top-price, /api/home/top-volume
- 메인 화면 로딩/오류 상태 분리
- 그래프 상단 라벨 잘림 보정
- 지역/Top5 섹션 skeleton 및 오류 메시지 추가
- 단지 상세 페이지 톤앤매너 정리
- 홈 속도 개선용 SQL 추가: _sql/003_home_speedup.sql

적용 순서
1) 이 패치 파일을 덮어쓰기
2) Supabase SQL Editor에서 _sql/003_home_speedup.sql 실행
3) 아래 쿼리 실행
   select public.refresh_home_summary_mvs();
4) Next.js 서버 재시작

백필 이후
- 백필 완료 후에도 아래 쿼리를 다시 실행
  select public.refresh_home_summary_mvs();
