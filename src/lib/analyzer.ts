/**
 * 문장 분석기 — 붙여넣은 영어 글에서 사전에 등록된 단어·숙어를 찾는다.
 *
 * 이 파일은 DB를 모르는 순수 함수만 둔다 (단위 테스트: analyzer.test.ts).
 * 등록된 단어 목록으로 색인을 만들어 캐시하는 일은 phraseIndex.ts가 한다.
 *
 * 규칙
 *   - 대소문자와 굽은 따옴표(’)는 구분하지 않는다. 결과의 start/end는 원문 기준 위치(JS 문자열 인덱스)다.
 *   - 활용형을 같은 표현으로 본다: -s/-es/-ies, -ed/-ied, -ing(e 탈락·자음 겹침 포함), 자주 쓰는 불규칙 동사.
 *     (kicked the bucket → kick the bucket, broke the ice → break the ice)
 *   - 숙어 속 자리 표시를 맞춘다: one's·someone's ↔ my/your/his/her/its/our/their/○○'s,
 *     oneself ↔ myself 등, someone·something ↔ 아무 단어 하나.
 *   - 숙어의 단어 사이에는 공백이나 하이픈만 올 수 있다 (쉼표·마침표를 건너 맞추지 않는다).
 *   - 표현이 겹치면 단어 수가 더 많은 숙어를 남긴다 (break the ice 안의 ice는 따로 잡지 않음).
 */

export type PhraseEntry = { id: string; word: string };

export type PhraseMatch = {
  entryId: string;
  /** 사전 표제어 (예: "kick the bucket") */
  word: string;
  /** 원문에 실제로 쓰인 형태 (예: "Kicked the Bucket") */
  matchedText: string;
  start: number;
  end: number;
};

type Token = { norm: string; start: number; end: number };

type IndexedEntry = {
  id: string;
  word: string;
  /** 표제어의 토큰마다 같은 단어로 볼 형태들 (원형·활용형 후보) */
  patterns: Pattern[];
};

type Pattern =
  | { kind: "word"; forms: Set<string> }
  | { kind: "possessive" } // one's, someone's
  | { kind: "reflexive" } // oneself
  | { kind: "any" }; // someone, something

export type PhraseIndex = {
  /** 첫 토큰의 형태 → 그 형태로 시작할 수 있는 표제어들 */
  byFirstForm: Map<string, IndexedEntry[]>;
  /** 첫 토큰이 자리 표시인 표제어 (모든 위치에서 확인한다) */
  placeholderFirst: IndexedEntry[];
  size: number;
};

