/**
 * 시연용 시드 데이터 — `npm run seed`
 *
 * - 시드 전용 사용자 2명(provider: "seed")을 만들고, 단어를 API와 같은 find-or-create 규칙으로 등록한다
 *   (lib/wordEntries.ts 공유 — definitions는 Wiktionary에서 실제로 가져옴).
 * - 단어마다 두 사용자가 쓴 story, 투표(추천순 정렬이 보이도록 서로 다른 수), 대댓글이 있는 댓글 스레드를 넣는다.
 * - 여러 번 실행해도 쌓이지 않도록, 시작할 때 "시드 사용자가 만든 데이터"만 지우고 다시 넣는다.
 * - 실제 사용자 데이터는 절대 건드리지 않는다:
 *   - 실제 사용자가 이미 등록한 단어는 재사용만 하고 지우지 않는다.
 *   - 실제 사용자의 댓글·투표·story가 시드 데이터에 얽혀 있으면(지우면 cascade로 같이 지워지거나
 *     voteCount가 어긋나는 경우) 아무것도 지우지 않고 중단한다.
 *
 * story 내용은 널리 알려진 유래담을 직접 요약한 것이며, 사이트 성격에 맞게 "설(說)"로 쓴다.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { findOrCreateWordEntry, normalizeWord } from "../src/lib/wordEntries.js";

const SEED_PROVIDER = "seed";

/** 시드 사용자 — 이메일·비밀번호가 없어서 로그인할 수 없고, 화면에는 이름만 보인다 */
const SEED_USERS = [
  { providerId: "nari", name: "어원 산책자 나리" },
  { providerId: "dohun", name: "말글 수집가 도훈" },
] as const;

type UserIndex = 0 | 1;

type SeedComment = { by: UserIndex; content: string; replies?: SeedComment[] };

type SeedStory = {
  by: UserIndex;
  content: string;
  /** 이 story에 투표하는 시드 사용자 — 추천순 정렬이 화면에서 보이도록 story마다 수를 다르게 둔다 */
  votes: UserIndex[];
  comments?: SeedComment[];
};

type SeedWord = { word: string; registeredBy: UserIndex; stories: SeedStory[] };

