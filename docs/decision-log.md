# MuthoRoot — 설계 결정 로그

이 문서는 코드 저장소(GitHub)에는 남지 않는 "왜 이렇게 결정했는지"를 기록합니다.
새 채팅을 열 때 이 문서를 프로젝트 지식에 함께 두면, 매번 배경을 다시 설명할 필요가 없습니다.

## 서비스 컨셉

단어·숙어에 얽힌 유래 이야기(story)를 커뮤니티가 함께 쓰고, 댓글로 토론하고, 투표하는 서비스.
etymonline 같은 어원 사전에서 출발했지만, "학술적으로 검증된 사실"이 아니라
"사람들 사이에 전해지는 이야기(설)"를 다루는 쪽으로 포지셔닝을 잡았다.

- 참고 사례: soapbox(비누상자) → "주장을 내세우다"라는 뜻이 된 유래담처럼,
  실제로 100% 검증되진 않았지만 널리 회자되는 이야기가 핵심 콘텐츠.
- 그래서 "검증됨" 배지나 사실 확인 로직은 만들지 않는다. 대신 story에
  출처(source) 필드를 선택적으로 둬서 추적 가능성만 열어둔다 (구현 시 우선순위 낮음).
- 사이트 전반에 "여기 실린 이야기는 검증된 학술 정보가 아니라 커뮤니티가 함께
  만들어가는 설(說)입니다"라는 디스클레이머를 노출한다.

## 이름: MuthoRoot

- muthos(μῦθος, 그리스어로 "이야기·설화") + root(어근)
- muthos는 logos(검증된 이성적 담론)와 대비되는 개념으로, "전해지는 이야기"라는
  서비스 포지셔닝과 정확히 맞아떨어져서 선택했다.
- epos(그리스어로 "서사시")도 후보였지만, 호메로스급 영웅 서사 뉘앙스가 강해서
  soapbox 같은 소박한 일상 단어 유래담에는 과장된 느낌을 줘서 제외했다.
- mythos/mythologue 등 "myth" 계열 이름은 이미 다른 프로젝트·서비스에서 많이
  쓰이고 있어서 (게임, 카드게임, 저널 등) 피했다.
- wordlore는 실제 서비스(wordlore.org, iOS/Android 앱)가 이미 있어서 제외했다.
- GitHub 저장소명은 kebab-case(`mutho-root`)로, 브랜드 표기는 `MuthoRoot`로 분리해서 쓴다
  (npm 패키지명 규칙 + OS 대소문자 이슈 회피 목적).

## 스코프 결정

- **1차 스코프**: Story(유래 이야기) + Comment(대댓글 토론) + Vote(업보트)까지만.
- **ROOT(어근) 태깅은 보류**: 어근 정보는 거의 모든 단어에 존재해서 범위가 넓고
  건조한 반면, "이야기"는 일부 단어에만 존재해서 범위가 더 좁고 이 프로젝트의
  관심사(숙어 탄생 서사)와 정확히 일치한다. 그래서 더 작은 범위인 STORY 쪽을
  먼저 구현하기로 했다. 여유가 되면 이후에 `WordEntry N:M Root` 관계로 추가한다.
- Story는 커뮤니티형: 한 단어(WordEntry)에 여러 사람이 각자 버전의 story를
  올릴 수 있다 (단어당 story 1개가 아님).
- Comment는 자기참조(parentId)로 대댓글(스레드)을 지원한다 — GitHub 이슈 댓글과
  비슷한 톤을 목표로 함.

## 데이터 모델 (확정 — prisma/schema.prisma에 반영됨)

- `User` 1:N `WordEntry` (누가 단어를 등록했는지)
- `WordEntry` 1:N `Story` (한 단어에 여러 유래 이야기)
- `Story` 1:N `Comment`, `Comment` 자기참조 1:N (대댓글)
- `User` N:M `Story` — `Vote` 조인 테이블로 업보트 표현 (N:M 요건 충족)
- `Root` 모델은 아직 스키마에 없음 (위 스코프 결정 참고)

## 사전 API — Wiktionary (2026-10-07 교체)

`WordEntry.definitions`는 외부 사전에서 한 번 채우고 고정한다 (수정 API 없음). 조회 로직은 `src/lib/dictionary.ts` 한 곳에 있다.

