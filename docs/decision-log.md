# PhraseLight — 설계 결정 로그

이 문서는 코드 저장소(GitHub)에는 남지 않는 "왜 이렇게 결정했는지"를 기록합니다.
새 채팅을 열 때 이 문서를 프로젝트 지식에 함께 두면, 매번 배경을 다시 설명할 필요가 없습니다.

## 지금의 서비스 (2026-11-10 방향 전환 이후)

영어 문장이나 문단을 붙여넣으면 그 안의 단어·숙어를 찾아 사전 뜻과 함께 보여주는 **영어 표현 사전**.
분석한 글은 출처 사진과 함께 개인 **분석 노트**로 저장한다.

- 데이터: 사용자, 단어(뜻은 Wiktionary에서 가져와 고정), 분석 노트, 노트에서 찾은 표현
- 고유 기능: 사전 자동 연동과 뜻 고정 / 문장 속 표현 찾기(문장 분석기) / 내 노트 속 용례 모아보기
- 아래 "방향 전환" 이전 섹션(스코프 결정, Story·Comment·Vote 관련 기록)은 **지난 기록**이다.
  사전 API, 인증, 이미지 업로드, 프론트 구조에 대한 결정은 지금도 유효하다.

## 방향 전환과 이름 변경 (2026-11-10)

- **이유**: 기말 프로젝트 안내(1차)에서 수업 실습 주제(SNS)는 선택할 수 없다.
  유래 이야기(Story)·추천(Vote)·댓글(Comment)은 "글 + 좋아요 + 댓글" 구조라 SNS로 보일 수 있어서 모두 없앴다.
- 단어만 남기면 공통 필수 기능(사용자 포함 데이터 3종, 1:N 2개, 사용자가 CRUD하는 데이터 + 본인만 수정·삭제)과
  프로젝트 필수 요건(이미지 업로드)을 채울 수 없어서, 사용자가 쓰는 데이터로 **분석 노트**를 새로 뒀다.
  이미지 업로드는 노트의 **출처 사진**(교재 페이지, 기사 캡처)으로 옮겼다.
- **이름: MuthoRoot → PhraseLight** (저장소 `phrase-light`)
  - muthos(그리스어 "이야기")는 유래 이야기가 빠지면 의미가 맞지 않는다.
  - phrase + highlight. 문장 속 표현에 불을 켜 준다는 핵심 기능이 이름에 드러난다.
    "phrase"는 숙어와 단어 표현을 모두 아우른다 ("idiom"은 숙어 전용으로 들림).
  - IdiomLens·Idiomark도 후보였지만 "Idiom-"으로 시작하는 영어 학습 앱(Idiomary, Idiomly, IdiomPal 등)이 많아 묻히기 쉬웠다.
  - 저장소명은 kebab-case(`phrase-light`), 브랜드 표기는 `PhraseLight`로 분리한다 (npm 패키지명 규칙 + OS 대소문자 이슈).
  - 이전 이름 MuthoRoot의 유래(muthos/logos 구도)는 아래 지난 기록에 남겨 둔다.

## (지난 기록) MuthoRoot 서비스 컨셉

단어·숙어에 얽힌 유래 이야기(story)를 커뮤니티가 함께 쓰고, 댓글로 토론하고, 투표하는 서비스였다.
etymonline 같은 어원 사전에서 출발했지만, "학술적으로 검증된 사실"이 아니라
"사람들 사이에 전해지는 이야기(설)"를 다루는 쪽으로 포지셔닝을 잡았다.
이름은 muthos(μῦθος, 그리스어로 "이야기·설화") + root(어근). muthos는 logos(검증된 이성적 담론)와 대비되는 개념이다.

## (지난 기록) 스코프 결정

- **1차 스코프**: Story(유래 이야기) + Comment(대댓글 토론) + Vote(업보트)까지만.
- **ROOT(어근) 태깅은 보류**: 어근 정보는 거의 모든 단어에 존재해서 범위가 넓고
  건조한 반면, "이야기"는 일부 단어에만 존재해서 범위가 더 좁고 이 프로젝트의
  관심사(숙어 탄생 서사)와 정확히 일치한다. 그래서 더 작은 범위인 STORY 쪽을
  먼저 구현하기로 했다. 여유가 되면 이후에 `WordEntry N:M Root` 관계로 추가한다.
