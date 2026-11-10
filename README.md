# PhraseLight

영어 문장이나 문단을 붙여넣으면 그 안의 단어·숙어를 찾아 사전 뜻과 함께 보여 주는 **영어 표현 사전**입니다.
분석한 글은 출처 사진과 함께 개인 **분석 노트**로 저장할 수 있습니다.

> 2026-11-10에 MuthoRoot(유래 이야기 커뮤니티)에서 방향을 바꿨습니다. 자세한 이유는 `docs/decision-log.md`를 보세요.

## 핵심 기능

- 회원가입 / 로그인 (이메일+비밀번호, Google·Kakao 소셜 로그인)
- 단어·숙어 검색과 등록 — 뜻은 Wiktionary에서 품사별로 자동으로 가져와 고정
- **문장 분석기** — 글에서 등록된 표현을 찾는다. `kicked the bucket`, `lost his temper`처럼 형태가 바뀌어도 알아보고,
  겹치면 긴 숙어를 우선한다
- **분석 노트** — 분석한 글을 제목·출처 사진과 함께 저장. 작성자만 보고 수정·삭제할 수 있다
- **내 노트 속 용례** — 단어 상세에서 내 노트 중 그 표현이 나온 문장을 모아 보여 준다

## API

| 메서드 · 경로 | 설명 | 로그인 |
| --- | --- | --- |
| `POST /api/auth/register` · `login` · `logout`, `GET /api/auth/me` | 이메일 가입·로그인 | — |
| `GET /api/auth/google` · `kakao` | 소셜 로그인 | — |
| `GET /api/words?q=` | 단어 검색 (q 없으면 최근 등록순) | 불필요 |
| `POST /api/words` | 단어 등록 (find-or-create, 뜻 자동 조회) | 필요 |
| `GET /api/words/:id` | 단어 상세 + 내 노트 속 용례(`myExamples`) | 불필요 (용례는 로그인 시) |
| `POST /api/analyze` | 글에서 등록된 표현 찾기 (`{ text }`, 최대 5,000자) | 불필요 |
| `GET /api/notes?q=` | 내 노트 목록 (제목 검색) | 필요 |
| `POST /api/notes` | 노트 작성 (multipart: `title`, `text`, 선택 `image`) | 필요 |
| `GET` · `PATCH` · `DELETE /api/notes/:id` | 노트 조회·수정·삭제 (남의 노트는 404) | 필요 |

## 기술 스택

Node.js 24 · TypeScript · Express 5 · Prisma + Supabase(PostgreSQL) · Passport(세션 로그인 + Google/Kakao OAuth) · bcrypt · multer · fetch/axios · cors

## 데이터 모델

- `User` 1:N `WordEntry` — 사용자가 사전에 단어를 등록
- `User` 1:N `Note` — 사용자가 분석 노트를 작성
- `Note` N:M `WordEntry` — `NoteMatch`로 연결 (노트의 어디에 어떤 형태로 나왔는지 함께 저장)

## 로컬 실행

백엔드를 먼저 켜고, 새 터미널에서 프론트엔드를 켭니다. Node.js 24 이상이 필요합니다 (`package.json`의 `engines` 기준).

```bash
# 1) 백엔드 — 저장소 루트, http://localhost:4000
cp .env.example .env   # 값 채우기 (CLIENT_ORIGIN=http://localhost:5173 은 그대로 둘 것)
npm install
npm run prisma:migrate
npm run seed            # 기본 사전(숙어 54개) — 문장 분석기가 찾을 표현
npm run dev

# 2) 프론트엔드 — 새 터미널에서 client/, http://localhost:5173
cd client
cp .env.example .env   # VITE_API_URL=http://localhost:4000
npm install
npm run dev
```

- 프론트는 Vite 프록시 없이 `VITE_API_URL`로 백엔드에 직접 요청하고, 백엔드가 CORS로 `CLIENT_ORIGIN`을 허용합니다.
  그래서 프론트 포트는 5173으로 고정돼 있고(`strictPort`), 5173이 이미 사용 중이면 다른 포트로 넘어가지 않고 실패합니다.
- 브라우저에서 http://localhost:5173 을 열면 됩니다.

### 기본 사전 넣기 (`npm run seed`)

```bash
npm run seed   # 저장소 루트에서 — 백엔드 .env의 DB에 기본 사전을 넣는다
```

- 자주 쓰는 영어 숙어·표현 54개를 사전에 등록합니다. 문장 분석기는 등록된 표현만 찾으므로 처음 한 번은 실행해 두세요. 단어 뜻은 Wiktionary에서 실제로 가져옵니다
  (요청 사이에 잠깐씩 쉬어서 1~2분쯤 걸립니다).
- 이미 있는 단어는 건너뜁니다. 여러 번 실행해도 중복되지 않고, 아무것도 지우지 않습니다.
- 등록자는 시드 전용 사용자(로그인 불가)입니다.

### 테스트

```bash
npm test       # 문장 분석기 단위 테스트 (DB 불필요)
```

## 폴더 구조

```
src/
  routes/        API 라우트
  controllers/   라우트 핸들러 로직
  middlewares/   인증 체크, 소유권 검증, multer 설정
  lib/           공용 로직 (analyzer: 문장 분석기, dictionary: Wiktionary, storage: 이미지 저장 등)
  index.ts       엔트리포인트
prisma/
  schema.prisma
uploads/         이미지 업로드 저장 위치 (git에는 포함 안 됨)
client/          프론트엔드 (Vite + React + TypeScript, react-router, 순수 CSS)
  src/api.ts     API 호출과 응답 타입
  src/pages/     페이지 (홈 검색, 단어 상세)
```
