# MuthoRoot

@docs/decision-log.md

## 컨벤션

- TypeScript strict 모드 유지, `any` 사용 금지
- 소유권 검증(요청자 == 리소스 소유자)은 수정·삭제 라우터에서 절대 생략하지 않는다
- Prisma는 반드시 `src/lib/prisma.ts`의 싱글턴 인스턴스를 사용한다 (`new PrismaClient()` 직접 생성 금지)
- 라우팅(`src/routes`)과 비즈니스 로직(`src/controllers`)을 분리한다
- 커밋 메시지는 Conventional Commits 형식 사용 (`feat:`, `fix:`, `chore:` ...)
- `CLAUDE.md`, `docs/`, `.env.example`은 작업 중 변경이 생기면 매번 그 작업 커밋에 함께 포함한다

## 자주 실수하는 지점

- Express 5부터 비동기 핸들러의 에러가 자동으로 에러 미들웨어까지 전달된다 — 매번 try/catch로 감쌀 필요 없음
- multer 업로드 저장 경로는 `uploads/`이며 `.gitignore`에 의해 git에는 포함되지 않는다
- 세션 기반 로그인과 Google/Kakao OAuth가 공존하므로, 인증 미들웨어는 `req.isAuthenticated()` 기준으로 통일한다
