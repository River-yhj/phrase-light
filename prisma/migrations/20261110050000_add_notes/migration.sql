-- 2026-11-10: 분석 노트(Note)와 노트에서 찾은 표현(NoteMatch)을 추가한다.
-- NoteMatch는 Note와 WordEntry를 잇는 N:M 연결 테이블이다.

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceImageUrl" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteMatch" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "wordEntryId" TEXT NOT NULL,
    "matchedText" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,

    CONSTRAINT "NoteMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_userId_updatedAt_idx" ON "Note"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "NoteMatch_noteId_idx" ON "NoteMatch"("noteId");

-- CreateIndex
CREATE INDEX "NoteMatch_wordEntryId_idx" ON "NoteMatch"("wordEntryId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMatch" ADD CONSTRAINT "NoteMatch_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMatch" ADD CONSTRAINT "NoteMatch_wordEntryId_fkey" FOREIGN KEY ("wordEntryId") REFERENCES "WordEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
