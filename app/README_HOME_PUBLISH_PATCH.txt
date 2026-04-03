적용 파일
- api/home/summary/route.ts
- home-page-client.tsx
- complex/[id]/complex-detail-client.tsx
- publish/_lib/publish-data.ts
- publish/_lib/publish-utils.ts
- publish/_components/publish-client.tsx

변경 내용
1. 메인 페이지 지역 바로가기 버튼 축소 및 거래건수 주황색 표시
2. 2020~2026 매매거래 동향 그래프 정상 표시
3. 최근 일주일 전국 거래가 TOP 5 / 거래량 TOP 5로 교체
4. 가격 표기 '만원' 형식으로 통일
5. 메인 페이지 오늘의 실거래 / 최근 일주일 실거래 섹션 제거
6. 배포용 본문에 지역별 today/week/month 텍스트 링크 추가
7. 배포용 본문에서 '최근 등록 거래'와 '매매가 TOP 5' 순서 교체
8. 배포용 페이지 데이터 범위를 today/week/month에 맞게 created_at 기준 필터링
