상세페이지 지도 복원 안내

- 이번 패치는 `complex/[id]/complex-detail-client.tsx`의 인라인 iframe 지도를 제거하고, 예전처럼 `@/components/NaverMap` 컴포넌트를 다시 사용하도록 되돌린 버전입니다.
- 사용 중인 실제 프로젝트에 기존 `components/NaverMap.tsx`가 이미 있으면 그대로 예전 지도가 보입니다.
- 업로드된 app.zip에는 app 폴더만 포함되어 있어 기존 `components/NaverMap.tsx` 원본은 들어 있지 않았습니다. 따라서 이 패치는 기존 프로젝트의 NaverMap 컴포넌트가 살아 있다는 전제에서 가장 안전하게 원복한 것입니다.
