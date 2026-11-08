# MASTER1004 복구 작업 — 2026-11-09

상태: 원인 확인 및 최소 코드 수정 완료. 비공개 배포와 실제 데이터 검증은 Vercel 접근 대기 중이다. 공개 도메인, DNS, Vercel/Supabase 설정, 원격 Git 브랜치는 변경하지 않았다.

## 기존 프로젝트

- 저장소: https://github.com/dev-m-1004/master1004-new
- 기준 커밋: `2977ff0ee991768d7887672e460b5b7b4521c403`
- 로컬 작업 브랜치: `fix/public-read-recovery`
- 기존 공개 배포: https://master1004-new-m1it.vercel.app/
- 위 주소는 기존 공개 서비스 주소이며, 새 비공개 테스트 배포가 아니다.

## 확인한 장애

### 1. 도메인의 DNSSEC 검증 실패

Google Public DNS와 Cloudflare DNS에서 `master1004.com` 및 `www.master1004.com` 조회가 SERVFAIL을 반환한다. Google의 DNSSEC 검증을 끈 진단 조회(`cd=1`)는 다음 레코드를 반환한다.

| 이름 | 종류 | 현재 관찰된 값 |
| --- | --- | --- |
| master1004.com | A | 76.76.21.21 |
| www.master1004.com | CNAME | cname.vercel-dns.com. |
| master1004.com | NS | ns1.hosting.co.kr. ~ ns4.hosting.co.kr. |

Cloudflare의 진단 메시지는 `DNSKEY Missing no SEP matching the DS found for master1004.com.`이다. 부모 영역의 DS는 다음과 같으나 현재 영역의 DNSKEY 응답에는 대응 키가 없다.

```text
2371 13 2 0D19B123953AFD8A3621890F7D9AEFE99ADA2DFE38094DF9CC69241EAFFF17CC
```

승인 후 적용할 복구안: 등록기관과 DNS 운영자의 실제 DNSSEC 상태를 확인한 뒤, 서명하지 않는 현재 DNS 영역을 유지할 경우 남아 있는 부모 DS를 제거한다. DNSSEC를 유지하려면 DNS 운영자가 제공하는 유효한 서명·DNSKEY와 일치하는 DS로 복구한다. A/CNAME은 Vercel 프로젝트의 Domains 권장값과 대조하기 전 변경하지 않는다. 이 작업은 아직 실행하지 않았다.

참고: https://developers.google.com/speed/public-dns/docs/troubleshooting

### 2. 공개 조회에서 관리용 API 키 인증 실패

기존 공개 Vercel 배포에 실제 GET 요청을 보내고 브라우저에서도 확인했다.

| 요청/화면 | 결과 |
| --- | --- |
| `/` | HTTP 200, 검색 UI 표시, 거래 데이터 조회 실패 |
| `/api/list?pageSize=1` | HTTP 500, `Unregistered API key` |
| `/api/home/summary` | HTTP 500, `Unregistered API key` |
| `/complex/073d80ec-8d4b-4abb-8c48-9a9af58e9c1c` | HTTP 200이지만 본문에 단지 조회 오류와 같은 인증 오류 표시 |
| `/api/regions/sido` | HTTP 200, 17개 시도 반환 |
| `/api/search/suggest?q=래미안` | HTTP 200, `complex_listing_mv`의 단지 8개 반환 |
| `/api/test` | HTTP 200, transactions 1건, error=null |

실패한 조회는 `lib/supabase/admin.ts`의 `SUPABASE_SERVICE_ROLE_KEY`를 사용한다. 성공한 조회는 기존 공개용 URL/anon key를 사용한다. 실제 Vercel 환경값과 로그를 읽지 못했으므로 관리용 키가 만료·교체·오입력 중 어떤 상태인지는 아직 확정하지 않았다.

## 최소 코드 수정

다음 네 파일의 읽기 전용 조회를 기존 `lib/supabase.ts` 공개 클라이언트로 변경했다.

- `app/api/list/route.ts`
- `lib/home-data.ts`
- `app/complex/[id]/page.tsx`
- `app/sitemap.ts`

관리자·수집·쓰기 API는 계속 관리용 클라이언트를 사용한다. 데이터베이스 권한 또는 RLS를 변경하지 않았다. 공개용 클라이언트는 기존 anon 권한을 그대로 따른다. `complexes` 및 요약 materialized view들의 실제 anon 조회 권한과 데이터는 Preview에서 추가 검증해야 한다. 권한을 우회하거나 임의로 확대하지 않는다.

## 빌드·배포 설정 검증

- `npm ci --no-audit --no-fund`: 성공, 잠금 파일 유지.
- 환경값 없는 기준 빌드: 컴파일·TypeScript 통과 후 `/api/list` 수집 단계에서 `NEXT_PUBLIC_SUPABASE_URL` 누락으로 실패. 이는 이 작업 환경의 설정 누락을 확인한 것이며 Vercel 환경 누락의 증거는 아니다.
- 수정 후 `npm run build`: 컴파일·TypeScript·정적 페이지 생성 27/27 성공. 실제 자격증명 대신 `https://compile-only.invalid` 및 명시적 컴파일 확인용 키를 프로세스 환경에만 사용했다. 이는 실제 DB 연결 또는 기능 복구 검증이 아니다. 이 빌드 산출물은 배포하지 않는다.
- `git diff --check`: 통과.
- `next.config.ts`: Next.js 16.2.1의 기존 Turbopack root 설정 유지.
- `vercel.json`: 기존 5분 Cron 유지. Hobby 요금제라면 이 빈도는 배포를 차단하므로 실제 요금제·배포 로그 확인이 필요하다. 임의로 스케줄이나 요금제를 변경하지 않았다.
- 이전 export 누락 오류는 현재 main 소스에서 이미 해결되어 있다.

## 계속 진행하는 데 필요한 접근

GitHub 연결과 저장소 쓰기 권한을 확인했다. main의 Vercel 성공 상태 링크로 실제 소유 팀이 `master1004`임을 확인했다. 연결 계정의 기본 팀은 별도 팀이며 프로젝트가 없다. Vercel 연결 자체는 완료됐지만 `master1004` 팀 접근은 아직 403으로 차단되어 팀별 승인이 필요하다. 키·비밀번호를 대화에 붙여 넣을 필요는 없다.

연결 후 수행할 순서:

1. 현재 Production/실패 배포의 Build Logs, Runtime Logs, 프로젝트 연결 저장소·Root Directory·프레임워크·빌드 명령·Node 버전·요금제를 읽기 전용으로 대조한다.
2. Preview 환경의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 존재·범위를 확인한다. 필요한 환경 설정 변경은 구체적인 차이를 제시하고 승인을 받은 뒤 수행한다.
3. 현재 Deployment Protection을 확인한다. 보호가 유지되는 기존 프로젝트의 비공개 Preview로만 배포한다. 보호 설정 변경이 필요하면 별도 승인을 받는다. main에 push하거나 Production으로 승격하지 않는다.
4. Preview에서 목록·지역 필터·검색·정렬·상세·요약·사이트맵과 보호되지 않은 접근의 차단을 실제 검증한다. 실제 거래 시점도 확인한다.
5. 정상 데이터 화면과 주요 링크가 확인된 Preview URL을 제공한다.
6. 별도 승인 후에만 DNSSEC 복구와 공개 배포를 진행한다.

## 되돌리기

아직 원격 반영 전이다. 복구 브랜치에서 위 네 소스 파일을 기준 커밋의 내용으로 되돌리면 코드 변경을 취소할 수 있다. 외부 설정에 되돌릴 변경은 없다.