- Story는 커뮤니티형: 한 단어(WordEntry)에 여러 사람이 각자 버전의 story를
  올릴 수 있다 (단어당 story 1개가 아님).
- Comment는 자기참조(parentId)로 대댓글(스레드)을 지원한다 — GitHub 이슈 댓글과
  비슷한 톤을 목표로 함.

## (지난 기록) 데이터 모델

- `User` 1:N `WordEntry` (누가 단어를 등록했는지)
- `WordEntry` 1:N `Story` (한 단어에 여러 유래 이야기)
- `Story` 1:N `Comment`, `Comment` 자기참조 1:N (대댓글)
- `User` N:M `Story` — `Vote` 조인 테이블로 업보트 표현 (N:M 요건 충족)
- `Root` 모델은 아직 스키마에 없음 (위 스코프 결정 참고)

## 문장 분석기 (2026-11-10)

`POST /api/analyze { text }` — 붙여넣은 영어 글(최대 5,000자)에서 사전에 등록된 단어·숙어를 찾아
원문 위치(`start`, `end`), 원문에 쓰인 형태(`matchedText`), 첫 뜻을 돌려준다. 로그인 없이 쓸 수 있다.

- **로직은 `src/lib/analyzer.ts`의 순수 함수**로 두고 단위 테스트(`npm test`, `src/lib/analyzer.test.ts`)로 규칙을 고정했다.
  DB를 모르는 함수라 테스트에 DB가 필요 없다.
- **찾는 규칙**
  - 대소문자, 굽은 따옴표(’)는 구분하지 않는다.
  - 활용형을 같은 표현으로 본다: -s/-es/-ies, -ed/-ied, -ing(e 탈락·자음 겹침·ying→ie), 그리고 숙어에 자주 나오는
    불규칙 동사 80여 개(break/broke/broken, steal/stole, spill/spilt …). 표제어 쪽과 원문 쪽의 원형 후보가 하나라도
    겹치면 같은 단어로 본다 (그래서 표제어 `cry over spilled milk`가 원문 `spilt milk`와도 맞는다).
    - 엄밀한 형태소 분석이 아니라 넉넉한 후보 목록이다. 후보가 틀려도 표제어와 겹치지 않으면 아무 일도 없어서 넓게 잡았다.
  - Wiktionary 표제어의 자리 표시를 맞춘다: `one's`·`someone's` ↔ my/your/his/her/its/our/their/○○'s,
    `oneself` ↔ myself 등, `someone`·`something` ↔ 아무 단어 하나.
  - 숙어 단어 사이에는 공백·줄바꿈·하이픈만 올 수 있다. 쉼표·마침표를 건너 맞추지 않는다 (`I kick. The bucket…` ✗).
    하이픈과 공백은 같게 본다 (`wild-goose chase` = `wild goose chase`).
  - 겹치면 단어 수가 많은 숙어를 남긴다 → 글자 수 → 앞에 나온 것 순. `break the ice` 안의 `ice`는 따로 잡지 않는다.
  - 위치는 JS 문자열 인덱스(UTF-16)다. 프론트도 JS 문자열이라 그대로 잘라 쓰면 된다.
- **색인 캐시 (`src/lib/phraseIndex.ts`)**: 등록된 단어 전체로 만든 색인을 메모리에 둔다. 단어는 지워지거나 표제어가 바뀌지
  않고 늘어나기만 하므로, 분석할 때마다 (단어 수, 마지막 등록 시각)만 확인하고 달라졌을 때만 다시 만든다.
  다른 프로세스(시드 스크립트)가 넣은 단어도 서버 재시작 없이 반영된다.
- 입력 검증은 `src/lib/body.ts`의 `readText` 한 곳에서 한다 (이전 story·comment의 `readContent`를 필드 이름을 받도록 일반화).
  여러 줄 입력은 줄바꿈·탭만 허용하고, 한 줄 입력(노트 제목)은 제어 문자를 하나도 허용하지 않는다.

## 사전 API — Wiktionary (2026-10-07 교체)

`WordEntry.definitions`는 외부 사전에서 한 번 채우고 고정한다 (수정 API 없음). 조회 로직은 `src/lib/dictionary.ts` 한 곳에 있다.