// 글자 + 단어 안의 아포스트로피 (don't, John's, one's)
const TOKEN_PATTERN = /\p{L}+(?:['’]\p{L}+)*/gu;
// 숙어의 단어 사이에 올 수 있는 것: 공백·하이픈만 (wild-goose chase = wild goose chase)
const JOINABLE_GAP = /^[\s-]+$/;

const POSSESSIVE_PLACEHOLDERS = new Set(["one's", "someone's", "somebody's"]);
const POSSESSIVE_DETERMINERS = new Set(["my", "your", "his", "her", "its", "our", "their", "one's"]);
const REFLEXIVE_PLACEHOLDERS = new Set(["oneself"]);
const REFLEXIVES = new Set([
  "myself",
  "yourself",
  "himself",
  "herself",
  "itself",
  "ourselves",
  "yourselves",
  "themselves",
  "oneself",
]);
const ANY_PLACEHOLDERS = new Set(["someone", "somebody", "something"]);

/** 불규칙 동사 — 원형: 과거형·과거분사 (숙어에 자주 나오는 동사 위주) */
const IRREGULAR_VERBS: Record<string, string[]> = {
  be: ["was", "were", "been", "is", "are", "am"],
  bear: ["bore", "borne"],
  beat: ["beaten"],
  become: ["became"],
  begin: ["began", "begun"],
  bend: ["bent"],
  bite: ["bit", "bitten"],
  blow: ["blew", "blown"],
  break: ["broke", "broken"],
  bring: ["brought"],
  build: ["built"],
  burn: ["burnt"],
  buy: ["bought"],
  catch: ["caught"],
  choose: ["chose", "chosen"],
  come: ["came"],
  cut: [],
  deal: ["dealt"],
  dig: ["dug"],
  do: ["did", "done", "does"],
  draw: ["drew", "drawn"],
  drink: ["drank", "drunk"],
  drive: ["drove", "driven"],
  eat: ["ate", "eaten"],
  fall: ["fell", "fallen"],
  feel: ["felt"],
  fight: ["fought"],
  find: ["found"],
  fly: ["flew", "flown"],
  forget: ["forgot", "forgotten"],
  get: ["got", "gotten"],
  give: ["gave", "given"],
  go: ["went", "gone", "goes"],
  grow: ["grew", "grown"],
  hang: ["hung"],
  have: ["had", "has"],
  hear: ["heard"],
  hide: ["hid", "hidden"],
  hit: [],
  hold: ["held"],
  keep: ["kept"],
  know: ["knew", "known"],
  lay: ["laid"],
  lead: ["led"],
  leave: ["left"],
  lend: ["lent"],
  let: [],
  lie: ["lay", "lain"],
  lose: ["lost"],
  make: ["made"],
  mean: ["meant"],
  meet: ["met"],
  pay: ["paid"],
  put: [],
  ride: ["rode", "ridden"],
  ring: ["rang", "rung"],
  rise: ["rose", "risen"],
  run: ["ran"],
  say: ["said"],
  see: ["saw", "seen"],
  sell: ["sold"],
  send: ["sent"],
  set: [],
  shake: ["shook", "shaken"],
  shoot: ["shot"],
  sing: ["sang", "sung"],
  sink: ["sank", "sunk"],
  sit: ["sat"],
  sleep: ["slept"],
  speak: ["spoke", "spoken"],
  spend: ["spent"],
  spill: ["spilt"],
  stand: ["stood"],
  steal: ["stole", "stolen"],
  stick: ["stuck"],
  strike: ["struck"],
  swim: ["swam", "swum"],
  take: ["took", "taken"],
  teach: ["taught"],
  tear: ["tore", "torn"],
  tell: ["told"],
  think: ["thought"],
  throw: ["threw", "thrown"],
  understand: ["understood"],
  wake: ["woke", "woken"],
  wear: ["wore", "worn"],
  win: ["won"],
  write: ["wrote", "written"],
};

/** 활용형 → 원형들 (lay처럼 두 동사에 걸치는 형태가 있어서 배열) */
const IRREGULAR_BASES = new Map<string, string[]>();
for (const [base, forms] of Object.entries(IRREGULAR_VERBS)) {
  for (const form of forms) IRREGULAR_BASES.set(form, [...(IRREGULAR_BASES.get(form) ?? []), base]);
}

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/’/g, "'");
}

/** 원문을 단어 토큰으로 나눈다 (위치는 원문 기준) */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index;
    tokens.push({ norm: normalizeToken(match[0]), start, end: start + match[0].length });
  }
  return tokens;
}

/**
 * 한 단어가 될 수 있는 원형 후보를 모두 돌려준다 (자기 자신 포함).
 * 엄밀한 형태소 분석이 아니라, 사전 표제어와 맞춰 보기 위한 넉넉한 후보 목록이다.
 * 후보가 틀려도 표제어와 일치하지 않으면 아무 일도 일어나지 않으므로, 넓게 잡는 쪽을 택했다.
 */
