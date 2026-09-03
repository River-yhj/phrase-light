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

```bash
cp .env.example .env   # 값 채우기
npm install
npm run prisma:migrate
npm run dev
```

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
```
