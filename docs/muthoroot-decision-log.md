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

## 진행 상황

### ✅ 1. 인증 (완료)

- 로컬 이메일+비밀번호 가입/로그인(bcrypt) + Google/Kakao OAuth 전부 실제 브라우저 테스트 통과
- **카카오는 이메일을 안 줌**: 개인 개발자는 "카카오계정(이메일)" 동의항목을 바로 못 쓴다 (비즈 앱 전환 + 별도 심사 필요, 시간 소요). 그래서 이메일에 의존하지 않는 쪽으로 설계 변경:
  - `User.email`을 `String? @unique`(선택값)로 변경
  - `@@unique([provider, providerId])`를 추가해서, 소셜 로그인 사용자는 이메일이 아니라 이 조합으로 식별
  - 카카오 로그인 시 `email: null`, `name`엔 카카오 닉네임 저장
- 동의항목: 닉네임은 **필수 동의**(서비스 운영에 꼭 필요), 프로필 사진은 **선택 동의**로 신청
- Supabase 관련 트러블슈팅 (다음에 또 겪을 수 있으니 기록):
  - DB 비밀번호를 새로 설정/리셋한 직후, Transaction pooler(6543)가 잠깐 인증 실패를 낼 수 있음 — Supabase 공식 문서에 나온 알려진 캐시 지연 현상. Session pooler(5432, `DIRECT_URL`)는 바로 되는데 6543만 실패하면 몇 분 기다렸다가 재시도하면 보통 해결됨
  - 이 프로젝트 규모(서버리스 아닌 단일 Express 서버)에서는 `DATABASE_URL`도 그냥 `DIRECT_URL`과 같은 세션 풀러 문자열을 써도 무방함
- `SESSION_SECRET`이 빈 문자열이면 `?? "dev-secret"` 폴백이 안 먹혀서 (`??`는 null/undefined만 처리) 서버 전체가 500 — 반드시 실제 랜덤 값을 채워야 함. 운영 환경(`NODE_ENV=production`)에서는 기본값으로 기동 자체가 막히도록 처리해둠
- 카카오 KOE006(Redirect URI 불일치) 에러 겪음 — `.env`의 `KAKAO_CALLBACK_URL`과 카카오 콘솔 등록값이 정확히 일치해야 함(슬래시 하나 차이도 실패 원인)

### 🔧 2. Story·Comment API — 설계 확정 (구현 전)

- **WordEntry는 "단어 검색 사이트"의 핵심**: `meaning`은 이제 커뮤니티가 채우는 게 아니라 외부 사전 API(Free Dictionary API, dictionaryapi.dev — 영어 기준, 키 불필요·무료)에서 조회해서 **고정 저장**한다. 등록 후에는 아무도 수정할 수 없음(수정 API 자체를 만들지 않음).
- **muthos/logos 구도가 여기서 완성됨**: `meaning`(고정된, 검증된 뜻) = logos, `Story`(검증 안 됐지만 재밌는 이야기, 인기로 줄세워짐) = muthos.
- **단어 등록은 find-or-create**: 이미 같은 단어(`WordEntry.word`, 소문자 정규화)가 있으면 기존 항목을 재사용하고, 없으면 사전 API를 조회해 `meaning`을 채운 뒤 새로 생성한다. `word`에 `@unique` 제약 추가함(스키마 반영 완료).
- 사전 API에서 뜻을 못 찾아도(404 등) 등록 자체는 막지 않는다 — `meaning: null`로 생성하고 프론트에서 "사전에 없는 표현" 정도로 표시.
- **Story 정렬**: 한 단어의 story 목록은 추천수(`voteCount`) 내림차순으로 보여준다.
- 성능을 위해 Vote 개수를 매번 집계(count)하지 않고 `Story.voteCount` 컬럼에 미리 계산해 들고 있는다 — 투표/취소 시 Prisma 트랜잭션으로 `Vote` row 생성·삭제와 `voteCount` +1/-1을 함께 처리한다(스키마 반영 완료: `Story.voteCount`, `@@index([wordEntryId, voteCount])`).

### 다음 작업 순서

2. Story·Comment API + 소유권 기반 권한 (본인 글만 수정·삭제) ← 다음 채팅
3. 이미지 업로드 (multer, Story에 첨부)
4. 프론트엔드 연동 (fetch/axios, cors)

## 저장소

- GitHub: https://github.com/River-yhj/mutho-root