export function lemmaCandidates(token: string): Set<string> {
  const word = normalizeToken(token);
  const forms = new Set<string>([word]);
  const add = (form: string) => {
    if (form.length >= 2) forms.add(form);
  };
  // stopped → stop, running → run (자음이 겹친 경우 하나를 뗀다)
  const undouble = (stem: string) => {
    const last = stem.at(-1);
    if (stem.length >= 3 && last !== undefined && last === stem.at(-2) && !VOWELS.has(last)) add(stem.slice(0, -1));
  };

  for (const base of IRREGULAR_BASES.get(word) ?? []) add(base);

  // 복수형·3인칭 단수: spies → spy, watches → watch, beans → bean
  if (word.endsWith("ies") && word.length > 4) add(`${word.slice(0, -3)}y`);
  if (/(?:ch|sh|s|x|z|o)es$/.test(word) && word.length > 3) add(word.slice(0, -2));
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 2) add(word.slice(0, -1));

  // 과거형: tried → try, kicked → kick, baked → bake, stopped → stop
  if (word.endsWith("ied") && word.length > 4) add(`${word.slice(0, -3)}y`);
  if (word.endsWith("ed") && word.length > 3) {
    const stem = word.slice(0, -2);
    add(stem);
    add(word.slice(0, -1));
    undouble(stem);
  }

  // 진행형: kicking → kick, making → make, running → run, lying → lie
  if (word.endsWith("ing") && word.length > 4) {
    const stem = word.slice(0, -3);
    add(stem);
    add(`${stem}e`);
    undouble(stem);
    if (stem.endsWith("y")) add(`${stem.slice(0, -1)}ie`);
  }

  // 축약 없는 소유격: John's → john (one's 자리 표시와는 별개로, 일반 단어 비교용)
  if (word.endsWith("'s") && word.length > 3) add(word.slice(0, -2));

  return forms;
}

/** 표제어 토큰 하나를 비교 규칙으로 바꾼다 */
function toPattern(token: string): Pattern {
  if (POSSESSIVE_PLACEHOLDERS.has(token)) return { kind: "possessive" };
  if (REFLEXIVE_PLACEHOLDERS.has(token)) return { kind: "reflexive" };
  if (ANY_PLACEHOLDERS.has(token)) return { kind: "any" };
  return { kind: "word", forms: lemmaCandidates(token) };
}

function matchesPattern(pattern: Pattern, token: Token): boolean {
  switch (pattern.kind) {
    case "possessive":
      return POSSESSIVE_DETERMINERS.has(token.norm) || (token.norm.endsWith("'s") && token.norm.length > 2);
    case "reflexive":
      return REFLEXIVES.has(token.norm);
    case "any":
      return true;
    case "word": {
      // 표제어 쪽 후보와 원문 쪽 후보가 하나라도 겹치면 같은 단어로 본다
      // (spilled ↔ spilt: 둘 다 spill로 모임)
      for (const form of lemmaCandidates(token.norm)) {
        if (pattern.forms.has(form)) return true;
      }
      return false;
    }
  }
}

/** 등록된 단어 목록으로 색인을 만든다. 표제어에서 토큰을 하나도 못 뽑으면 건너뛴다 */
export function buildPhraseIndex(entries: PhraseEntry[]): PhraseIndex {
  const byFirstForm = new Map<string, IndexedEntry[]>();
  const placeholderFirst: IndexedEntry[] = [];
  let size = 0;

  for (const { id, word } of entries) {
    const tokens = tokenize(word).map((token) => token.norm);
    if (tokens.length === 0) continue;
    const patterns = tokens.map(toPattern);
    const entry: IndexedEntry = { id, word, patterns };
    size += 1;

    const first = patterns[0];
    if (first.kind !== "word") {
      placeholderFirst.push(entry);
      continue;
    }
    for (const form of first.forms) {
      const list = byFirstForm.get(form);
      if (list) list.push(entry);
      else byFirstForm.set(form, [entry]);
    }
  }
  return { byFirstForm, placeholderFirst, size };
}