const SEED_WORDS: SeedWord[] = [
  {
    word: "soapbox",
    registeredBy: 0,
    stories: [
      {
        by: 0,
        votes: [0, 1],
        content:
          "19세기 런던 하이드파크의 '스피커스 코너'에서 연설하려는 사람들이 비누를 담아 나르던 나무 상자를 뒤집어 놓고 그 위에 올라섰다는 이야기가 가장 널리 퍼져 있다. 군중 너머로 목소리를 보내려고 키를 높인 것이다. 그래서 soapbox가 '자기 주장을 펴는 자리'라는 뜻을 얻었다는 설.",
        comments: [
          {
            by: 1,
            content: "스피커스 코너는 지금도 일요일마다 연설이 열린다고 들었어요. 진짜 상자를 들고 오는 사람도 있을까요?",
            replies: [
              {
                by: 0,
                content: "요즘은 접이식 발판을 많이 쓴다고 하더라고요. 도구는 바뀌어도 'soapbox'라는 이름은 그대로 남았죠.",
                replies: [{ by: 1, content: "도구는 바뀌어도 이름은 남는다… 이 사이트 주제랑 딱 맞네요." }],
              },
            ],
          },
        ],
      },
      {
        by: 1,
        votes: [1],
        content:
          "영국이 아니라 미국 쪽 이야기라는 주장도 있다. 20세기 초 미국 도시의 거리 연설가들, 특히 노동운동가와 선거 운동원들이 어디서나 구할 수 있는 튼튼한 비누 상자를 휴대용 연단으로 썼다는 것. 'get on one's soapbox(자기 주장을 늘어놓다)'라는 표현이 이 무렵 굳어졌다고 한다.",
      },
      {
        by: 1,
        votes: [],
        content:
          "왜 하필 비누 상자였는지에 대한 설명도 따라다닌다. 당시 비누는 큰 덩어리로 팔려서 포장 상자가 유난히 튼튼했고, 가게 뒤편에 흔히 쌓여 있어 쉽게 얻을 수 있었다는 것. 확인된 이야기는 아니지만 그럴듯해서 자주 함께 언급된다.",
      },
    ],
  },
  {
    word: "kick the bucket",
    registeredBy: 1,
    stories: [
      {
        by: 1,
        votes: [0, 1],
        content:
          "여기서 bucket은 양동이가 아니라 옛 영어에서 '들보·가로대'를 가리키는 말이었다는 설이 꽤 알려져 있다. 도축할 때 가축을 이 들보에 매달았는데, 숨이 끊어지기 직전 발버둥 치며 들보를 찼다는 데서 '죽다'라는 뜻이 나왔다는 것. 영국 노퍽 지방 방언에 이 쓰임이 남아 있었다는 이야기가 근거로 자주 인용된다.",
      },
      {
        by: 0,
        votes: [0],
        content:
          "더 흔히 듣는 설명은 생을 마감하려는 사람이 딛고 서 있던 양동이를 걷어찬다는 장면에서 왔다는 것이다. 다만 이건 표현이 먼저 퍼진 뒤에 그럴듯한 장면을 끼워 맞춘 '민간 어원'일 가능성이 높다는 의견도 많다. 어느 쪽이든 18세기 영국 속어 사전에 이미 '죽다'라는 뜻으로 실려 있었다고 한다.",
        comments: [
          {
            by: 1,
            content: "양동이 설은 장면이 너무 극적이라 오히려 나중에 만들어진 이야기 같아요.",
            replies: [{ by: 0, content: "저도요. 사실관계보다 이미지가 강해서 살아남은 설명 같달까요." }],
          },
        ],
      },
    ],
  },
  {
    word: "spill the beans",
    registeredBy: 0,
    stories: [
      {
        by: 0,
        votes: [0, 1],
        content:
          "고대 그리스에서 비밀 투표를 할 때 흰 콩은 찬성, 검은 콩은 반대로 항아리에 넣었는데, 누군가 실수로 항아리를 엎으면 결과가 미리 드러나 버렸다는 이야기. 그래서 '비밀을 누설하다'가 됐다는 설이다. 다만 이 표현이 영어 기록에 처음 보이는 건 20세기 초 미국이라 연결 고리가 약하다는 지적도 있다.",
        comments: [
          {
            by: 1,
            content: "그리스 투표 설은 거의 모든 유래 글에 나오는데, 정작 고대 문헌 근거는 본 적이 없어요.",
            replies: [
              {
                by: 0,
                content: "맞아요, 그래서 '설'로 올렸어요. 어느 쪽이 더 그럴듯한지 추천으로 겨뤄 보죠.",
              },
            ],
          },
        ],
      },
      {
        by: 1,
        votes: [],
        content:
          "그냥 미국 속어에서 spill(흘리다)이 이미 '비밀을 털어놓다'는 뜻으로 쓰이고 있었고, 콩은 한번 쏟으면 다시 주워 담기 어려운 것의 이미지로 붙었을 뿐이라는 해석도 있다. 쏟아진 콩처럼 한번 나간 말은 되돌릴 수 없다는 것.",
      },
    ],
  },
  {
    word: "break the ice",
    registeredBy: 1,
    stories: [
      {
        by: 1,
        votes: [1],
        content:
          "겨울이면 강과 항구가 얼어붙어 배가 다닐 수 없었는데, 작은 배들이 먼저 얼음을 깨 뒤따르는 배들의 길을 열어 줬다는 데서 왔다는 설. 꽉 막힌 분위기를 처음 깨고 대화의 물꼬를 트는 일과 닮아서 지금의 뜻이 됐다고 한다.",
      },
      {
        by: 0,
        votes: [0, 1],
        content:
          "얼음을 깨 뱃길을 내는 일이 낯선 지역 사이의 교역을 처음 열어 줬다는 점에서, '어려운 일을 처음 시작하다'라는 비유가 먼저 생겼다는 이야기도 있다. 16세기 무렵에는 이 넓은 뜻으로 쓰이다가, 나중에 '처음 만난 사람들 사이의 어색함을 깨다'로 좁혀졌다는 것.",
        comments: [
          {
            by: 1,
            content: "회의 시작할 때 하는 '아이스브레이킹'도 여기서 온 거겠죠?",
            replies: [{ by: 0, content: "네, 같은 비유예요. 얼음이 깨져야 배가 움직이듯 대화도 그렇다는 거죠." }],
          },
        ],
      },
    ],
  },
];

/** 시드 사용자를 만들거나(처음) 이름만 맞춘다(재실행). id는 실행마다 그대로 유지된다 */
async function upsertSeedUsers(): Promise<string[]> {
  const ids: string[] = [];
  for (const user of SEED_USERS) {
    const row = await prisma.user.upsert({
      where: { provider_providerId: { provider: SEED_PROVIDER, providerId: user.providerId } },
      update: { name: user.name },
      create: { provider: SEED_PROVIDER, providerId: user.providerId, name: user.name },
      select: { id: true },
    });
    ids.push(row.id);
  }
  return ids;
}

/**
 * 시드 사용자가 만든 데이터만 지운다. 실제 사용자 데이터가 얽혀 있으면 아무것도 지우지 않고 예외를 던진다.
 */