- **교체 이유**: 처음 쓰던 dictionaryapi.dev가 2026-09-17부터 3주 넘게 응답하지 않았다.
  DNS·TCP·TLS 연결은 바로 되는데 API 경로에서만 첫 바이트가 오지 않는 상태(Cloudflare 뒤 원본 서버 무응답)라,
  그동안 등록한 단어는 전부 `meaning: null`이 됐다. 위키미디어가 운영해 가용성이 높은 Wiktionary로 바꿨다.
- **엔드포인트**: `https://en.wiktionary.org/api/rest_v1/page/definition/{word}`
  - 공백은 `_`로 바꾼 뒤 `encodeURIComponent` (`kick the bucket` → `kick_the_bucket`)
  - 응답의 `en` 배열에서 정의를 **사전 순서대로, 품사별 최대 3개** 저장한다 (아래 2026-10-08 변경 참고).
    정의에 `<span>`·`<a>` 태그가 섞여 있어 태그를 지우고 HTML 엔티티를 풀어 평문으로 저장한다.
    태그를 지우면 빈 문자열이 되는 정의는 건너뛰고 개수에도 세지 않는다.
  - 위키미디어 API 정책에 따라 `User-Agent`에 앱 이름과 연락처를 넣는다
    (`PhraseLight/0.1 (https://github.com/River-yhj/phrase-light)`)
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