/** tokens[from]부터 표제어가 이어지는지 확인하고, 맞으면 마지막 토큰 위치를 돌려준다 */
function matchAt(entry: IndexedEntry, tokens: Token[], from: number, text: string): number | null {
  const last = from + entry.patterns.length - 1;
  if (last >= tokens.length) return null;
  for (let k = 0; k < entry.patterns.length; k += 1) {
    const token = tokens[from + k];
    if (k > 0 && !JOINABLE_GAP.test(text.slice(tokens[from + k - 1].end, token.start))) return null;
    if (!matchesPattern(entry.patterns[k], token)) return null;
  }
  return last;
}

/** 원문에서 등록된 표현을 찾는다. 결과는 원문 순서이고 서로 겹치지 않는다 */
export function findPhrases(text: string, index: PhraseIndex): PhraseMatch[] {
  const tokens = tokenize(text);
  const candidates: { entry: IndexedEntry; from: number; to: number }[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const pool = new Set<IndexedEntry>(index.placeholderFirst);
    for (const form of lemmaCandidates(tokens[i].norm)) {
      for (const entry of index.byFirstForm.get(form) ?? []) pool.add(entry);
    }
    for (const entry of pool) {
      const to = matchAt(entry, tokens, i, text);
      if (to !== null) candidates.push({ entry, from: i, to });
    }
  }

  // 겹치면 긴 숙어 우선: 단어 수 → 글자 수 → 앞에 나온 것 순으로 고르고, 이미 쓰인 토큰과 겹치면 버린다
  const span = (c: (typeof candidates)[number]) => tokens[c.to].end - tokens[c.from].start;
  candidates.sort((a, b) => b.to - b.from - (a.to - a.from) || span(b) - span(a) || a.from - b.from);
  const used = new Array<boolean>(tokens.length).fill(false);
  const chosen: typeof candidates = [];
  for (const candidate of candidates) {
    let free = true;
    for (let j = candidate.from; j <= candidate.to; j += 1) if (used[j]) free = false;
    if (!free) continue;
    for (let j = candidate.from; j <= candidate.to; j += 1) used[j] = true;
    chosen.push(candidate);
  }

  return chosen
    .sort((a, b) => a.from - b.from)
    .map(({ entry, from, to }) => {
      const start = tokens[from].start;
      const end = tokens[to].end;
      return { entryId: entry.id, word: entry.word, matchedText: text.slice(start, end), start, end };
    });
}

const SENTENCE_END = /[.!?\n]/;

/**
 * 원문의 [start, end) 표현이 들어 있는 문장을 잘라낸다 (단어 상세의 "내 노트 속 용례"용).
 * 문장이 maxLength보다 길면 표현을 가운데 두고 자르고 앞뒤에 "…"를 붙인다.
 * 돌려주는 start/end는 잘라낸 문장 기준 위치다.
 */
export function extractSentence(
  text: string,
  start: number,
  end: number,
  maxLength = 240
): { sentence: string; start: number; end: number } {
  let from = start;
  while (from > 0 && !SENTENCE_END.test(text[from - 1])) from -= 1;
  let to = end;
  while (to < text.length && !SENTENCE_END.test(text[to])) to += 1;
  if (to < text.length && text[to] !== "\n") to += 1; // 마침표·물음표·느낌표까지 포함

  while (from < start && /\s/.test(text[from])) from += 1;
  while (to > end && /\s/.test(text[to - 1])) to -= 1;

  let prefix = "";
  let suffix = "";
  if (to - from > maxLength) {
    const room = Math.max(0, maxLength - (end - start));
    const newFrom = Math.max(from, start - Math.floor(room / 2));
    const newTo = Math.min(to, newFrom + Math.max(maxLength, end - newFrom));
    if (newFrom > from) prefix = "…";
    if (newTo < to) suffix = "…";
    from = newFrom;
    to = newTo;
  }

  return {
    sentence: prefix + text.slice(from, to) + suffix,
    start: prefix.length + start - from,
    end: prefix.length + end - from,
  };
}
