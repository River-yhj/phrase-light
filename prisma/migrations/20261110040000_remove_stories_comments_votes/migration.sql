-- 2026-11-10 방향 전환: 유래 이야기(Story)·댓글(Comment)·추천(Vote)을 없앤다.
-- 수업 실습 주제(SNS)로 보이지 않도록 단어·숙어 사전 + 개인 분석 노트로 바꾸면서 쓰지 않게 된 테이블이다.
-- 이 테이블들의 데이터(시연용 시드 포함)는 함께 삭제된다.

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_storyId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_userId_fkey";

-- DropForeignKey
ALTER TABLE "Story" DROP CONSTRAINT "Story_wordEntryId_fkey";

-- DropForeignKey
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_storyId_fkey";

-- DropForeignKey
ALTER TABLE "Vote" DROP CONSTRAINT "Vote_userId_fkey";

-- DropTable
DROP TABLE "Comment";

-- DropTable
DROP TABLE "Story";

-- DropTable
DROP TABLE "Vote";