## 작업 기록

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
2. Story·Comment API + 소유권 기반 권한 (본인 글만 수정·삭제) — 완료 (2026-09-17), **2026-11-10 제거 (지난 기록)**
   - 방향 전환으로 Story·Comment·Vote 테이블과 API를 모두 지웠다 (마이그레이션 `20261110040000_remove_stories_comments_votes`).
     아래 기록 중 find-or-create, definitions 고정, null 재조회, 입력 검증 규칙은 단어·분석 노트에 그대로 쓰인다.
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
   - **작성자 본인 추천 허용 (2026-10-08 결정)**: 작성자는 자기 story에 추천할 수 있다. 의도된 동작이다.
     - Reddit·Instagram 같은 대형 SNS와 같은 방식이다.
     - 사용자당 story 1표 제한(`Vote`의 `@@unique([userId, storyId])` + 토글)은 그대로 유지한다.
     - ⚠️ 이후 작업에서 이 동작을 버그로 보고 막지 않는다.
   - **`votedByMe` (2026-10-08 추가)**: `GET /api/words/:id`의 각 story에 로그인 사용자가 추천했는지(boolean)를 넣는다.
     비로그인이면 전부 `false`. 추천 버튼의 눌림 상태 표시용이며, story 수만큼 쿼리하지 않도록
     그 단어의 story ID 목록으로 내 Vote를 한 번에 조회한다.
   - Story를 지우면 댓글·투표를, 부모 댓글을 지우면 대댓글 스레드 전체를 함께 지운다 (`onDelete: Cascade`).
     기본값(RESTRICT)이면 투표·댓글이 달린 story는 삭제가 실패하고, SetNull이면 대댓글이 최상위로 떠버린다.
   - **content 입력 검증 (2026-10-08 추가)** — story·comment 공통, `src/lib/body.ts`의 `readContent` 한 곳에서:
     - 줄바꿈(`\n`, `\r`)·탭을 제외한 제어 문자(유니코드 Cc)가 있으면 400. 특히 NUL은 Postgres `text`에
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
4. 프론트엔드 연동 (fetch, cors) — **조회 화면·로그인 완료 (2026-10-08)**
   - 2026-11-10 방향 전환으로 단어 상세의 이야기 목록·댓글 스레드 화면을 지웠고, 하단 디스클레이머(설說)를
     Wiktionary 출처·라이선스 안내로 바꿨다. 남은 작성 화면은 문장 분석과 분석 노트다.
   - **구조**: 저장소 루트의 `client/`에 Vite + React + TypeScript(react-ts 템플릿). 백엔드 구조는 그대로 두고
     독립된 npm 프로젝트로 둔다. 라우팅은 react-router, 스타일은 순수 CSS(`client/src/index.css`).
     - API 호출과 응답 타입은 `client/src/api.ts` 한 파일에 모은다 (fetch 사용).
     - 모든 요청에 `credentials: "include"` — 다음 단계의 세션 로그인 연동 대비.
     - react-router는 처음엔 7.18을 썼다 (최신 8.x는 `engines.node >=22.22`인데 당시 개발 PC가 Node 22.16).
       **2026-10-08 Node 24 전환 후 8.4로 올렸다.** v8.0.0 breaking change 중 이 프로젝트에 해당하는 것은 없어서
       코드 변경 없이 버전만 올렸다:
       - `react-router-dom` 패키지 제거 → 처음부터 `react-router`에서만 import하고 있었음
       - ESM 전용 배포 → Vite 번들링이라 무관
       - `RouterProvider`/`HydratedRouter`는 `react-router/dom`으로 이동 → 선언형 `BrowserRouter`만 써서 무관
       - middleware·meta `data`·`hasErrorBoundary`·trailing slash 플래그 → Data/Framework 모드 기능이라 무관
       - 최소 Node 22.22 / React 19.2.7 → Node 24.21, React 19.3.0
       - 확인: 빌드·lint 통과, 헤드리스 Edge로 홈·검색·상세·없는 단어(404)·없는 경로(`*`) 모두 정상, 콘솔·CORS 에러 0건
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
   - **로그인 (2026-10-08, 작성 1단계)**:
     - 앱 시작 시(새로고침·OAuth 복귀 포함) `GET /api/auth/me`로 세션을 확인하고 React Context로 앱 전체에 공유한다
       (`client/src/auth/`). 확인 중에는 헤더 버튼을 그리지 않아 "로그인 → 이름"으로 깜빡이지 않게 했다.
       `only-export-components` lint 규칙 때문에 Context·훅(`authContext.ts`)과 Provider 컴포넌트를 파일로 나눴다.
     - 헤더: 비로그인이면 "로그인", 로그인이면 이름(없으면 이메일)과 "로그아웃". 로그아웃은 서버 요청이
       실패해도 화면 상태는 바로 비우고 홈으로 이동한다.
     - `/login`: 이메일 로그인·회원가입 폼 + Google·카카오 버튼. 서버 에러는 사용자 문구로 바꿔 보여준다
       (401 → "이메일 또는 비밀번호가 올바르지 않습니다", 409 → "이미 가입된 이메일입니다", 400 → 항목별 안내).
       빈 값·이메일 형식·비밀번호 8자는 서버에 보내기 전에 먼저 거른다 (`noValidate` + 직접 검증으로 문구 통일).
     - 로그인 후 돌아갈 곳은 `?next=`. 같은 사이트 경로("/..."로 시작, "//" 제외)만 허용해 오픈 리디렉션을 막는다.
       소셜 로그인은 백엔드가 `OAUTH_SUCCESS_REDIRECT`(프론트 홈)로 돌려보내므로 next를 이어가지 않는다.
     - 소셜 로그인은 fetch가 아니라 페이지 이동(`<a href="{API}/api/auth/google|kakao">`).
     - 세션 쿠키(`connect.sid`)는 `HttpOnly`·`SameSite=Lax`. localhost:5173과 localhost:4000은 포트만 다른
       **같은 사이트**라 `credentials: "include"` 요청에 Lax 쿠키도 실린다. 배포 때 프론트·백엔드 도메인이
       다른 사이트가 되면 `SameSite=None; Secure`로 바꿔야 한다.
     - 확인: 헤드리스 Edge + DevTools Protocol로 가입(검증 문구) → 로그아웃(/me 401) → 중복 가입 409 →
       틀린 비밀번호 401 → 로그인 → 새로고침 후 유지 → next 복귀 → 오픈 리디렉션 차단 → 소셜 버튼이 실제 제공자
       로그인 화면(콜백 주소 포함)까지 이동하는 것까지 20개 항목 통과. 실제 Google·카카오 계정 로그인은 사용자가 직접 확인.
   - **단어 등록 (2026-10-08, 작성 1단계)**: 검색 결과가 없으면 "'{검색어}' 등록하기" 버튼을 보여준다.
     - 비로그인이면 `/login?next=/?q={검색어}`로 보내 로그인 후 같은 검색 결과로 돌아온다 (자동 등록은 하지 않음 —
       사용자가 결과를 다시 보고 누르게).
     - 로그인 상태면 `POST /api/words` 후 상세로 이동한다. find-or-create라 `created: false`(그사이 다른 사람이 먼저
       등록)여도 응답의 단어로 이동하면 된다 — 검색 결과가 없을 때만 버튼이 보이므로 이 경로는 경쟁 상황에서만 생긴다.
     - 새 단어는 백엔드가 Wiktionary에서 뜻을 가져오느라 최대 5초쯤 걸릴 수 있어 "등록 중… 사전에서 뜻을 찾고 있어요"를 보여준다.
     - 세션이 끊겨 401이 오면 로그인 상태를 비우고 `/login?next=`로 보낸다. 400(100자 초과 등)은 서버 문구를 그대로 보여준다.
     - 확인: 비로그인 등록 시도 → 로그인 → 검색 결과 복귀 → 등록(진행 표시) → 상세(Wiktionary 뜻 표시),
       다른 계정이 먼저 등록한 경쟁 상황(created: false), 100자 초과, 세션 만료까지 12개 항목 통과.
   - **댓글 스레드 보기 (2026-10-08 추가)**: story마다 "댓글 n개 보기" 버튼으로 대댓글 스레드를 펼친다 (읽기 전용).
     기본은 접힌 상태이고, 펼칠 때 처음 `GET /api/stories/:id/comments`(트리)를 불러온다. 대댓글은 재귀로 들여쓴다.
     시드 데이터의 스레드가 화면에서 보이도록 추가했다.
   - 확인 방법 메모: CORS는 브라우저만 강제하므로 curl로는 "에러 없음"을 증명할 수 없다. 개발 PC의 Edge를
     헤드리스(임시 프로필)로 띄워 실제 렌더링·콘솔 로그로 확인했다 (`--dump-dom`은 끝나지 않는 요청을 무한정 기다리므로
     로딩 화면은 `--timeout`으로 캡처).
     클릭이 필요한 시나리오(검색 → 결과 클릭 SPA 이동 → 댓글 펼치기 → 뒤로 가기)는 Edge를 `--remote-debugging-port`로 띄우고
     Node 24 내장 WebSocket으로 DevTools Protocol을 직접 호출해 검증했다.

