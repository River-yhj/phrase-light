# MuthoRoot

단어와 숙어에 얽힌 유래 이야기(story)를 커뮤니티가 함께 쓰고, 댓글로 토론하고, 투표하는 서비스.

> muthos(μῦθος, 그리스어로 "이야기·설화")에서 이름을 따왔습니다. 여기 실린 이야기는 검증된 학술 정보가 아니라 커뮤니티가 함께 만들어가는 설(說)입니다.

## 핵심 기능

- 회원가입 / 로그인 (이메일+비밀번호, Google·Kakao 소셜 로그인)
- 단어(WordEntry) 등록, 단어별 여러 유래 이야기(Story) 작성
- Story에 이미지 첨부
- Story에 대한 댓글 + 대댓글(스레드) 토론
- Story 업보트(투표)
- 작성자 본인만 수정·삭제 가능 (소유권 기반 권한)

## 기술 스택

Node.js 24 · TypeScript · Express 5 · Prisma + Supabase(PostgreSQL) · Passport(세션 로그인 + Google/Kakao OAuth) · bcrypt · multer · fetch/axios · cors

## 데이터 모델

`User` 1:N `WordEntry` / `WordEntry` 1:N `Story` / `Story` 1:N `Comment`(자기참조로 대댓글) / `User` N:M `Story`(Vote 조인 테이블로 업보트)

## 로컬 실행

백엔드를 먼저 켜고, 새 터미널에서 프론트엔드를 켭니다. Node.js 22.12 이상이 필요합니다 (Vite 8 요구사항).

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