- **교체 이유**: 처음 쓰던 dictionaryapi.dev가 2026-09-17부터 3주 넘게 응답하지 않았다.
  DNS·TCP·TLS 연결은 바로 되는데 API 경로에서만 첫 바이트가 오지 않는 상태(Cloudflare 뒤 원본 서버 무응답)라,
  그동안 등록한 단어는 전부 `meaning: null`이 됐다. 위키미디어가 운영해 가용성이 높은 Wiktionary로 바꿨다.
- **엔드포인트**: `https://en.wiktionary.org/api/rest_v1/page/definition/{word}`
  - 공백은 `_`로 바꾼 뒤 `encodeURIComponent` (`kick the bucket` → `kick_the_bucket`)
  - 응답의 `en` 배열에서 정의를 **사전 순서대로, 품사별 최대 3개** 저장한다 (아래 2026-10-08 변경 참고).
    정의에 `<span>`·`<a>` 태그가 섞여 있어 태그를 지우고 HTML 엔티티를 풀어 평문으로 저장한다.
    태그를 지우면 빈 문자열이 되는 정의는 건너뛰고 5개에도 세지 않는다.
  - 위키미디어 API 정책에 따라 `User-Agent`에 앱 이름과 연락처를 넣는다
    (`MuthoRoot/0.1 (https://github.com/River-yhj/mutho-root)`)
  - 타임아웃 5초, 404·타임아웃·네트워크 오류 등 어떤 실패든 `null`로 폴백 (등록은 막지 않음)
- **2026-10-08 변경 — `meaning`(String?) → `definitions`(Json?)**:
  - 문제: "첫 품사의 첫 정의" 하나만 저장하니 soapbox가 "A crate for packing soap."만 남고,
    이 사이트의 핵심인 비유적 의미(연설대, 의견을 늘어놓는 장)가 빠졌다.
  - 형식: `[{ "partOfSpeech": "noun", "text": "..." }, ...]` — 품사는 소문자, Wiktionary `en` 배열 순서 유지.
  - 처음엔 품사를 가리지 않고 앞에서 5개를 잘랐는데, 한 품사의 정의가 5개 이상이면 뒤 품사가 통째로 빠졌다
    (hello는 감탄사 5개만 남고 명사·동사 뜻이 빠짐). 같은 날 **품사별 최대 3개**로 바꿨다.
    - 어원이 다르면 같은 품사가 여러 블록으로 나오므로, 블록이 아니라 품사 이름 기준으로 센다
    - 결과: soapbox = noun 3개(비누 상자 / 즉석 연설대 / 의견을 밝히는 매체) + verb 1개(연설하다),
      hello = interjection 3개 + noun 1개 + verb 1개, kick the bucket = verb 2개
    - 대가: 한 품사의 4번째 이후 뜻은 빠진다 (soapbox의 "의견을 장황하게 늘어놓는 수단"은 noun 4번째라 제외됨)
  - API 응답 필드도 `definitions`. 검색(`GET /api/words?q=`)은 여전히 `word` 기준이다 (뜻 텍스트로는 검색 안 됨).
  - 단어가 0건인 것을 확인한 뒤 `meaning` 컬럼을 지우고 `definitions JSONB`를 추가했다 (데이터 이전 없음).
  - 구현 메모: Prisma `Json?` 필드는 일반 `null`로 쓰거나 필터할 수 없어서 `Prisma.DbNull`(DB의 NULL)을 쓴다.
    "못 가져옴"은 항상 DB NULL이고, JSON `null`이나 빈 배열은 저장하지 않는다.
- ⚠️ **출처 표시 필요 (CC BY-SA)**: Wiktionary 본문은 CC BY-SA 라이선스다. 프론트엔드에서 뜻을 보여줄 때
  "출처: Wiktionary (CC BY-SA)"와 해당 항목 링크를 함께 표시해야 하고, 가져온 뜻 텍스트를 가공해 다시 배포하면
  같은 라이선스(BY-SA)를 따라야 한다. 4번 프론트엔드 연동 때 반드시 반영할 것.
