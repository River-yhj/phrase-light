/**
 * 기본 사전 시드 — `npm run seed`
 *
 * 문장 분석기는 사전에 등록된 단어·숙어만 찾을 수 있다. 처음 써 보는 사람도 분석 결과를 볼 수 있도록
 * 자주 쓰는 영어 숙어·표현을 미리 등록해 둔다.
 *
 * - API(POST /api/words)와 같은 find-or-create(lib/wordEntries.ts)를 써서 Wiktionary 뜻을 실제로 가져온다.
 * - 이미 있는 단어는 건너뛴다. 여러 번 실행해도 중복되지 않고, 아무것도 지우지 않는다.
 * - 등록자는 시드 전용 사용자(provider "seed")다. 이메일·비밀번호가 없어 로그인할 수 없다.
 * - Wiktionary에 부담을 주지 않도록 새로 등록할 때만 요청하고, 요청 사이에 잠깐 쉰다.
 * - 뜻을 못 가져온 단어(타임아웃 등)는 끝에 목록으로 알려 준다. 단어 상세 화면을 열 때 다시 조회해 채운다.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { findOrCreateWordEntry, normalizeWord } from "../src/lib/wordEntries.js";

const SEED_USER = { provider: "seed", providerId: "dictionary", name: "PhraseLight 기본 사전" } as const;

const DELAY_MS = 300;

/**
 * Wiktionary 표제어 형태 그대로 쓴다 (one's·someone's 자리 표시 포함 — 분석기가 his·her·John's 등과 맞춘다).
 * 문장 분석기 시연에 쓰기 좋은, 일상 글에 자주 나오는 숙어 위주로 골랐다.
 */
const SEED_WORDS = [
  "soapbox",
  "kick the bucket",
  "spill the beans",
  "break the ice",
  "lose one's temper",
  "piece of cake",
  "hit the sack",
  "under the weather",
  "once in a blue moon",
  "cost an arm and a leg",
  "let the cat out of the bag",
  "bite the bullet",
  "call it a day",
  "cut corners",
  "get out of hand",
  "hang in there",
  "hit the nail on the head",
  "miss the boat",
  "on the ball",
  "pull someone's leg",
  "last straw",
  "through thick and thin",
  "up in the air",
  "beat around the bush",
  "burn the midnight oil",
  "go the extra mile",
  "in hot water",
  "make ends meet",
  "on cloud nine",
  "see eye to eye",
  "take it easy",
  "throw in the towel",
  "when pigs fly",
  "add insult to injury",
  "back to square one",
  "blessing in disguise",
  "break a leg",
  "by the skin of one's teeth",
  "get the hang of",
  "hold one's horses",
  "jump the gun",
  "let off steam",
  "out of the blue",
  "rain cats and dogs",
  "sit on the fence",
  "speak of the devil",
  "steal someone's thunder",
  "turn a blind eye",
  "wild-goose chase",
  "bark up the wrong tree",
  "word of mouth",
  "keep an eye on",
  "get cold feet",
  "cry over spilled milk",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const seedUser = await prisma.user.upsert({
    where: { provider_providerId: { provider: SEED_USER.provider, providerId: SEED_USER.providerId } },
    update: { name: SEED_USER.name },
    create: { ...SEED_USER },
  });

  let created = 0;
  let existing = 0;
  const missingDefinitions: string[] = [];

  for (const [index, raw] of SEED_WORDS.entries()) {
    const word = normalizeWord(raw);
    const progress = `[${index + 1}/${SEED_WORDS.length}]`;
    const { entry, created: isNew } = await findOrCreateWordEntry(word, seedUser.id);

    if (isNew) {
      created += 1;
      console.log(`${progress} 등록  ${word}`);
      await sleep(DELAY_MS);
    } else {
      existing += 1;
      console.log(`${progress} 있음  ${word}`);
    }
    if (entry.definitions === null) missingDefinitions.push(word);
  }

  console.log(`\n완료: 새로 등록 ${created}개, 이미 있음 ${existing}개 (전체 ${SEED_WORDS.length}개)`);
  if (missingDefinitions.length > 0) {
    console.log(
      `뜻을 아직 못 가져온 단어 ${missingDefinitions.length}개 — 단어 상세 화면을 열 때 다시 조회합니다:\n  ` +
        missingDefinitions.join(", ")
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error("[seed] 실패:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
