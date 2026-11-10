# PhraseLight

영어 단어·숙어 사전. 단어를 등록하면 Wiktionary에서 뜻을 가져와 고정 저장합니다.

> 2026-11-10에 MuthoRoot(유래 이야기 커뮤니티)에서 방향을 바꿨습니다. 자세한 이유는 `docs/decision-log.md`를 보세요.

## 핵심 기능

- 회원가입 / 로그인 (이메일+비밀번호, Google·Kakao 소셜 로그인)
- 단어·숙어 검색과 등록 (뜻은 Wiktionary에서 자동으로 가져와 고정)

## 기술 스택

Node.js 24 · TypeScript · Express 5 · Prisma + Supabase(PostgreSQL) · Passport(세션 로그인 + Google/Kakao OAuth) · bcrypt · multer · fetch/axios · cors

## 데이터 모델

`User` 1:N `WordEntry`

## 로컬 실행

백엔드를 먼저 켜고, 새 터미널에서 프론트엔드를 켭니다. Node.js 24 이상이 필요합니다 (`package.json`의 `engines` 기준).

```bash
# 1) 백엔드 — 저장소 루트, http://localhost:4000
cp .env.example .env   # 값 채우기 (CLIENT_ORIGIN=http://localhost:5173 은 그대로 둘 것)
npm install
npm run prisma:migrate
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

### 시연용 데이터 넣기 (선택)

```bash
npm run seed   # 저장소 루트에서 — 백엔드 .env의 DB에 시드 데이터를 넣는다
```

- 자주 쓰는 영어 숙어·표현 50여 개를 사전에 등록합니다. 단어 뜻은 Wiktionary에서 실제로 가져옵니다
  (요청 사이에 잠깐씩 쉬어서 1~2분쯤 걸립니다).
- 이미 있는 단어는 건너뜁니다. 여러 번 실행해도 중복되지 않고, 아무것도 지우지 않습니다.
- 등록자는 시드 전용 사용자(로그인 불가)입니다.

## 폴더 구조

```
src/
  routes/        API 라우트
  controllers/   라우트 핸들러 로직
  middlewares/   인증 체크, 소유권 검증, multer 설정
  lib/           prisma client 등 공용 인스턴스
  index.ts       엔트리포인트
prisma/
  schema.prisma
uploads/         이미지 업로드 저장 위치 (git에는 포함 안 됨)
client/          프론트엔드 (Vite + React + TypeScript, react-router, 순수 CSS)
  src/api.ts     API 호출과 응답 타입
  src/pages/     페이지 (홈 검색, 단어 상세)
```
