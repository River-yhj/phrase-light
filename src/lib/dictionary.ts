/**
 * 사전 조회 — 외부 사전 API 호출·파싱은 이 파일 한 곳에 모은다.
 *
 * 소스: Wiktionary REST API (en.wiktionary.org)
 *   - 2026-09 dictionaryapi.dev가 3주 넘게 응답하지 않아 교체했다.
 *   - Wiktionary 콘텐츠는 CC BY-SA 라이선스라, 화면에 뜻을 보여줄 때 출처 표시가 필요하다.
 */

const WIKTIONARY_DEFINITION_API = "https://en.wiktionary.org/api/rest_v1/page/definition/";

// Wikimedia API 정책상 앱 이름과 연락처를 담은 User-Agent를 보내야 한다
const USER_AGENT = "MuthoRoot/0.1 (https://github.com/River-yhj/mutho-root)";

// 사전 조회는 단어 등록의 부가 정보일 뿐이므로, 오래 걸리면 기다리지 않고 meaning 없이 진행한다
const TIMEOUT_MS = 5000;

// meaning이 null인 단어를 상세 조회 때 다시 채울 때, 같은 단어로 외부 API를 반복 호출하지 않기 위한 간격
const RETRY_COOLDOWN_MS = 10 * 60 * 1000;

/** "kick the bucket" → "kick_the_bucket" (Wiktionary 문서 제목 규칙) → URL 인코딩 */
function toWiktionarySlug(word: string): string {
  return encodeURIComponent(word.replace(/ /g, "_"));
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** definition에 섞인 HTML 태그를 지우고 엔티티를 풀어 평문으로 만든다 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] === "#") {
        const point = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Wiktionary 응답의 "en" 배열에서 첫 품사의 첫 정의를 평문으로 꺼낸다.
 * 응답 형태: { en: [{ partOfSpeech, language, definitions: [{ definition: "<html>" }] }], fr: [...] }
 * 태그를 지우고 나니 빈 문자열인 정의는 건너뛰고 그다음 정의를 쓴다.
 */
export function extractFirstEnglishDefinition(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const entries = (data as { en?: unknown }).en;
  if (!Array.isArray(entries)) return null;

  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const definitions = (entry as { definitions?: unknown }).definitions;
    if (!Array.isArray(definitions)) continue;

    for (const item of definitions) {
      if (typeof item !== "object" || item === null) continue;
      const definition = (item as { definition?: unknown }).definition;
      if (typeof definition !== "string") continue;
      const text = htmlToPlainText(definition);
      if (text) return text;
    }
  }
  return null;
}

/**
 * 영어 단어·숙어의 뜻을 조회한다.
 * 404(사전에 없음)·타임아웃·네트워크 오류 등 어떤 실패든 예외를 던지지 않고 null을 돌려준다.
 */
export async function fetchMeaning(word: string): Promise<string | null> {
  try {
    const response = await fetch(WIKTIONARY_DEFINITION_API + toWiktionarySlug(word), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      console.warn(`[dictionary] "${word}" 조회 실패: HTTP ${response.status}`);
      return null;
    }
    return extractFirstEnglishDefinition(await response.json());
  } catch (error) {
    console.warn(`[dictionary] "${word}" 조회 실패:`, error instanceof Error ? error.message : error);
    return null;
  }
}

const lastRetryAt = new Map<string, number>();

/**
 * meaning이 null로 저장된 단어를 다시 조회한다 (단어 상세 조회 시 사용).
 * 사전에 없는 단어를 볼 때마다 외부 API를 기다리지 않도록, 같은 단어는
 * RETRY_COOLDOWN_MS 동안 한 번만 실제로 요청하고 그 사이에는 바로 null을 돌려준다.
 */
export async function retryFetchMeaning(word: string): Promise<string | null> {
  const last = lastRetryAt.get(word);
  if (last !== undefined && Date.now() - last < RETRY_COOLDOWN_MS) return null;

  lastRetryAt.set(word, Date.now());
  const meaning = await fetchMeaning(word);
  if (meaning) lastRetryAt.delete(word);
  return meaning;
}