## 기본 사전 시드 (2026-11-10 교체)

`npm run seed` (`prisma/seed.ts`, tsx로 실행)는 자주 쓰는 영어 숙어·표현 54개를 사전에 등록한다.
문장 분석기는 사전에 등록된 표현만 찾을 수 있어서, 처음 써 보는 사람도 분석 결과를 볼 수 있게 하려는 것이다.

- API와 **같은 코드**(`src/lib/wordEntries.ts`의 find-or-create)로 등록하고, 뜻은 Wiktionary에서 실제로 가져온다.
- 이미 있는 단어는 건너뛴다. 여러 번 실행해도 중복되지 않고 **아무것도 지우지 않는다** (이전 시드는 story를 지우고 다시 넣었다).
- 등록자는 시드 전용 사용자 `provider: "seed"`, `providerId: "dictionary"`. 이메일·비밀번호가 없어 로그인할 수 없다.
  이전 시드 사용자(`nari`, `dohun`)는 지우지 않는다 — 그들이 등록한 단어(spill the beans, break the ice)가 남아 있다.
- 표제어는 Wiktionary 형태 그대로 쓴다. `lose one's temper`, `pull someone's leg`처럼 자리 표시(one's·someone's)가 든
  표현은 문장 분석기가 his·her·John's 등과 맞춘다.
- Wiktionary에 부담을 주지 않도록 새로 등록할 때만 요청하고 요청 사이에 300ms 쉰다.
- 뜻을 못 가져온 단어(첫 요청 타임아웃 등)는 실행 끝에 목록으로 보여 준다. 단어 상세 화면을 열 때 다시 조회해 채운다.
- 시드는 분석 노트를 만들지 않는다. 노트는 작성자만 볼 수 있는데 시드 사용자는 로그인할 수 없어서, 만들어도 아무도 볼 수 없다.

## 개발 환경

- **Node.js 24 기준** (2026-10-08 전환). 루트 `package.json`의 `engines`는 `>=24`이고 README도 24 기준으로 안내한다.
  - 그전까지 개발 PC는 Node 22.16이었다. 백엔드는 문제없이 돌았지만 `engines`(>=24)와 어긋나 있었고,
    react-router 8(Node 22.22 이상)을 쓸 수 없어서 7.x로 버텼다. PC를 24.21로 올린 뒤 8.x로 업그레이드했다.
  - Vite 8 자체는 Node 20.19+ / 22.12+면 되지만, 프로젝트 기준은 `engines`와 맞춰 24로 통일한다.

## 저장소

- GitHub: https://github.com/River-yhj/phrase-light (2026-11-10에 mutho-root에서 이름 변경, 옛 주소는 자동 연결)
