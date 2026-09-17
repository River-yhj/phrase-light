const DICTIONARY_API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";

// 사전 조회는 단어 등록의 부가 정보일 뿐이므로, 오래 걸리면 기다리지 않고 meaning 없이 등록한다
const TIMEOUT_MS = 5000;

/**
 * dictionaryapi.dev 응답에서 첫 번째 정의를 꺼낸다.
 * 응답 형태: [{ meanings: [{ partOfSpeech, definitions: [{ definition }] }] }]
 */
function extractFirstDefinition(data: unknown): string | null {
  if (!Array.isArray(data)) return null;

  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const meanings = (entry as { meanings?: unknown }).meanings;
    if (!Array.isArray(meanings)) continue;

    for (const meaning of meanings) {
      if (typeof meaning !== "object" || meaning === null) continue;
      const definitions = (meaning as { definitions?: unknown }).definitions;
      if (!Array.isArray(definitions)) continue;

      for (const item of definitions) {
        if (typeof item !== "object" || item === null) continue;
        const definition = (item as { definition?: unknown }).definition;
        if (typeof definition === "string" && definition.trim()) return definition.trim();
      }
    }
  }
  return null;
}

/**
 * 영어 사전에서 단어 뜻을 조회한다.
 * 404(사전에 없음)·타임아웃·네트워크 오류 등 어떤 실패든 예외를 던지지 않고 null을 돌려준다.
 */
export async function fetchMeaning(word: string): Promise<string | null> {
  try {
    const response = await fetch(DICTIONARY_API_BASE + encodeURIComponent(word), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      console.warn(`[dictionary] "${word}" 조회 실패: HTTP ${response.status}`);
      return null;
    }
    return extractFirstDefinition(await response.json());
  } catch (error) {
    console.warn(`[dictionary] "${word}" 조회 실패:`, error instanceof Error ? error.message : error);
    return null;
  }
}