async function removePreviousSeedData(seedIds: string[]): Promise<void> {
  const seed = { in: seedIds };
  const notSeed = { notIn: seedIds };

  const conflicts = {
    // 시드 story를 지우면 cascade로 같이 지워지는 실제 사용자 데이터
    "시드 story에 달린 실제 사용자 댓글": await prisma.comment.count({ where: { story: { userId: seed }, userId: notSeed } }),
    "시드 story에 대한 실제 사용자 투표": await prisma.vote.count({ where: { story: { userId: seed }, userId: notSeed } }),
    // 시드 댓글을 지우면 cascade로 같이 지워지는 실제 사용자 대댓글
    "시드 댓글에 달린 실제 사용자 대댓글": await prisma.comment.count({ where: { parent: { userId: seed }, userId: notSeed } }),
    // 시드가 등록한 단어를 지우려면 함께 지워야 하는 실제 사용자 story
    "시드가 등록한 단어의 실제 사용자 story": await prisma.story.count({ where: { wordEntry: { userId: seed }, userId: notSeed } }),
    // 지우면 실제 사용자 story의 voteCount가 어긋나는 시드 투표 (시드는 이런 투표를 만들지 않음)
    "실제 사용자 story에 대한 시드 투표": await prisma.vote.count({ where: { userId: seed, story: { userId: notSeed } } }),
  };
  const found = Object.entries(conflicts).filter(([, count]) => count > 0);
  if (found.length > 0) {
    const detail = found.map(([what, count]) => `  - ${what}: ${count}건`).join("\n");
    throw new Error(
      `실제 사용자 데이터가 시드 데이터에 연결돼 있어 기존 시드를 지울 수 없습니다. 아무것도 변경하지 않았습니다.\n${detail}`
    );
  }

  const [comments, stories, words] = await prisma.$transaction([
    // 실제 사용자 story에 단 시드 댓글 (시드 story의 댓글·투표는 아래 story 삭제의 cascade로 지워짐)
    prisma.comment.deleteMany({ where: { userId: seed } }),
    prisma.story.deleteMany({ where: { userId: seed } }),
    // 시드가 등록한 단어만 지운다 — 실제 사용자가 등록한 단어는 재사용만 했으므로 남는다
    prisma.wordEntry.deleteMany({ where: { userId: seed } }),
  ]);
  console.log(`기존 시드 데이터 삭제: 댓글 ${comments.count} · story ${stories.count} · 단어 ${words.count}`);
}

/** 투표 — API의 토글과 같은 규칙으로 Vote 생성과 voteCount 증가를 한 트랜잭션에 묶는다 */
async function addVotes(storyId: string, voterIds: string[]): Promise<void> {
  if (voterIds.length === 0) return;
  await prisma.$transaction([
    prisma.vote.createMany({ data: voterIds.map((userId) => ({ userId, storyId })) }),
    prisma.story.update({ where: { id: storyId }, data: { voteCount: { increment: voterIds.length } } }),
  ]);
}

async function addComments(storyId: string, comments: SeedComment[], userIds: string[], parentId: string | null): Promise<number> {
  let count = 0;
  for (const comment of comments) {
    const row = await prisma.comment.create({
      data: { storyId, parentId, userId: userIds[comment.by], content: comment.content },
      select: { id: true },
    });
    count += 1 + (await addComments(storyId, comment.replies ?? [], userIds, row.id));
  }
  return count;
}

async function main(): Promise<void> {
  const userIds = await upsertSeedUsers();
  await removePreviousSeedData(userIds);

  for (const seedWord of SEED_WORDS) {
    const { entry, created } = await findOrCreateWordEntry(normalizeWord(seedWord.word), userIds[seedWord.registeredBy]);
    const definitions = Array.isArray(entry.definitions) ? `${entry.definitions.length}개` : "null (상세 조회 시 재조회)";

    let commentCount = 0;
    const voteCounts: number[] = [];
    for (const story of seedWord.stories) {
      const row = await prisma.story.create({
        data: { content: story.content, wordEntryId: entry.id, userId: userIds[story.by] },
        select: { id: true },
      });
      await addVotes(row.id, story.votes.map((index) => userIds[index]));
      commentCount += await addComments(row.id, story.comments ?? [], userIds, null);
      voteCounts.push(story.votes.length);
    }

    console.log(
      `${entry.word.padEnd(16)} ${created ? "새로 등록" : "기존 단어 재사용"} · 뜻 ${definitions} · ` +
        `story ${seedWord.stories.length}개(추천 ${voteCounts.join("/")}) · 댓글 ${commentCount}개`
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