- **null 재조회 규칙**: `definitions`가 `null`인 단어는 `GET /api/words/:id` 때 사전을 한 번 더 조회해 채운다.
  - 이미 값이 있으면 절대 다시 조회하거나 덮어쓰지 않는다 (고정 원칙은 definitions 전체에 적용)
  - 저장은 `where: { id, definitions: { equals: Prisma.DbNull } }` 조건부 갱신이라, 동시 요청이 먼저 채웠으면
    아무것도 바꾸지 않는다
  - 사전에 없는 단어를 볼 때마다 외부 API를 기다리지 않도록 같은 단어는 10분에 한 번만 재조회한다
    (서버 메모리 기준이라 재시작하면 초기화됨)
  - 실제 사례: Wiktionary는 캐시되지 않은 문서의 첫 요청이 5초를 넘길 때가 있다 (soapbox 6.9초 → `null`).
    이런 단어는 첫 상세 조회 때 채워진다.

## 다음 작업 순서 (기능 단위로 채팅 분리 예정)

1. 인증 — 회원가입/로그인, Google·Kakao OAuth (Passport + bcrypt) — **완료 (2026-09-15)**
   - 로컬 이메일+비밀번호 가입/로그인(bcrypt) + Google/Kakao OAuth 전부 실제 브라우저 테스트 통과
   - **카카오는 이메일을 안 줌**: 개인 개발자는 "카카오계정(이메일)" 동의항목을 바로 못 쓴다
     (비즈 앱 전환 + 별도 심사 필요, 시간 소요). 그래서 이메일에 의존하지 않는 쪽으로 설계 변경:
     - `User.email`을 `String? @unique`(선택값)로 변경
     - `@@unique([provider, providerId])`를 추가해서, 소셜 로그인 사용자는 이메일이 아니라 이 조합으로 식별
     - 카카오 로그인 시 `email: null`, `name`엔 카카오 닉네임 저장
   - 동의항목: 닉네임은 **필수 동의**(서비스 운영에 꼭 필요), 프로필 사진은 **선택 동의**로 신청
   - `SESSION_SECRET`이 빈 문자열이면 `?? "dev-secret"` 폴백이 안 먹혀서 (`??`는 null/undefined만 처리)
     서버 전체가 500 — 반드시 실제 랜덤 값을 채워야 함. 운영 환경(`NODE_ENV=production`)에서는
     기본값으로 기동 자체가 막히도록 처리해둠
   - 트러블슈팅 기록 (다음에 또 겪을 수 있으니):
     - 카카오 KOE006(Redirect URI 불일치) — `.env`의 `KAKAO_CALLBACK_URL`과 카카오 콘솔 등록값이
       정확히 일치해야 함 (슬래시 하나 차이도 실패 원인)
     - Supabase Transaction pooler(6543)만 인증 실패하고 Session pooler(5432, `DIRECT_URL`)는 되는 경우:
       - DB 비밀번호를 새로 설정/리셋한 직후라면 Supabase 공식 문서에 나온 알려진 캐시 지연 현상 —
         몇 분 기다렸다가 재시도하면 보통 해결됨
       - 그래도 안 되면 `DATABASE_URL`과 `DIRECT_URL`의 비밀번호가 같은지 먼저 비교할 것
         (2026-09-15에 실제로 겪은 원인은 두 URL의 비밀번호 불일치였음)
       - 이 프로젝트 규모(서버리스 아닌 단일 Express 서버)에서는 `DATABASE_URL`도 그냥
         `DIRECT_URL`과 같은 세션 풀러 문자열을 써도 무방함
     - Supabase 무료 플랜은 7일간 활동이 없으면 프로젝트가 일시 중지된다. 이때 두 연결 모두
       `FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found`가 난다 — 대시보드에서 Restore
       (2026-10-07에 실제로 겪음)
2. Story·Comment API + 소유권 기반 권한 (본인 글만 수정·삭제) — **완료 (2026-09-17)**
   - **WordEntry는 "단어 검색 사이트"의 핵심**: 뜻은 커뮤니티가 채우는 게 아니라 외부 사전 API에서
     조회해서 **고정 저장**한다. 등록 후에는 아무도 수정할 수 없음 (수정 API 자체를 만들지 않음).
     처음엔 dictionaryapi.dev + `meaning` 한 줄이었다가 Wiktionary + `definitions` 목록으로 바뀜
     (위 "사전 API" 섹션 참고)
   - **muthos/logos 구도가 여기서 완성됨**: `definitions`(고정된, 검증된 뜻) = logos,
     `Story`(검증 안 됐지만 재밌는 이야기, 인기로 줄세워짐) = muthos.
   - **단어 등록은 find-or-create**: 이미 같은 단어(`WordEntry.word`, 소문자 정규화)가 있으면 기존 항목을
     재사용하고, 없으면 사전 API를 조회해 `definitions`를 채운 뒤 새로 생성한다 (`word`에 `@unique`).
   - 사전 API에서 뜻을 못 찾아도(404 등) 등록 자체는 막지 않는다 — `definitions: null`로 생성하고
     프론트에서 "사전에 없는 표현" 정도로 표시.
   - **Story 정렬**: 한 단어의 story 목록은 추천수(`voteCount`) 내림차순으로 보여준다.
   - 성능을 위해 Vote 개수를 매번 집계(count)하지 않고 `Story.voteCount` 컬럼에 미리 계산해 들고 있는다 —
     투표/취소 시 Prisma 트랜잭션으로 `Vote` row 생성·삭제와 `voteCount` +1/-1을 함께 처리한다
     (`@@index([wordEntryId, voteCount])`). 같은 사용자의 동시 투표가 겹치면 한쪽을 롤백하고 409로 응답한다.
   - Story를 지우면 댓글·투표를, 부모 댓글을 지우면 대댓글 스레드 전체를 함께 지운다 (`onDelete: Cascade`).
     기본값(RESTRICT)이면 투표·댓글이 달린 story는 삭제가 실패하고, SetNull이면 대댓글이 최상위로 떠버린다.
   - **content 입력 검증 (2026-10-08 추가)** — story·comment 공통, `src/lib/body.ts`의 `readContent` 한 곳에서:
     - 줄바꿈(`
`, ``)·탭을 제외한 제어 문자(유니코드 Cc)가 있으면 400. 특히 NUL은 Postgres `text`에
       저장할 수 없어서 검증 전에는 DB 단계에서 500(`22021`)이 났다. trim이 앞뒤 제어 문자를 지우기 전에 원문으로 검사한다.
     - 앞뒤 공백을 제거한 뒤 빈 문자열이면 400
     - 최대 길이 story 10,000자 / comment 2,000자 초과면 400. 길이는 UTF-16 단위가 아니라 문자(코드 포인트) 기준
       (이모지 10,000개는 UTF-16으로 20,000이지만 10,000자로 센다)
     - PATCH에서는 content를 아예 안 보내면 "변경 없음"이지만, 보냈는데 비어 있으면 400
     - 수정·삭제는 소유권 검사가 먼저라, 남의 글이면 내용과 상관없이 403
3. 이미지 업로드 (multer, Story에 첨부) — **완료 (2026-10-07)**
   - multer 2.x로 로컬 디스크 `uploads/`에 저장, Story당 1장 (기존 `Story.imageUrl` 사용, 스키마 변경 없음)
   - 파일명은 원본 이름 대신 `crypto.randomUUID()` + 확장자. 확장자는 원본 파일명도, 클라이언트가 보낸
     MIME도 아닌 **파일 시그니처(매직 바이트)** 기준으로 정한다 (jpeg/png/webp/gif만 허용, 최대 5MB)
   - DB에는 `/uploads/<파일명>` 상대경로만 저장하고 `express.static`으로 제공
     (`X-Content-Type-Options: nosniff`, 세션 미들웨어보다 앞에 둬서 이미지 요청마다 DB 조회가 없게 함)
   - 업로드·삭제 로직은 `src/lib/storage.ts` 한 곳에 모았다 — 저장소를 바꿀 때 이 파일만 교체
   - PATCH 미들웨어 순서는 requireAuth → 소유권 체크 → multer. 403이면 파일이 디스크에 쓰이지 않는다
   - 고아 파일 방지: 이미지 교체·제거·Story 삭제 시 이전 파일 삭제, 업로드 후 저장이 실패하면
     (검증 실패·404·DB 오류 모두) 방금 올린 파일 삭제. 파일 삭제 실패는 로그만 남기고 요청은 성공시킨다
   - 형식 거부 400, 5MB 초과 413 — multer 에러는 공용 에러 미들웨어에서 변환
   - **매직 바이트 검사 (2026-10-07 추가)**: 클라이언트 MIME은 위조할 수 있어서(예: `.txt`를 `image/png`로 전송)
     파일 앞부분 시그니처로 실제 형식을 판별한다 — JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`,
     GIF `GIF87a`/`GIF89a`, WebP `RIFF....WEBP`. 하나도 맞지 않으면 400.
     - multer를 메모리 저장으로 바꿔 버퍼에서 먼저 검사하고, 통과한 파일만 디스크에 쓴다.
       위조 파일은 디스크에 한 번도 쓰이지 않으니 지울 파일 자체가 생기지 않는다 (최대 5MB라 메모리 부담 작음).
     - 클라이언트 MIME 필터는 값싼 1차 거름망으로만 남겼다. 진짜 JPEG를 `image/png`로 보내도 `.jpg`로 저장된다.
     - 시그니처만 보고 이미지 전체를 디코딩하진 않는다 — 헤더만 맞춘 깨진 파일은 통과할 수 있다.
   - ⚠️ **배포 시 주의**: Render·Railway·Fly.io·Heroku 같은 PaaS는 컨테이너 디스크가 휘발성이라
     재배포·재시작·스케일 아웃 때 `uploads/`가 초기화되고, DB의 `imageUrl`만 남아 이미지가 전부 404가 된다.
     인스턴스가 여러 대면 업로드된 인스턴스에만 파일이 있다. 배포 전에 Supabase Storage 같은
     외부 오브젝트 스토리지로 옮겨야 한다 (`src/lib/storage.ts`만 교체하면 되도록 설계해 둠).
4. 프론트엔드 연동 (fetch, cors) — **조회 화면 완료 (2026-10-08)**, 로그인·작성 화면은 다음 단계
   - **구조**: 저장소 루트의 `client/`에 Vite + React + TypeScript(react-ts 템플릿). 백엔드 구조는 그대로 두고
     독립된 npm 프로젝트로 둔다. 라우팅은 react-router, 스타일은 순수 CSS(`client/src/index.css`).
     - API 호출과 응답 타입은 `client/src/api.ts` 한 파일에 모은다 (fetch 사용).
     - 모든 요청에 `credentials: "include"` — 다음 단계의 세션 로그인 연동 대비.
     - react-router는 **7.x**를 쓴다. 최신 8.x는 `engines.node >=22.22`인데 개발 PC는 Node 22.16이라,
       Node 20+를 지원하는 7.18을 골랐다 (이번에 쓰는 `BrowserRouter`·`Routes`·`useParams` 등은 v7·v8 동일).
   - **Vite 프록시를 쓰지 않는 이유**: 프록시를 쓰면 브라우저 입장에서 같은 출처 요청이 돼서 CORS가 아예 일어나지 않는다.
     실제 배포처럼 프론트(5173)와 백엔드(4000)를 다른 출처로 두고 백엔드의 `cors({ origin: CLIENT_ORIGIN, credentials: true })`가
     실제로 동작하는 모습을 보여주기 위해, `client/.env`의 `VITE_API_URL`(http://localhost:4000)로 직접 요청한다.
     - 대가: 프론트 포트가 `CLIENT_ORIGIN`과 정확히 같아야 한다. 그래서 Vite를 `port: 5173, strictPort: true`로 고정했다
       (5173이 사용 중일 때 5174로 조용히 넘어가면 CORS로 전부 막히므로, 넘어가지 않고 바로 실패하게 함).
     - `credentials: "include"`와 함께 쓰려면 `Access-Control-Allow-Origin`이 `*`가 아니라 정확한 출처여야 하고
       `Access-Control-Allow-Credentials: true`가 필요하다 — 둘 다 응답 헤더로 확인함.
   - **화면**: 홈(`/`) 단어 검색(검색어는 URL `?q=`에 담아 뒤로 가기 시 유지, 검색어가 없으면 최근 단어),
     단어 상세(`/words/:id`) 뜻을 품사별 번호 목록으로 + Wiktionary 출처·CC BY-SA 링크 + story 목록(추천순, 썸네일).
     `definitions`가 null이면 "사전에서 찾을 수 없는 표현입니다". 모든 페이지 하단에 설(說) 디스클레이머.
     로딩·에러(네트워크·404)·결과 없음 상태를 각각 처리한다.
   - 확인 방법 메모: CORS는 브라우저만 강제하므로 curl로는 "에러 없음"을 증명할 수 없다. 개발 PC의 Edge를
     헤드리스(임시 프로필)로 띄워 실제 렌더링·콘솔 로그로 확인했다 (`--dump-dom`은 끝나지 않는 요청을 무한정 기다리므로
     로딩 화면은 `--timeout`으로 캡처).

## 저장소

- GitHub: https://github.com/River-yhj/mutho-root
